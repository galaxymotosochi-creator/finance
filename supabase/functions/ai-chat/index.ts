// AI Chat — Edge Function для Supabase
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';

const systemPrompt = `Ты — AI-ассистент для системы учёта AtlasPos. Твоя задача — помогать пользователю.

Ты можешь выполнять действия. Для этого отвечай в формате:

[ДЕЙСТВИЕ:название]
параметр1: значение1
параметр2: значение2
[/ДЕЙСТВИЕ]

ПРАВИЛА ПОДТВЕРЖДЕНИЯ:
🔴 Действия, которые МЕНЯЮТ ДАННЫЕ — ВСЕГДА переспрашивай
🟢 Действия-ЗАПРОСЫ (только чтение) — выполняй СРАЗУ

Доступные действия: ADD_INCOME, ADD_EXPENSE, ADD_PRODUCT, ADD_CATEGORY, GET_REPORT, GET_BALANCE, GET_DEBTORS, GET_STOCK, GET_TOP_PRODUCTS, GET_TIMESHEET_STATS, GET_SHIFT_INFO, GET_FORECAST, GET_ZERO_STOCK, GET_CLIENTS, GET_EMPLOYEES, GET_SUPPLIES, GET_WRITEOFFS, GET_TRANSACTIONS, GET_MONTHLY_SUMMARY, AI_QUERY

Не выдумывай данные. Пиши полезно и по делу.`;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { message, history } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
    }

    const payload = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        ...(history || []).map((m) => ({ role: m.role, content: m.text })),
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
      return new Response(JSON.stringify({ error: `AI API error: ${errText}` }), { status: response.status });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '...';

    // Парсим действие из ответа
    const actionMatch = reply.match(/\[ДЕЙСТВИЕ:(\w+)\]\n([\s\S]*?)\[\/ДЕЙСТВИЕ\]/);
    let action = null;
    const params = {};

    if (actionMatch) {
      action = actionMatch[1];
      const paramLines = actionMatch[2].trim().split('\n');
      paramLines.forEach((line) => {
        const [key, ...vals] = line.split(':');
        if (key && vals.length) {
          const k = key.trim();
          const v = vals.join(':').trim();
          if (params[k] !== undefined) {
            if (!Array.isArray(params[k])) params[k] = [params[k]];
            params[k].push(v);
          } else {
            params[k] = v;
          }
        }
      });
    }

    const cleanReply = reply.replace(/\[ДЕЙСТВИЕ:[\s\S]*?\[\/ДЕЙСТВИЕ\]\n*/g, '').trim() || 'Готово!';

    return new Response(JSON.stringify({ action, params, reply: cleanReply }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
