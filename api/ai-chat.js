// AI Chat API — прокси к DeepSeek с упрощённым подходом
// AI отвечает текстом, клиент парсит команды

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = process.env.DEEPSEEK_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const systemPrompt = `Ты — AI-ассистент для системы учёта Finance. Твоя задача — помогать пользователю.

Ты можешь выполнять действия. Для этого отвечай в формате:

[ДЕЙСТВИЕ:название]
параметр1: значение1
параметр2: значение2
[/ДЕЙСТВИЕ]

Доступные действия:
- ADD_INCOME — добавить доход. Параметры: amount (сумма), description (описание), date (дата, опционально)
- ADD_EXPENSE — добавить расход. Параметры: amount (сумма), description (описание), date (дата, опционально)
- ADD_PRODUCT — добавить товар. Параметры: name (название), price (цена), type (product/service, опционально), unit (ед.изм, опционально)
- ADD_CATEGORY — добавить категорию товаров. Параметры: name (название)
- GET_REPORT — получить отчёт. Параметры: period (today/week/month/all)

После действия напиши короткий ответ пользователю.

Пример:
Пользователь: добавь расход 5000 на запчасти
Ты:
[ДЕЙСТВИЕ:ADD_EXPENSE]
amount: 5000
description: запчасти
[/ДЕЙСТВИЕ]
✅ Расход 5 000₽ на запчасти добавлен

Если пользователь пишет не по делу — вежливо скажи что ты умеешь делать.
Не выдумывай данные. Если нужна информация — скажи что данных нет.`;

  try {
    const payload = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(m => ({ role: m.role, content: m.text })),
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 800,
    };

    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `AI API error: ${errText}` });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '...';

    // Парсим действие из ответа
    const actionMatch = reply.match(/\[ДЕЙСТВИЕ:(\w+)\]\n([\s\S]*?)\[\/ДЕЙСТВИЕ\]/);
    let action = null;
    let params = {};

    if (actionMatch) {
      action = actionMatch[1];
      const paramLines = actionMatch[2].trim().split('\n');
      paramLines.forEach(line => {
        const [key, ...vals] = line.split(':');
        if (key && vals.length) {
          params[key.trim()] = vals.join(':').trim();
        }
      });
    }

    // Чистый ответ без блоков действий
    const cleanReply = reply.replace(/\[ДЕЙСТВИЕ:[\s\S]*?\[\/ДЕЙСТВИЕ\]\n*/g, '').trim() || 'Готово!';

    return res.json({ action, params, reply: cleanReply });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
