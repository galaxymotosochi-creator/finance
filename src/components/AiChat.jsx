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
    return `📊 Отчёт за ${periodLabel}:\n• Доходы: +${income.toLocaleString()} ₽\n• Расходы: −${expense.toLocaleString()} ₽\n• Прибыль: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()} ₽`;
  },
  GET_TIMESHEET_STATS: async (p, user) => {
    try {
      let { data: employees } = await supabase
        .from('employees')
        .select('id, name')
        .eq('user_id', user.id);
      if (!employees) employees = [];

      // Ищем сотрудника по имени (частичное совпадение)
      const empName = (p.employee_name || '').toLowerCase().trim();
      let empIds = [];
      if (empName) {
        const found = employees.filter(e => e.name.toLowerCase().includes(empName));
        empIds = found.map(e => e.id);
        if (empIds.length === 0) return `👤 Сотрудник "${p.employee_name}" не найден`;
      }

      // Период
      const from = p.period_from || new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
      const to = p.period_to || new Date().toISOString().split('T')[0];

      let query = supabase
        .from('timesheet_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', from)
        .lte('date', to);

      if (empIds.length > 0) {
        query = query.in('employee_id', empIds);
      }

      const { data: entries } = await query.order('date', { ascending: true });

      if (!entries || entries.length === 0) {
        return '📭 Нет записей в табеле за указанный период';
      }

      // Собираем статистику
      const totalBonus = entries.reduce((s, e) => s + Number(e.bonus_amount || 0), 0);
      const totalDeduct = entries.reduce((s, e) => s + Number(e.deduct_amount || 0), 0);
      const workedDays = entries.filter(e => e.status === 'present' || e.status === 'remote').length;
      const sickDays = entries.filter(e => e.status === 'sick').length;
      const vacationDays = entries.filter(e => e.status === 'vacation').length;
      const absentDays = entries.filter(e => e.status === 'absent').length;

      const statType = (p.stat_type || '').toLowerCase();

      if (statType === 'bonus') {
        const empStats = {};
        entries.filter(e => (e.bonus_amount||0)>0).forEach(e => {
          const name = employees.find(em => em.id === e.employee_id)?.name || '—';
          if (!empStats[name]) empStats[name] = { count: 0, sum: 0 };
          empStats[name].count++;
          empStats[name].sum += Number(e.bonus_amount);
        });
        let text = `🎯 Бонусы с ${from} по ${to}:\n`;
        if (Object.keys(empStats).length === 0) return '🎯 Бонусов за этот период нет';
        Object.entries(empStats).forEach(([name, s]) => {
          text += `• ${name}: ${s.count} раз(а), всего +${s.sum.toLocaleString()} ₽\n`;
        });
        text += `\nИтого: +${totalBonus.toLocaleString()} ₽`;
        return text;
      }

      if (statType === 'deduct') {
        const empStats = {};
        entries.filter(e => (e.deduct_amount||0)>0).forEach(e => {
          const name = employees.find(em => em.id === e.employee_id)?.name || '—';
          if (!empStats[name]) empStats[name] = { count: 0, sum: 0 };
          empStats[name].count++;
          empStats[name].sum += Number(e.deduct_amount);
        });
        let text = `⚠️ Штрафы с ${from} по ${to}:\n`;
        if (Object.keys(empStats).length === 0) return '⚠️ Штрафов за этот период нет';
        Object.entries(empStats).forEach(([name, s]) => {
          text += `• ${name}: ${s.count} раз(а), всего -${s.sum.toLocaleString()} ₽\n`;
        });
        text += `\nИтого: -${totalDeduct.toLocaleString()} ₽`;
        return text;
      }

      if (statType === 'worked' || statType === 'отработал' || statType === 'дней') {
        const empStats = {};
        entries.forEach(e => {
          const name = employees.find(em => em.id === e.employee_id)?.name || '—';
          if (!empStats[name]) empStats[name] = { worked: 0, sick: 0, vacation: 0, absent: 0 };
          if (e.status === 'present' || e.status === 'remote') empStats[name].worked++;
          else if (e.status === 'sick') empStats[name].sick++;
          else if (e.status === 'vacation') empStats[name].vacation++;
          else if (e.status === 'absent') empStats[name].absent++;
        });
        let text = `📅 Статистика с ${from} по ${to}:\n`;
        Object.entries(empStats).forEach(([name, s]) => {
          text += `• ${name}: ${s.worked} рабочих дн., ${s.sick} больн., ${s.vacation} отпуск, ${s.absent} прогул\n`;
        });
        return text;
      }

      // По умолчанию — полная сводка
      const empStats = {};
      entries.forEach(e => {
        const name = employees.find(em => em.id === e.employee_id)?.name || '—';
        if (!empStats[name]) empStats[name] = { worked: 0, bonus: 0, deduct: 0 };
        if (e.status === 'present' || e.status === 'remote') empStats[name].worked++;
        empStats[name].bonus += Number(e.bonus_amount || 0);
        empStats[name].deduct += Number(e.deduct_amount || 0);
      });
      let text = `📊 Табель с ${from} по ${to}:\n`;
      Object.entries(empStats).forEach(([name, s]) => {
        text += `• ${name}: ${s.worked} дн., бонусы +${s.bonus.toLocaleString()} ₽, штрафы -${s.deduct.toLocaleString()} ₽\n`;
      });
      text += `\n📌 Всего: +${totalBonus.toLocaleString()} ₽ бонусов, -${totalDeduct.toLocaleString()} ₽ штрафов, ${workedDays} рабочих дней`;
      return text;
    } catch (err) {
      return '❌ Ошибка загрузки табеля: ' + err.message;
    }
  },
};

export default function AiChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '👋 Привет! Я AI-помощник. Могу:\n• Добавить расход/доход\n• Создать товар/категорию\n• Сделать отчёт\n• Показать статистику табеля\n\nНапример:\n"добавь расход 5000 на запчасти"\n"сколько штрафов у Шаманской с 12 по 16 июня"\n"сколько дней отработала Анна"', isNotification: false },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifDot, setNotifDot] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const notifLoaded = useRef(false);
  const listRef = useRef(null);


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
        }}>
        {open ? '✕' : (notifDot ? <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='1.5' strokeLinecap='round'><rect x='2' y='4' width='20' height='16' rx='2'/><path d='M22 4L12 13 2 4'/></svg> : 'AI')}
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
                ✏️ Печатает...
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
