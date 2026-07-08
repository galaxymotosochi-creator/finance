const { exec } = require('child_process');
const { Pool } = require('pg');
const BOT_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_HOST = '149.154.167.220';
const API_URL = 'https://' + TG_HOST + '/bot' + BOT_TOKEN;
var lastOffset = 0;

const pool = new Pool({
  host: 'localhost', port: 5432, database: 'atlaspos',
  user: 'atlaspos', password: 'atlaspos_2026_secret', max: 5,
});

function tgApi(method, body) {
  return new Promise((resolve, reject) => {
    var cmd = 'curl -sk -H "Host: api.telegram.org"';
    if (body) {
      cmd += ' -X POST -H "Content-Type: application/json"';
      cmd += ' -d \'' + JSON.stringify(body) + '\'';
    }
    cmd += ' "' + API_URL + '/' + method + '"';
    exec(cmd, { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(stdout)); }
      catch(e) { reject(e); }
    });
  });
}

async function sendMsg(chatId, text) {
  try { await tgApi('sendMessage', { chat_id: chatId, text: text, parse_mode: 'HTML' }); }
  catch(e) { console.error('sendMsg err:', e.message); }
}

async function poll() {
  try {
    const data = await tgApi('getUpdates', { offset: lastOffset + 1, timeout: 10 });
    if (!data || !data.ok || !data.result) return;
    for (const u of data.result) {
      lastOffset = u.update_id;
      const msg = (u.message && u.message.text) || '';
      const chatId = u.message && u.message.chat && u.message.chat.id;
      if (!chatId) continue;
      console.log('Msg:', msg.slice(0, 50), 'from', chatId);
      if (msg.startsWith('/start ')) {
        const code = msg.split(' ')[1];
        const r = await pool.query('SELECT user_id FROM telegram_codes WHERE code = $1 AND expires_at > NOW()', [code]);
        if (r.rows.length > 0) {
          const uid = r.rows[0].user_id;
          await pool.query('INSERT INTO telegram_connections (user_id, chat_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET chat_id = $2', [uid, String(chatId)]);
          await pool.query('DELETE FROM telegram_codes WHERE code = $1', [code]);
          await sendMsg(chatId, '\u2705 \u0412\u044b \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u043b\u0438 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f AtlasPos!');
          console.log('Connected user', uid, 'chat', chatId);
        } else {
          await sendMsg(chatId, '\u274c \u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043a\u043e\u0434. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0441\u043d\u043e\u0432\u0430.');
        }
      } else if (msg === '/start') {
        await sendMsg(chatId, '\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 /start {code} \u0438\u0437 \u041d\u0430\u0441\u0442\u0440\u043e\u0435\u043a AtlasPos');
      }
    }
  } catch(e) {
    console.error('Poll err:', e.message);
  }
}

setInterval(poll, 2000);
poll();
console.log('Poller started (curl)');
