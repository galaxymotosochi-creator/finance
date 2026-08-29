const express = require('express');
const cors = require('cors');
const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { AsyncLocalStorage } = require('async_hooks');
const { sendMessage, handleMessage } = require('./telegram');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'atlaspos-jwt-secret-2026';

// Parse int8/bigint as numbers (otherwise pg returns strings)
types.setTypeParser(20, parseInt);

// Настройка почты для отправки писем
const mailer = nodemailer.createTransport({
  host: 'smtp.mail.ru',
  port: 465,
  secure: true,
  auth: {
    user: 'atlaspos@mail.ru',
    pass: 'TlZHlj2zX8kOAzcn15oa',
  },
});

const pool = new Pool({
  user: 'atlaspos',
  password: 'atlaspos_2026_secret',
  host: 'localhost',
  port: 5432,
  database: 'atlaspos',
});

const rlsStorage = new AsyncLocalStorage();

// RLS контекст — запоминаем user_id для каждого запроса
app.use((req, res, next) => {
  rlsStorage.run({ userId: req.user?.id }, () => next());
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.get('/api/health', (req, res) => { res.json({ status: 'ok', time: new Date().toISOString() }); });

// Отправка письма
async function sendMail(to, subject, html) {
  try {
    await mailer.sendMail({ from: 'AtlasPos <atlaspos@mail.ru>', to, subject, html });
    return true;
  } catch (e) {
    console.error('Mail error:', e.message);
    return false;
  }
}

// Обёртка: SET + основной запрос на одном соединении (multi-statement)
async function q(text, params) {
  const store = rlsStorage.getStore();
  const userId = store?.userId;
  if (userId) {
    // Сдвигаем индексы параметров ($1 → $2, $2 → $3 и т.д.)
    const shifted = text.replace(/\$(\d+)/g, (_, n) => '$' + (parseInt(n) + 1));
    const sql = "SELECT set_config('app.current_user_id', $1, true);\n" + shifted;
    return pool.query(sql, [userId, ...(params || [])]);
  }
  return pool.query(text, params);
}

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.user_id]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
};

