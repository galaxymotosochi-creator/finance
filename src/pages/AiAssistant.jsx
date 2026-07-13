import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getReport, getWeeklyReport, getTopProducts, getZeroStock, getForecast, downloadExcel } from '../lib/aiActions';

// ===== ДЕЙСТВИЯ AI (из AiChat.jsx) =====
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
  GET_BALANCE: async (p, user) => {
    const {data:accts} = await supabase.from('accounts').select('id,name,balance').eq('user_id',user.id);
    const {data:txs} = await supabase.from('transactions').select('account_id,type,amount').eq('user_id',user.id);
    if (!accts || accts.length === 0) return '📭 Нет счетов';
    const txById = {}; (txs||[]).forEach(t => { if (!txById[t.account_id]) txById[t.account_id] = 0; txById[t.account_id] += Number(t.amount||0) * (t.type==='income'?1:-1); });
    let text = '💰 Баланс счетов:\n'; let total = 0;
    accts.forEach(a => { const b = (parseFloat(a.balance)||0) + (txById[a.id]||0); text += `- ${a.name}: ${b.toLocaleString()} ₽\n`; total += b; });
    text += `\n📊 Общий баланс: ${total.toLocaleString()} ₽`; return text;
  },
  GET_DEBTORS: async (p, user) => {
    const {data:clients} = await supabase.from('clients').select('name,debt').eq('user_id',user.id).not('debt','is',null).gt('debt',0).order('debt',{ascending:false});
    if (!clients?.length) return '✅ Нет должников';
    return '⚠️ Должники:\n' + clients.map(c => `- ${c.name}: ${Number(c.debt).toLocaleString()} ₽`).join('\n');
  },
  GET_STOCK: async (p, user) => {
    const name = (p.product_name||'').toLowerCase().trim();
    if (!name) return '📦 Укажите название товара';
    const {data:prods} = await supabase.from('products').select('id,name').eq('user_id',user.id).eq('hidden',false);
    const found = (prods||[]).filter(p => p.name.toLowerCase().includes(name));
    if (found.length === 0) return `❌ Товар «${p.product_name}» не найден`;
    const [supRes, woRes] = await Promise.all([
      supabase.from('supplies').select('items').eq('user_id',user.id),
      supabase.from('writeoffs').select('items').eq('user_id',user.id),
    ]);
    const sm = {}; found.forEach(p => sm[p.id] = 0);
    (supRes.data||[]).forEach(sp => (sp.items||[]).forEach(it => { if (sm[it.prodId]!==undefined) sm[it.prodId] += it.qty||0; }));
    (woRes.data||[]).forEach(w => (w.items||[]).forEach(it => { if (sm[it.prodId]!==undefined) sm[it.prodId] -= it.qty||0; }));
    return `📦 Остатки по «${p.product_name}»:\n` + found.map(p => `- ${p.name}: ${sm[p.id]||0} шт`).join('\n');
  },
  GET_SHIFT_INFO: async (p, user) => {
    const {data:shift} = await supabase.from('shifts').select('*').eq('user_id',user.id).is('closed_at',null).order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (!shift) return 'Касса закрыта. Нужно открыть смену';
    const today = new Date().toISOString().split('T')[0];
    const {data:txs} = await supabase.from('transactions').select('amount').eq('user_id',user.id).eq('type','income').gte('date',today).not('description','ilike','%Перевод%');
    const sales = (txs||[]).reduce((s,t) => s + (t.amount||0), 0);
    return `🗄️ Касса: ${shift.cashier_name || '—'}\nОткрыта: ${new Date(shift.opened_at).toLocaleString('ru-RU')}\nПродажи сегодня: +${sales.toLocaleString()} ₽`;
  },
  GET_FORECAST: async (p, user) => { const r = await getForecast(user); return r.text; },
};

// Быстрые отчёты (возвращают { text, table, title })
const REPORT_ACTIONS = {
  weekly: (user) => getWeeklyReport(user),
  revenue: (user) => getReport('week', user, { asTable: true }),
  topproducts: (user) => getTopProducts('week', user),
  zerostock: (user) => getZeroStock(user),
  forecast: (user) => getForecast(user),
};

const QUICK_BUTTONS = [
  { id: 'weekly', label: '📊 За неделю', icon: '📊' },
  { id: 'topproducts', label: '🏆 Топ продаж', icon: '🏆' },
  { id: 'zerostock', label: '📦 Остатки', icon: '📦' },
  { id: 'forecast', label: '📈 Прогноз', icon: '📈' },
  { id: 'revenue', label: '💰 Доходы/Расходы', icon: '💰' },
];

