import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const FUNC_MAP = {
  addIncome: async (args, user) => {
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id, type: 'income',
      amount: args.amount, description: args.description,
      date: args.date || new Date().toISOString().split('T')[0],
    });
    return error ? `Ошибка: ${error.message}` : `✅ Доход ${args.amount}₽ добавлен`;
  },
  addExpense: async (args, user) => {
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id, type: 'expense',
      amount: args.amount, description: args.description,
      date: args.date || new Date().toISOString().split('T')[0],
    });
    return error ? `Ошибка: ${error.message}` : `✅ Расход ${args.amount}₽ добавлен`;
  },
  addProduct: async (args, user) => {
    const { error } = await supabase.from('products').insert({
      user_id: user.id, name: args.name, price: args.price,
      type: args.type || 'product', unit: args.unit || 'шт',
      hidden: false,
    });
    return error ? `Ошибка: ${error.message}` : `✅ Товар «${args.name}» добавлен`;
  },
  // Создать категорию товаров
  createStockCategory: async (args, user) => {
    const { error } = await supabase.from('stock_categories').insert({
      user_id: user.id, name: args.name, type: 'product',
    });
    return error ? `Ошибка: ${error.message}` : `✅ Категория «${args.name}» создана`;
  },
  getReport: async (args, user) => {
    const days = { today: 1, week: 7, month: 30, all: 9999 };
    const d = days[args.period] || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - d);
    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', cutoff.toISOString().split('T')[0]);
    if (!txs || txs.length === 0) return '📭 Нет операций за этот период';
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = txs.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const profit = income - expense;
    return `📊 Отчёт за ${args.period === 'all' ? 'всё время' : args.period}:\n• Доходы: +${income.toLocaleString()}₽\n• Расходы: −${expense.toLocaleString()}₽\n• Прибыль: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}₽`;
  },
};

export default function AiChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '👋 Привет! Я AI-помощник. Могу:\n• Добавить расход/доход\n• Создать товар\n• Сделать отчёт\n\nПопробуй: "Добавь расход 5000 на запчасти"' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(p => [...p, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();

      if (data.type === 'function_call' && data.function) {
        const fn = FUNC_MAP[data.function];
        if (fn) {
          const result = await fn(data.arguments, user);
          setMessages(p => [...p, { role: 'assistant', text: result }]);
        } else {
          setMessages(p => [...p, { role: 'assistant', text: `❌ Функция ${data.function} не найдена` }]);
        }
      } else {
        setMessages(p => [...p, { role: 'assistant', text: data.reply || '...' }]);
      }
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', text: '❌ Ошибка соединения' }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Кнопка чата */}
      <button onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 999,
          width: '56px', height: '56px', borderRadius: '50%',
          background: '#000', color: '#fff', border: 'none',
          fontSize: '1rem', fontWeight:700, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit', letterSpacing:'.05em',
          animation:'pulse-ai 2s infinite',
        }}>
        {open ? '✕' : 'AI'}
      </button>

      {/* Модалка чата */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '72px', right: '20px', zIndex: 998,
          width: '340px', height: '600px',
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          {/* Шапка чата */}
          <div style={{ background: '#000', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff6052' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ffbd2e' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#28c93f' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)', marginLeft: 4, letterSpacing: '.03em' }}>AI-ПОМОЩНИК</span>
          </div>

          {/* Сообщения */}
          <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', lineHeight: 1.5 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                maxWidth: '85%', padding: '6px 10px', borderRadius: '8px',
                background: m.role === 'user' ? '#e8f0ff' : '#f5f5f5',
                color: '#333', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                whiteSpace: 'pre-wrap',
              }}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{ maxWidth: '85%', padding: '6px 10px', borderRadius: '8px', background: '#f5f5f5', color: '#999', alignSelf: 'flex-start' }}>
                ⏳ Думаю...
              </div>
            )}
          </div>

          {/* Поле ввода */}
          <div style={{ borderTop: '1px solid #eee', padding: '8px', display: 'flex', gap: '6px' }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите сообщение..."
              disabled={loading}
              style={{
                flex: 1, border: '1px solid #e0e0e0', borderRadius: '6px',
                padding: '6px 8px', fontSize: '13px', outline: 'none',
                fontFamily: 'inherit', background: '#fff',
              }}
            />
            <button onClick={send} disabled={loading || !input.trim()}
              style={{
                background: '#000', color: '#fff', border: 'none',
                borderRadius: '6px', padding: '6px 12px', fontSize: '12px',
                fontWeight: 600, cursor: loading ? 'default' : 'pointer',
                fontFamily: 'inherit', opacity: loading ? 0.5 : 1,
              }}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