// ===== AUTH =====

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(400).json({ error: 'Неверный email или пароль' });
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Неверный email или пароль' });
    const token = jwt.sign({ user_id: rows[0].id, role: 'atlaspos' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await pool.query('INSERT INTO users (id, email, password_hash, name, created_at) VALUES ($1, $2, $3, $4, NOW())', [id, email, hash, name || '']);
    const token = jwt.sign({ user_id: id, role: 'atlaspos' }, JWT_SECRET, { expiresIn: '7d' });
    // Отправляем письмо с подтверждением
    sendMail(email, 'Добро пожаловать в AtlasPos!',
      '<p>Здравствуйте' + (name ? ', ' + name : '') + '!</p>'
      + '<p>Вы успешно зарегистрировались в <b>AtlasPos</b>.</p>'
      + '<p>Ваш email: <b>' + email + '</b></p>'
      + '<p>Войти можно по ссылке: <a href="https://atlaspos.ru/login">atlaspos.ru/login</a></p>'
    );
    res.json({ token, user: { id, email, name: name || '' } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Восстановление пароля — отправка письма
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.json({ ok: true }); // не говорим, есть пользователь или нет
    // Создаём токен на 1 час
    const token = jwt.sign({ user_id: rows[0].id, purpose: 'reset' }, JWT_SECRET, { expiresIn: '1h' });
    const link = 'https://atlaspos.ru/reset-password?token=' + token;
    await sendMail(email, 'Восстановление пароля AtlasPos',
      '<p>Вы запросили восстановление пароля.</p>'
      + '<p>Нажмите на ссылку, чтобы задать новый пароль:</p>'
      + '<p><a href="' + link + '">' + link + '</a></p>'
      + '<p>Ссылка действует 1 час.</p>'
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Вход через Яндекс
const YANDEX_CLIENT_ID = 'a61e2a767f724e368cbcab159c66a941';
const YANDEX_SECRET = '6f5dc8d0cc4b4db6ac51cf9efaad24c9';

app.post('/api/auth/yandex/login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code' });

    // Обмениваем code на токен
    const tokenRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: YANDEX_CLIENT_ID,
        client_secret: YANDEX_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).json({ error: 'Token exchange failed' });

    // Получаем email пользователя
    const userRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token },
    });
    const userData = await userRes.json();
    const email = userData.default_email;
    if (!email) return res.status(400).json({ error: 'Email not provided' });

    // Ищем или создаём пользователя
    let { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;
    const name = userData.real_name || userData.display_name || email.split('@')[0];
    if (!rows.length) {
      const id = uuidv4();
      await pool.query('INSERT INTO users (id, email, password_hash, name, created_at) VALUES ($1, $2, \'\', $3, NOW())',
        [id, email, name]);
      user = { id, email, name };
    } else {
      user = { id: rows[0].id, email: rows[0].email, name: rows[0].name };
    }

    const token = jwt.sign({ user_id: user.id, role: 'atlaspos' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Приглашение сотрудника (создание учётной записи)
app.post('/api/invite-user', auth, async (req, res) => {
  try {
    const { email, employeeId, employeeName } = req.body;
    if (!email || !employeeId) {
      return res.status(400).json({ error: 'Email и employeeId обязательны' });
    }

    // Проверяем, что сотрудник принадлежит текущему пользователю
    const empCheck = await pool.query(
      'SELECT id, name FROM employees WHERE id = $1 AND user_id = $2',
      [employeeId, req.user.id]
    );
    if (!empCheck.rows.length) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }

    // Проверяем, нет ли уже пользователя с таким email
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length) {
      return res.status(400).json({ error: 'Пользователь с таким email уже зарегистрирован' });
    }

    // Генерируем временный пароль
    const tempPassword = Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 1000);
    const hash = await bcrypt.hash(tempPassword, 10);
    const id = uuidv4();

    // Создаём пользователя
    const empName = employeeName || empCheck.rows[0].name || email.split('@')[0];
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, created_at, employee_id) VALUES ($1, $2, $3, $4, NOW(), $5)',
      [id, email, hash, empName, employeeId]
    );

    // Обновляем запись сотрудника
    await pool.query(
      'UPDATE employees SET email = $1, status = $2 WHERE id = $3',
      [email, 'invited', employeeId]
    );

    // Отправляем письмо с приглашением
    const appUrl = process.env.APP_URL || 'https://atlaspos.ru';
    const html = [
      '<p>Здравствуйте, <b>' + empName + '</b>!</p>',
      '<p>Вам предоставлен доступ к системе учёта <b>AtlasPos</b>.</p>',
      '<hr style="border:none;border-top:1px solid #eee;margin:16px 0">',
      '<p><b>Данные для входа:</b></p>',
      '<p>Сайт: <a href="' + appUrl + '/login">' + appUrl + '/login</a></p>',
      '<p>Email: <b>' + email + '</b></p>',
      '<p>Пароль: <b>' + tempPassword + '</b></p>',
      '<hr style="border:none;border-top:1px solid #eee;margin:16px 0">',
      '<p style="color:#999;font-size:12px">Настоятельно рекомендуем сменить пароль после первого входа.</p>',
    ].join('');

    const sent = await sendMail(email, 'Доступ к AtlasPos', html);
    if (!sent) {
      console.error('Failed to send invite email to ' + email);
    }

    res.json({
      message: 'Приглашение отправлено на ' + email,
      user_id: id,
      temp_password: tempPassword,
      email_sent: sent,
    });
  } catch (e) {
    console.error('Invite error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// AI-чат (заглушка, без внешнего AI, пока нет API ключа)
app.post('/api/ai/chat', auth, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'No message' });

    // Простые ответы без AI
    const msg = message.toLowerCase();
    let reply = '';
    let action = null;
    let params = {};

    if (msg.includes('приход') || msg.includes('доход') || msg.includes('добав') && msg.includes('доход')) {
      const nums = message.match(/\d[\d\s]*/g);
      const amount = nums ? parseInt(nums[0].replace(/\s/g,'')) : 0;
      const desc = message.replace(/доход|приход|добавь|добавить|новый/gi,'').replace(/\d+[\d\s]*/g,'').trim();
      if (amount > 0) {
        action = 'ADD_INCOME';
        params = { amount, description: desc || 'Доход', date: new Date().toISOString().split('T')[0] };
        reply = '✅ Добавляю доход ' + amount.toLocaleString() + ' ₽' + (desc ? ': ' + desc : '');
      } else {
        reply = 'Укажите сумму дохода (например: добавь доход 5000)';
      }
    } else if (msg.includes('расход') || msg.includes('трата') || msg.includes('добав') && msg.includes('расход')) {
      const nums = message.match(/\d[\d\s]*/g);
      const amount = nums ? parseInt(nums[0].replace(/\s/g,'')) : 0;
      const desc = message.replace(/расход|трата|добавь|добавить|новый/gi,'').replace(/\d+[\d\s]*/g,'').trim();
      if (amount > 0) {
        action = 'ADD_EXPENSE';
        params = { amount, description: desc || 'Расход', date: new Date().toISOString().split('T')[0] };
        reply = '✅ Добавляю расход ' + amount.toLocaleString() + ' ₽' + (desc ? ': ' + desc : '');
      } else {
        reply = 'Укажите сумму расхода (например: расход 3000 на канцелярию)';
      }
    } else if (msg.includes('отчет') || msg.includes('отчёт') || msg.includes('итог') || msg.includes('сводк')) {
      action = 'GET_REPORT';
      if (msg.includes('день') || msg.includes('сегодня')) params.period = 'today';
      else if (msg.includes('недел')) params.period = 'week';
      else params.period = 'month';
      reply = '📊 Формирую отчёт за ' + ({today:'сегодня',week:'неделю',month:'месяц'}[params.period]||params.period);
    } else if (msg.includes('привет') || msg.includes('здравствуй')) {
      reply = '👋 Привет! Я AI-помощник AtlasPos. Могу помочь с учётом: добавить доход/расход, сформировать отчёт, найти товар. Что нужно сделать?';
    } else if (msg.includes('помощ') || msg.includes('что ты умеешь')) {
      reply = '🤖 Я умею:\n• Добавлять доходы (например: "добавь доход 15000 за услугу")\n• Добавлять расходы ("расход 3000 на рекламу")\n• Делать отчёты ("отчёт за месяц")\n• Искать информацию по складу и клиентам\n\nПросто напишите, что нужно сделать!';
    } else {
      reply = 'Я не совсем понял запрос. Попробуйте: "добавь доход 5000", "расход 3000", "отчёт за неделю" или "помощь"';
    }

    res.json({ reply, action, params });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  let employeePerms = null;
  if (req.user.employee_id) {
    try {
      const emp = await pool.query('SELECT permissions FROM employees WHERE id = $1', [req.user.employee_id]);
      if (emp.rows.length) employeePerms = emp.rows[0].permissions;
    } catch (e) { console.error('Failed to load employee permissions:', e.message); }
  }
  res.json({
    user: { id: req.user.id, email: req.user.email, name: req.user.name, employee_id: req.user.employee_id },
    permissions: employeePerms,
  });
});

