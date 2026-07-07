// Telegram уведомления
const BOT_TOKEN = process.env.TG_BOT_TOKEN || '';
const API = 'https://api.telegram.org/bot' + BOT_TOKEN;

// Отправить сообщение пользователю
async function sendMessage(chatId, text) {
  if (!BOT_TOKEN) return { error: 'TG_BOT_TOKEN не настроен' };
  try {
    const res = await fetch(API + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { error: err.message };
  }
}

// Установить вебхук (вызывается один раз при старте)
async function setWebhook(url) {
  if (!BOT_TOKEN) return;
  try {
    const res = await fetch(API + '/setWebhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url + '/api/telegram/webhook' }),
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

// Извлечь chat_id из входящего сообщения
function getChatId(body) {
  return body?.message?.chat?.id || body?.callback_query?.message?.chat?.id || null;
}

// Обработать входящее сообщение от Telegram
function handleMessage(body) {
  const msg = body?.message?.text || '';
  const chatId = getChatId(body);
  if (!chatId) return null;
  
  const cmd = msg.trim().toLowerCase();
  
  if (cmd === '/start' || cmd.startsWith('/start')) {
    // /start или /start VERIFICATION_CODE
    const parts = msg.split(' ');
    const code = parts[1] || '';
    return {
      type: 'connect',
      chatId: String(chatId),
      code: code,
      reply: code 
        ? '✅ Подключение...' 
        : 'Привет! Для подключения уведомлений введите код из настроек AtlasPos.\n\nНапример: /start 4821',
    };
  }
  
  if (cmd === '/help') {
    return {
      type: 'help',
      chatId: String(chatId),
      reply: 'AtlasPos Bot — уведомления о продажах, остатках и событиях.\n\nКоманды:\n/start — подключить аккаунт\n/help — помощь\n/status — статус подключения',
    };
  }
  
  return {
    type: 'unknown',
    chatId: String(chatId),
    reply: 'Используйте /start чтобы подключиться, или /help для помощи.',
  };
}

module.exports = { sendMessage, setWebhook, handleMessage, getChatId };
