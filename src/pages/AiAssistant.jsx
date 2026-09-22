import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getReport, getWeeklyReport, getTopProducts, getZeroStock, getForecast, downloadExcel } from '../lib/aiActions';
import { getCurrencySymbol } from '../lib/currency';
import Atlas from '../components/Atlas';


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
    accts.forEach(a => { const b = (parseFloat(a.balance)||0) + (txById[a.id]||0); text += `- ${a.name}: ${b.toLocaleString()} ${cur}\n`; total += b; });
    text += `\n📊 Общий баланс: ${total.toLocaleString()} ${cur}`; return text;
  },
  GET_DEBTORS: async (p, user) => {
    const {data:clients} = await supabase.from('clients').select('name,debt').eq('user_id',user.id).not('debt','is',null).lt('debt',0).order('debt',{ascending:true});
    if (!clients?.length) return '✅ Нет должников';
    return '⚠️ Должники:\n' + clients.map(c => `- ${c.name}: ${Math.abs(Number(c.debt)).toLocaleString()} ${cur}`).join('\n');
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
    return `🗄️ Касса: ${shift.cashier_name || '—'}\nОткрыта: ${new Date(shift.opened_at).toLocaleString('ru-RU')}\nПродажи сегодня: +${sales.toLocaleString()} ${cur}`;
  },
  GET_FORECAST: async (p, user) => { const r = await getForecast(user); return r.text; },
};