// ===== GENERIC TABLE CRUD =====

const ALLOWED_TABLES = ['products','categories','accounts','transactions','receipts','receipt_items',
  'shifts','supplies','writeoffs','inventory','suppliers','employees','positions','position_templates',
  'timesheet','timesheet_entries','clients','loyalty','loyalties','promos','subscriptions',
  'user_profiles','users','salary','stock_categories','plans','deductions','bonuses','combo_items','initial_stocks'];

// --- Схема БД: кеш колонок и типов (чтобы корректно приводить типы фильтров) ---
const tableColumnsCache = new Map();
const columnTypeCache = new Map();

async function getTableColumns(table) {
  if (tableColumnsCache.has(table)) return tableColumnsCache.get(table);
  const { rows } = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [table]);
  const cols = new Set(rows.map(r => r.column_name));
  tableColumnsCache.set(table, cols);
  return cols;
}

// Возвращает SQL-каст для параметра фильтра по фактическому типу колонки
async function castForColumn(table, col) {
  const cacheKey = table + '.' + col;
  if (columnTypeCache.has(cacheKey)) return columnTypeCache.get(cacheKey);
  let cast = '';
  try {
    const { rows } = await pool.query('SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2', [table, col]);
    const t = rows[0] && rows[0].data_type;
    if (t) {
      if (t.indexOf('timestamp') >= 0) cast = '::timestamptz';
      else if (t.indexOf('int') >= 0 || t.indexOf('numeric') >= 0 || t.indexOf('double') >= 0 || t.indexOf('real') >= 0 || t.indexOf('bigint') >= 0) cast = '::numeric';
    }
  } catch (e) { /* если таблицы нет — без каста */ }
  columnTypeCache.set(cacheKey, cast);
  return cast;
}

