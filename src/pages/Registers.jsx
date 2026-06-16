import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Registers() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('products');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [payMode, setPayMode] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('products').select('*').eq('user_id', user.id).order('name');
      if (data) setProducts(data.filter(p => !p.hidden));
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
    if (cart.length === 0) return;
    setPayMode(null);
    const date = new Date().toISOString().split('T')[0];
    const inserts = cart.map(item => ({
      user_id: user.id, type: 'income', amount: item.price * item.qty,
      description: item.name + (item.qty > 1 ? ` (${item.qty} шт)` : ''),
      date,
    }));
    const { error } = await supabase.from('transactions').insert(inserts);
    if (error) return setToast('❌ ' + error.message);
    setCart([]);
    setToast(`✅ Продано на ${total.toLocaleString()} ₽`);
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <>
      {toast && (
        <div style={{position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', border:'1px solid #e5e7eb', borderRadius:'.75rem', padding:'.75rem 1.2rem', fontSize:'.85rem', color:'#333', boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)', zIndex:9999 }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div><h1>Касса</h1><div className="sub">Продажа товаров и услуг</div></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div style={{display:'flex',gap:'16px',alignItems:'stretch'}}>
        {/* Левая панель — ЧЕК */}
        <div style={{width:'320px',minWidth:'320px',display:'flex',flexDirection:'column',gap:'10px'}}>
          <div style={{background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'14px',padding:'12px',display:'flex',flexDirection:'column',flex:1}}>
            <div style={{fontSize:'.78rem',fontWeight:600,marginBottom:'8px',paddingBottom:'6px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
              <span>ЧЕК</span>
              {cart.length > 0 && <span style={{fontSize:'.7rem',color:'var(--muted)'}}>{cart.reduce((s,i)=>s+i.qty,0)} шт</span>}
            </div>
            <div style={{flex:1,overflowY:'auto',minHeight:0}}>
              {cart.length === 0 ? (
                <div style={{textAlign:'center',padding:'2rem 0',color:'var(--muted)',fontSize:'.82rem'}}>
                  Выберите товары справа
                </div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.78rem'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left',padding:'4px 4px',color:'var(--muted)',fontWeight:500,fontSize:'.65rem',borderBottom:'1px solid var(--border)'}}>№</th>
                      <th style={{textAlign:'left',padding:'4px 4px',color:'var(--muted)',fontWeight:500,fontSize:'.65rem',borderBottom:'1px solid var(--border)'}}>Товар</th>
                      <th style={{textAlign:'center',padding:'4px 4px',color:'var(--muted)',fontWeight:500,fontSize:'.65rem',borderBottom:'1px solid var(--border)'}}>Кол-во</th>
                      <th style={{textAlign:'right',padding:'4px 4px',color:'var(--muted)',fontWeight:500,fontSize:'.65rem',borderBottom:'1px solid var(--border)'}}>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, i) => (
                      <tr key={item.id}>
                        <td style={{padding:'5px 4px',color:'var(--muted)',fontSize:'.72rem',borderBottom:'1px solid #f0f0f0'}}>{i+1}</td>
                        <td style={{padding:'5px 4px',borderBottom:'1px solid #f0f0f0'}}>
                          <div style={{fontWeight:500}}>{item.name}</div>
                        </td>
                        <td style={{textAlign:'center',padding:'5px 4px',borderBottom:'1px solid #f0f0f0',whiteSpace:'nowrap'}}>
                          <button onClick={() => updateQty(item.id, -1)} style={{background:'none',border:'1px solid #ddd',borderRadius:'4px',width:'22px',height:'22px',cursor:'pointer',fontSize:'.7rem',lineHeight:1,color:'#555'}}>−</button>
                          <span style={{margin:'0 6px',fontWeight:600,fontSize:'.82rem'}}>{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} style={{background:'none',border:'1px solid #ddd',borderRadius:'4px',width:'22px',height:'22px',cursor:'pointer',fontSize:'.7rem',lineHeight:1,color:'#555'}}>+</button>
                        </td>
                        <td style={{textAlign:'right',padding:'5px 4px',borderBottom:'1px solid #f0f0f0',fontWeight:600}}>{(item.price * item.qty).toLocaleString()}₽</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* Итого + кнопки оплаты */}
            {cart.length > 0 && (
              <>
                <div style={{borderTop:'1px solid var(--border)',paddingTop:'8px',marginTop:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'.75rem',color:'var(--muted)'}}>Итого</span>
                  <span style={{fontSize:'1rem',fontWeight:800}}>{total.toLocaleString()} ₽</span>
                </div>
                <div style={{display:'flex',gap:'6px',marginTop:'8px'}}>
                  <button onClick={() => setPayMode('cash')} style={{
                    flex:1, padding:'7px 0', borderRadius:'8px', border:'1.5px solid var(--border)',
                    background: payMode === 'cash' ? '#f0fdf4' : 'transparent',
                    color: payMode === 'cash' ? '#16a34a' : '#555',
                    fontSize:'.72rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  }}>💵 Наличные</button>
                  <button onClick={() => setPayMode('card')} style={{
                    flex:1, padding:'7px 0', borderRadius:'8px', border:'1.5px solid var(--border)',
                    background: payMode === 'card' ? '#e0f2fe' : 'transparent',
                    color: payMode === 'card' ? '#0369a1' : '#555',
                    fontSize:'.72rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  }}>💳 Карта</button>
                </div>
                <button onClick={sell} style={{
                  width:'100%', padding:'10px 0', borderRadius:'100px', border:'none',
                  background:'#000', color:'#fff', fontSize:'.85rem', fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit', marginTop:'6px',
                  opacity: payMode ? 1 : 0.4,
                }} disabled={!payMode}>Продать</button>
              </>
            )}
          </div>
        </div>

        {/* Правая панель — товары */}
        <div style={{flex:1,minWidth:0}}>
          {/* Переключатель и поиск */}
          <div className="search-row" style={{display:'flex',alignItems:'center',marginBottom:'10px',gap:'10px',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:'4px',background:'#f5f5f5',borderRadius:'8px',padding:'3px'}}>
              {[
                { key:'products', label:'Товары' },
                { key:'service', label:'Услуги' },
                { key:'all', label:'Все' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    padding:'5px 14px', borderRadius:'6px', border:'none',
                    background: tab === t.key ? '#fff' : 'transparent',
                    color: tab === t.key ? '#000' : '#888',
                    fontSize:'.72rem', fontWeight: tab === t.key ? 600 : 500,
                    cursor:'pointer', fontFamily:'inherit', boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                  }}>{t.label}</button>
              ))}
            </div>
            <div className="stock-search" style={{display:'flex',alignItems:'center',gap:'.3rem',flex:1,maxWidth:'300px',border:'1px solid var(--border)',borderRadius:'8px',padding:'6px 10px',background:'var(--body-bg)'}}>
              <span style={{fontSize:'.75rem',color:'var(--muted)',lineHeight:1}}>🔍</span>
              <input type="text" placeholder="Поиск товара или услуги..." value={search} onChange={e => setSearch(e.target.value)}
                style={{border:'none',outline:'none',flex:1,fontSize:'.8rem',fontFamily:'var(--font)',background:'none',padding:0}} />
            </div>
          </div>

          {/* Сетка товаров */}
          {filtered.length === 0 ? (
            <div className="empty-products"><div className="big-icon">📦</div><p>Нет товаров</p></div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',gap:'10px'}}>
              {filtered.map(p => (
                <div key={p.id} onClick={() => addToCart(p)}
                  style={{
                    background:'var(--body-bg)', border:'1px solid var(--border)', borderRadius:'12px',
                    padding:'12px 14px', cursor:'pointer',
                    transition:'box-shadow .15s, border-color .15s', userSelect:'none',
                    display:'flex', flexDirection:'column', gap:'4px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.06)'; e.currentTarget.style.borderColor='#ddd'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='var(--border)'; }}
                >
                  <div style={{fontSize:'.78rem',fontWeight:500,lineHeight:1.3}}>{p.name}</div>
                  <div style={{fontSize:'.85rem',fontWeight:700,color:'#000'}}>{(p.price||0).toLocaleString()} ₽</div>
                  <div style={{fontSize:'.62rem',color:'var(--muted)',marginTop:'2px'}}>{p.type === 'service' ? 'Услуга' : p.unit || 'шт'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