// Быстрые отчеты (возвращают { text, table, title })
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
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState('calm');
  const moodTimer = useRef(null);
  const listRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // Загрузка истории переписки пользователя (только своя — фильтр по user_id)
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.from('ai_messages')
          .select('id,role,text,data,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(300);
        if (!alive) return;
        setMessages((data || []).map(m => ({ role: m.role, text: m.text, data: m.data || null })));
      } catch (e) { /* тихо */ }
    })();
    return () => { alive = false; };
  }, [user]);

  // Сохранение сообщения в базу (привязано к аккаунту)
  const saveMsg = async (role, text, data) => {
    if (!user) return;
    try {
      await supabase.from('ai_messages').insert({
        id: Date.now() + Math.floor(Math.random() * 1000),
        user_id: user.id,
        role,
        text: text || '',
        data: data || null,
      });
    } catch (e) { /* тихо */ }
  };

  // Очистить историю (свою)
  const clearHistory = async () => {
    if (!user) return;
    if (!window.confirm('Очистить всю историю переписки с Атласом?')) return;
    try {
      await supabase.from('ai_messages').delete().eq('user_id', user.id);
      setMessages([]);
      setToast && setToast('История очищена');
    } catch (e) { /* тихо */ }
  };

  // Эмоции Атласа: радость/грусть держим ~2с, затем спокойный
  const flashMood = (m, ms) => {
    if (moodTimer.current) clearTimeout(moodTimer.current);
    setMood(m);
    moodTimer.current = setTimeout(() => setMood('calm'), ms || 2000);
  };
  // Слушает, когда есть текст в поле
  useEffect(() => {
    if (loading) return;
    setMood(input.trim() ? 'listen' : 'calm');
  }, [input, loading]);

  // Быстрый отчет
  const handleQuickReport = async (id) => {
    const fn = REPORT_ACTIONS[id];
    if (!fn) return;
    const qLabel = QUICK_BUTTONS.find(b => b.id === id)?.label || 'Отчет';
    setMessages(p => [...p, { role: 'user', text: qLabel, data: null }]);
    saveMsg('user', qLabel, null);
    setLoading(true); setMood('think');
    try {
      const result = await fn(user);
      const text = typeof result === 'string' ? result : result.text;
      const table = result?.table || null;
      const title = result?.title || '';
      setMessages(p => [...p, { role: 'assistant', text, data: { table, title } }]);
      saveMsg('assistant', text, { table, title });
      flashMood('joy', 2000);
    } catch (e) {
      setMessages(p => [...p, { role: 'assistant', text: '❌ Ошибка: ' + e.message, data: null }]);
      saveMsg('assistant', '❌ Ошибка: ' + e.message, null);
      flashMood('sad', 2500);
    }
    setLoading(false);
  };

  // Отправка сообщения в AI
  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(p => [...p, { role: 'user', text: userMsg, data: null }]);
    saveMsg('user', userMsg, null);
    setLoading(true); setMood('think');
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
      saveMsg('assistant', reply, null);
      flashMood(/^❌/.test(reply) ? 'sad' : 'joy', 2200);
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', text: '❌ Ошибка соединения с сервером', data: null }]);
      saveMsg('assistant', '❌ Ошибка соединения с сервером', null);
      flashMood('sad', 2500);
    }
    setLoading(false);
  };

  // Загрузка фото
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessages(p => [...p, { role: 'user', text: `📸 ${file.name}`, data: null }]);
    saveMsg('user', `📸 ${file.name}`, null);
    setLoading(true); setMood('think');
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
        saveMsg('assistant', '❌ Не удалось обработать фото', null);
        flashMood('sad', 2500);
      } else {
        setMessages(p => [...p, { role: 'assistant', text: analysis.text, data: null }]);
        saveMsg('assistant', analysis.text, null);
        flashMood('joy', 2200);
      }
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', text: '❌ Ошибка: ' + err.message, data: null }]);
      saveMsg('assistant', '❌ Ошибка: ' + err.message, null);
      flashMood('sad', 2500);
    }
    setLoading(false);
    e.target.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: 'var(--font)' }}>
      
      {/* Окно раздела: рамка с тенью + шапка с тремя точками */}
      <div className="ai-window">
      <div className="ai-topbar">
        <i className="tdot r"></i><i className="tdot y"></i><i className="tdot g"></i>
        <span className="ai-topbar-t">AI помощник</span>
      </div>

      {/* Шапка с Атласом */}
      <div className="ai-hero">
        <Atlas mood={mood} size={0.72} />
        <h2>Привет! Я Атлас</h2>
        <p>Ваш помощник по бизнесу. Задайте мне вопрос!</p>
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5}}>
          <div className="ai-status"><span className="live"></span>Онлайн</div>
          <button type="button" className="ai-clear" onClick={clearHistory} title="Очистить историю переписки">Очистить историю</button>
        </div>
      </div>

      {/* Чат */}
      <div className="ai-chatbox" ref={listRef}>
        {messages.length === 0 && (
          <div className="ai-msg bot">
            <div className="ai-av bot">A</div>
            <div className="ai-bub">👋 Привет! Чем могу помочь?</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={'ai-msg ' + (m.role === 'user' ? 'me' : 'bot')}>
            <div className={'ai-av ' + (m.role === 'user' ? 'user' : 'bot')}>{m.role === 'user' ? 'Ю' : 'A'}</div>
            <div className="ai-bub">
              {m.text}
            </div>
            <div style={{display:'flex',flexDirection:'column'}}>
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
          </div>
        ))}
        {loading && (
          <div className="ai-msg bot">
            <div className="ai-av bot">A</div>
            <div className="ai-bub" style={{ color: '#8b93a3' }}>Атлас думает…</div>
          </div>
        )}
      </div>

      {/* Окно ввода — как в превью */}
      <div className="ai-composer">
        <div className="ai-inputrow">
          <input type="file" accept="image/*" ref={fileRef} onChange={handlePhoto} style={{ display: 'none' }} />
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Спросите Атласа или загрузите фото накладной…"
            disabled={loading} />
          <button type="button" className="ai-clip" onClick={() => fileRef.current?.click()} title="Загрузить фото">📎</button>
          <button type="button" className="ai-send" onClick={send} disabled={loading || !input.trim()}>➤</button>
        </div>
        <div className="ai-hint">Атлас может ошибаться — проверяйте важные цифры</div>
      </div>
      </div>
    </div>
  );
}