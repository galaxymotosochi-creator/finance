import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function QuickSupply({ onClose }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [supplier, setSupplier] = useState('');
  const [payMode, setPayMode] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const [pRes, aRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (aRes.data) setAccounts(aRes.data);
    })();
  }, [user]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  const addToCart = (p) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price || 0, qty: 1 }];
    });
  };

  const total = cart.reduce((s, i) => s + i.cost * i.qty, 0);

  const process = async () => {
    if (!cart.length || !payMode) return setToast('⚠️ Добавьте товары и выберите счёт');
    const items = cart.map(i => ({ prodId: i.id, name: i.name, qty: i.qty, cost: i.cost || 0 }));
    const { error } = await supabase.from('supplies').insert({
      user_id: user.id, supplier: supplier.trim() || null, items,
      total: items.reduce((s, i) => s + i.cost * i.qty, 0),
      account_id: payMode, date: new Date().toISOString().split('T')[0],
    });
    if (error) return setToast('' + error.message);
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') onClose(); }}>
      {toast && <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'1rem 1.5rem',fontSize:'.9rem',zIndex:10000}}>{toast}</div>}
      <div className="modal-box" style={{maxWidth:'500px',maxHeight:'85vh',display:'flex',flexDirection:'column',padding:0}}>
        <div style={{padding:'20px 24px 0',display:'flex',justifyContent:'space-between',alignItems:'center',paddingBottom:'12px',borderBottom:'1px solid #eee'}}>
          <h2 style={{fontSize:'16px',fontWeight:700,margin:0}}>Поставка</h2>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'#999',padding:'0 4px'}}>×</button>
        </div>
        <div style={{padding:'12px 24px 0',flex:1,overflowY:'auto'}}>
          <input type="text" placeholder="Поставщик" value={supplier} onChange={e => setSupplier(e.target.value)}
            style={{width:'100%',border:'1px solid #eee',borderRadius:'8px',padding:'7px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit',marginBottom:'8px',boxSizing:'border-box'}} />
          <input type="text" placeholder="Поиск товара..." value={search} onChange={e => setSearch(e.target.value)}
            style={{width:'100%',border:'1px solid #eee',borderRadius:'8px',padding:'7px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit',marginBottom:'6px',boxSizing:'border-box'}} />
          <div style={{maxHeight:'100px',overflowY:'auto',marginBottom:'8px'}}>
            {(search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : products.slice(0,5)).map(p => (
              <div key={p.id} onClick={() => addToCart(p)} style={{display:'flex',justifyContent:'space-between',padding:'4px 8px',cursor:'pointer',borderRadius:'6px',fontSize:'13px'}}
                onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span>{p.name}</span>
                <span style={{fontWeight:600}}>{(p.price||0).toLocaleString()} ₽</span>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div style={{background:'#f9f9f9',borderRadius:'8px',padding:'8px 10px',marginBottom:'10px',fontSize:'13px'}}>
              {cart.map((item, i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'3px 0',gap:'4px'}}>
                  <span style={{flex:1,fontSize:'12px'}}>{item.name}</span>
                  <input type="number" min="0" step="0.01" placeholder="Цена"
                    value={item.cost || ''} onChange={e => setCart(prev => prev.map((x,j) => j === i ? {...x, cost: parseFloat(e.target.value) || 0} : x))}
                    style={{width:'70px',border:'1px solid #eee',borderRadius:'4px',padding:'3px 6px',fontSize:'12px',outline:'none',fontFamily:'inherit'}} />
                  <span style={{fontSize:'12px',color:'#999'}}>×{item.qty}</span>
                  <button onClick={() => setCart(prev => prev.filter((_,j) => j !== i))} style={{background:'none',border:'none',cursor:'pointer',fontSize:'14px',color:'#999',padding:'0 2px'}}>✕</button>
                </div>
              ))}
              <div style={{borderTop:'1px solid #eee',margin:'4px 0',paddingTop:'4px',display:'flex',justifyContent:'space-between',fontWeight:800}}>
                <span>Итого:</span>
                <span>{total.toLocaleString()} ₽</span>
              </div>
            </div>
          )}
        </div>
        <div style={{padding:'0 24px 12px'}}>
          <label style={{fontSize:'11px',fontWeight:600,color:'#888',display:'block',marginBottom:'4px'}}>Счёт списания</label>
          <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'8px'}}>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setPayMode(a.id)} style={{
                padding:'6px 12px',borderRadius:'6px',border:'1px solid #eee',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                background: payMode === a.id ? '#000' : '#fff', color: payMode === a.id ? '#fff' : '#555',
              }}>{a.name}</button>
            ))}
          </div>
        </div>
        <div style={{padding:'12px 24px 16px',borderTop:'1px solid #eee',display:'flex',gap:'8px'}}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{flex:1}}>Отмена</button>
          <button type="button" className="btn btn-account-select" onClick={process} disabled={!cart.length || !payMode}
            style={{flex:1,opacity: (cart.length && payMode) ? 1 : 0.4}}>Оформить</button>
        </div>
      </div>
    </div>
  );
}
