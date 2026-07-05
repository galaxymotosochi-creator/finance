const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'atlaspos-jwt-secret-2026';

const pool = new Pool({
  user: 'atlaspos',
  password: 'atlaspos_2026_secret',
  host: 'localhost',
  port: 5432,
  database: 'atlaspos',
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

// Health check — must be BEFORE generic routes!
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Auth middleware
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.user_id]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ===== AUTH =====

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [id, email, hash, name || '']
    );
    const token = jwt.sign({ user_id: id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, email, name: name || '' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(400).json({ error: 'Неверный email или пароль' });
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Неверный email или пароль' });
    const token = jwt.sign({ user_id: rows[0].id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, name: req.user.name } });
});

// ===== GENERIC TABLE CRUD =====

const ALLOWED_TABLES = ['products','categories','accounts','transactions','receipts','receipt_items',
  'shifts','supplies','writeoffs','inventory','suppliers','employees','positions',
  'timesheet','clients','loyalty','promos','subscriptions','user_profiles'];

app.get('/api/:table', auth, async (req, res) => {
  try {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/:table', auth, async (req, res) => {
  try {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const data = { ...req.body, user_id: req.user.id };
    const keys = Object.keys(data);
    const vals = Object.values(data);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`, vals
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/:table/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const data = req.body;
    const keys = Object.keys(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = Object.values(data);
    vals.push(id, req.user.id);
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${setClause} WHERE id = $${vals.length - 1} AND user_id = $${vals.length} RETURNING *`, vals
    );
    res.json(rows[0] || { error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/:table/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    await pool.query(`DELETE FROM ${table} WHERE id = $1 AND user_id = $2`, [id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== PHOTO UPLOAD =====
app.post('/api/upload', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AtlasPos API running on port ${PORT}`);
});