app.get('/api/:table', auth, async (req, res) => {
  try {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    let sql = 'SELECT * FROM ' + table + ' WHERE 1=1';
    const params = [];
    var paramIdx = 1;
    // Парсим PostgREST-style параметры: col=op.val (например status=eq.open)
    const ops = ['neq','gte','lte','gt','lt','like','ilike','is','in','not','eq'];
    for (const [col, valRaw] of Object.entries(req.query)) {
      if (col === 'order' || col === 'limit' || col === 'select') continue;
      // Повторные параметры (date=gte.x&date=lte.y) Express собирает в массив
      const vals = Array.isArray(valRaw) ? valRaw : [valRaw];
      for (const val of vals) {
        if (typeof val !== 'string') continue;
        const dotIdx = val.indexOf('.');
        if (dotIdx > 0) {
          const op = val.slice(0, dotIdx);
          const v = val.slice(dotIdx + 1);
          if (ops.includes(op)) {
            if (col === 'user_id') continue; // user_id берём из токена
            const cleanCol = col.replace(/[^a-z_]/gi, '');
            const cast = await castForColumn(table, cleanCol);
            if (op === 'eq') { sql += ' AND ' + cleanCol + ' = $' + paramIdx + cast; params.push(v); paramIdx++; }
            else if (op === 'neq') { sql += ' AND ' + cleanCol + ' != $' + paramIdx + cast; params.push(v); paramIdx++; }
            else if (op === 'gt') { sql += ' AND ' + cleanCol + ' > $' + paramIdx + cast; params.push(v); paramIdx++; }
            else if (op === 'gte') { sql += ' AND ' + cleanCol + ' >= $' + paramIdx + cast; params.push(v); paramIdx++; }
            else if (op === 'lt') { sql += ' AND ' + cleanCol + ' < $' + paramIdx + cast; params.push(v); paramIdx++; }
            else if (op === 'lte') { sql += ' AND ' + cleanCol + ' <= $' + paramIdx + cast; params.push(v); paramIdx++; }
            else if (op === 'like' || op === 'ilike') { sql += ' AND ' + cleanCol + ' ' + op + ' $' + paramIdx; params.push(v); paramIdx++; }
            else if (op === 'is') {
              // is НЕ добавляет параметр — paramIdx не сдвигаем (фикс "could not determine data type")
              if (v === 'null') sql += ' AND ' + cleanCol + ' IS NULL';
              else if (v === 'not.null') sql += ' AND ' + cleanCol + ' IS NOT NULL';
            }
            continue;
          }
        }
        // Если не PostgREST — добавляем как прямой фильтр (col=val)
        const cleanCol = col.replace(/[^a-z_]/gi, '');
        if (cleanCol !== 'user_id') {
          const cast = await castForColumn(table, cleanCol);
          sql += ' AND ' + cleanCol + ' = $' + paramIdx + cast;
          params.push(val);
          paramIdx++;
        }
      }
    }
    // Фильтр по user_id из токена — только если колонка есть (иначе 500 для receipt_items/users)
    const cols = await getTableColumns(table);
    if (cols.has('user_id')) {
      sql += ' AND user_id = $' + paramIdx;
      params.push(req.user.id);
      paramIdx++;
    }
    const { order, limit } = req.query;
    if (order) {
      const col = order.split('.')[0];
      const dir = order.includes('desc') ? 'DESC' : 'ASC';
      sql += ' ORDER BY ' + col + ' ' + dir;
    } else {
      sql += ' ORDER BY created_at DESC';
    }
    if (limit) {
      sql += ' LIMIT ' + parseInt(limit);
    }
    const { rows } = await q(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/:table', auth, async (req, res) => {
  try {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const body = Array.isArray(req.body) ? req.body[0] : req.body;
    const cols = await getTableColumns(table);

    // Атомарная нумерация чеков: игнорируем переданный receipt_number, берём MAX+1 на сервере
    // (чинит дубли: раньше QuickSale считал count+1, касса max+1, плюс гонки)
    if (table === 'receipts') {
      const keys = Object.keys(body).filter(k => body[k] !== undefined && k !== 'receipt_number');
      if (!keys.includes('user_id') && cols.has('user_id')) { keys.push('user_id'); body.user_id = req.user.id; }
      if (!keys.includes('id')) { keys.unshift('id'); body.id = Date.now(); }
      // created_at по умолчанию — иначе записи без даты теряются из отчётов/сортировок
      if (!keys.includes('created_at') && cols.has('created_at')) { keys.push('created_at'); body.created_at = new Date().toISOString(); }
      const uidIdx = keys.indexOf('user_id') + 1;
      const vals = keys.map(k => Array.isArray(body[k]) && typeof body[k][0] === 'object' ? JSON.stringify(body[k]) : body[k]);
      const ph = keys.map((_, i) => '$' + (i + 1)).join(', ');
      const sql = 'INSERT INTO receipts (' + keys.join(', ') + ', receipt_number) VALUES (' + ph +
        ', (SELECT COALESCE(MAX(receipt_number),0)+1 FROM receipts WHERE user_id = $' + uidIdx + ')) RETURNING *';
      const { rows } = await q(sql, vals);
      return res.json(rows[0] || rows);
    }

    const keys = Object.keys(body).filter(k => body[k] !== undefined);
    if (!keys.includes('user_id') && cols.has('user_id')) { keys.push('user_id'); body.user_id = req.user.id; }
    if (!keys.includes('id')) { keys.unshift('id'); body.id = Date.now(); }
    // created_at по умолчанию — иначе записи без даты теряются из отчётов/сортировок
    if (!keys.includes('created_at') && cols.has('created_at')) { keys.push('created_at'); body.created_at = new Date().toISOString(); }
    const vals = keys.map(k => Array.isArray(body[k]) && typeof body[k][0] === 'object' ? JSON.stringify(body[k]) : body[k]);
    const ph = keys.map((_, i) => '$' + (i + 1)).join(', ');
    const { rows } = await q('INSERT INTO ' + table + ' (' + keys.join(', ') + ') VALUES (' + ph + ') RETURNING *', vals);
    res.json(rows[0] || rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/:table/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const data = req.body;
    const keys = Object.keys(data).filter(k => data[k] !== undefined);
    const cols = await getTableColumns(table);
    const sc = keys.map((k, i) => k + ' = $' + (i + 1)).join(', ');
    let sql;
    let vals;
    if (cols.has('user_id')) {
      vals = [...keys.map(k => data[k]), id, req.user.id];
      sql = 'UPDATE ' + table + ' SET ' + sc + ' WHERE id = $' + (keys.length + 1) + ' AND user_id = $' + (keys.length + 2);
    } else {
      vals = [...keys.map(k => data[k]), id];
      sql = 'UPDATE ' + table + ' SET ' + sc + ' WHERE id = $' + (keys.length + 1);
    }
    const { rows } = await q(sql, vals);
    res.json(rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/:table/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const cols = await getTableColumns(table);
    if (cols.has('user_id')) {
      await q('DELETE FROM ' + table + ' WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    } else {
      await q('DELETE FROM ' + table + ' WHERE id = $1', [id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== TELEGRAM =====
// Вебхук от Telegram (входящие сообщения)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const result = handleMessage(req.body);
    if (result && result.type === 'connect' && result.code) {
      // Проверяем код подключения
      const code = result.code;
      const codeResult = await pool.query(
        "SELECT user_id FROM telegram_codes WHERE code = $1 AND expires_at > NOW()",
        [code]
      );
      if (codeResult.rows.length > 0) {
        const userId = codeResult.rows[0].user_id;
        // Сохраняем chat_id
        await pool.query(
          "INSERT INTO telegram_connections (user_id, chat_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET chat_id = $2",
          [userId, result.chatId]
        );
        // Удаляем использованный код
        await pool.query("DELETE FROM telegram_codes WHERE code = $1", [code]);
        await sendMessage(result.chatId, '✅ Вы успешно подключили уведомления AtlasPos!');
        return res.json({ ok: true });
      } else {
        await sendMessage(result.chatId, '❌ Неверный или просроченный код. Попробуйте снова в Настройках.');
        return res.json({ ok: true });
      }
    }
    if (result && result.reply) {
      await sendMessage(result.chatId, result.reply);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Telegram webhook error:', e.message);
    res.json({ ok: true });
  }
});

// Сгенерировать код для подключения
app.post('/api/telegram/connect', auth, async (req, res) => {
  try {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await pool.query(
      "INSERT INTO telegram_codes (user_id, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes') ON CONFLICT (user_id) DO UPDATE SET code = $2, expires_at = NOW() + INTERVAL '5 minutes'",
      [req.user.id, code]
    );
    res.json({ code, bot: '@AtlasPos_bot' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Проверить статус подключения
app.get('/api/telegram/status', auth, async (req, res) => {
  try {
    console.log('TG status check: user_id=' + req.user.id + ' type=' + typeof req.user.id);
    const result = await pool.query(
      'SELECT chat_id, prefs FROM telegram_connections WHERE user_id = $1',
      [String(req.user.id)]
    );
    res.json({
      connected: result.rows.length > 0,
      chatId: result.rows[0]?.chat_id || null,
      prefs: result.rows[0]?.prefs || null,
    });
  } catch (e) {
    console.error('TG status error:', e.message);
    res.json({ connected: false });
  }
});

// Отвязать Telegram
app.post('/api/telegram/disconnect', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM telegram_connections WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Сохранить настройки уведомлений
app.post('/api/telegram/prefs', auth, async (req, res) => {
  try {
    const prefs = req.body;
    await pool.query(
      'UPDATE telegram_connections SET prefs = $1 WHERE user_id = $2',
      [JSON.stringify(prefs), req.user.id]
    );
    
    // Отправляем подтверждение в Telegram
    const connResult = await pool.query(
      'SELECT chat_id FROM telegram_connections WHERE user_id = $1',
      [req.user.id]
    );
    const chatId = connResult.rows[0]?.chat_id;
    if (chatId) {
      const labelMap = {
        sale: 'Каждая продажа в кассе',
        low_stock: 'Критические остатки',
        daily: 'Ежедневный отчёт',
        big_sale: 'Крупная продажа (от 10 000 ₽)',
      };
      const enabled = Object.entries(prefs)
        .filter(([, v]) => v)
        .map(([k]) => '- ' + (labelMap[k] || k))
        .join('\n');
      const text = enabled
        ? '\u2705 \u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b!\n\u0411\u0443\u0434\u0443 \u043f\u0440\u0438\u0441\u044b\u043b\u0430\u0442\u044c:\n' + enabled
        : '\u274c \u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u044b';
      sendMessage(chatId, text);
    }
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== PHOTO UPLOAD =====
app.post('/api/upload', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = '/uploads/' + req.file.filename;
  res.json({ url });
});

app.listen(PORT, '0.0.0.0', () => { console.log('AtlasPos API running on port ' + PORT); });
