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

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, name: req.user.name } });
});

// ===== GENERIC TABLE CRUD =====

const ALLOWED_TABLES = ['products','categories','accounts','transactions','receipts','receipt_items',
  'shifts','supplies','writeoffs','inventory','suppliers','employees','positions','position_templates',
  'timesheet','timesheet_entries','clients','loyalty','loyalties','promos','subscriptions',
  'user_profiles','users','salary','stock_categories','plans','deductions','bonuses','combo_items'];

app.get('/api/:table', auth, async (req, res) => {
  try {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    let sql = 'SELECT * FROM ' + table + ' WHERE user_id = $1';
    const params = [req.user.id];
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
    const keys = Object.keys(body).filter(k => body[k] !== undefined);
    if (!keys.includes('user_id')) { keys.push('user_id'); body.user_id = req.user.id; }
    if (!keys.includes('id')) { keys.unshift('id'); body.id = Date.now(); }
    const vals = keys.map(k => body[k]);
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
    const sc = keys.map((k, i) => k + ' = $' + (i + 1)).join(', ');
    const vals = [...keys.map(k => data[k]), id, req.user.id];
    const { rows } = await q('UPDATE ' + table + ' SET ' + sc + ' WHERE id = $' + (vals.length - 1) + ' AND user_id = $' + vals.length + ' RETURNING *', vals);
    res.json(rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/:table/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    await q('DELETE FROM ' + table + ' WHERE id = $1 AND user_id = $2', [id, req.user.id]);
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
      const { data } = await pool.query(
        "SELECT user_id FROM telegram_codes WHERE code = $1 AND expires_at > NOW()",
        [code]
      );
      if (data.rows.length > 0) {
        const userId = data.rows[0].user_id;
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
    const { data } = await pool.query(
      'SELECT chat_id, prefs FROM telegram_connections WHERE user_id = $1',
      [req.user.id]
    );
    res.json({
      connected: data.rows.length > 0,
      chatId: data.rows[0]?.chat_id || null,
      prefs: data.rows[0]?.prefs || null,
    });
  } catch (e) {
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
    const { data } = await pool.query(
      'SELECT chat_id FROM telegram_connections WHERE user_id = $1',
      [req.user.id]
    );
    const chatId = data.rows[0]?.chat_id;
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
