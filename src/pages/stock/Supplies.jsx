import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';


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
  const { user } = useAuth();
  const [supplies, setSuppliesState] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
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

  var scanBarcode = function(onResult){
  if (!navigator.mediaDevices) { setToast && setToast('Камера недоступна'); return; }
  import('quagga').then(function(mod){
    var Quagga = mod.default || mod;
    var w=document.createElement('div');
    w.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center';
    var v=document.createElement('div');v.id='qv';
    v.style.cssText='position:relative;width:100%;max-width:500px;aspect-ratio:4/3;overflow:hidden;border-radius:12px';
    var f=document.createElement('div');
    f.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;width:260px;height:100px;border:2px solid rgba(255,255,255,.5);border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.4);pointer-events:none';
    var i=document.createElement('input');i.type='text';i.placeholder='';
    i.style.cssText='width:80%;max-width:360px;margin-top:16px;padding:12px 16px;border:none;border-radius:12px;font-size:16px;text-align:center;letter-spacing:4px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.2);outline:none;font-family:inherit';
    var c=document.createElement('div');c.textContent='✕';c.title='Закрыть';
    c.style.cssText='position:fixed;top:20px;right:20px;z-index:10000;width:36px;height:36px;background:rgba(0,0,0,.4);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;font-weight:700;line-height:1';
    var beep=function(){try{var ac=new AudioContext();var g=ac.createGain();g.connect(ac.destination);g.gain.value=.15;var o=ac.createOscillator();o.type='sine';o.frequency.value=1200;o.connect(g);o.start();setTimeout(function(){o.stop();ac.close()},100)}catch(e){}};
    v.appendChild(f);w.appendChild(v);w.appendChild(i);document.body.appendChild(w);document.body.appendChild(c);
    var q=null;var lock=false;
    var done=function(val){if(val&&!lock){lock=true;beep();if(onResult)onResult(val);setTimeout(function(){lock=false},3000)}cl()};
    var cl=function(){if(q){q.stop();q=null}w.remove();c.remove()};
    i.onkeydown=function(e){if(e.key==='Enter'&&i.value.trim()){done(i.value.trim())}};c.onclick=cl;
    Quagga.init({
      inputStream:{name:'Live',type:'LiveStream',target:v,targetSize:1,constraints:{width:640,height:480,facingMode:'environment'}},
      decoder:{readers:['ean_reader','ean_8_reader','code_128_reader','code_39_reader','upc_reader','upc_e_reader']},
      locate:true
    },function(err){if(err){setToast && setToast('Ошибка камеры');return}
      q=Quagga;Quagga.start();
      Quagga.onDetected(function(data){if(data&&data.codeResult&&data.codeResult.code){done(data.codeResult.code)}});
    });
  }).catch(function(){setToast && setToast('Ошибка загрузки сканера')});
};

