import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const ACTION_MAP = {
  ADD_INCOME: async (p, user) => {
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id, type: 'income',
      amount: parseFloat(p.amount), description: p.description,
      date: p.date || new Date().toISOString().split('T')[0],
    });
    return error ? `❌ Ошибка: ${error.message}` : null;
  },
  ADD_EXPENSE: async (p, user) => {
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id, type: 'expense',
      amount: parseFloat(p.amount), description: p.description,
      date: p.date || new Date().toISOString().split('T')[0],
    });
    return error ? `❌ Ошибка: ${error.message}` : null;
  },
  ADD_PRODUCT: async (p, user) => {
    const { error } = await supabase.from('products').insert({
      id: Date.now(), user_id: user.id, name: p.name, price: parseFloat(p.price),
      type: p.type || 'product', unit: p.unit || 'шт', hidden: false,
    });
    return error ? `❌ Ошибка: ${error.message}` : null;
  },
  ADD_CATEGORY: async (p, user) => {
    const { error } = await supabase.from('stock_categories').insert({
      id: Date.now(), user_id: user.id, name: p.name, type: p.type || 'product',
    });
    return error ? `❌ Ошибка: ${error.message}` : null;
  },
  GET_REPORT: async (p, user) => {
    const days = { today: 1, week: 7, month: 30, all: 9999 };
    const d = days[p.period] || 30;
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
    const periodLabel = { today: 'сегодня', week: 'неделю', month: 'месяц', all: 'всё время' }[p.period] || p.period;
    return `📊 Отчёт за ${periodLabel}:\n• Доходы: +${income.toLocaleString()}₽\n• Расходы: −${expense.toLocaleString()}₽\n• Прибыль: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}₽`;
  },
};

export default function AiChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '👋 Привет! Я AI-помощник. Могу:\n• Добавить расход/доход\n• Создать товар/категорию\n• Сделать отчёт\n\nНапример: "добавь расход 5000 на запчасти"', isNotification: false },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifDot, setNotifDot] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const listRef = useRef(null);

  // Генерируем уведомления на клиенте
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const now = new Date();
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

        const [txRes, prodRes] = await Promise.all([
          supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(100),
          supabase.from('products').select('*').eq('user_id', user.id),
        ]);

        const transactions = txRes.data || [];
        const products = prodRes.data || [];

        const weekTx = transactions.filter(t => t.date && new Date(t.date) >= weekAgo);
        const monthTx = transactions.filter(t => t.date && new Date(t.date) >= monthAgo);

        const weekIncome = weekTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
        const weekExpense = weekTx.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
        const monthIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
        const monthExpense = monthTx.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);

        const notifs = [];

        if (weekExpense > weekIncome && weekExpense > 0)
          notifs.push({ level: 'critical', title: '📉 Убыток за неделю', text: 'Доходы ' + weekIncome.toLocaleString() + '₽, расходы ' + weekExpense.toLocaleString() + '₽', color: '#dc2626' });

        const monthProfit = monthIncome - monthExpense;
        if (monthProfit > 0)
          notifs.push({ level: 'info', title: '📈 Прибыль за месяц', text: '+' + monthProfit.toLocaleString() + '₽ при доходах ' + monthIncome.toLocaleString() + '₽', color: '#16a34a' });
        else if (monthProfit < 0 && monthTx.length > 0)
          notifs.push({ level: 'critical', title: '📉 Убыток за месяц', text: '−' + Math.abs(monthProfit).toLocaleString() + '₽', color: '#dc2626' });

        if (weekIncome > 0 && weekExpense > 0) {
          const ratio = Math.round(weekExpense / weekIncome * 100);
          if (ratio > 70)
            notifs.push({ level: 'warning', title: '⚠️ Высокие расходы', text: ratio + '% доходов уходит на расходы', color: '#f59e0b' });
        }

        if (weekTx.length === 0 && transactions.length > 5)
          notifs.push({ level: 'warning', title: '📭 Нет операций за неделю', text: 'За 7 дней не было ни одной операции', color: '#f59e0b' });

        if (notifs.length > 0) {
          const topLevel = ['critical', 'warning', 'info'].find(l => notifs.some(n => n.level === l));
          const colors = { critical: '#dc2626', warning: '#f59e0b', info: '#16a34a' };
          setNotifDot(colors[topLevel]);
          setNotifCount(notifs.length);
          setMessages(prev => [...prev, ...notifs.map(n => ({ role: 'assistant', text: n.title + '\n' + n.text, isNotification: true, color: n.color }))]);
        }
      } catch (e) {}
    })();
  }, [user]);

  // Сбрасываем уведомления при открытии чата (прочитано)
  useEffect(() => {
    if (open) { setNotifDot(null); setNotifCount(0); }
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(p => [...p, { role: 'user', text: userMsg, isNotification: false }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: messages.filter(m => !m.isNotification).slice(-10).map(m => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      let reply = data.reply || '...';

      if (data.action) {
        const fn = ACTION_MAP[data.action];
        if (fn) {
          const err = await fn(data.params, user);
          if (err) reply = err;
        }
      }

      setMessages(p => [...p, { role: 'assistant', text: reply, isNotification: false }]);

      if (data.action && data.action !== 'GET_REPORT') {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', text: '❌ Ошибка соединения с сервером', isNotification: false }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      <button onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 999,
          width: '56px', height: '56px', borderRadius: '50%',
          background: '#000', color: '#fff', border: 'none',
          fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit',
          animation: notifDot ? 'pulse-ai 2s infinite' : 'none',
          position: 'relative',
        }}>
        {open ? '✕' : <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'><rect x='2' y='4' width='20' height='16' rx='2'/><path d='M22 4L12 13 2 4'/></svg>}
        {!open && notifDot && (
          <>
            <span style={{
              position: 'absolute', top: '2px', right: '2px',
              width: '14px', height: '14px', borderRadius: '50%',
              background: notifDot, border: '2px solid #000',
            }} />
            {notifCount > 1 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: '#000', color: '#fff', fontSize: '9px',
                fontWeight: 700, borderRadius: '8px', padding: '1px 5px',
                lineHeight: '14px', border: '1.5px solid #fff',
              }}>
                {notifCount}
              </span>
            )}
          </>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: '96px', right: '24px', zIndex: 998,
          width: '340px', height: '600px',
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <div style={{ background: '#000', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff6052' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ffbd2e' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#28c93f' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)', marginLeft: 4, letterSpacing: '.03em' }}>AI-ПОМОЩНИК</span>
          </div>

          <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', lineHeight: 1.5 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                maxWidth: '85%', padding: '6px 10px', borderRadius: '8px',
                background: m.isNotification ? (m.color ? m.color + '18' : '#fff7ed') : (m.role === 'user' ? '#e8f0ff' : '#f5f5f5'),
                color: '#333', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                whiteSpace: 'pre-wrap',
                borderLeft: m.isNotification && m.color ? `3px solid ${m.color}` : 'none',
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

          <div style={{ borderTop: '1px solid #eee', padding: '8px', display: 'flex', gap: '6px' }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите сообщение..."
              disabled={loading}
              style={{
                flex: 1, border: '1px solid #e0e0e0', borderRadius: '6px',
                padding: '6px 8px', fontSize: '13px', outline: 'none',
                fontFamily: 'inherit', background: '#fff',
              }} />
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
