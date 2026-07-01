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
    return `📊 Отчёт за ${periodLabel}:\n- Доходы: +${income.toLocaleString()} ₽\n- Расходы: −${expense.toLocaleString()} ₽\n- Прибыль: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()} ₽`;
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
        if (found.length > 1) {
          const names = found.map(e => e.name).join(', ');
          return `Найдено несколько: ${names}. Уточните фамилию или ФИО`;
        }
        empIds = found.map(e => e.id);
        if (empIds.length === 0) return `Сотрудник "${p.employee_name}" не найден`;
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
          text += `- ${name}: ${s.count} раз(а), всего +${s.sum.toLocaleString()} ₽\n`;
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
          text += `- ${name}: ${s.count} раз(а), всего -${s.sum.toLocaleString()} ₽\n`;
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
          text += `- ${name}: ${s.worked} рабочих дн., ${s.sick} больн., ${s.vacation} отпуск, ${s.absent} прогул\n`;
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
        text += `- ${name}: ${s.worked} дн., бонусы +${s.bonus.toLocaleString()} ₽, штрафы -${s.deduct.toLocaleString()} ₽\n`;
      });
      text += `\n📌 Всего: +${totalBonus.toLocaleString()} ₽ бонусов, -${totalDeduct.toLocaleString()} ₽ штрафов, ${workedDays} рабочих дней`;
      return text;
    } catch (err) {
      return '❌ Ошибка загрузки табеля: ' + err.message;
    }
  },
  GET_BALANCE: async (p, user) => {
    const {data:accts} = await supabase.from('accounts').select('id,name,balance').eq('user_id',user.id);
    const {data:txs} = await supabase.from('transactions').select('account_id,type,amount').eq('user_id',user.id);
    if (!accts || accts.length === 0) return '📭 Нет счетов';
    const txById = {};
    (txs||[]).forEach(t => { if (!txById[t.account_id]) txById[t.account_id] = 0; txById[t.account_id] += Number(t.amount||0) * (t.type==='income'?1:-1); });
    let text = '💰 Баланс счетов:\n';
    let total = 0;
    accts.forEach(a => { const b = (parseFloat(a.balance)||0) + (txById[a.id]||0); text += `- ${a.name}: ${b.toLocaleString()} ₽\n`; total += b; });
    text += `\n📊 Общий баланс: ${total.toLocaleString()} ₽`;
    return text;
  },
  GET_DEBTORS: async (p, user) => {
    const {data:clients} = await supabase.from('clients').select('name,debt').eq('user_id',user.id).not('debt','is',null).gt('debt',0).order('debt',{ascending:false});
    if (!clients || clients.length === 0) return '✅ Нет должников';
    let text = '⚠️ Должники:\n';
    clients.forEach(c => { text += `- ${c.name}: ${Number(c.debt).toLocaleString()} ₽\n`; });
    return text;
  },
  GET_STOCK: async (p, user) => {
    const name = (p.product_name||'').toLowerCase().trim();
    if (!name) return '📦 Укажите название товара';
    const {data:prods} = await supabase.from('products').select('id,name').eq('user_id',user.id).eq('hidden',false);
    const found = (prods||[]).filter(p => p.name.toLowerCase().includes(name));
    if (found.length === 0) return `❌ Товар «${p.product_name}» не найден`;
    const ids = found.map(p => p.id);
    const {data:supRaw} = await supabase.from('supplies').select('items').eq('user_id',user.id);
    const {data:wo} = await supabase.from('writeoffs').select('items').eq('user_id',user.id);
    const sm = {};
    (supRaw||[]).forEach(sp => (sp.items||[]).forEach(it => { if (!sm[it.prodId]) sm[it.prodId] = 0; sm[it.prodId] += it.qty||0; }));
    (wo||[]).forEach(w => (w.items||[]).forEach(it => { if (sm[it.prodId]) sm[it.prodId] -= it.qty||0; }));
    let text = `📦 Остатки по «${p.product_name}»:\n`;
    found.forEach(p => { text += `- ${p.name}: ${sm[p.id]||0} шт\n`; });
    return text;
  },
  GET_TOP_PRODUCTS: async (p, user) => {
    const days = { today: 1, week: 7, month: 30, all: 9999 };
    const d = days[p.period] || 7;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - d);
    const cs = cutoff.toISOString().split('T')[0];
    const {data:recs} = await supabase.from('receipts').select('id').eq('user_id',user.id).gte('date',cs);
    const rids = (recs||[]).map(r=>r.id);
    if (rids.length === 0) return '📭 Нет продаж за этот период';
    const {data:items} = rids.length ? await supabase.from('receipt_items').select('product_name,quantity,total').in('receipt_id',rids) : {data:[]};
    const top = {};
    (items||[]).forEach(i => { const n = i.product_name||'Товар'; if (!top[n]) top[n] = {qty:0,rev:0}; top[n].qty += i.quantity||0; top[n].rev += i.total||0; });
    const sorted = Object.entries(top).sort((a,b)=>b[1].rev-a[1].rev).slice(0, parseInt(p.limit)||5);
    let text = `🏆 Топ ${Math.min(sorted.length, parseInt(p.limit)||5)} товаров:\n`;
    sorted.forEach(([name,v],i) => { text += `${i+1}. ${name}: ${v.qty} шт, ${v.rev.toLocaleString()} ₽\n`; });
    return text;
  },
  GET_SHIFT_INFO: async (p, user) => {
    const {data:shift} = await supabase.from('shifts').select('*').eq('user_id',user.id).is('closed_at',null).order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (!shift) return 'Касса закрыта. Нужно открыть смену';
    const today = new Date().toISOString().split('T')[0];
    const {data:txs} = await supabase.from('transactions').select('amount').eq('user_id',user.id).eq('type','income').gte('date',today).not('description','ilike','%Перевод%');
    const sales = (txs||[]).reduce((s,t) => s + (t.amount||0), 0);
    const {data:accts} = await supabase.from('accounts').select('id,balance,name').eq('user_id',user.id);
    const {data:allTx} = await supabase.from('transactions').select('account_id,type,amount').eq('user_id',user.id);
    const txById = {};
    (allTx||[]).forEach(t => { if (!txById[t.account_id]) txById[t.account_id] = 0; txById[t.account_id] += Number(t.amount||0) * (t.type==='income'?1:-1); });
    const cashAc = (accts||[]).find(a => a.name === 'Касса');
    const cashBal = cashAc ? (parseFloat(cashAc.balance)||0) + (txById[cashAc.id]||0) : 0;
    return 'Касса: ' + (shift.cashier_name || '—') + '\nСмена открыта: ' + new Date(shift.opened_at).toLocaleString('ru-RU') + '\nПродажи за сегодня: +' + sales.toLocaleString() + ' ₽\nНаличные в кассе: ' + Math.round(cashBal).toLocaleString() + ' ₽';
  },
};

