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

// ===== PHOTO UPLOAD =====
app.post('/api/upload', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = '/uploads/' + req.file.filename;
  res.json({ url });
});

app.listen(PORT, '0.0.0.0', () => { console.log('AtlasPos API running on port ' + PORT); });
