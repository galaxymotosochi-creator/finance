import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Registers({ fullscreen }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allCats, setAllCats] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [payMode, setPayMode] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [openShiftCashier, setOpenShiftCashier] = useState('');
  const [openShiftBal, setOpenShiftBal] = useState('0');
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCat, setAddCat] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addUnit, setAddUnit] = useState('');
  const [addType, setAddType] = useState('product');
  const [addSku, setAddSku] = useState('');
  const [addBarcode, setAddBarcode] = useState('');
  const [addWeight, setAddWeight] = useState('0');
  const [addWeightUnit, setAddWeightUnit] = useState('кг');
  const [addDesc, setAddDesc] = useState('');
  const [showPay, setShowPay] = useState(false);
  const [paySplit, setPaySplit] = useState(false);
  const [payUnpaid, setPayUnpaid] = useState(false);
  const [splitAmts, setSplitAmts] = useState({});
  const [showActions, setShowActions] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closeFactBal, setCloseFactBal] = useState('');
  const [shiftTx, setShiftTx] = useState([]);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Кассир';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [pRes, cRes, sRes, aRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('stock_categories').select('*').eq('user_id', user.id).order('name'),
        supabase.from('shifts').select('*').eq('user_id', user.id).eq('status', 'open').maybeSingle(),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (cRes.data) { setCategories(cRes.data.filter(c => c.type === 'product')); setAllCats(cRes.data); }
      if (aRes.data) setAccounts(aRes.data);
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

  const openPay = () => {
    if (!cart.length) return;
    setPayMode(null);
    setPaySplit(false);
    setPayUnpaid(false);
    setSplitAmts({});
    setShowPay(true);
  };

  const processPay = async () => {
    if (!cart.length) return;
    const date = new Date().toISOString().split('T')[0];
    
    if (payUnpaid) {
      // Неоплаченный чек — одна транзакция без счёта
      const { error } = await supabase.from('transactions').insert(
        cart.map(i => ({ user_id: user.id, type: 'income', amount: i.price * i.qty, description: i.name + (i.qty > 1 ? ' (' + i.qty + ' шт)' : ''), date, status: 'unpaid' }))
      );
      if (error) return setToast('Ошибка: ' + error.message);
      setCart([]); setShowPay(false);
      return setToast('✅ Чек сохранён (не оплачен)');
    }

    if (paySplit) {
      // Раздельная оплата
      const entries = Object.entries(splitAmts).filter(([, v]) => v && parseFloat(v) > 0);
      if (entries.length === 0) return setToast('⚠️ Укажите суммы для оплаты');
      const sum = entries.reduce((s, [, v]) => s + parseFloat(v), 0);
      if (Math.abs(sum - total) > 0.01) return setToast('⚠️ Сумма оплаты не совпадает с итогом');
      for (const [acId, amt] of entries) {
        const { error } = await supabase.from('transactions').insert(
          cart.map(i => ({ user_id: user.id, type: 'income', amount: (i.price * i.qty) * (parseFloat(amt) / total), description: i.name + (i.qty > 1 ? ' (' + i.qty + ' шт)' : ''), date, account_id: acId, status: 'paid' }))
        );
        if (error) return setToast('Ошибка: ' + error.message);
      }
      setCart([]); setShowPay(false); setPayMode(null);
      return setToast('✅ Оплачено с нескольких счетов');
    }

    // Обычная оплата на один счёт
    if (!payMode) return setToast('⚠️ Выберите способ оплаты');
    const selectedAc = accounts.find(a => a.id === payMode);
    const { error } = await supabase.from('transactions').insert(
      cart.map(i => ({ user_id: user.id, type: 'income', amount: i.price * i.qty, description: i.name + (i.qty > 1 ? ' (' + i.qty + ' шт)' : ''), date, account_id: selectedAc?.id || null, status: 'paid' }))
    );
    if (error) return setToast('Ошибка: ' + error.message);
    setCart([]); setShowPay(false); setPayMode(null);
    setToast('Продано на ' + total.toLocaleString() + ' руб');
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (!addName.trim()) return setToast('⚠️ Введите название');
    const price = parseFloat(addPrice) || 0;
    const { error } = await supabase.from('products').insert({
      id: Date.now(), name: addName.trim(), cat: addCat, price, unit: addUnit || 'шт',
      type: addType, sku: addSku.trim(), barcode: addBarcode.trim(),
      weight: parseFloat(addWeight) || 0, weight_unit: addWeightUnit,
      description: addDesc, user_id: user.id, hidden: false,
    });
    if (error) return setToast('❌ ' + error.message);
    setShowAdd(false);
    setAddName(''); setAddCat(''); setAddPrice(''); setAddUnit(''); setAddType('product');
    setAddSku(''); setAddBarcode(''); setAddWeight('0'); setAddWeightUnit('кг'); setAddDesc('');
    // Refresh products
    const { data } = await supabase.from('products').select('*').eq('user_id', user.id).order('name');
    if (data) setProducts(data);
    setToast('✅ Товар добавлен!');
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
    <div style={{background:'#f5f5f7',height:'100%',display:'flex',padding:'20px',width:'100vw',boxSizing:'border-box',fontFamily:'Inter,-apple-system,BlinkMacSystemFont,sans-serif'}}>
      <div style={{display:'flex',flex:1,flexShrink:0,width:'100%',background:'#fff',borderRadius:'24px',overflow:'hidden',boxShadow:'0 8px 60px rgba(0,0,0,.06)'}}>
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'1rem 1.5rem',fontSize:'.9rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}

      {/* Левая панель — чек */}
      <div style={{width:'280px',flexShrink:0,display:'flex',flexDirection:'column',background:'#fff',borderRight:'1px solid #eee',overflow:'hidden'}}>
        {/* Шапка Вариант 3 — плашка с тенью */}
        <div style={{margin:'10px',background:'#fff',borderRadius:'12px',padding:'8px 14px',display:'flex',alignItems:'center',gap:'8px',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
          <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#ff6052',display:'inline-block'}}></span>
          <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#ffbd2e',display:'inline-block'}}></span>
          <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#28c93f',display:'inline-block'}}></span>
          <span style={{fontSize:'12px',fontWeight:700,color:'#222',marginLeft:'8px',flex:1}}>Касса</span>
          <span style={{fontSize:'11px',color:'#888'}}>{activeShift?.cashier_name || userName}</span>
          <span onClick={() => { if (activeShift) setShowActions(true); else setShowOpenShift(true); }} style={{fontSize:'20px',cursor:'pointer',color:'#999',padding:'2px',userSelect:'none',lineHeight:1}}>⚙</span>
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
              <div style={{fontSize:'13px',fontWeight:700,minWidth:'60px',textAlign:'right'}}>{(item.price * item.qty).toLocaleString()} ₽</div>
            </div>
          ))}
        </div>

        {/* Итого и оплата */}
        <div style={{padding:'14px',borderTop:'1px solid #eee',display:'flex',flexDirection:'column',gap:'10px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'12px',color:'#999'}}>ИТОГО:</span>
              <span style={{fontSize:'20px',fontWeight:800}}>{total.toLocaleString()} ₽</span>
            </div>
            <button onClick={openPay} disabled={!cart.length} style={{
              width:'100%', padding:'13px', borderRadius:'100px', border:'none',
              background: cart.length ? '#000' : '#ddd',
              color:'#fff', fontSize:'14px', fontWeight:700,
              cursor: cart.length ? 'pointer' : 'default', fontFamily:'inherit',
            }}>Продажа</button>
          </div>
      </div>

      {/* Правая панель — товары */}
      <div style={{flex:'1 1 auto',display:'flex',flexDirection:'column',padding:'16px',overflow:'auto',width:'100%',minWidth:0}}>
        {/* Поиск */}
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Поиск"
            style={{flex:1,border:'1px solid #eee',borderRadius:'10px',padding:'9px 14px',fontSize:'13px',outline:'none',fontFamily:'inherit',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}} />
          <button onClick={() => { setShowAdd(true); setAddName(''); setAddCat(''); setAddPrice(''); setAddUnit(''); setAddType('product'); setAddSku(''); setAddBarcode(''); setAddWeight('0'); setAddWeightUnit('кг'); setAddDesc(''); }} style={{padding:'9px 16px',border:'none',borderRadius:'10px',background:'#000',color:'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>+ Добавить позицию</button>
        </div>

        {/* Категории */}
        <div style={{display:'flex',gap:'4px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px'}}>
          <button onClick={() => setCatFilter('all')} style={{
            padding:'5px 12px', borderRadius:'6px', border:'none', fontSize:'11px',
            fontWeight: catFilter === 'all' ? 600 : 500, cursor:'pointer', whiteSpace:'nowrap',
            background: catFilter === 'all' ? '#000' : '#e8e8ed',
            color: catFilter === 'all' ? '#fff' : '#666', fontFamily:'inherit',
          }}>Все</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.name)} style={{
              padding:'5px 12px', borderRadius:'6px', border:'none', fontSize:'11px',
              fontWeight: catFilter === c.name ? 600 : 500, cursor:'pointer', whiteSpace:'nowrap',
              background: catFilter === c.name ? '#000' : '#e8e8ed',
              color: catFilter === c.name ? '#fff' : '#666', fontFamily:'inherit',
            }}>{c.name}</button>
          ))}
        </div>

        {/* Сетка товаров */}
        <div style={{flex:1,overflowY:'auto',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',alignContent:'start',minHeight:0,width:'100%'}}>
          {filtered.length === 0 ? (
            <div style={{gridColumn:'1/-1',textAlign:'center',padding:'3rem 0',color:'#bbb',fontSize:'13px'}}>Нет товаров</div>
          ) : filtered.map(p => (
            <div key={p.id} onClick={() => addToCart(p)}
              style={{background:'#fff',borderRadius:'14px',padding:'14px',cursor:'pointer',transition:'all .12s',display:'flex',flexDirection:'column',border:'1px solid #eee',boxShadow:'0 1px 4px rgba(0,0,0,.05)',height:'100%'}}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.06)' } }
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.03)' } }>
              <div style={{fontSize:'13px',fontWeight:600,color:'#222',lineHeight:1.3}}>{p.name}</div>
              {p.cat && <div style={{fontSize:'10px',color:'#999',marginBottom:'2px'}}>{p.cat}</div>}
              <div style={{fontSize:'16px',fontWeight:800,color:'#000',marginTop:'auto'}}>{(p.price||0).toLocaleString()} ₽</div>
            </div>
          ))}
        </div>
      </div>

      </div>

      {/* Модалка добавления товара */}
      {showAdd && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowAdd(false); }}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <button className="modal-close" onClick={() => setShowAdd(false)}>&times;</button>
            <h2>Добавить позицию</h2>
            <div className="sub">Новый товар появится в каталоге и разделе «Каталог позиций»</div>
            <form onSubmit={saveProduct}>
              <div className="form-group">
                <label>Название</label>
                <input type="text" value={addName} onChange={e => setAddName(e.target.value)} required placeholder="Например: свечи зажигания" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Категория</label>
                  <select value={addCat} onChange={e => setAddCat(e.target.value)}>
                    <option value="">— выберите —</option>
                    {allCats.filter(c => c.type === 'product').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Тип</label>
                  <select value={addType} onChange={e => setAddType(e.target.value)}>
                    <option value="product">Товар</option>
                    <option value="service">Услуга</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Цена продажи (₽)</label>
                  <input type="number" min="0" step="0.01" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Ед. измерения</label>
                  <select value={addUnit} onChange={e => setAddUnit(e.target.value)}>
                    <option value="">— выберите —</option>
                    <option value="шт">шт</option>
                    <option value="кг">кг</option>
                    <option value="л">л</option>
                    <option value="усл">усл</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Артикул</label>
                  <input type="text" value={addSku} onChange={e => setAddSku(e.target.value)} placeholder="ART-001" />
                </div>
                {addType !== 'service' && <div className="form-group">
                  <label>Штрихкод</label>
                  <input type="text" value={addBarcode} onChange={e => setAddBarcode(e.target.value)} placeholder="4600000000000" />
                </div>}
                {addType === 'service' && <div className="form-group"></div>}
              </div>
              {addType !== 'service' && <div className="form-row">
                <div className="form-group">
                  <label>Вес</label>
                  <input type="number" min="0" step="0.01" value={addWeight} onChange={e => setAddWeight(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Ед. веса</label>
                  <select value={addWeightUnit} onChange={e => setAddWeightUnit(e.target.value)}>
                    <option value="г">г</option>
                    <option value="кг">кг</option>
                    <option value="т">т</option>
                  </select>
                </div>
              </div>}
              <div className="form-group">
                <label>Описание</label>
                <textarea rows="2" value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Дополнительная информация..." />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-account-select">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка оплаты */}
      {showPay && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowPay(false); }}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowPay(false)}>&times;</button>
            <h2>Оплата чека <span style={{fontSize:'13px',color:'#999',fontWeight:400}}>№{shiftTx.length + 1 || 1}</span></h2>

            {/* Список товаров */}
            <div style={{margin:'0 0 12px',fontSize:'.82rem',color:'var(--muted)'}}>
              {cart.map((item, i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'3px 0'}}>
                  <span>{item.name} ×{item.qty}</span>
                  <span style={{fontWeight:600}}>{(item.price * item.qty).toLocaleString()} ₽</span>
                </div>
              ))}
              <div style={{borderTop:'1px solid #eee',marginTop:'6px',paddingTop:'6px',display:'flex',justifyContent:'space-between',fontSize:'1rem',fontWeight:800}}>
                <span>ИТОГО:</span>
                <span>{total.toLocaleString()} ₽</span>
              </div>
            </div>

            {/* Выбор счёта */}
            <div style={{marginBottom:'12px'}}>
              <label style={{fontSize:'.82rem',fontWeight:600,color:'var(--muted)',marginBottom:'6px',display:'block'}}>Способ оплаты</label>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {accounts.map(a => (
                  <button key={a.id} onClick={() => setPayMode(a.id)} style={{
                    padding:'8px 14px', borderRadius:'8px', border:'1.5px solid #eee',
                    background: payMode === a.id ? '#000' : '#fff',
                    color: payMode === a.id ? '#fff' : '#555',
                    fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'inherit',whiteSpace:'nowrap',minWidth:0
                  }}>{a.name}</button>
                ))}
              </div>
            </div>

            {/* Ползунок «Разделить на счета» */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
              <label style={{position:'relative',display:'inline-block',width:'36px',height:'20px',cursor:'pointer'}}>
                <input type="checkbox" checked={paySplit} onChange={e => { setPaySplit(e.target.checked); if (!e.target.checked) setSplitAmts({}); }} style={{opacity:0,width:0,height:0}} />
                <span style={{position:'absolute',inset:0,background:paySplit?'#000':'#ddd',borderRadius:'100px',transition:'.2s'}}>
                  <span style={{position:'absolute',top:'2px',left:paySplit?'18px':'2px',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',transition:'.2s'}}></span>
                </span>
              </label>
              <span style={{fontSize:'13px',fontWeight:500}}>Разделить на счета</span>
            </div>

            {paySplit && (
              <div style={{marginBottom:'12px'}}>
                {accounts.map(a => {
                  const amt = parseFloat(splitAmts[a.id]) || 0;
                  const remain = total - Object.entries(splitAmts).filter(([id]) => id !== a.id).reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
                  return (
                    <div key={a.id} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px'}}>
                      <span style={{fontSize:'12px',minWidth:'70px',fontWeight:500,flexShrink:0}}>{a.name}</span>
                      <div style={{position:'relative',flex:1}}>
                        <input type="number" min="0" step="0.01" placeholder={Math.round(remain).toString()} 
                          value={splitAmts[a.id] || ''} 
                          onChange={e => setSplitAmts({...splitAmts, [a.id]: e.target.value})}
                          style={{width:'100%',border:'1px solid #eee',borderRadius:'6px',padding:'6px 24px 6px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} />
                        <span style={{position:'absolute',right:'8px',top:'50%',transform:'translateY(-50%)',fontSize:'12px',color:'#999'}}>₽</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{fontSize:'12px',fontWeight:600,textAlign:'right',marginTop:'4px',color: Math.abs(total - Object.values(splitAmts).reduce((s, v) => s + (parseFloat(v) || 0), 0)) < 0.01 ? '#16a34a' : '#dc2626'}}>
                  Остаток: {(total - Object.values(splitAmts).reduce((s, v) => s + (parseFloat(v) || 0), 0)).toLocaleString()} ₽
                </div>
              </div>
            )}

            {/* Ползунок «Не оплачивать» */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px'}}>
              <label style={{position:'relative',display:'inline-block',width:'36px',height:'20px',cursor:'pointer'}}>
                <input type="checkbox" checked={payUnpaid} onChange={e => { setPayUnpaid(e.target.checked); if (e.target.checked) { setPaySplit(false); setSplitAmts({}); }} } style={{opacity:0,width:0,height:0}} />
                <span style={{position:'absolute',inset:0,background:payUnpaid?'#dc2626':'#ddd',borderRadius:'100px',transition:'.2s'}}>
                  <span style={{position:'absolute',top:'2px',left:payUnpaid?'18px':'2px',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',transition:'.2s'}}></span>
                </span>
              </label>
              <span style={{fontSize:'13px',fontWeight:500}}>Не оплачивать сейчас (долг)</span>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowPay(false)}>Отмена</button>
              <button type="button" className="btn btn-account-select" onClick={processPay}>{payUnpaid ? 'Сохранить чек' : 'Пробить чек'}</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Меню действий */}
      {showActions && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowActions(false); }}>
          <div className="modal-box" style={{maxWidth:'340px'}}>
            <button className="modal-close" onClick={() => setShowActions(false)}>&times;</button>
            <h2 style={{textAlign:'center'}}>⚙ Действия</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'16px'}}>
              <button onClick={async () => {
                setShowActions(false);
                const start = new Date(activeShift.opened_at);
                const now = new Date();
                const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).gte('created_at', start.toISOString()).lte('created_at', now.toISOString()).order('created_at', { ascending: false });
                setShiftTx(data || []);
                setShowCloseShift(true);
              }} style={{padding:'12px 16px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#111',fontSize:'13px',fontWeight:600,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>🔒 Закрыть смену</button>
              <button onClick={async () => {
                setShowActions(false);
                const start = new Date(activeShift.opened_at);
                const now = new Date();
                const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).gte('created_at', start.toISOString()).lte('created_at', now.toISOString()).order('created_at', { ascending: false });
                setShiftTx(data || []);
              }} style={{padding:'12px 16px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#111',fontSize:'13px',fontWeight:600,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>📋 Чеки за смену</button>
            </div>
          </div>
        </div>
      )}

      {/* Чеки за смену */}
      {shiftTx.length > 0 && !showCloseShift && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') { setShiftTx([]); } }}>
          <div className="modal-box" style={{maxWidth:'520px',display:'flex',flexDirection:'column',maxHeight:'80vh',padding:0}}>
            <div style={{padding:'24px 24px 0'}}>
              <button className="modal-close" onClick={() => setShiftTx([])}>&times;</button>
              <h2 style={{marginBottom:'4px'}}>Чеки за смену</h2>
              <div className="sub" style={{marginBottom:'16px'}}>Все операции с момента открытия смены</div>
            </div>
            <div style={{overflowY:'auto',flex:1,padding:'0 24px'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #eee'}}>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'left'}}>Чек</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Товар</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Время</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Способ</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Статус</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftTx.map((t, i) => {
                    const ac = accounts.find(a => a.id === t.account_id);
                    const time = new Date(t.created_at).toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
                    return (
                      <tr key={i} style={{borderBottom:'1px solid #f5f5f5'}}>
                        <td style={{padding:'10px 10px',fontWeight:600,textAlign:'left'}}>{i + 1}</td>
                        <td style={{padding:'10px 10px',textAlign:'center'}}>{t.description}</td>
                        <td style={{padding:'10px 10px',color:'#999',textAlign:'center'}}>{time}</td>
                        <td style={{padding:'10px 10px',textAlign:'center'}}>{ac?.name || '—'}</td>
                        <td style={{padding:'10px 10px',textAlign:'center'}}>
                          <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'100px',background: t.status === 'unpaid' ? '#fef2f2' : '#f0fdf4',color: t.status === 'unpaid' ? '#dc2626' : '#16a34a'}}>{t.status === 'unpaid' ? 'Долг' : 'Оплачен'}</span>
                        </td>
                        <td style={{padding:'10px 10px',textAlign:'center',fontWeight:700,color: t.type === 'income' ? '#16a34a' : '#dc2626'}}>{t.type === 'income' ? '+' : ''}{(t.amount || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:'16px 24px',borderTop:'1px solid #eee',display:'flex',alignItems:'baseline',gap:'6px',fontWeight:800,fontSize:'15px'}}>
              <span>Итого:</span>
              <span>+{shiftTx.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0).toLocaleString()} ₽</span>
            </div>
            <div style={{padding:'0 24px 20px'}}>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setShiftTx([])}>Закрыть</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Закрытие смены */}
      {showCloseShift && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowCloseShift(false); }}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <button className="modal-close" onClick={() => setShowCloseShift(false)}>&times;</button>
            <h2>Закрытие смены</h2>
            <div className="sub" style={{marginBottom:'12px'}}>Проверьте баланс перед закрытием</div>
            
            <div style={{background:'#f9f9f9',borderRadius:'10px',padding:'12px',fontSize:'13px',lineHeight:1.8,marginBottom:'12px'}}>
              <div style={{display:'flex'}}>
                <span style={{flex:1}}>Начальный остаток</span>
                <span>{(parseFloat(activeShift.opening_balance) || 0).toLocaleString()} ₽</span>
              </div>
              <div style={{borderTop:'1px solid #eee',margin:'4px 0'}}></div>
              {(() => {
                const byAc = {};
                shiftTx.filter(t => t.type === 'income').forEach(t => {
                  const key = t.account_id || 'unknown';
                  byAc[key] = (byAc[key] || 0) + (parseFloat(t.amount) || 0);
                });
                const acMap = {};
                accounts.forEach(a => { acMap[a.id] = a.name; });
                return Object.entries(byAc).map(([acId, amt]) => (
                  <div key={acId} style={{display:'flex',padding:'2px 0'}}>
                    <span style={{flex:1}}>{acMap[acId] || 'Без счёта'}</span>
                    <span>+{amt.toLocaleString()} ₽</span>
                  </div>
                ));
              })()}
              <div style={{borderTop:'1px solid #eee',margin:'4px 0'}}></div>
              <div style={{display:'flex',fontWeight:800}}>
                <span style={{flex:1}}>Расчётный остаток</span>
                <span>{( (parseFloat(activeShift.opening_balance)||0) + shiftTx.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) ).toLocaleString()} ₽</span>
              </div>
            </div>

            <div className="form-group">
              <label>Фактический остаток в кассе (₽)</label>
              <input type="number" min="0" step="0.01" placeholder="0" value={closeFactBal} onChange={e => setCloseFactBal(e.target.value)} autoFocus />
            </div>
            {closeFactBal && (() => {
              const calcBal = (parseFloat(activeShift.opening_balance)||0) + shiftTx.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
              const fact = parseFloat(closeFactBal) || 0;
              const diff = fact - calcBal;
              if (Math.abs(diff) < 0.01) {
                return <div style={{textAlign:'center',padding:'6px',background:'#f0fdf4',borderRadius:'8px',color:'#16a34a',fontWeight:600,fontSize:'13px',marginBottom:'8px'}}>✅ Касса сходится</div>;
              } else {
                return <div style={{textAlign:'center',padding:'6px',background:'#fef2f2',borderRadius:'8px',color:'#dc2626',fontWeight:600,fontSize:'13px',marginBottom:'8px'}}>⚠️ Расхождение: {diff > 0 ? 'излишек' : 'недостача'} {Math.abs(diff).toLocaleString()} ₽</div>;
              }
            })()}

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowCloseShift(false)}>Отмена</button>
              <button type="button" className="btn btn-account-select" style={{background:'#dc2626',color:'#fff'}} onClick={async () => {
                const fact = parseFloat(closeFactBal);
                if (isNaN(fact)) return setToast('⚠️ Введите фактический остаток');
                const calcBal = (parseFloat(activeShift.opening_balance)||0) + shiftTx.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
                const { error } = await supabase.from('shifts').update({
                  closed_at: new Date().toISOString(),
                  closing_balance: fact,
                  status: 'closed',
                }).eq('id', activeShift.id);
                if (error) return setToast('❌ ' + error.message);
                setShowCloseShift(false); setCloseFactBal(''); setShiftTx([]);
                setActiveShift(null);
                setShowOpenShift(true);
                setOpenShiftCashier(userName);
                setOpenShiftBal('0');
                setToast('✅ Смена закрыта' + (Math.abs(fact - calcBal) > 0.01 ? ' (расхождение ' + (fact - calcBal > 0 ? 'излишек' : 'недостача') + ' ' + Math.abs(fact - calcBal).toLocaleString() + ' ₽)' : ''));
              }}>Закрыть смену</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}