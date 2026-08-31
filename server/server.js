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
    // Подписка: пробный период 14 дней при регистрации (иначе раздел «Подписка» мёртв)
    try {
      await pool.query("INSERT INTO subscriptions (user_id, status, plan, trial_starts_at, trial_ends_at) VALUES ($1, 'trial', 'Базовый', NOW(), NOW() + INTERVAL '14 days')", [id]);
    } catch (e) { console.error('Subscription create error:', e.message); }
    // Сотрудник «Руководитель»: должность + все права доступа + личный пин (вход в кассу и подтверждение скидок)
    let adminPin = '8888';
    try {
      adminPin = String(1000 + Math.floor(Math.random() * 9000));
      const adminId = 'admin-' + Date.now();
      const allPerms = ['dashboard','registers','finance','finance.transactions','finance.accounts','finance.receipts','finance.salary','finance.shifts','finance.pnl','finance.categories','finance.plans','stock','stock.products','stock.categories','stock.turnover','stock.stock','stock.supplies','stock.inventory','stock.writeoffs','stock.suppliers','clients','clients.base','clients.loyalty','clients.promos','team','team.employees','team.positions','team.timesheet','settings','settings.general','settings.venues','settings.subscription'];
      // Должность «Руководитель» со всеми правами
      const adminPosId = Date.now();
      await pool.query('INSERT INTO position_templates (id, user_id, name, salary, bonus_type, bonus_value, permissions) VALUES ($1, $2, $3, 0, $4, 0, $5::jsonb)',
        [adminPosId, id, 'Руководитель', 'none', JSON.stringify(allPerms)]);
      // Сотрудник «Руководитель» на этой должности
      await pool.query('INSERT INTO employees (id, user_id, name, position_id, base_salary, bonus_type, bonus_value, permissions, pin, status, hire_date, created_at) VALUES ($1, $2, $3, $4, 0, $5, 0, $6::jsonb, $7, $8, NOW(), NOW())',
        [adminId, id, (name || 'Руководитель'), String(adminPosId), 'none', JSON.stringify(allPerms), adminPin, 'active']);
    } catch (e) { console.error('Admin employee create error:', e.message); }
    const token = jwt.sign({ user_id: id, role: 'atlaspos' }, JWT_SECRET, { expiresIn: '7d' });
    // Отправляем письмо с подтверждением
    sendMail(email, 'Добро пожаловать в AtlasPos!',
      '<p>Здравствуйте' + (name ? ', ' + name : '') + '!</p>'
      + '<p>Вы успешно зарегистрировались в <b>AtlasPos</b>.</p>'
      + '<p>Ваш email: <b>' + email + '</b></p>'
      + '<p>Войти можно по ссылке: <a href="https://atlaspos.ru/login">atlaspos.ru/login</a></p>'
    );
    res.json({ token, user: { id, email, name: name || '' }, adminPin });
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
  'timesheet','timesheet_entries','clients','loyalty','loyalties','loyalty_programs','promos','subscriptions',
  'user_profiles','users','salary','stock_categories','plans','deductions','bonuses','combo_items','initial_stocks','employee_debts','trash'];

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
    // Корзина: записи старше 30 дней удаляем навсегда (автоочистка)
    if (table === 'trash') {
      await pool.query('DELETE FROM trash WHERE user_id = $1 AND deleted_at < NOW() - INTERVAL \'30 days\'', [req.user.id]);
    }
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
            else if (op === 'in') {
              // col=in.(v1,v2,v3) — список через запятую (раньше оператор игнорировался и возвращались ВСЕ строки)
              const list = v.split(',').map(x => x.trim()).filter(x => x !== '');
              if (list.length > 0) {
                sql += ' AND ' + cleanCol + ' IN (' + list.map((_, i) => '$' + (paramIdx + i) + cast).join(',') + ')';
                params.push(...list);
                paramIdx += list.length;
              }
            }
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

