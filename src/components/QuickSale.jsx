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
  const [paySplit, setPaySplit] = useState(false);
  const [splitAmts, setSplitAmts] = useState({});
  const [userName, setUserName] = useState('');
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
      const { data: profile } = await supabase.from('user_profiles').select('name').eq('user_id', user.id).maybeSingle();
      if (profile?.name) setUserName(profile.name);
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
      cashier_name: userName || '',
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

    // Уменьшаем остатки на складе
    try {
      var woItems = cart.map(function(item){return {prodId:item.id, name:item.name, qty:item.qty, cost:0};});
      await supabase.from('writeoffs').insert({
        id: Date.now(), user_id: user.id, name: 'Продажа (быстрая) по чеку №' + receiptNum,
        items: woItems, quantity: woItems.reduce(function(s,i){return s+i.qty},0),
        reason: 'Продажа', date: date, created_at: new Date().toISOString()
      });
    } catch(e) { console.error('Ошибка списания со склада:', e); }

    onClose();
  };

  if (loading) return null;

  return (
    <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') onClose(); }}>
      {toast && <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'1rem 1.5rem',fontSize:'.9rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:10000}}>{toast}</div>}
      <div className="modal-box" style={{maxWidth:'520px',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
        <h2 style={{fontSize:'1.15rem',fontWeight:700,margin:0}}>Быстрая продажа</h2>
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div style={{padding:'12px 24px 0'}}>
          </div>
          {/* Клиент */}
          <div className="form-group">
            <label>Клиент</label>
            <div style={{position:'relative'}}>
              <input type="text" placeholder="Поиск по имени или телефону..." value={selectedClient ? (clients.find(c => c.id === selectedClient)?.name || clientSearch) : clientSearch}
                onChange={e => { setClientSearch(e.target.value); setSelectedClient(''); setClientDrop(true); }}
                onFocus={() => setClientDrop(true)}
                onBlur={() => setTimeout(() => setClientDrop(false), 200)}
                style={{width:'100%',padding:'.5rem .65rem',fontSize:'.82rem',border:'1.5px solid var(--border)',borderRadius:'var(--radius-md)',outline:'none',fontFamily:'var(--font)',boxSizing:'border-box'}} />
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
          <div className="form-group"><label>Товар или услуга</label>
          <div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
          <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}
            style={{flex:1,border:'1.5px solid #e0e0e0',borderRadius:'8px',padding:'9px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit'}} />
          <button type="button" onClick={() => { var bc = prompt('Введите штрихкод:'); if (bc) { var found = products.find(p => p.barcode === bc.trim()); if (found) { addToCart(found); setToast('Найден: '+found.name); } else setToast('Товар со штрихкодом '+bc+' не найден'); } }}
            style={{padding:'8px 12px',border:'1.5px solid #e0e0e0',borderRadius:'8px',background:'#fff',cursor:'pointer',fontSize:'13px',fontFamily:'inherit'}}>📷</button>
        </div>
          
          <div style={{maxHeight:'120px',overflowY:'auto',marginBottom:'8px'}}>
            {(search.trim() ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : []).map(p => (
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
          <div className="form-group" style={{marginTop:'.5rem'}}>
            <label>Способ оплаты</label>
          <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'10px'}}>
            {accounts.filter(function(a){return a.type !== 'cash';}).map(a => (
              <button key={a.id} onClick={() => setPayMode(a.id)} style={{
                    flex:1, padding:'8px 6px', borderRadius:'8px', border:'1.5px solid #eee',
                    background: payMode === a.id ? '#111' : '#fff',
                    color: payMode === a.id ? '#fff' : '#555',
                    fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', minWidth:'60px'
                  }}>{a.type === 'cash_register' ? 'Наличные' : a.name}</button>
            ))}
          </div>

          {/* Сумма оплаты */}
          {payMode && !payUnpaid && (
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'11px',fontWeight:600,color:'#888',display:'block',marginBottom:'4px'}}>Сумма</label>
              <input type="number" min="0" step="0.01" placeholder={total.toString()} value={payAmount} onChange={e => setPayAmount(e.target.value)}
                style={{width:'100%',padding:'.5rem .65rem',fontSize:'.82rem',border:'1.5px solid var(--border)',borderRadius:'var(--radius-md)',outline:'none',fontFamily:'var(--font)',boxSizing:'border-box'}} />
              {payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) < total && (
                <div style={{fontSize:'11px',color:'#92400e',marginTop:'3px'}}>Остаток {(total - parseFloat(payAmount)).toLocaleString()} ₽ — долг</div>
              )}
            </div>
          )}

          {/* Не оплачен */}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'18px'}}>
            <label style={{position:'relative',display:'inline-block',width:'36px',height:'20px',cursor:'pointer'}}>
              <input type="checkbox" checked={paySplit} onChange={e => { setPaySplit(e.target.checked); if (!e.target.checked) setSplitAmts({}); }} style={{opacity:0,width:0,height:0}} />
              <span style={{position:'absolute',inset:0,background:paySplit?'#000':'#ddd',borderRadius:'100px',transition:'.2s'}}>
                <span style={{position:'absolute',top:'2px',left:paySplit?'18px':'2px',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',transition:'.2s'}}></span>
              </span>
            </label>
            <span style={{fontSize:'13px',fontWeight:500,color:'#111'}}>Разделить на счета</span>
          </div>
          {paySplit && (
            <div style={{marginBottom:'14px'}}>
              {accounts.filter(function(a){return a.type !== 'cash';}).map(a => {
                const remain = total - Object.entries(splitAmts).filter(([id]) => id !== a.id).reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
                return (
                  <div key={a.id} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px',justifyContent:'flex-end'}}>
                    <span style={{fontSize:'12px',fontWeight:500,color:'#555'}}>{a.type === 'cash_register' ? 'Наличные' : a.name}</span>
                    <input type="number" min="0" step="0.01" placeholder={Math.round(remain).toString()}
                      value={splitAmts[a.id] || ''} onChange={e => setSplitAmts({...splitAmts, [a.id]: e.target.value})}
                      style={{width:'90px',border:'1.5px solid #eee',borderRadius:'6px',padding:'5px 8px',fontSize:'13px',outline:'none',fontFamily:'inherit',textAlign:'right'}} />
                  </div>
                );
              })}
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'18px'}}>
            <label style={{position:'relative',display:'inline-block',width:'36px',height:'20px',cursor:'pointer'}}>
              <input type="checkbox" checked={payUnpaid} onChange={e => { setPayUnpaid(e.target.checked); if (e.target.checked) { setPaySplit(false); setSplitAmts({}); }} } style={{opacity:0,width:0,height:0}} />
              <span style={{position:'absolute',inset:0,background:payUnpaid?'#dc2626':'#ddd',borderRadius:'100px',transition:'.2s'}}>
                <span style={{position:'absolute',top:'2px',left:payUnpaid?'18px':'2px',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',transition:'.2s'}}></span>
              </span>
            </label>
            <span style={{fontSize:'13px',fontWeight:500,color:'#111'}}>Не оплачивать сейчас (долг)</span>
          </div>
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