export default function AiChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '👋 Привет! Чем могу помочь?\n\n💰 Финансы\n- Добавить расход / доход\n- Баланс счетов / Деньги на счетах\n- Отчёт за день / неделю / месяц\n- Кто должен клиентов\n\n📦 Склад и товары\n- Создать товар / категорию\n- Остатки на складе\n\n👥 Сотрудники\n- Статистика табеля\n- Бонусы / Штрафы\n- Сколько дней отработал\n\n📊 Продажи\n- Что продаётся лучше всего\n- Прибыль / Средний чек\n\nПримеры:\n"добавь расход 5000 на запчасти"\n"сколько денег на счетах?"\n"кто должен?"\n"сколько дней отработала Анна"', isNotification: false },
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

  // Живое приветствие при открытии
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [{data:txs},{data:shift},{data:accts},{data:recs},{data:emps}] = await Promise.all([
          supabase.from('transactions').select('amount,type').eq('user_id',user.id).gte('date',today),
          supabase.from('shifts').select('cashier_name').eq('user_id',user.id).is('closed_at',null).limit(1).maybeSingle(),
          supabase.from('accounts').select('name,balance').eq('user_id',user.id),
          supabase.from('receipts').select('total_amount').eq('user_id',user.id).gte('date',today),
          supabase.from('employees').select('name').eq('user_id',user.id),
        ]);
        // Именинники
        const now = new Date();
        const md = now.toISOString().slice(5,10);
        const bdays = (emps||[]).filter(() => false); // пока отключено

        const sales = (txs||[]).filter(t => t.type==='income'&&!t.description?.startsWith('Перевод')).reduce((s,t)=>s+Number(t.amount||0),0);
        const recCount = (recs||[]).length;
        let greet = 'Доброе' + (now.getHours() < 12 ? ' утро' : now.getHours() < 18 ? ' день' : ' вечер') + '!';
        if (shift?.cashier_name && recCount > 0) {
          greet += `\nКасса: ${shift.cashier_name} · продажи ${recs.reduce((s,r)=>s+(r.total_amount||0),0).toLocaleString()} ₽`;
        } else if (shift?.cashier_name) {
          greet += `\nСмена открыта, кассир ${shift.cashier_name}`;
        } else {
          greet += '\nНовый день! Откроем смену?';
        }
        setMessages([{ role: 'assistant', text: greet + '\n\nЧем могу помочь?', isNotification: false }]);
      } catch(e) {
        // Оставляем стандартное приветствие
      }
    })();
  }, [open, user]);

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
          animation: 'pulse-ai 2s infinite',
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
          width: '300px', height: '450px',
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
                padding: '10px 12px', fontSize: '14px', outline: 'none',
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
