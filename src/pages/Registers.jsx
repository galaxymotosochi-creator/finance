import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const T = { name: '.85rem', price: '.95rem', label: '.68rem', small: '.72rem', cell: '.8rem' };

export default function Registers({ fullscreen }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('products');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [payMode, setPayMode] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [openShiftCashier, setOpenShiftCashier] = useState('');
  const [openShiftBal, setOpenShiftBal] = useState('0');

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Кассир';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [pRes, sRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('shifts').select('*').eq('user_id', user.id).eq('status', 'open').maybeSingle(),
      ]);
      if (pRes.data) setProducts(pRes.data.filter(p => !p.hidden));
      if (sRes.data) setActiveShift(sRes.data);
      else { setOpenShiftCashier(userName); setShowOpenShift(true); }
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); } }, [toast]);

  const filtered = useMemo(() => {
    let items = products.filter(p => tab === 'all' || p.type === tab);
    if (search) { const q = search.toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(q)); }
    return items;
  }, [products, search, tab]);

  const gridItems = useMemo(() => {
    const items = [...filtered];
    const cols = 4;
    const rem = items.length % cols;
    if (rem) for (let i = 0; i < cols - rem; i++) items.push(null);
    return items;
  }, [filtered]);

  const addToCart = (p) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price || 0, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      const i = prev.find(x => x.id === id);
      if (!i) return prev;
      const n = i.qty + delta;
      if (n <= 0) return prev.filter(x => x.id !== id);
      return prev.map(x => x.id === id ? { ...x, qty: n } : x);
    });
  };

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const sell = async () => {
    if (!cart.length || !payMode) return;
    const date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('transactions').insert(
      cart.map(i => ({ user_id: user.id, type: 'income', amount: i.price * i.qty, description: i.name + (i.qty > 1 ? ' (' + i.qty + ' шт)' : ''), date }))
    );
    if (error) return setToast('Ошибка: ' + error.message);
    setCart([]); setPayMode(null);
    setToast('Продано на ' + total.toLocaleString() + ' руб');
  };

  const openShift = async () => {
    const bal = parseFloat(openShiftBal) || 0;
    const { data, error } = await supabase.from('shifts').insert({
      user_id: user.id, opening_balance: bal, status: 'open', cashier_name: openShiftCashier.trim() || userName,
    }).select().single();
    if (error) return setToast('Ошибка: ' + error.message);
    if (data) setActiveShift(data);
    setShowOpenShift(false);
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <div style={{ display: 'flex', gap: '12px', height: '100%' }}>
      {toast && (
        <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'1rem 1.5rem', fontSize:'.9rem', color:'#333', boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)', zIndex:9999 }}>
          {toast}
        </div>
      )}

      {/* ЧЕК */}
      <div style={{ width: '380px', minWidth: '380px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: T.cell, fontWeight: 600, marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <span>ЧЕК</span>
            {cart.length > 0 && <span style={{ fontSize: T.small, color: 'var(--muted)' }}>{cart.reduce((s,i)=>s+i.qty,0)} шт</span>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--muted)', fontSize: T.cell }}>Выберите товары справа</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T.cell }}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left',padding:'5px 4px',color:'var(--muted)',fontWeight:500,fontSize:T.label,borderBottom:'1px solid #eee'}}>N</th>
                    <th style={{textAlign:'left',padding:'5px 4px',color:'var(--muted)',fontWeight:500,fontSize:T.label,borderBottom:'1px solid #eee'}}>Товар</th>
                    <th style={{textAlign:'center',padding:'5px 4px',color:'var(--muted)',fontWeight:500,fontSize:T.label,borderBottom:'1px solid #eee'}}>Кол-во</th>
                    <th style={{textAlign:'right',padding:'5px 4px',color:'var(--muted)',fontWeight:500,fontSize:T.label,borderBottom:'1px solid #eee'}}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, i) => (
                    <tr key={item.id}>
                      <td style={{padding:'6px 4px',color:'var(--muted)',fontSize:T.small,borderBottom:'1px solid #f5f5f5'}}>{i+1}</td>
                      <td style={{padding:'6px 4px',borderBottom:'1px solid #f5f5f5'}}><div style={{fontWeight:500,fontSize:T.cell}}>{item.name}</div></td>
                      <td style={{textAlign:'center',padding:'6px 4px',borderBottom:'1px solid #f5f5f5'}}>
                        <button onClick={() => updateQty(item.id, -1)} style={{background:'none',border:'1px solid #d0d0d0',borderRadius:'4px',width:'26px',height:'26px',cursor:'pointer',fontSize:T.cell,color:'#555'}}>-</button>
                        <span style={{margin:'0 8px',fontWeight:600,fontSize:T.name}}>{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} style={{background:'none',border:'1px solid #d0d0d0',borderRadius:'4px',width:'26px',height:'26px',cursor:'pointer',fontSize:T.cell,color:'#555'}}>+</button>
                      </td>
                      <td style={{textAlign:'right',padding:'6px 4px',borderBottom:'1px solid #f5f5f5',fontWeight:600,fontSize:T.cell}}>{(item.price * item.qty).toLocaleString()} руб</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {cart.length > 0 && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '10px', marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: T.cell, color: 'var(--muted)' }}>Итого</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{total.toLocaleString()} руб</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {[['Наличные','cash'],['Карта','card']].map(([l,m]) => (
                  <button key={l} onClick={() => setPayMode(m)} style={{
                    flex:1, padding:'10px 0', borderRadius:'8px', border:'1.5px solid #ddd',
                    background: payMode===m ? (m==='cash' ? '#f0fdf4' : '#e0f2fe') : 'transparent',
                    color: payMode===m ? (m==='cash' ? '#16a34a' : '#0369a1') : '#555',
                    fontSize:T.small, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  }}>{l}</button>
                ))}
              </div>
              <button onClick={sell} style={{ width:'100%', padding:'12px 0', borderRadius:'100px', border:'none', background:'#000', color:'#fff', fontSize:T.name, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: payMode?1:0.4 }} disabled={!payMode}>Продать</button>
            </div>
          )}
        </div>
      </div>

      {/* Правая панель */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', height:'100%' }}>
        {activeShift && (
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem', padding:'.45rem .8rem', background:'#f0fdf4', borderRadius:'8px', marginBottom:'8px', fontSize:T.small, color:'#333' }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#16a34a', flexShrink:0 }} />
            <span>{activeShift.cashier_name||'-'} · Остаток {(parseFloat(activeShift.opening_balance)||0).toLocaleString()} руб</span>
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:'4px', background:'#f5f5f5', borderRadius:'8px', padding:'3px' }}>
            {[['Товары','products'],['Услуги','service'],['Все','all']].map(([l,k]) => (
              <button key={k} onClick={() => setTab(k)} style={{ padding:'6px 16px', borderRadius:'6px', border:'none', background: tab===k?'#fff':'transparent', color: tab===k?'#000':'#888', fontSize:T.small, fontWeight: tab===k?600:500, cursor:'pointer', fontFamily:'inherit', boxShadow: tab===k?'0 1px 3px rgba(0,0,0,.1)':'none' }}>{l}</button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'.3rem', flex:1, maxWidth:'300px', border:'1px solid #ddd', borderRadius:'8px', padding:'7px 10px', background:'#fff' }}>
            <span style={{ fontSize:T.cell, color:'var(--muted)' }}>@</span>
            <input type="text" placeholder="Поиск товаров..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ border:'none', outline:'none', flex:1, fontSize:T.cell, fontFamily:'inherit', background:'none', padding:0 }} />
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
            {gridItems.map((p, i) => (
              p ? (
                <div key={p.id} onClick={() => addToCart(p)}
                  style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'14px', cursor:'pointer', transition:'box-shadow .15s,border-color .15s', display:'flex', flexDirection:'column', gap:'4px', minHeight:'90px' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.08)'; e.currentTarget.style.borderColor='#ccc'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='#e5e7eb'; }}>
                  <div style={{ fontSize:'.88rem', fontWeight:500, lineHeight:1.35 }}>{p.name}</div>
                  <div style={{ fontSize:'1rem', fontWeight:700, color:'#000' }}>{(p.price||0).toLocaleString()} руб</div>
                  <div style={{ fontSize:T.label, color:'var(--muted)', marginTop:'2px' }}>{p.type==='service'?'Услуга':p.unit||'шт'}</div>
                </div>
              ) : (
                <div key={'e'+i} style={{ background:'#f9f9f9', border:'1px dashed #e0e0e0', borderRadius:'12px', minHeight:'90px' }} />
              )
            ))}
          </div>
        </div>
      </div>

      {showOpenShift && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className==='modal-overlay active') setShowOpenShift(false); }}>
          <div className="modal-box" style={{maxWidth:'380px'}}>
            <button className="modal-close" onClick={() => setShowOpenShift(false)}>&times;</button>
            <h2>Открытие смены</h2>
            <div className="sub">Для работы кассы необходимо открыть смену</div>
            <form onSubmit={e => { e.preventDefault(); openShift(); }}>
              <div className="form-group">
                <label>Кассир</label>
                <input type="text" value={openShiftCashier} onChange={e => setOpenShiftCashier(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Остаток денег на начало дня (руб)</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={openShiftBal} onChange={e => setOpenShiftBal(e.target.value)} autoFocus />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-account-select">Открыть смену</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}