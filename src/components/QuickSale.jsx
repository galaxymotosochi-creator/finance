import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function QuickSale({ onClose }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientDrop, setClientDrop] = useState(false);
  const [payMode, setPayMode] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payUnpaid, setPayUnpaid] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [pRes, aRes, clRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
        supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (aRes.data) setAccounts(aRes.data);
      if (clRes?.data) setClients(clRes.data);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

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

  const processSale = async () => {
    if (!cart.length || !selectedClient) return setToast('⚠️ Добавьте товары и выберите клиента');
    const date = new Date().toISOString().split('T')[0];
    
    let saleCatId = null;
    const { data: cats } = await supabase.from('categories').select('id').eq('user_id', user.id).eq('name', 'Доход от продаж').maybeSingle();
    if (cats) saleCatId = cats.id;
    else {
      const { data: newCat } = await supabase.from('categories').insert({ user_id: user.id, name: 'Доход от продаж', type: 'income' }).select('id').single();
      if (newCat) saleCatId = newCat.id;
    }

    const { count } = await supabase.from('receipts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const receiptNum = (count || 0) + 1;

    // Определяем статус чека
    var receiptStatus = 'paid';
    if (payUnpaid) receiptStatus = 'unpaid';
    else if (payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) < total) receiptStatus = 'partially_paid';

    // Создаём чек
    var clientObj = clients.find(c => c.id === selectedClient);
    var { data: newReceipt, error: receiptErr } = await supabase.from('receipts').insert({
      user_id: user.id, receipt_number: receiptNum,
      date, total_amount: total,
      status: receiptStatus,
      client_id: selectedClient || null,
      client_name: clientObj?.name || '',
      source: 'quick_sale',
    }).select('id').single();
    if (newReceipt) {
      var receiptItems = cart.map(function(item) {
        return {
          receipt_id: newReceipt.id, product_id: item.id,
          product_name: item.name, quantity: item.qty,
          price: item.price, total: item.price * item.qty,
        };
      });
      var { error: itemsErr } = await supabase.from('receipt_items').insert(receiptItems);
      if (itemsErr) console.warn('Не удалось сохранить товары чека:', itemsErr.message);
    } else if (receiptErr) {
      console.warn('Не удалось создать чек:', receiptErr.message);
    }

    if (payUnpaid) {
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id, type: 'income', amount: total,
        description: 'Продажа по чеку №' + receiptNum,
        date, status: 'unpaid', category_id: saleCatId,
      });
      if (error) return setToast('' + error.message);
      onClose();
      return;
    }

    if (!payMode) return setToast('⚠️ Выберите способ оплаты');
    const selectedAc = accounts.find(a => a.id === payMode);
    // Наличные → перенаправляем на счёт Касса
    var targetAc = selectedAc;
    if (selectedAc && selectedAc.type === 'cash') {
      targetAc = accounts.find(a => a.type === 'cash_register') || selectedAc;
    }
    const paidAmt = payAmount ? parseFloat(payAmount) : total;

    if (paidAmt > 0) {
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'income', amount: Math.min(paidAmt, total),
        description: (paidAmt >= total ? 'Продажа по чеку №' : 'Частичная оплата по чеку №') + receiptNum,
        date, account_id: targetAc?.id || null, status: 'paid', category_id: saleCatId,
      });
    }

    if (paidAmt > 0 && paidAmt < total) {
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'income', amount: total - paidAmt,
        description: 'Долг по чеку №' + receiptNum,
        date, status: 'debt', category_id: saleCatId,
      });
      const client = clients.find(c => c.id === selectedClient);
      const curDebt = parseFloat(client?.debt) || 0;
      await supabase.from('clients').update({ debt: curDebt - (total - paidAmt) }).eq('id', selectedClient);
    }

    onClose();
  };

  if (loading) return null;

  return (
    <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') onClose(); }}>
      {toast && <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'1rem 1.5rem',fontSize:'.9rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:10000}}>{toast}</div>}
      <div className="modal-box" style={{maxWidth:'520px',maxHeight:'85vh',display:'flex',flexDirection:'column',padding:0}}>
        <div style={{padding:'20px 24px 0',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #eee',paddingBottom:'12px'}}>
          <h2 style={{fontSize:'16px',fontWeight:700,margin:0}}>Быстрая продажа</h2>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'#999',padding:'0 4px'}}>×</button>
        </div>

        <div style={{padding:'12px 24px 0'}}>
          {/* Клиент */}
          <label style={{fontSize:'11px',fontWeight:600,color:'#888',display:'block',marginBottom:'4px'}}>Клиент</label>
          <div style={{display:'flex',gap:'6px',marginBottom:'12px'}}>
            <div style={{position:'relative',flex:1}}>
              <input type="text" placeholder="Поиск клиента..." value={selectedClient ? (clients.find(c => c.id === selectedClient)?.name || clientSearch) : clientSearch}
                onChange={e => { setClientSearch(e.target.value); setSelectedClient(''); setClientDrop(true); }}
                onFocus={() => setClientDrop(true)}
                onBlur={() => setTimeout(() => setClientDrop(false), 200)}
                style={{width:'100%',border:'1px solid #eee',borderRadius:'8px',padding:'7px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} />
              {clientDrop && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #eee',borderRadius:'8px',boxShadow:'0 4px 12px rgba(0,0,0,.1)',zIndex:10,maxHeight:'150px',overflowY:'auto',marginTop:'2px'}}>
                  {(clientSearch ? clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)) : clients).map(c => (
                    <div key={c.id} onMouseDown={() => { setSelectedClient(c.id); setClientSearch(c.name + (c.phone ? ' · '+c.phone : '')); setClientDrop(false); }}
                      style={{padding:'7px 10px',cursor:'pointer',fontSize:'13px',borderBottom:'1px solid #f5f5f5'}}
                      onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}>{c.name}{c.phone ? ' · '+c.phone : ''}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Товары */}
          <label style={{fontSize:'11px',fontWeight:600,color:'#888',display:'block',marginBottom:'4px'}}>Товары</label>
          <input type="text" placeholder="Поиск товара..." value={search} onChange={e => setSearch(e.target.value)}
            style={{width:'100%',border:'1px solid #eee',borderRadius:'8px',padding:'7px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit',marginBottom:'8px',boxSizing:'border-box'}} />
          
          <div style={{maxHeight:'120px',overflowY:'auto',marginBottom:'8px'}}>
            {(search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : products.slice(0,6)).map(p => (
              <div key={p.id} onClick={() => addToCart(p)} style={{display:'flex',justifyContent:'space-between',padding:'5px 8px',cursor:'pointer',borderRadius:'6px',fontSize:'13px'}}
                onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span>{p.name}</span>
                <span style={{fontWeight:600}}>{(p.price||0).toLocaleString()} ₽</span>
              </div>
            ))}
          </div>

          {/* Корзина */}
          {cart.length > 0 && (
            <div style={{background:'#f9f9f9',borderRadius:'8px',padding:'8px 10px',marginBottom:'10px',fontSize:'13px'}}>
              {cart.map((item, i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'3px 0'}}>
                  <span style={{flex:1}}>{item.name}</span>
                  <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                    <button onClick={() => updateQty(item.id, -1)} style={{width:'22px',height:'22px',borderRadius:'4px',border:'1px solid #ddd',background:'#fff',cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                    <span style={{minWidth:'14px',textAlign:'center',fontWeight:600}}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} style={{width:'22px',height:'22px',borderRadius:'4px',border:'1px solid #ddd',background:'#fff',cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                  </div>
                  <span style={{fontWeight:700,minWidth:'55px',textAlign:'right'}}>{(item.price * item.qty).toLocaleString()} ₽</span>
                </div>
              ))}
              <div style={{borderTop:'1px solid #eee',margin:'4px 0',paddingTop:'4px',display:'flex',justifyContent:'space-between',fontWeight:800}}>
                <span>ИТОГО:</span>
                <span>{total.toLocaleString()} ₽</span>
              </div>
            </div>
          )}
        </div>

        <div style={{padding:'0 24px 12px'}}>
          {/* Способ оплаты */}
          <label style={{fontSize:'11px',fontWeight:600,color:'#888',display:'block',marginBottom:'4px'}}>Способ оплаты</label>
          <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'10px'}}>
            {accounts.filter(function(a){return a.type !== 'cash';}).map(a => (
              <button key={a.id} onClick={() => setPayMode(a.id)} style={{
                padding:'6px 12px',borderRadius:'6px',border:'1px solid #eee',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                background: payMode === a.id ? '#000' : '#fff', color: payMode === a.id ? '#fff' : '#555',
              }}>{a.type === 'cash_register' ? 'Наличные' : a.name}</button>
            ))}
          </div>

          {/* Сумма оплаты */}
          {payMode && !payUnpaid && (
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'11px',fontWeight:600,color:'#888',display:'block',marginBottom:'4px'}}>Сумма</label>
              <input type="number" min="0" step="0.01" placeholder={total.toString()} value={payAmount} onChange={e => setPayAmount(e.target.value)}
                style={{width:'100%',border:'1px solid #eee',borderRadius:'8px',padding:'7px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} />
              {payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) < total && (
                <div style={{fontSize:'11px',color:'#92400e',marginTop:'3px'}}>Остаток {(total - parseFloat(payAmount)).toLocaleString()} ₽ — долг</div>
              )}
            </div>
          )}

          {/* Не оплачен */}
          <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',cursor:'pointer',marginBottom:'10px',color:'#555'}}>
            <input type="checkbox" checked={payUnpaid} onChange={e => { setPayUnpaid(e.target.checked); if (e.target.checked) setPayMode(null); }} style={{accentColor:'#dc2626'}} />
            Не оплачивать
          </label>
        </div>

        <div style={{padding:'12px 24px 16px',borderTop:'1px solid #eee',display:'flex',gap:'8px'}}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{flex:1}}>Отмена</button>
          <button type="button" className="btn btn-account-select" onClick={processSale} disabled={!cart.length || !selectedClient}
            style={{flex:1,opacity: (cart.length && selectedClient) ? 1 : 0.4}}>Продать</button>
        </div>
      </div>
    </div>
  );
}