// ===== PHOTO UPLOAD (ДОЛЖЕН быть ДО generic /api/:table — иначе перехватывается им) =====
app.post('/api/upload', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = '/uploads/' + req.file.filename;
  res.json({ url });
});

// Удаление загруженного фото (используется, когда форму закрыли без сохранения)
app.delete('/api/upload/:file', auth, async (req, res) => {
  try {
    const file = path.basename(req.params.file || ''); // защита от путей
    const full = path.join(uploadDir, file);
    if (!full.startsWith(uploadDir)) return res.status(400).json({ error: 'Invalid file' });
    if (fs.existsSync(full)) fs.unlinkSync(full);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/:table', auth, async (req, res) => {
  try {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const cols = await getTableColumns(table);
    // Поддержка batch-вставки: фронтенд шлёт массив (позиции чека, инкассация, счета)
    const items = Array.isArray(req.body) ? req.body : [req.body];
    // Защита: системные типы счетов (cash/cash_register) — только один на пользователя
    if (table === 'accounts') {
      for (const b of items) {
        if (b.type === 'cash' || b.type === 'cash_register') {
          const { rows: ex } = await pool.query('SELECT id FROM accounts WHERE user_id = $1 AND type = $2', [req.user.id, b.type]);
          if (ex.length > 0) {
            return res.status(400).json({ error: 'Счёт «' + (b.type === 'cash' ? 'Наличные' : 'Кассовый ящик') + '» уже существует — на одно заведение можно завести только один' });
          }
        }
      }
    }
    // Начальные остатки: только одна запись на пользователя — повторное сохранение заменяет старую
    // (иначе копятся дубли и загружается неизвестно какая из них)
    if (table === 'initial_stocks') {
      await pool.query('DELETE FROM initial_stocks WHERE user_id = $1', [req.user.id]);
    }
    const results = [];
    for (const body of items) {
      // Атомарная нумерация чеков: игнорируем переданный receipt_number, берём MAX+1 на сервере
      // (чинит дубли: раньше QuickSale считал count+1, касса max+1, плюс гонки)
      if (table === 'receipts') {
        const keys = Object.keys(body).filter(k => body[k] !== undefined && k !== 'receipt_number');
        // user_id всегда берём из токена — не доверяем переданному в payload
        if (cols.has('user_id')) { if (!keys.includes('user_id')) keys.push('user_id'); body.user_id = req.user.id; }
        if (!keys.includes('id')) { keys.unshift('id'); body.id = Date.now() + results.length; }
        // created_at по умолчанию — иначе записи без даты теряются из отчётов/сортировок
        if (!keys.includes('created_at') && cols.has('created_at')) { keys.push('created_at'); body.created_at = new Date().toISOString(); }
        const uidIdx = keys.indexOf('user_id') + 1;
        // jsonb-колонки: любые массивы (объектов И строк, напр. permissions) сериализуем
        const vals = keys.map(k => Array.isArray(body[k]) ? JSON.stringify(body[k]) : body[k]);
        const ph = keys.map((_, i) => '$' + (i + 1)).join(', ');
        const sql = 'INSERT INTO receipts (' + keys.join(', ') + ', receipt_number) VALUES (' + ph +
          ', (SELECT COALESCE(MAX(receipt_number),0)+1 FROM receipts WHERE user_id = $' + uidIdx + ')) RETURNING *';
        const { rows } = await q(sql, vals);
        results.push(rows[0] || rows);
        continue;
      }

      const keys = Object.keys(body).filter(k => body[k] !== undefined);
      // user_id всегда берём из токена — не доверяем переданному в payload
      if (cols.has('user_id')) { if (!keys.includes('user_id')) keys.push('user_id'); body.user_id = req.user.id; }
      // timesheet_entries: id — serial (integer), Date.now() не влезает — не подставляем, пусть БД сама
      if (!keys.includes('id') && table !== 'timesheet_entries') { keys.unshift('id'); body.id = Date.now() + results.length; }
      // created_at по умолчанию — иначе записи без даты теряются из отчётов/сортировок
      if (!keys.includes('created_at') && cols.has('created_at')) { keys.push('created_at'); body.created_at = new Date().toISOString(); }
      // Кассовые смены: opened_at по умолчанию — иначе дата открытия NULL и раздел «Смены» показывает 01.01.1970
      if (table === 'shifts' && !keys.includes('opened_at') && cols.has('opened_at')) { keys.push('opened_at'); body.opened_at = new Date().toISOString(); }
      // jsonb-колонки: любые массивы (объектов И строк, напр. permissions) сериализуем
      const vals = keys.map(k => Array.isArray(body[k]) ? JSON.stringify(body[k]) : body[k]);
      const ph = keys.map((_, i) => '$' + (i + 1)).join(', ');
      const { rows } = await q('INSERT INTO ' + table + ' (' + keys.join(', ') + ') VALUES (' + ph + ') RETURNING *', vals);
      results.push(rows[0] || rows);
    }
    res.json(items.length === 1 ? results[0] : results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/:table/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const data = { ...req.body };
    delete data.user_id; // user_id всегда берём из токена
    const keys = Object.keys(data).filter(k => data[k] !== undefined);
    const cols = await getTableColumns(table);
    // Запоминаем старое имя складской категории — после переименования обновим товары
    let oldCatName = null;
    if (table === 'stock_categories' && typeof data.name === 'string') {
      const { rows: oldRows } = await pool.query('SELECT name FROM stock_categories WHERE id = $1', [id]);
      if (oldRows.length && oldRows[0].name !== data.name) oldCatName = oldRows[0].name;
    }
    // Запоминаем старое имя поставщика — после переименования обновим закупки
    let oldSupplierName = null;
    if (table === 'suppliers' && typeof data.name === 'string') {
      const { rows: oldRows } = await pool.query('SELECT name FROM suppliers WHERE id = $1', [id]);
      if (oldRows.length && oldRows[0].name !== data.name) oldSupplierName = oldRows[0].name;
    }
    const sc = keys.map((k, i) => k + ' = $' + (i + 1)).join(', ');
    // jsonb-колонки: любые массивы (объектов И строк, напр. permissions) сериализуем —
    // иначе PATCH падает с «invalid input syntax for type json»
    const toVal = (v) => Array.isArray(v) ? JSON.stringify(v) : v;
    let sql;
    let vals;
    if (cols.has('user_id')) {
      vals = [...keys.map(k => toVal(data[k])), id, req.user.id];
      sql = 'UPDATE ' + table + ' SET ' + sc + ' WHERE id = $' + (keys.length + 1) + ' AND user_id = $' + (keys.length + 2);
    } else {
      vals = [...keys.map(k => toVal(data[k])), id];
      sql = 'UPDATE ' + table + ' SET ' + sc + ' WHERE id = $' + (keys.length + 1);
    }
    const { rows } = await q(sql, vals);
    // Переименование складской категории → обновляем товары/услуги этой категории
    if (oldCatName) {
      await pool.query('UPDATE products SET cat = $1 WHERE cat = $2 AND user_id = $3', [data.name, oldCatName, req.user.id]);
    }
    // Переименование поставщика → обновляем закупки (иначе статистика и защита теряют связь)
    if (oldSupplierName) {
      await pool.query('UPDATE supplies SET supplier_name = $1 WHERE supplier_name = $2 AND user_id = $3', [data.name, oldSupplierName, req.user.id]);
    }
    res.json(rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/:table/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const cols = await getTableColumns(table);
    // Защита счетов: системные (наличные/касса) и счета с операциями удалять нельзя
    if (table === 'accounts') {
      const { rows: ac } = await pool.query('SELECT type FROM accounts WHERE id = $1 AND user_id = $2', [id, req.user.id]);
      if (ac.length && (ac[0].type === 'cash' || ac[0].type === 'cash_register')) {
        return res.status(400).json({ error: 'Системный счёт («Наличные»/«Кассовый ящик») удалить нельзя' });
      }
      const { rows: tx } = await pool.query('SELECT id FROM transactions WHERE account_id = $1 AND user_id = $2 LIMIT 1', [id, req.user.id]);
      if (tx.length > 0) return res.status(400).json({ error: 'Нельзя удалить счёт — на нём есть операции' });
    }
    // Защита категорий: используемые в операциях удалять нельзя
    if (table === 'categories') {
      const { rows: tx } = await pool.query('SELECT id FROM transactions WHERE category_id = $1 LIMIT 1', [id]);
      if (tx.length > 0) return res.status(400).json({ error: 'Категория используется в операциях — удалить нельзя' });
    }
    // Защита складских категорий: с товарами/услугами удалять нельзя
    if (table === 'stock_categories') {
      const { rows: sc } = await pool.query('SELECT name FROM stock_categories WHERE id = $1', [id]);
      if (sc.length) {
        const { rows: prod } = await pool.query('SELECT id FROM products WHERE cat = $1 AND user_id = $2 LIMIT 1', [sc[0].name, req.user.id]);
        if (prod.length > 0) return res.status(400).json({ error: 'Нельзя удалить категорию — в ней есть товары или услуги. Сначала переназначьте их' });
      }
    }
    // Защита должностей: привязанных к сотрудникам удалять нельзя
    if (table === 'position_templates') {
      const { rows: emp } = await pool.query('SELECT id FROM employees WHERE position_id::text = $1 AND user_id = $2 LIMIT 1', [id, req.user.id]);
      if (emp.length > 0) return res.status(400).json({ error: 'Нельзя удалить должность — она назначена сотрудникам. Сначала переназначьте их' });
    }
    // Защита связанных данных: клиент с чеками, товар в чеках/закупках, сотрудник в зарплате и т.д.
    if (table === 'clients') {
      const { rows } = await pool.query('SELECT id FROM receipts WHERE client_id = $1 AND user_id = $2 LIMIT 1', [id, req.user.id]);
      if (rows.length > 0) return res.status(400).json({ error: 'Нельзя удалить клиента — у него есть чеки. Сначала удалите или переназначьте чеки' });
    }
    if (table === 'products') {
      const { rows: ri } = await pool.query('SELECT id FROM receipt_items WHERE product_id = $1 LIMIT 1', [id]);
      if (ri.length > 0) return res.status(400).json({ error: 'Нельзя удалить товар — он есть в чеке. Можно скрыть его в каталоге' });
      const { rows: wo } = await pool.query('SELECT id FROM writeoffs WHERE product_id::text = $1 LIMIT 1', [id]);
      if (wo.length > 0) return res.status(400).json({ error: 'Нельзя удалить товар — по нему есть списания со склада' });
      const { rows: sp } = await pool.query('SELECT id FROM supplies, jsonb_array_elements(items) it WHERE user_id = $2 AND it->>\'prodId\' = $1 LIMIT 1', [id, req.user.id]);
      if (sp.length > 0) return res.status(400).json({ error: 'Нельзя удалить товар — он есть в закупках' });
    }
    if (table === 'employees') {
      const { rows: s } = await pool.query('SELECT id FROM salary WHERE employee_id::text = $1 AND user_id = $2 LIMIT 1', [id, req.user.id]);
      if (s.length > 0) return res.status(400).json({ error: 'Нельзя удалить сотрудника — по нему есть зарплатные начисления' });
      const { rows: t } = await pool.query('SELECT id FROM timesheet_entries WHERE employee_id::text = $1 LIMIT 1', [id]);
      if (t.length > 0) return res.status(400).json({ error: 'Нельзя удалить сотрудника — по нему есть записи в табеле' });
      const { rows: ri } = await pool.query('SELECT id FROM receipt_items WHERE employee_id = $1 LIMIT 1', [id]);
      if (ri.length > 0) return res.status(400).json({ error: 'Нельзя удалить сотрудника — он участвует в продажах' });
    }
    if (table === 'suppliers') {
      // Проверяем и по supplier_id, и по supplier_name (старые поставки пишут только имя)
      const { rows: sup } = await pool.query('SELECT name FROM suppliers WHERE id = $1', [id]);
      const supName = sup.length ? sup[0].name : null;
      const { rows: sp } = await pool.query('SELECT id FROM supplies WHERE user_id = $2 AND (supplier_id = $1 OR (supplier_name IS NOT NULL AND supplier_name = $3)) LIMIT 1', [id, req.user.id, supName]);
      if (sp.length > 0) return res.status(400).json({ error: 'Нельзя удалить поставщика — есть закупки от него' });
    }
    if (table === 'promos') {
      const { rows: ri } = await pool.query('SELECT id FROM receipt_items WHERE promo_id = $1 LIMIT 1', [id]);
      if (ri.length > 0) return res.status(400).json({ error: 'Нельзя удалить акцию — она применялась в продажах' });
    }
    // ===== КОРЗИНА: перед удалением сохраняем полную копию записи =====
    // (кроме самой корзины и системных таблиц) — восстановление в течение 30 дней
    if (table !== 'trash' && table !== 'users' && table !== 'user_profiles' && table !== 'telegram_connections' && table !== 'telegram_codes') {
      try {
        const { rows: rec } = await q('SELECT * FROM ' + table + ' WHERE id = $1' + (cols.has('user_id') ? ' AND user_id = $2' : ''), cols.has('user_id') ? [id, req.user.id] : [id]);
        if (rec.length) {
          await q('INSERT INTO trash (id, user_id, table_name, record_id, data, deleted_by) VALUES ($1, $2, $3, $4, $5, $6)', [
            Date.now(), req.user.id, table, String(id), JSON.stringify(rec[0]), (req.user.name || req.user.email || String(req.user.id))
          ]);
        }
      } catch (e) { /* если не удалось скопировать — удаляем как раньше */ }
    }
    if (cols.has('user_id')) {
      await q('DELETE FROM ' + table + ' WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    } else {
      await q('DELETE FROM ' + table + ' WHERE id = $1', [id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== КОРЗИНА: восстановление записи =====
app.post('/api/trash/:id/restore', auth, async (req, res) => {
  try {
    const id = req.params.id;
    // Автоочистка: записи старше 30 дней удаляем навсегда
    await pool.query('DELETE FROM trash WHERE user_id = $1 AND deleted_at < NOW() - INTERVAL \'30 days\'', [req.user.id]);
    const { rows } = await pool.query('SELECT * FROM trash WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Запись не найдена в корзине' });
    const t = rows[0];
    const target = t.table_name;
    const data = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
    // Проверка: таблица должна быть разрешённой
    if (!ALLOWED_TABLES.includes(target)) return res.status(400).json({ error: 'Нельзя восстановить — неизвестная таблица' });
    // Восстановление: вставляем запись с тем же id (оригинал удалён, конфликта нет)
    const cols = await getTableColumns(target);
    const keys = Object.keys(data).filter(k => data[k] !== undefined && cols.has(k));
    if (!keys.includes('id')) keys.unshift('id');
    const vals = keys.map(k => Array.isArray(data[k]) ? JSON.stringify(data[k]) : data[k]);
    const ph = keys.map((_, i) => '$' + (i + 1)).join(', ');
    await pool.query('INSERT INTO ' + target + ' (' + keys.join(', ') + ') VALUES (' + ph + ')', vals);
    // Убираем из корзины
    await pool.query('DELETE FROM trash WHERE id = $1', [id]);
    res.json({ ok: true, table: target });
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

app.listen(PORT, '0.0.0.0', () => { console.log('AtlasPos API running on port ' + PORT); });
