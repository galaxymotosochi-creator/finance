import { useState, useEffect } from 'react';

const getSupplies = () => JSON.parse(localStorage.getItem('supplies88') || '[]');
const setSupplies = (list) => localStorage.setItem('supplies88', JSON.stringify(list));
const getProducts = () => JSON.parse(localStorage.getItem('products88') || '[]');
const getSuppliers = () => JSON.parse(localStorage.getItem('suppliers88') || '[]');
const SUPPLY_STATUSES = ['ordered','transit','received'];
const SUPPLY_LABELS = {ordered:'Заказано',transit:'В пути',received:'Оприходовано'};
const SUPPLY_COLORS = {ordered:'#2563eb',transit:'#d97706',received:'#16a34a'};
const PAY_LABELS = {unpaid:'Не оплачено',partially_paid:'Частично оплачено',paid:'Оплачено'};
const PAY_COLORS = {unpaid:'#dc2626',partially_paid:'#d97706',paid:'#16a34a'};

function getPayStatus(s) {
  const total = s.total || 0;
  const paid = s.paid || 0;
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partially_paid';
  return 'unpaid';
}

export default function Supplies() {
  const [supplies, setSuppliesState] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [showPay, setShowPay] = useState(false);

  const [fSupName, setFSupName] = useState('');
  const [fInvoice, setFInvoice] = useState('');
  const [fStatus, setFStatus] = useState('ordered');
  const [fPaid, setFPaid] = useState('0');
  const [fItems, setFItems] = useState([]);
  const [fAddProd, setFAddProd] = useState('');
  const [fAddQty, setFAddQty] = useState('');
  const [fAddCost, setFAddCost] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1500); };

  const load = () => setSuppliesState(getSupplies());
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setFInvoice(''); setFStatus('ordered'); setFPaid('0'); setFItems([]);
    setFAddProd(''); setFAddQty(''); setFAddCost(''); setFSupName('');
    setShowModal(true);
  };

  const addItem = () => {
    const prodId = parseInt(fAddProd);
    if (!prodId) return alert('Выберите товар');
    const qty = parseFloat(fAddQty) || 1;
    const cost = parseFloat(fAddCost) || 0;
    const prod = getProducts().find(p => p.id === prodId);
    setFItems(prev => [...prev, { prodId, name: prod ? prod.name : 'Товар', qty, cost }]);
    setFAddProd(''); setFAddQty(''); setFAddCost('');
  };

  const removeItem = (idx) => setFItems(prev => prev.filter((_, i) => i !== idx));

  const save = (e) => {
    e.preventDefault();
    if (!fItems.length) return alert('Добавьте хотя бы один товар');
    const total = fItems.reduce((acc, it) => acc + it.qty * it.cost, 0);
    const list = getSupplies();
    const obj = {
      invoice: fInvoice.trim(), supplierName: fSupName.trim(), items: fItems,
      total, supplyStatus: fStatus, paid: parseFloat(fPaid) || 0, payments: [],
      date: new Date().toLocaleDateString('ru-RU')
    };
    if (editId) {
      const idx = list.findIndex(x => x.id === editId);
      if (idx > -1) list[idx] = { ...list[idx], ...obj };
    } else { obj.id = Date.now(); list.unshift(obj); }
    setSupplies(list); load(); setShowModal(false);
    showToast('✅ Поставка проведена');
  };

  const cycleStatus = (id) => {
    const list = getSupplies();
    const s = list.find(x => x.id === id);
    if (!s) return;
    const idx = SUPPLY_STATUSES.indexOf(s.supplyStatus || 'ordered');
    s.supplyStatus = SUPPLY_STATUSES[(idx + 1) % SUPPLY_STATUSES.length];
    setSupplies(list); load();
  };

  const edit = (id) => {
    const s = getSupplies().find(x => x.id === id);
    if (!s) return;
    setEditId(id); setFInvoice(s.invoice||''); setFSupName(s.supplierName||'');
    setFStatus(s.supplyStatus||'ordered'); setFPaid(String(s.paid||0));
    setFItems((s.items||[{prodId:s.prodId,name:'Товар',qty:s.qty||0,cost:s.cost||0}]).slice());
    setShowModal(true);
  };

  const remove = (id) => {
    if (!confirm('Удалить поставку?')) return;
    setSupplies(getSupplies().filter(x => x.id !== id)); load();
  };

  const copy = (id) => {
    const list = getSupplies(); const s = list.find(x => x.id === id);
    if (!s) return;
    list.push({...s, id:Date.now(), invoice:(s.invoice||'')+' (копия)'});
    setSupplies(list); load(); showToast('📋 Поставка скопирована');
  };

  const confirmPay = (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('payAmount').value) || 0;
    const method = document.getElementById('payMethod').value;
    if (amount <= 0) return alert('Введите сумму');
    const list = getSupplies(); const s = list.find(x => x.id === showPay);
    if (!s) return;
    if (!s.payments) s.payments = [];
    s.payments.push({ amount, method, date: new Date().toLocaleDateString('ru-RU') });
    s.paid = (s.paid||0) + amount; setSupplies(list); load(); setShowPay(null);
    showToast('💳 Оплата проведена');
  };

  const totalItems = (s) => (s.items||[s]).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Поставки</h1>
          <div className="sub">Оприходование товаров на склад</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAdd}>+ Новая поставка</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table>
          <thead id="supplyColHeaders">
            <tr>
              <th>№ накладной</th>
              <th>Поставщик</th>
              <th>Сумма</th>
              <th>Поставка</th>
              <th>Оплата</th>
              <th>Дата</th>
              <th style={{width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="supplyTableBody">
            {supplies.length === 0 ? (
              <tr><td colSpan="7"><div className="empty-products"><div className="big-icon">📦</div><p>Поставок пока нет. Нажмите «+ Новая поставка»</p></div></td></tr>
            ) : supplies.map(s => {
              const total = s.total || (s.items||[]).reduce((sum,it) => sum + it.qty*it.cost, 0) || (s.qty||0)*(s.cost||0);
              const payStatus = getPayStatus(s);
              const supSt = SUPPLY_LABELS[s.supplyStatus||'ordered']||'Заказано';
              const paySt = PAY_LABELS[payStatus]||'Не оплачено';
              const supColor = SUPPLY_COLORS[s.supplyStatus||'ordered']||'#2563eb';
              const payColor = PAY_COLORS[payStatus]||'#dc2626';
              return (
                <tr key={s.id}>
                  <td style={{textAlign:'left'}}>
                    <div className="prod-name" style={{color:'var(--primary)',cursor:'pointer',borderBottom:'1px dashed var(--primary)',display:'inline-block'}}
                      onClick={() => setViewId(prev => prev === s.id ? null : s.id)}>{s.invoice||'—'}</div>
                    <div className="prod-sku">{totalItems(s)} поз.</div>
                  </td>
                  <td><span className="prod-cat">{s.supplierName||'—'}</span></td>
                  <td><span className="num">{Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}₽</span></td>
                  <td><span style={{cursor:'pointer',color:supColor}} onClick={() => cycleStatus(s.id)} title="Нажмите чтобы изменить">{supSt}</span></td>
                  <td><span style={{color:payColor}}>{paySt}</span></td>
                  <td style={{fontSize:'.82rem',color:'var(--muted)'}}>{s.date||'—'}</td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    {payStatus !== 'paid' && <button className="act-btn prod-edit-btn" onClick={() => setShowPay(s.id)}>Оплатить</button>}
                    <button className="act-btn prod-edit-btn" onClick={() => edit(s.id)}>Ред.</button>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={(e) => {
                        e.stopPropagation();
                        const dd = e.currentTarget.nextElementSibling;
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                        dd.classList.toggle('open');
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={() => copy(s.id)}>Копировать</button>
                        <button onClick={() => remove(s.id)} style={{color:'#dc3545'}}>Удалить</button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Просмотр поставки */}
      {viewId && (() => {
        const s = getSupplies().find(x => x.id === viewId);
        if (!s) return null;
        const items = s.items || [{name:'Товар',qty:s.qty||0,cost:s.cost||0}];
        const total = s.total || items.reduce((sum,it) => sum + it.qty*it.cost, 0);
        const supSt = SUPPLY_LABELS[s.supplyStatus||'ordered']||'Заказано';
        const payStatus = getPayStatus(s);
        const paySt = PAY_LABELS[payStatus];
        const supColor = SUPPLY_COLORS[s.supplyStatus||'ordered']||'#2563eb';
        const payColor = PAY_COLORS[payStatus]||'#dc2626';
        return (
          <div className="promo-detail" style={{marginTop:'.5rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.5rem'}}>
              <div style={{fontSize:'.9rem',fontWeight:600}}>Поставка №{s.invoice||''}</div>
              <span style={{cursor:'pointer',color:'var(--muted)',fontSize:'1.1rem'}} onClick={() => setViewId(null)}>✕</span>
            </div>
            <div style={{marginBottom:'.5rem',fontSize:'.82rem'}}>
              <div><span style={{color:'var(--muted)'}}>Поставщик:</span> {s.supplierName||'—'}</div>
              <div><span style={{color:'var(--muted)'}}>Статус поставки:</span> <span style={{color:supColor}}>{supSt}</span></div>
              <div><span style={{color:'var(--muted)'}}>Статус оплаты:</span> <span style={{color:payColor}}>{paySt}</span></div>
              <div><span style={{color:'var(--muted)'}}>Дата:</span> {s.date||'—'}</div>
            </div>
            <div style={{fontSize:'.78rem',fontWeight:600,color:'var(--muted)',paddingTop:'.5rem',borderTop:'1px solid var(--border)'}}>Товары</div>
            {items.map((it,i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'.2rem 0',fontSize:'.82rem'}}>
                <span>{it.name}</span>
                <span>{it.qty} шт x {it.cost.toFixed(2)}</span>
                <span style={{fontWeight:500}}>{(it.qty*it.cost).toFixed(2)}₽</span>
              </div>
            ))}
            <div style={{borderTop:'1px solid var(--border)',paddingTop:'.35rem',display:'flex',justifyContent:'space-between',fontWeight:600,fontSize:'.85rem'}}>
              <span>Итого:</span><span>{total.toFixed(2)}₽</span>
            </div>
            {(s.paid||0) < total && (
              <div style={{display:'flex',justifyContent:'space-between',color:'#dc2626',fontSize:'.82rem'}}>
                <span>Долг:</span><span>{(total-(s.paid||0)).toFixed(2)}₽</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Модалка поставки */}
      {showModal && (
        <div className="modal-overlay active" onClick={(e)=>e.target.className==='modal-overlay active'&&(setShowModal(false),setFItems([]))}>
          <div className="modal-box" style={{maxWidth:'650px'}}>
            <button className="modal-close" onClick={()=>{setShowModal(false);setFItems([])}}>&times;</button>
            <h2>{editId?'Редактировать поставку':'Новая поставка'}</h2>
            <div className="sub">{editId?'Товары в накладной':'Добавьте товары в накладную'}</div>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group">
                  <label>Поставщик *</label>
                  <select value={fSupName} onChange={e=>setFSupName(e.target.value)}>
                    <option value="">— выберите поставщика —</option>
                    {getSuppliers().map(s=><option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>№ накладной</label>
                  <input type="text" value={fInvoice} onChange={e=>setFInvoice(e.target.value)} placeholder="INV-001" />
                </div>
              </div>
              <div style={{border:'1px solid var(--border)',borderRadius:'8px',padding:'.75rem',marginBottom:'.5rem',background:'var(--body-bg)'}}>
                <div style={{fontSize:'.78rem',fontWeight:600,color:'var(--muted)',marginBottom:'.5rem'}}>Товары в поставке</div>
                <div style={{maxHeight:'250px',overflowY:'auto',marginBottom:'.65rem'}}>
                  {fItems.length===0 ? (
                    <div style={{textAlign:'center',padding:'.5rem',color:'var(--muted)',fontSize:'.8rem'}}>Товары не добавлены</div>
                  ) : fItems.map((it,idx)=>(
                    <div key={idx} style={{display:'flex',alignItems:'center',gap:'.35rem',padding:'.3rem .5rem',borderBottom:'1px solid var(--border)',fontSize:'.85rem'}}>
                      <span style={{flex:3,fontWeight:500}}>{it.name}</span>
                      <span style={{flex:1,textAlign:'center'}}>{it.qty} шт</span>
                      <span style={{flex:1,textAlign:'right',fontWeight:500}}>{(it.qty*it.cost).toFixed(2)}₽</span>
                      <button type="button" onClick={()=>removeItem(idx)} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:'1rem'}}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:'.35rem'}}>
                  <select value={fAddProd} onChange={e=>setFAddProd(e.target.value)} style={{flex:1,fontSize:'.82rem',padding:'.35rem',border:'1px solid var(--border)',borderRadius:'5px',fontFamily:'var(--font)'}}>
                    <option value="">— выберите товар —</option>
                    {getProducts().map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" value={fAddQty} onChange={e=>setFAddQty(e.target.value)} placeholder="Количество" min="1" step="any"
                    style={{flex:1,fontSize:'.82rem',padding:'.35rem',border:'1px solid var(--border)',borderRadius:'5px',fontFamily:'var(--font)'}} />
                  <input type="number" value={fAddCost} onChange={e=>setFAddCost(e.target.value)} placeholder="Цена" min="0" step="0.01"
                    style={{flex:1,fontSize:'.82rem',padding:'.35rem',border:'1px solid var(--border)',borderRadius:'5px',fontFamily:'var(--font)'}} />
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:'.35rem'}}>
                  <button type="button" onClick={addItem} style={{padding:'.25rem .55rem',fontSize:'.75rem',background:'#16a34a',color:'#fff',border:'none',borderRadius:'5px',cursor:'pointer',fontFamily:'var(--font)'}}>+ Добавить</button>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Статус</label>
                  <select value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                    <option value="ordered">Заказано</option>
                    <option value="transit">В пути</option>
                    <option value="received">Оприходовано</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Оплачено (₽)</label>
                  <input type="number" value={fPaid} onChange={e=>setFPaid(e.target.value)} placeholder="0" min="0" step="0.01" />
                </div>
              </div>
              <div style={{textAlign:'right',fontSize:'.85rem',fontWeight:600,paddingTop:'.35rem'}}>
                {fItems.length > 0 && `Итого: ${fItems.length} товаров = ${fItems.reduce((a,it)=>a+it.qty*it.cost,0).toFixed(2)}₽`}
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" style={{width:'100%'}}>Провести</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка оплаты */}
      {showPay && (() => {
        const s = getSupplies().find(x => x.id === showPay);
        if (!s) return null;
        const total = s.total || (s.items||[]).reduce((sum,it)=>sum+it.qty*it.cost,0) || 0;
        const paid = s.paid || 0;
        const debt = total - paid;
        return (
          <div className="modal-overlay active" onClick={(e)=>e.target.className==='modal-overlay active'&&setShowPay(null)}>
            <div className="modal-box" style={{maxWidth:'450px'}}>
              <button className="modal-close" onClick={()=>setShowPay(null)}>&times;</button>
              <h2>💳 Оплата {s.invoice||'поставки'}</h2>
              <div className="sub">{s.supplierName||''}</div>
              <div id="payModalInfo" style={{margin:'.5rem 0'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.25rem'}}><span>Сумма накладной:</span><span>{total.toFixed(2)}₽</span></div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.25rem'}}><span>Уже оплачено:</span><span style={{color:'#16a34a'}}>{paid.toFixed(2)}₽</span></div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.5rem',fontWeight:600}}><span>Остаток:</span><span style={{color:'#dc2626'}}>{debt.toFixed(2)}₽</span></div>
              </div>
              <form onSubmit={confirmPay}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Сумма (₽)</label>
                    <input type="number" id="payAmount" defaultValue={debt>0?debt.toFixed(2):''} min="0" step="0.01" required />
                  </div>
                  <div className="form-group">
                    <label>Способ</label>
                    <select id="payMethod">
                      <option value="cash">Наличные</option>
                      <option value="transfer">Безнал</option>
                      <option value="card">Карта</option>
                    </select>
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn btn-primary" style={{width:'100%'}}>Провести оплату</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && (
        <div id="toast" style={{
          position:'fixed', bottom:'1.5rem', left:'50%', transform:'translateX(-50%)',
          background:'#fff', border:'1px solid #e5e7eb', borderRadius:'.75rem',
          padding:'.65rem 1.2rem', fontSize:'.85rem', color:'#333',
          boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)', zIndex:9999,
          display:'flex', alignItems:'center', gap:'.5rem'
        }}>
          {toast}
        </div>
      )}
    </>
  );
}