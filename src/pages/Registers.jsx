import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Registers({ fullscreen }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
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
      const [pRes, cRes, sRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('stock_categories').select('*').eq('user_id', user.id).order('name'),
        supabase.from('shifts').select('*').eq('user_id', user.id).eq('status', 'open').maybeSingle(),
      ]);
      if (pRes.data) setProducts(pRes.data.filter(p => !p.hidden));
      if (cRes.data) setCategories(cRes.data.filter(c => c.type === 'product'));
      if (sRes.data) setActiveShift(sRes.data);
      else { setOpenShiftCashier(userName); setShowOpenShift(true); }
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); } }, [toast]);

  const filtered = useMemo(() => {
    let items = products;
    if (catFilter !== 'all') items = items.filter(p => (p.cat || '') === catFilter);
    if (search) { const q = search.toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(q)); }
    return items;
  }, [products, search, catFilter]);

  const addToCart = (p) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price || 0, qty: 1, cat: p.cat || '' }];
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
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

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
    <div style={{display:'flex',gap:0,height:'100%',fontFamily:'Inter,-apple-system,BlinkMacSystemFont,sans-serif'}}>
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'1rem 1.5rem',fontSize:'.9rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}

      {/* Левая панель — чек */}
      <div style={{width:'280px',minWidth:'280px',display:'flex',flexDirection:'column',background:'#fff',borderRight:'1px solid #eee',height:'100%'}}>
        {/* Шапка с кассиром */}
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'14px',borderBottom:'1px solid #eee'}}>
          <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'#000',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,flexShrink:0}}>
            {(activeShift?.cashier_name || userName).charAt(0)}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{activeShift?.cashier_name || userName}</div>
            <div style={{fontSize:'10px',color:'#16a34a',fontWeight:500}}>● Смена открыта</div>
          </div>
        </div>

        {/* Список товаров в чеке */}
        <div style={{flex:1,overflowY:'auto'}}>
          {cart.length === 0 ? (
            <div style={{textAlign:'center',padding:'2rem 1rem',color:'#bbb',fontSize:'13px'}}>Выберите товары</div>
          ) : cart.map((item, i) => (
            <div key={item.id} style={{display:'flex',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid #f5f5f5',gap:'6px'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'13px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                <button onClick={() => updateQty(item.id, -1)} style={{width:'24px',height:'24px',borderRadius:'6px',border:'1px solid #e0e0e0',background:'#fff',fontSize:'14px',cursor:'pointer',color:'#333',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>−</button>
                <span style={{fontWeight:600,minWidth:'14px',textAlign:'center',fontSize:'13px'}}>{item.qty}</span>
                <button onClick={() => updateQty(item.id, 1)} style={{width:'24px',height:'24px',borderRadius:'6px',border:'1px solid #e0e0e0',background:'#fff',fontSize:'14px',cursor:'pointer',color:'#333',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>+</button>
              </div>
              <div style={{fontSize:'13px',fontWeight:700,minWidth:'60px',textAlign:'right'}}>{(item.price * item.qty).toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Итого и оплата */}
        <div style={{padding:'14px',borderTop:'1px solid #eee',display:'flex',flexDirection:'column',gap:'10px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'12px',color:'#999'}}>ИТОГО</span>
              <span style={{fontSize:'20px',fontWeight:800}}>{total.toLocaleString()} ₽</span>
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              {[['Наличные','cash'],['Карта','card']].map(([l,m]) => (
                <button key={l} onClick={() => setPayMode(m)} style={{
                  flex:1, padding:'10px', borderRadius:'8px', border:'1.5px solid #eee',
                  background: payMode === m ? '#000' : '#fff',
                  color: payMode === m ? '#fff' : '#555',
                  fontSize:'11px', fontWeight:600, cursor:'pointer', textAlign:'center',
                  fontFamily:'inherit',
                }}>{l}</button>
              ))}
            </div>
            <button onClick={sell} disabled={!payMode} style={{
              width:'100%', padding:'13px', borderRadius:'8px', border:'none',
              background:'#000', color:'#fff', fontSize:'14px', fontWeight:700,
              cursor:'pointer', fontFamily:'inherit', opacity: payMode ? 1 : 0.3,
            }}>Продажа</button>
          </div>
      </div>

      {/* Правая панель — товары */}
      <div style={{flex:1,display:'flex',flexDirection:'column',padding:'16px',minWidth:0}}>
        {/* Поиск */}
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Найти товар..."
            style={{flex:1,border:'1px solid #e5e5e5',borderRadius:'10px',padding:'9px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',background:'#fafafa'}} />
        </div>

        {/* Категории */}
        <div style={{display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px'}}>
          <button onClick={() => setCatFilter('all')} style={{
            padding:'5px 14px', borderRadius:'100px', border:'none', fontSize:'11px',
            fontWeight: catFilter === 'all' ? 600 : 500, cursor:'pointer', whiteSpace:'nowrap',
            background: catFilter === 'all' ? '#000' : '#f5f5f5',
            color: catFilter === 'all' ? '#fff' : '#666', fontFamily:'inherit',
          }}>Все</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.name)} style={{
              padding:'5px 14px', borderRadius:'100px', border:'none', fontSize:'11px',
              fontWeight: catFilter === c.name ? 600 : 500, cursor:'pointer', whiteSpace:'nowrap',
              background: catFilter === c.name ? '#000' : '#f5f5f5',
              color: catFilter === c.name ? '#fff' : '#666', fontFamily:'inherit',
            }}>{c.name}</button>
          ))}
        </div>

        {/* Сетка товаров */}
        <div style={{flex:1,overflowY:'auto',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',alignContent:'start'}}>
          {filtered.length === 0 ? (
            <div style={{gridColumn:'1/-1',textAlign:'center',padding:'3rem 0',color:'#bbb',fontSize:'13px'}}>Нет товаров</div>
          ) : filtered.map(p => (
            <div key={p.id} onClick={() => addToCart(p)}
              style={{background:'#fafafa',borderRadius:'12px',padding:'14px',cursor:'pointer',transition:'background .1s',display:'flex',flexDirection:'column',gap:'4px',minHeight:'70px'}}
              onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'}
              onMouseLeave={e => e.currentTarget.style.background='#fafafa'}>
              <div style={{fontSize:'12px',fontWeight:500,color:'#555',lineHeight:1.3}}>{p.name}</div>
              <div style={{fontSize:'15px',fontWeight:800,color:'#000',marginTop:'6px'}}>{(p.price||0).toLocaleString()} ₽</div>
              {p.cat && <div style={{fontSize:'10px',color:'#999',marginTop:'2px'}}>{p.cat}</div>}
            </div>
          ))}
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
              <div className="form-group"><label>Кассир</label><input type="text" value={openShiftCashier} onChange={e => setOpenShiftCashier(e.target.value)} /></div>
              <div className="form-group"><label>Остаток денег на начало дня (руб)</label><input type="number" placeholder="0" min="0" step="0.01" value={openShiftBal} onChange={e => setOpenShiftBal(e.target.value)} autoFocus /></div>
              <div className="modal-actions"><button type="submit" className="btn btn-account-select">Открыть смену</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}