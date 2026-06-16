import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

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

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }
  }, [toast]);

  const filtered = useMemo(() => {
    let items = products.filter(p => tab === 'all' || p.type === tab);
    if (search) { const q = search.toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(q)); }
    return items;
  }, [products, search, tab]);

  const gridItems = useMemo(() => {
    const items = [...filtered];
    const filler = items.length % 4;
    for (let i = 0; i < (filler ? 4 - filler : 0); i++) items.push(null);
    return items;
  }, [filtered]);

  const addToCart = (p) => {
    setCart(prev => {
      const exist = prev.find(item => item.id === p.id);
      if (exist) return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { id: p.id, name: p.name, price: p.price || 0, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, qty: newQty } : i);
    });
  };

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const sell = async () => {
    if (cart.length === 0 || !payMode) return;
    const date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('transactions').insert(
      cart.map(item => ({
        user_id: user.id, type: 'income', amount: item.price * item.qty,
        description: item.name + (item.qty > 1 ? ' (' + item.qty + ' шт)' : ''), date,
      }))
    );
    if (error) return setToast('Ошибка: ' + error.message);
    setCart([]); setPayMode(null);
    setToast('Продано на ' + total.toLocaleString() + ' руб');
  };

  const openShift = async () => {
    const bal = parseFloat(openShiftBal) || 0;
    const { data, error } = await supabase.from('shifts').insert({
      user_id: user.id, opening_balance: bal, status: 'open',
      cashier_name: openShiftCashier.trim() || userName,
    }).select().single();
    if (error) return setToast('Ошибка: ' + error.message);
    if (data) setActiveShift(data);
    setShowOpenShift(false);
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <div style={{display:'flex',gap:'10px',height:'100%'}}>
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.75rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}

      {/* ЧЕК */}
      <div style={{width:'360px',minWidth:'360px',display:'flex',flexDirection:'column',gap:'8px',height:'100%'}}>
        <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'14px',padding:'12px',display:'flex',flexDirection:'column',flex:1}}>
          <div style={{fontSize:'.78rem',fontWeight:600,marginBottom:'8px',paddingBottom:'6px',borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between'}}>
            <span>ЧЕК</span>
            {cart.length > 0 && <span style={{fontSize:'.7rem',color:'var(--muted)'}}>{cart.reduce((s,i)=>s+i.qty,0)} шт</span>}
          </div>
          <div style={{flex:1,overflowY:'auto',minHeight:0}}>
            {cart.length === 0 ? (
              <div style={{textAlign:'center',padding:'2rem 0',color:'var(--muted)',fontSize:'.82rem'}}>Выберите товары справа</div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.78rem'}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left',padding:'4px',color:'var(--muted)',fontWeight:500,fontSize:'.65rem',borderBottom:'1px solid #eee'}}>N</th>
                    <th style={{textAlign:'left',padding:'4px',color:'var(--muted)',fontWeight:500,fontSize:'.65rem',borderBottom:'1px solid #eee'}}>Товар</th>
                    <th style={{textAlign:'center',padding:'4px',color:'var(--muted)',fontWeight:500,fontSize:'.65rem',borderBottom:'1px solid #eee'}}>Кол-во</th>
                    <th style={{textAlign:'right',padding:'4px',color:'var(--muted)',fontWeight:500,fontSize:'.65rem',borderBottom:'1px solid #eee'}}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, i) => (
                    <tr key={item.id}>
                      <td style={{padding:'5px 4px',color:'var(--muted)',fontSize:'.72rem',borderBottom:'1px solid #f5f5f5'}}>{i+1}</td>
                      <td style={{padding:'5px 4px',borderBottom:'1px solid #f5f5f5'}}><div style={{fontWeight:500}}>{item.name}</div></td>
                      <td style={{textAlign:'center',padding:'5px 4px',borderBottom:'1px solid #f5f5f5'}}>
                        <button onClick={() => updateQty(item.id, -1)} style={{background:'none',border:'1px solid #ddd',borderRadius:'4px',width:'22px',height:'22px',cursor:'pointer',fontSize:'.7rem',color:'#555'}}>-</button>
                        <span style={{margin:'0 6px',fontWeight:600,fontSize:'.82rem'}}>{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} style={{background:'none',border:'1px solid #ddd',borderRadius:'4px',width:'22px',height:'22px',cursor:'pointer',fontSize:'.7rem',color:'#555'}}>+</button>
                      </td>
                      <td style={{textAlign:'right',padding:'5px 4px',borderBottom:'1px solid #f5f5f5',fontWeight:600}}>{(item.price * item.qty).toLocaleString()} руб</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {cart.length > 0 && (
            <>
              <div style={{borderTop:'1px solid #eee',paddingTop:'8px',marginTop:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'.75rem',color:'var(--muted)'}}>Итого</span>
                <span style={{fontSize:'1.1rem',fontWeight:800}}>{total.toLocaleString()} руб</span>
              </div>
              <div style={{display:'flex',gap:'6px',marginTop:'8px'}}>
                {['Наличные','Карта'].map(m => (
                  <button key={m} onClick={() => setPayMode(m === 'Наличные' ? 'cash' : 'card')} style={{
                    flex:1, padding:'8px 0', borderRadius:'8px', border:'1.5px solid #ddd',
                    background: payMode === (m === 'Наличные' ? 'cash' : 'card') ? '#f0fdf4' : 'transparent',
                    color: payMode === (m === 'Наличные' ? 'cash' : 'card') ? '#16a34a' : '#555',
                    fontSize:'.78rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  }}>{m}</button>
                ))}
              </div>
              <button onClick={sell} style={{
                width:'100%', padding:'12px 0', borderRadius:'100px', border:'none',
                background:'#000', color:'#fff', fontSize:'.9rem', fontWeight:700,
                cursor:'pointer', fontFamily:'inherit', marginTop:'8px', opacity: payMode ? 1 : 0.4,
              }} disabled={!payMode}>Продать</button>
            </>
          )}
        </div>
      </div>

      {/* Правая панель */}
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',height:'100%'}}>
        {activeShift && (
          <div style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.35rem .7rem',background:'#f0fdf4',borderRadius:'8px',marginBottom:'8px',fontSize:'.72rem',color:'#333'}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#16a34a'}} />
            <span>{activeShift.cashier_name || '-'} · Остаток {(parseFloat(activeShift.opening_balance)||0).toLocaleString()} руб</span>
          </div>
        )}
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px',flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:'4px',background:'#f5f5f5',borderRadius:'8px',padding:'3px'}}>
            {['Товары','Услуги','Все'].map((l, i) => {
              const key = i === 2 ? 'all' : i === 0 ? 'products' : 'service';
              return (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding:'5px 14px', borderRadius:'6px', border:'none',
                  background: tab === key ? '#fff' : 'transparent',
                  color: tab === key ? '#000' : '#888',
                  fontSize:'.72rem', fontWeight: tab === key ? 600 : 500,
                  cursor:'pointer', fontFamily:'inherit',
                  boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                }}>{l}</button>
              );
            })}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'.3rem',flex:1,maxWidth:'280px',border:'1px solid #ddd',borderRadius:'8px',padding:'6px 10px',background:'#fff'}}>
            <span style={{fontSize:'.75rem',color:'var(--muted)',lineHeight:1}}>@</span>
            <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}
              style={{border:'none',outline:'none',flex:1,fontSize:'.8rem',fontFamily:'var(--font)',background:'none',padding:0}} />
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',minHeight:0}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px'}}>
            {gridItems.map((p, i) => (
              p ? (
                <div key={p.id} onClick={() => addToCart(p)}
                  style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'10px',padding:'10px 12px',cursor:'pointer',
                    transition:'box-shadow .15s,border-color .15s',display:'flex',flexDirection:'column',gap:'3px'}}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.06)'; e.currentTarget.style.borderColor='#ccc'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='#e5e7eb'; }}>
                  <div style={{fontSize:'.78rem',fontWeight:500,lineHeight:1.3}}>{p.name}</div>
                  <div style={{fontSize:'.85rem',fontWeight:700,color:'#000'}}>{(p.price||0).toLocaleString()} руб</div>
                  <div style={{fontSize:'.6rem',color:'var(--muted)',marginTop:'1px'}}>{p.type === 'service' ? 'Услуга' : p.unit || 'шт'}</div>
                </div>
              ) : (
                <div key={'e'+i} style={{background:'#f9f9f9',border:'1px dashed #e0e0e0',borderRadius:'10px',padding:'10px 12px',minHeight:'80px'}} />
              )
            ))}
          </div>
        </div>
      </div>

      {/* Модалка открытия смены */}
      {showOpenShift && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowOpenShift(false); }}>
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