// AI Chat API — прокси к DeepSeek
// Для Function Calling: AI может добавлять расходы/доходы/товары и анализировать данные

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = process.env.DEEPSEEK_API_KEY;

// Описание доступных функций для AI
const FUNCTIONS = [
  {
    name: 'addIncome',
    description: 'Добавить доход (поступление средств)',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Сумма дохода в рублях' },
        description: { type: 'string', description: 'Описание/название дохода' },
        date: { type: 'string', description: 'Дата в формате YYYY-MM-DD' },
      },
      required: ['amount', 'description'],
    },
  },
  {
    name: 'addExpense',
    description: 'Добавить расход (списание средств)',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Сумма расхода в рублях' },
        description: { type: 'string', description: 'Описание/название расхода' },
        date: { type: 'string', description: 'Дата в формате YYYY-MM-DD' },
      },
      required: ['amount', 'description'],
    },
  },
  {
    name: 'addProduct',
    description: 'Добавить товар или услугу в каталог',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Название товара или услуги' },
        price: { type: 'number', description: 'Цена продажи в рублях' },
        type: { type: 'string', enum: ['product', 'service'], description: 'Тип: товар или услуга' },
        unit: { type: 'string', description: 'Единица измерения (шт, кг, час и т.д.)' },
      },
      required: ['name', 'price'],
    },
  },
  {
    name: 'createStockCategory',
    description: 'Создать категорию для товаров на складе (например "Скутеры", "Запчасти", "Экипировка")',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Название категории' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getReport',
    description: 'Получить финансовый отчёт за период (доходы, расходы, прибыль)',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'all'], description: 'Период отчёта' },
      },
      required: ['period'],
    },
  },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, context } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const systemPrompt = `Ты — AI-ассистент для системы учёта Finance для бизнеса.

У программы есть разделы:
1. Товары и склад — категории товаров (для группировки товаров, например «Скутеры», «Запчасти»)
2. Финансы — доходы и расходы (деньги), финансовые категории (для группировки доходов/расходов)
3. Клиенты, Сотрудники, Настройки

Если пользователь просит «добавить категорию» — уточни, это категория для ТОВАРОВ (склад) или для ДОХОДОВ/РАСХОДОВ (финансы).
По умолчанию, если не указано — создавай категорию товаров.

Отвечай кратко и по делу на русском языке.
Используй function calling для выполнения действий.
Не выдумывай данные — если данных нет, скажи что их нет.`;

  try {
    const payload = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      functions: FUNCTIONS,
      function_call: 'auto',
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
    const choice = data.choices?.[0];
    
    if (choice?.finish_reason === 'function_call') {
      const fn = choice.message.function_call;
      return res.json({
        type: 'function_call',
        function: fn.name,
        arguments: JSON.parse(fn.arguments || '{}'),
        reply: null,
      });
    }

    return res.json({
      type: 'reply',
      function: null,
      arguments: null,
      reply: choice?.message?.content || '...',
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