const load = async () => {
    setLoading(true);
    const [supRes, prodRes, suppRes] = await Promise.all([
      supabase.from('supplies').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('user_id', user.id).order('created_at')
    ]);
    if (supRes.data) setSuppliesState(supRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (suppRes.data) setSuppliers(suppRes.data);
    setLoading(false);
  };
  useEffect(() => { if (user) load(); }, [user]);

  // Миграция из localStorage
  useEffect(() => {
    if (!user || supplies.length > 0) return;
    const old = JSON.parse(localStorage.getItem('supplies88') || '[]');
    if (old.length > 0) {
      old.forEach(async (s) => {
        await supabase.from('supplies').insert({
          id: s.id, user_id: user.id, supplier_id: null, supplier_name: s.supplierName || '',
          invoice: s.invoice || '', status: s.supplyStatus || 'ordered', date: s.date || '',
          items: s.items || [{prodId:s.prodId,name:'Товар',qty:s.qty||0,cost:s.cost||0}],
          total: s.total || 0, paid: s.paid || 0
        });
      });
      localStorage.removeItem('supplies88');
      load();
    }
  }, [user, supplies.length]);
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
    const prod = products.find(p => p.id === prodId);
    setFItems(prev => [...prev, { prodId, name: prod ? prod.name : 'Товар', qty, cost }]);
    setFAddProd(''); setFAddQty(''); setFAddCost('');
  };

  const removeItem = (idx) => setFItems(prev => prev.filter((_, i) => i !== idx));

  const save = async (e) => {
    e.preventDefault();
    if (!fItems.length) return alert('Добавьте хотя бы один товар');
    const total = fItems.reduce((acc, it) => acc + it.qty * it.cost, 0);
    const obj = { user_id: user.id, supplier_name: fSupName.trim(), invoice: fInvoice.trim(), items: fItems, total, status: fStatus, paid: parseFloat(fPaid) || 0, date: new Date().toISOString().split('T')[0] };
    if (editId) {
      await supabase.from('supplies').update(obj).eq('id', editId);
    } else { await supabase.from('supplies').insert({ ...obj, id: Date.now() }); }
    await load(); setShowModal(false);
    showToast('✅ Поставка проведена');
  };

  const cycleStatus = async (id) => {
    const s = supplies.find(x => x.id === id);
    if (!s) return;
    const idx = SUPPLY_STATUSES.indexOf(s.status || 'ordered');
    await supabase.from('supplies').update({ status: SUPPLY_STATUSES[(idx + 1) % SUPPLY_STATUSES.length] }).eq('id', id);
    await load();
  };

  const edit = (id) => {
    const s = supplies.find(x => x.id === id);
    if (!s) return;
    setEditId(id); setFInvoice(s.invoice||''); setFSupName(s.supplier_name||'');
    setFStatus(s.status||'ordered'); setFPaid(String(s.paid||0));
    setFItems((s.items||[{prodId:s.prodId,name:'Товар',qty:s.qty||0,cost:s.cost||0}]).slice());
    setShowModal(true);
  };

  const remove = async (id) => {
    if (!confirm('Удалить поставку?')) return;
    await supabase.from('supplies').delete().eq('id', id); await load();
  };

  const copy = async (id) => {
    const s = supplies.find(x => x.id === id);
    if (!s) return;
    await supabase.from('supplies').insert({ ...s, id: Date.now(), invoice: (s.invoice||'') + ' (копия)', created_at: new Date().toISOString() });
    await load(); showToast('📋 Поставка скопирована');
  };

  const confirmPay = async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('payAmount').value) || 0;
    const method = document.getElementById('payMethod').value;
    if (amount <= 0) return alert('Введите сумму');
    const s = supplies.find(x => x.id === showPay);
    if (!s) return;
    if (!s.payments) s.payments = [];
    s.payments.push({ amount, method, date: new Date().toLocaleDateString('ru-RU') });
    await supabase.from('supplies').update({ paid: (s.paid||0) + amount }).eq('id', showPay); await load(); setShowPay(null);
    showToast('💳 Оплата проведена');
  };

  const totalItems = (s) => (s.items||[s]).length;
  
  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Поставки</h1>
          <div className="sub">Учет поступлений товаров от поставщиков</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={openAdd}>+ Добавить</button>
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
              <tr><td colSpan="7"><div className="empty-products"><div className="big-icon">📦</div><p>Список поставок пуст</p><p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Оформите первое поступление товаров от поставщика</p></div></td></tr>
            ) : supplies.map(s => {
              const total = s.total || (s.items||[]).reduce((sum,it) => sum + it.qty*it.cost, 0) || (s.qty||0)*(s.cost||0);
              const payStatus = getPayStatus(s);
              const supSt = SUPPLY_LABELS[s.status||'ordered']||'Заказано';
              const paySt = PAY_LABELS[payStatus]||'Не оплачено';
              const supColor = SUPPLY_COLORS[s.status||'ordered']||'#2563eb';
              const payColor = PAY_COLORS[payStatus]||'#dc2626';
              return (
                <tr key={s.id}>
                  <td style={{textAlign:'left'}}>
                    <div className="prod-name" style={{color:'var(--primary)',cursor:'pointer',borderBottom:'1px dashed var(--primary)',display:'inline-block'}}
                      onClick={() => setViewId(prev => prev === s.id ? null : s.id)}>{s.invoice||'—'}</div>
                    <div className="prod-sku">{totalItems(s)} поз.</div>
                  </td>
                  <td><span className="prod-cat">{s.supplier_name||'—'}</span></td>
                  <td><span className="num">{Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}₽</span></td>
                  <td><span style={{cursor:'pointer',color:supColor}} onClick={() => cycleStatus(s.id)} title="Нажмите чтобы изменить">{supSt}</span></td>
                  <td><span style={{color:payColor}}>{paySt}</span></td>
                  <td style={{fontSize:'.82rem',color:'var(--muted)',whiteSpace:'nowrap'}}>{s.date||'—'}</td>
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
        const s = supplies.find(x => x.id === viewId);
        if (!s) return null;
        const items = s.items || [{name:'Товар',qty:s.qty||0,cost:s.cost||0}];
        const total = s.total || items.reduce((sum,it) => sum + it.qty*it.cost, 0);
        const supSt = SUPPLY_LABELS[s.status||'ordered']||'Заказано';
        const payStatus = getPayStatus(s);
        const paySt = PAY_LABELS[payStatus];
        const supColor = SUPPLY_COLORS[s.status||'ordered']||'#2563eb';
        const payColor = PAY_COLORS[payStatus]||'#dc2626';
        return (
          <div className="promo-detail" style={{marginTop:'.5rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.5rem'}}>
              <div style={{fontSize:'.9rem',fontWeight:600}}>Поставка №{s.invoice||''}</div>
              <span style={{cursor:'pointer',color:'var(--muted)',fontSize:'1.1rem'}} onClick={() => setViewId(null)}>✕</span>
            </div>
            <div style={{marginBottom:'.5rem',fontSize:'.82rem'}}>
              <div><span style={{color:'var(--muted)'}}>Поставщик:</span> {s.supplier_name||'—'}</div>
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
            <div className="sub">Добавление товаров на склад</div>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group">
                  <label>Поставщик</label>
                  <select value={fSupName} onChange={e=>setFSupName(e.target.value)}>
                    <option value="">— выберите поставщика —</option>
                    {suppliers.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
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
                  <span onClick={function(){scanBarcode(function(bc){
                    var found=products.find(function(p){return p.barcode===bc;});
                    if(found){setFAddProd(String(found.id));setToast('Найден: '+found.name)}else setToast('Штрихкод '+bc+' не найден');
                  })}} title="Сканировать штрихкод" style={{fontSize:'16px',cursor:'pointer',padding:'.25rem',lineHeight:1}}>📷</span>
                  <select value={fAddProd} onChange={e=>setFAddProd(e.target.value)} style={{flex:1,fontSize:'.82rem',padding:'.35rem',border:'1px solid var(--border)',borderRadius:'5px',fontFamily:'var(--font)'}}>
                    <option value="">— выберите товар —</option>
                    {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" value={fAddQty} onChange={e=>setFAddQty(e.target.value)} placeholder="Количество" min="1" step="any"
                    style={{flex:1,fontSize:'.82rem',padding:'.35rem',border:'1px solid var(--border)',borderRadius:'5px',fontFamily:'var(--font)'}} />
                  <input type="number" value={fAddCost} onChange={e=>setFAddCost(e.target.value)} placeholder="Цена" min="0" step="0.01"
                    style={{flex:1,fontSize:'.82rem',padding:'.35rem',border:'1px solid var(--border)',borderRadius:'5px',fontFamily:'var(--font)'}} />
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:'.35rem'}}>
                  <button type="button" onClick={addItem} style={{padding:'.35rem .7rem',fontSize:'.75rem',background:'var(--primary)',color:'var(--primary-text)',border:'none',borderRadius:'100px',cursor:'pointer',fontFamily:'var(--font)',fontWeight:'600'}}>+ Добавить</button>
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
        const s = supplies.find(x => x.id === showPay);
        if (!s) return null;
        const total = s.total || (s.items||[]).reduce((sum,it)=>sum+it.qty*it.cost,0) || 0;
        const paid = s.paid || 0;
        const debt = total - paid;
        return (
          <div className="modal-overlay active" onClick={(e)=>e.target.className==='modal-overlay active'&&setShowPay(null)}>
            <div className="modal-box" style={{maxWidth:'450px'}}>
              <button className="modal-close" onClick={()=>setShowPay(null)}>&times;</button>
              <h2>💳 Оплата {s.invoice||'поставки'}</h2>
              <div className="sub">{s.supplier_name||''}</div>
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