export default function AiAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '👋 Привет! Чем могу помочь?', data: null },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // Быстрый отчёт
  const handleQuickReport = async (id) => {
    const fn = REPORT_ACTIONS[id];
    if (!fn) return;
    setMessages(p => [...p, { role: 'user', text: QUICK_BUTTONS.find(b => b.id === id)?.label || 'Отчёт', data: null }]);
    setLoading(true);
    try {
      const result = await fn(user);
      const text = typeof result === 'string' ? result : result.text;
      const table = result?.table || null;
      const title = result?.title || '';
      setMessages(p => [...p, { role: 'assistant', text, data: { table, title } }]);
    } catch (e) {
      setMessages(p => [...p, { role: 'assistant', text: '❌ Ошибка: ' + e.message, data: null }]);
    }
    setLoading(false);
  };

  // Отправка сообщения в AI
  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(p => [...p, { role: 'user', text: userMsg, data: null }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: messages.filter(m => m.role !== 'system').slice(-10).map(m => ({ role: m.role, text: m.text })),
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
      setMessages(p => [...p, { role: 'assistant', text: reply, data: null }]);
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', text: '❌ Ошибка соединения с сервером', data: null }]);
    }
    setLoading(false);
  };

  // Загрузка фото
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessages(p => [...p, { role: 'user', text: `📸 ${file.name}`, data: null }]);
    setLoading(true);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { data: analysis, error } = await supabase.functions.invoke('ai-photo', {
        body: { image: b64, user_id: user.id },
      });
      if (error || !analysis?.text) {
        setMessages(p => [...p, { role: 'assistant', text: '❌ Не удалось обработать фото', data: null }]);
      } else {
        setMessages(p => [...p, { role: 'assistant', text: analysis.text, data: null }]);
      }
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', text: '❌ Ошибка: ' + err.message, data: null }]);
    }
    setLoading(false);
    e.target.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: 'var(--font)' }}>
      
      {/* Шапка */}
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>🤖 AI помощник</h1>
        <div className="sub" style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.2rem' }}>
          Спрашивай, загружай фото, получай отчёты
        </div>
      </div>

      {/* Быстрые кнопки */}
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
        {QUICK_BUTTONS.map(btn => (
          <button key={btn.id} onClick={() => handleQuickReport(btn.id)} disabled={loading}
            style={{
              padding: '.4rem .75rem', fontSize: '.75rem', fontWeight: 500,
              borderRadius: '100px', border: '1px solid rgba(0,0,0,.1)',
              background: '#fff', cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit', color: '#555', transition: 'all .15s',
              whiteSpace: 'nowrap', opacity: loading ? .6 : 1,
            }}
            onMouseEnter={e => { if(!loading) e.currentTarget.style.background = '#f5f5f5'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}>
            {btn.label}
          </button>
        ))}
      </div>

      {/* Чат */}
      <div ref={listRef} style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        background: '#fff', borderRadius: '14px',
        border: '1px solid rgba(0,0,0,.08)',
        padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.75rem',
        marginBottom: '.75rem',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#999', fontSize: '.85rem' }}>
            Начните диалог или выберите быстрый отчёт 👆
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            maxWidth: '85%', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              padding: '.6rem .85rem', borderRadius: '12px', fontSize: '.82rem', lineHeight: 1.5,
              background: m.role === 'user' ? '#ffdd2d' : '#f5f5f5',
              color: m.role === 'user' ? '#000' : '#333',
              borderBottomRightRadius: m.role === 'user' ? '4px' : '12px',
              borderBottomLeftRadius: m.role === 'user' ? '12px' : '4px',
              whiteSpace: 'pre-wrap',
            }}>
              {m.text}
            </div>

            {/* Кнопка Excel если есть таблица */}
            {m.data?.table && (
              <div style={{ marginTop: '.4rem' }}>
                <button onClick={() => downloadExcel(m.data.table, (m.data.title || 'otchet').replace(/[^a-zа-я0-9_\-]/gi,'_')+'.xlsx')}
                  style={{
                    padding: '.25rem .6rem', fontSize: '.68rem', fontWeight: 600,
                    borderRadius: '6px', border: '1px solid rgba(0,0,0,.1)',
                    background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                    color: '#555',
                  }}>
                  ⬇ Скачать Excel
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '.6rem .85rem', borderRadius: '12px', background: '#f5f5f5', color: '#999', fontSize: '.82rem' }}>
            Печатает...
          </div>
        )}
      </div>

      {/* Поле ввода + фото */}
      <div style={{
        display: 'flex', gap: '.5rem', alignItems: 'center',
        background: '#fff', borderRadius: '14px',
        border: '1px solid rgba(0,0,0,.08)',
        padding: '.5rem .75rem',
      }}>
        <input type="file" accept="image/*" ref={fileRef} onChange={handlePhoto}
          style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.1rem', padding: '.25rem', lineHeight: 1,
            fontFamily: 'inherit', color: '#555', flexShrink: 0,
          }} title="Загрузить фото">📸
        </button>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение..."
          disabled={loading}
          style={{
            flex: 1, border: 'none', outline: 'none',
            fontSize: '.82rem', fontFamily: 'inherit',
            padding: '.35rem 0', color: '#333',
          }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{
            background: '#000', color: '#fff', border: 'none',
            borderRadius: '50%', width: '34px', height: '34px',
            cursor: (loading || !input.trim()) ? 'default' : 'pointer',
            fontSize: '.8rem', fontWeight: 600, flexShrink: 0,
            fontFamily: 'inherit', opacity: (loading || !input.trim()) ? .4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          ➤
        </button>
      </div>
    </div>
  );
}