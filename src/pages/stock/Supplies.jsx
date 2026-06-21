import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  const [paySplit, setPaySplit] = useState(false);
  const [splitAmts, setSplitAmts] = useState({});
  const loc = useLocation();
  const [supplies, setSuppliesState] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [showPay, setShowPay] = useState(false);
  const [payAccounts, setPayAccounts] = useState([]);
  const [payTxList, setPayTxList] = useState([]);

  const [fSupName, setFSupName] = useState('');
  const [fInvoice, setFInvoice] = useState('');
  const [fStatus, setFStatus] = useState('ordered');
  const [fPaid, setFPaid] = useState('0');
  const [fItems, setFItems] = useState([]);
  const [fAddProd, setFAddProd] = useState('');
  const [fAddQty, setFAddQty] = useState('');
  const [fAddCost, setFAddCost] = useState('');
  const [fAddSearch, setFAddSearch] = useState('');
  const [fAddDrop, setFAddDrop] = useState(false);
  const [toast, setToast] = useState(null);

  // Авто-открытие модалки новой поставки
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.prod-more-wrap')) {
        document.querySelectorAll('.prod-dropdown.open').forEach(d => d.classList.remove('open'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    if (params.get('add') === 'supply') {
      setEditId(null);
      setFInvoice(''); setFStatus('ordered'); setFPaid('0'); setFItems([]);
      setFAddProd(''); setFAddQty(''); setFAddCost(''); setFSupName('');
      setShowModal(true);
    }
  }, [loc.search]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1500); };

  var scanBarcode = function(onResult){
  if (!navigator.mediaDevices) { setToast && setToast('Камера недоступна'); return; }
  import('quagga').then(function(mod){
    var Quagga = mod.default || mod;
    var w=document.createElement('div');
    w.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center';
    var v=document.createElement('div');v.id='qv';
    v.style.cssText='position:relative;width:100%;max-width:500px;overflow:hidden;border-radius:12px;background:#000';
    var f=document.createElement('div');
    f.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;width:320px;height:130px;border:2px solid rgba(255,255,255,.5);border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.4);pointer-events:none';
    var i=document.createElement('input');i.type='text';i.placeholder='';
    i.style.cssText='width:80%;max-width:360px;margin-top:16px;padding:12px 16px;border:none;border-radius:12px;font-size:16px;text-align:center;letter-spacing:4px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.2);outline:none;font-family:inherit';
    var c=document.createElement('div');c.textContent='✕';c.title='Закрыть';
    c.style.cssText='position:fixed;top:20px;right:20px;z-index:10000;width:36px;height:36px;background:rgba(0,0,0,.4);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;font-weight:700;line-height:1';
    var beep=function(){try{var ac=new AudioContext();var g=ac.createGain();g.connect(ac.destination);g.gain.value=.15;var o=ac.createOscillator();o.type='sine';o.frequency.value=1200;o.connect(g);o.start();setTimeout(function(){o.stop();ac.close()},100)}catch(e){}};
    v.appendChild(f);w.appendChild(v);w.appendChild(i);document.body.appendChild(w);    setTimeout(function(){var c=document.getElementById("qv");if(c){c.querySelectorAll("video").forEach(function(el){el.style.cssText="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0"});c.querySelectorAll("canvas").forEach(function(el){el.style.cssText="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0"})}},200);
document.body.appendChild(c);
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
    const [supRes, prodRes, suppRes, accRes, txRes] = await Promise.all([
      supabase.from('supplies').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id).order('name'),
      supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('*').eq('user_id', user.id).limit(1000),
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('user_id', user.id).order('created_at')
    ]);
    if (supRes.data) setSuppliesState(supRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (suppRes.data) setSuppliers(suppRes.data);
    if (accRes.data) setPayAccounts(accRes.data);
    if (txRes.data) setPayTxList(txRes.data);
    setLoading(false);
  };
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.prod-more-wrap')) {
        document.querySelectorAll('.prod-dropdown.open').forEach(d => d.classList.remove('open'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => { if (user) load(); }, [user]);

  // Миграция из localStorage
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.prod-more-wrap')) {
        document.querySelectorAll('.prod-dropdown.open').forEach(d => d.classList.remove('open'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

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
    const idStr = fAddProd.trim();
    if (!idStr) return showToast('Выберите товар');
    const prod = products.find(p => String(p.id) === idStr);
    if (!prod) return showToast('Товар не найден');
    const qty = parseFloat(fAddQty) || 1;
    const cost = parseFloat(fAddCost) || 0;
    setFItems(prev => [...prev, { prodId: prod.id, name: prod.name, qty, cost }]);
    setFAddProd(''); setFAddQty(''); setFAddCost(''); setFAddSearch('');
  };

  const removeItem = (idx) => setFItems(prev => prev.filter((_, i) => i !== idx));

  const save = async (e) => {
    e.preventDefault();
    if (!fItems.length) return alert('Добавьте хотя бы один товар');
    const total = fItems.reduce((acc, it) => acc + it.qty * it.cost, 0);
    const obj = { user_id: user.id, supplier_name: fSupName.trim(), invoice: fInvoice.trim(), items: fItems, total, status: fStatus, paid: 0, date: new Date().toISOString().split('T')[0] };
    if (editId) {
      await supabase.from('supplies').update(obj).eq('id', editId);
    } else { await supabase.from('supplies').insert({ ...obj, id: Date.now() }); }
    await load(); setShowModal(false);
    showToast('Поставка проведена');
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
    const s = supplies.find(x => x.id === showPay);
    if (!s) return;
    const total = s.total || (s.items||[]).reduce((sum,it)=>sum+it.qty*it.cost,0) || 0;
    const paid = s.paid || 0;
    const debt = total - paid;
    if (paySplit) {
      for (const ac of payAccounts) {
        const amt = parseFloat(splitAmts[ac.id]) || 0;
        if (amt <= 0) continue;
        var bal = parseFloat(ac.balance)||0;
        payTxList.forEach(function(t){if(t.account_id===ac.id)bal+=Number(t.amount||0)*(t.type==='income'?1:-1)});
        if (bal < amt) return alert('Недостаточно средств на '+ac.name+'. Доступно: ' + bal.toLocaleString() + ' ₽');
        await supabase.from('transactions').insert({
          user_id: user.id, account_id: ac.id, type: 'expense', amount: amt,
          description: 'Оплата поставки ' + (s.invoice||''), date: new Date().toISOString().split('T')[0]
        });
        if (!s.payments) s.payments = [];
        s.payments.push({ amount: amt, method: ac.name, date: new Date().toLocaleDateString('ru-RU') });
      }
    } else {
      const amount = parseFloat(document.getElementById('payAmount').value) || 0;
      const acId = document.getElementById('payMethod').value;
      if (amount <= 0) return alert('Введите сумму');
      if (!acId) return alert('Выберите счет');
      var ac = payAccounts.find(function(a){return a.id === acId;});
      var bal = parseFloat(ac?.balance)||0;
      payTxList.forEach(function(t){if(t.account_id===acId)bal+=Number(t.amount||0)*(t.type==='income'?1:-1)});
      if (bal < amount) return alert('Недостаточно средств на счете. Доступно: ' + bal.toLocaleString() + ' ₽');
      await supabase.from('transactions').insert({
        user_id: user.id, account_id: acId, type: 'expense', amount: amount,
        description: 'Оплата поставки ' + (s.invoice||''), date: new Date().toISOString().split('T')[0]
      });
      if (!s.payments) s.payments = [];
      s.payments.push({ amount, method: ac?.name||'', date: new Date().toLocaleDateString('ru-RU') });
    }
    const totalPaid = (s.payments||[]).reduce((sum,p) => sum + (parseFloat(p.amount)||0), 0);
    await supabase.from('supplies').update({ paid: totalPaid }).eq('id', showPay);
    await load(); setShowPay(null); setPaySplit(false); setSplitAmts({});
    showToast('Оплата проведена');
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
              <th>Кол-во</th>
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
              <tr><td colSpan="8"><div className="empty-products"><div className="big-icon">📦</div><p>Список поставок пуст</p><p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Оформите первое поступление товаров от поставщика</p></div></td></tr>
            ) : supplies.map(s => {
              const total = s.total || (s.items||[]).reduce((sum,it) => sum + it.qty*it.cost, 0) || (s.qty||0)*(s.cost||0);
              const payStatus = getPayStatus(s);
              const supSt = SUPPLY_LABELS[s.status||'ordered']||'Заказано';
              const paySt = PAY_LABELS[payStatus]||'Не оплачено';
              const supColor = SUPPLY_COLORS[s.status||'ordered']||'#2563eb';
              const payColor = PAY_COLORS[payStatus]||'#dc2626';
              return (
                <tr key={s.id}>
                  <td style={{textAlign:'left',color:'#555'}}>
                    <div className="prod-name" style={{cursor:'pointer',borderBottom:'1px dashed var(--border)',display:'inline-block'}}
                      onClick={() => setViewId(prev => prev === s.id ? null : s.id)}>{s.invoice||'—'}</div>
                  </td>
                  <td style={{textAlign:'center',color:'#555'}}>{totalItems(s)}</td>
                  <td style={{whiteSpace:'nowrap'}}><span className="prod-cat">{s.supplier_name||'—'}</span></td>
                  <td style={{whiteSpace:'nowrap',color:'#555'}}><span className="num">{Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}₽</span></td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.72rem',fontWeight:600,color:"#555",background:supColor+'18',cursor:'pointer',whiteSpace:'nowrap'}}
                      onClick={() => cycleStatus(s.id)}>{supSt}</span>
                  </td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.72rem',fontWeight:600,color:"#555",background:payColor+'18',cursor:'pointer',whiteSpace:'nowrap'}}
                      onClick={() => payStatus !== 'paid' && setShowPay(s.id)}>{paySt}</span>
                  </td>
                  <td style={{whiteSpace:'nowrap',color:'#555'}}>{s.date||'—'}</td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={(e) => {
                        e.stopPropagation();
                        const dd = e.currentTarget.nextElementSibling;
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                        dd.classList.toggle('open');
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={() => edit(s.id)}>Редактировать</button>
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
              <div style={{display:'flex',alignItems:'center',gap:'.35rem',marginBottom:'.25rem'}}><span style={{color:'var(--muted)'}}>Статус поставки:</span> <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.72rem',fontWeight:600,color:"#555",background:supColor+'18',cursor:'pointer'}} onClick={() => cycleStatus(s.id)}>{supSt}</span></div>
              <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}><span style={{color:'var(--muted)'}}>Статус оплаты:</span> <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.72rem',fontWeight:600,color:"#555",background:payColor+'18',cursor:payStatus!=='paid'?'pointer':'default'}} onClick={() => payStatus !== 'paid' && setShowPay(s.id)}>{paySt}</span></div>
              <div><span style={{color:'var(--muted)'}}>Дата:</span> {s.date||'—'}</div>
            </div>
            <div style={{fontSize:'.78rem',fontWeight:600,color:'var(--muted)',paddingTop:'.5rem',borderTop:'1px solid var(--border)'}}>Товары</div>
            {items.map((it,i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'.2rem 0',fontSize:'.82rem'}}>
                <span>{it.name}</span>
                <span>{it.qty} шт x {it.cost.toFixed(2)}</span>
                <span style={{fontWeight:500}}>{(it.qty*it.cost).toFixed(2)} ₽</span>
              </div>
            ))}
            <div style={{borderTop:'1px solid var(--border)',paddingTop:'.35rem',display:'flex',justifyContent:'space-between',fontWeight:600,fontSize:'.85rem'}}>
              <span>Итого:</span><span>{total.toFixed(2)}₽</span>
            </div>
            {(s.payments||[]).length > 0 && (
              <div style={{marginTop:'.5rem',borderTop:'1px solid var(--border)',paddingTop:'.35rem'}}>
                <div style={{fontSize:'.72rem',fontWeight:600,color:'var(--muted)',marginBottom:'.25rem'}}>Платежи</div>
                {(s.payments||[]).map((p,i) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'.78rem',padding:'.1rem 0'}}>
                    <span style={{color:'#555'}}>{p.date}</span>
                    <span style={{color:'#555'}}>{p.method}</span>
                    <span style={{fontWeight:600,color:'#16a34a'}}>-{Number(p.amount).toLocaleString()} ₽</span>
                  </div>
                ))}
              </div>
            )}
            {(s.paid||0) < total && (
              <div style={{display:'flex',justifyContent:'space-between',color:'#dc2626',fontSize:'.82rem'}}>
                <span>Долг:</span><span>{(total-(s.paid||0)).toFixed(2)}₽</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Модалка поставки — Вариант 7 (Фокус на поставщика) */}
      {showModal && (
        <div className="modal-overlay active" onClick={(e)=>e.target.className==='modal-overlay active'&&(setShowModal(false),setFItems([]),setFAddSearch(''))}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>{setShowModal(false);setFItems([]);setFAddSearch('')}}>&times;</button>
            <div className="page-header" style={{marginBottom:'12px'}}>
              <div>
                <h1 style={{fontSize:'1.2rem',fontWeight:700,marginBottom:0}}>{editId?'Редактировать поставку':'Новая поставка'}</h1>
                <div className="sub" style={{marginBottom:0}}>Добавление товаров на склад</div>
              </div>
            </div>
            <form onSubmit={save}>
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
              <div style={{border:'1px solid #eee',borderRadius:'10px',padding:'12px',margin:'12px 0',background:'#fafafa'}}>
                <div style={{display:'flex',alignItems:'center',gap:'.35rem',marginBottom:'8px'}}>
                  <span style={{fontSize:'.72rem',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.3px'}}>Товары в поставке</span>
                  <span onClick={function(){scanBarcode(function(bc){
                    var found=products.find(function(p){return p.barcode===bc;});
                    if(found){setFAddProd(String(found.id));setFAddSearch(found.name);setToast('Найден: '+found.name);setFAddDrop(false)}else setToast('Штрихкод '+bc+' не найден');
                  })}} title="Сканировать штрихкод" 
                    style={{fontSize:'16px',cursor:'pointer',padding:'1px 6px',background:'#fff',border:'1.5px solid #eee',borderRadius:'6px',lineHeight:1,display:'inline-flex',alignItems:'center'}}>📷</span>
                </div>
                <div style={{display:'flex',gap:'.35rem',padding:'.3rem .5rem .2rem',fontSize:'.68rem',fontWeight:600,color:'#aaa',textTransform:'uppercase',letterSpacing:'.3px'}}>
                  <span style={{flex:3}}>Товар</span>
                  <span style={{flex:1,textAlign:'center'}}>Кол-во</span>
                  <span style={{flex:1,textAlign:'right'}}>Сумма</span>
                  <span style={{width:'1rem'}}></span>
                </div>
                <div style={{maxHeight:'160px',overflowY:'auto',marginBottom:'8px'}}>
                  {fItems.length===0 ? (
                    <div style={{textAlign:'center',padding:'.4rem',color:'#bbb',fontSize:'.8rem'}}></div>
                  ) : fItems.map((it,idx)=>(
                    <div key={idx} style={{display:'flex',alignItems:'center',gap:'.35rem',padding:'.3rem .5rem',borderBottom:'1px solid #f0f0f0',fontSize:'.85rem'}}>
                      <span style={{flex:3,fontWeight:500}}>{it.name}</span>
                      <span style={{flex:1,textAlign:'center',color:'#888'}}>{it.qty} шт</span>
                      <span style={{flex:1,textAlign:'right',fontWeight:500}}>{(it.qty*it.cost).toFixed(2)} ₽</span>
                      <button type="button" onClick={()=>removeItem(idx)} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:'1rem'}}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:'.35rem',alignItems:'center'}}>
                  <div style={{position:'relative',flex:1}}>
                    <input type="text" value={fAddSearch} onChange={function(e){setFAddSearch(e.target.value);setFAddProd('');setFAddDrop(true)}} 
                      onFocus={function(){setFAddDrop(true)}} onBlur={function(){setTimeout(function(){setFAddDrop(false)},200)}}
                      placeholder="Поиск товара..."
                      style={{width:'100%',padding:'.5rem .65rem',border:'1.5px solid var(--border)',borderRadius:'var(--radius-md)',fontSize:'.82rem',fontFamily:'var(--font)',outline:'none',background:'var(--body-bg)',boxSizing:'border-box',minHeight:'38px',textAlign:'left'}} />
                    {fAddDrop && (
                      <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #eee',borderRadius:'8px',boxShadow:'0 4px 12px rgba(0,0,0,.1)',zIndex:10,maxHeight:'150px',overflowY:'auto',marginTop:'2px'}}>
                        {(fAddSearch ? products.filter(function(p){return p.name.toLowerCase().includes(fAddSearch.toLowerCase())}) : products).map(function(p){
                          return (
                            <div key={p.id} onMouseDown={function(){setFAddProd(String(p.id));setFAddSearch(p.name);setFAddDrop(false)}}
                              style={{padding:'6px 10px',cursor:'pointer',fontSize:'.82rem',borderBottom:'1px solid #f5f5f5'}}
                              onMouseEnter={function(e){e.currentTarget.style.background='#f5f5f5'}}
                              onMouseLeave={function(e){e.currentTarget.style.background='#fff'}}>{p.name}</div>
                          );
                        })}
                        {products.filter(function(p){return !fAddSearch || p.name.toLowerCase().includes(fAddSearch.toLowerCase())}).length === 0 && (
                          <div style={{padding:'8px',fontSize:'.78rem',color:'#999',textAlign:'center'}}>Ничего не найдено</div>
                        )}
                      </div>
                    )}
                  </div>
                  <input type="number" value={fAddQty} onChange={e=>setFAddQty(e.target.value)} placeholder="Кол-во" min="1" step="any"
                    style={{width:'70px',padding:'.5rem .65rem',border:'1.5px solid var(--border)',borderRadius:'var(--radius-md)',fontSize:'.82rem',fontFamily:'var(--font)',outline:'none',background:'var(--body-bg)',textAlign:'center',boxSizing:'border-box',minHeight:'38px'}} />
                  <input type="number" value={fAddCost} onChange={e=>setFAddCost(e.target.value)} placeholder="Цена" min="0" step="0.01"
                    style={{width:'80px',padding:'.5rem .65rem',border:'1.5px solid var(--border)',borderRadius:'var(--radius-md)',fontSize:'.82rem',fontFamily:'var(--font)',outline:'none',background:'var(--body-bg)',textAlign:'left',boxSizing:'border-box',minHeight:'38px'}} />
                  <button type="button" onClick={addItem} style={{padding:'.3rem .5rem',fontSize:'.72rem',fontWeight:600,border:'none',borderRadius:'6px',background:'#111',color:'#fff',cursor:'pointer',fontFamily:'inherit',lineHeight:1.2}}>+</button>
                </div>
              </div>
              {fItems.length > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontWeight:700,fontSize:'.85rem'}}>
                  <span>Итого: {fItems.length} {function(n){if(n%10===1&&n%100!==11)return'товар';if(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20))return'товара';return'товаров'}(fItems.length)}</span>
                  <span>{fItems.reduce((a,it)=>a+it.qty*it.cost,0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ₽</span>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Статус</label>
                  <select value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                    <option value="ordered">Заказано</option>
                    <option value="transit">В пути</option>
                    <option value="received">Оприходовано</option>
                  </select>
                </div>

              </div>
              <div style={{textAlign:'right',marginTop:'10px'}}>
                <button type="submit" style={{padding:'10px 24px',borderRadius:'100px',border:'none',background:'#ffdd2d',color:'#111',fontSize:'.85rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Провести</button>
              </div>
            </form>
          </div>
        </div>
      )}{/* Модалка оплаты */}
      {showPay && (() => {
        const s = supplies.find(x => x.id === showPay);
        if (!s) return null;
        const total = s.total || (s.items||[]).reduce((sum,it)=>sum+it.qty*it.cost,0) || 0;
        const paid = s.paid || 0;
        const debt = total - paid;
        return (
          <div className="modal-overlay active" onClick={(e)=>e.target.className==='modal-overlay active'&&setShowPay(null)}>
            <div className="modal-box" style={{maxWidth:'420px'}}>
              <button className="modal-close" onClick={()=>setShowPay(null)}>&times;</button>
              <div className="page-header" style={{marginBottom:'12px'}}>
                <div>
                  <h1 style={{fontSize:'1.2rem',fontWeight:700,margin:0}}>Оплата поставки</h1>
                  <div className="sub" style={{marginBottom:0}}>{s.invoice||''} {s.supplier_name||''}</div>
                </div>
              </div>
              <div style={{background:'#f9f9f9',borderRadius:'10px',padding:'10px',marginBottom:'12px',fontSize:'.85rem',lineHeight:2}}>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>Сумма накладной:</span><span style={{fontWeight:600}}>{total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ₽</span></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>Уже оплачено:</span><span style={{color:'#16a34a',fontWeight:600}}>{paid.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ₽</span></div>
                <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #e8e8e8',paddingTop:'4px',marginTop:'4px'}}><span style={{fontWeight:600}}>Остаток:</span><span style={{color:'#dc2626',fontWeight:700}}>{debt.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ₽</span></div>
              </div>
              <form onSubmit={confirmPay}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Сумма (₽)</label>
                    <input type="number" id="payAmount" defaultValue={debt>0?debt.toFixed(2):''} min="0" step="0.01" required />
                  </div>
                  <div className="form-group">
                    <label>Счет списания</label>
                    <select id="payMethod">
                      <option value="">— выберите счет —</option>
                      {payAccounts.map(function(a){var bal=parseFloat(a.balance)||0;payTxList.forEach(function(t){if(t.account_id===a.id)bal+=Number(t.amount||0)*(t.type==='income'?1:-1)});return <option key={a.id} value={a.id}>{a.name} ({bal.toLocaleString()} ₽)</option>})}
                    </select>
                  </div>
                </div>
                <div style={{fontSize:'.82rem',color:'var(--secondary)',cursor:'pointer',marginBottom:'.5rem',fontWeight:500,marginTop:'.25rem'}} onClick={function(){setPaySplit(!paySplit);if(!paySplit)setSplitAmts({})}}>+ Разделить</div>
                {paySplit && <div style={{padding:'.5rem 0',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'.35rem',marginBottom:'.5rem'}}>
                  {payAccounts.map(function(a){
                    return (
                      <div key={a.id} style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
                        <span style={{flex:1,fontSize:'.8rem',fontWeight:500}}>{a.name}</span>
                        <input type="number" value={splitAmts[a.id]||''} onChange={function(e){setSplitAmts(function(p){return{...p,[a.id]:e.target.value}})}}
                          style={{width:'100px',padding:'.35rem .5rem',fontSize:'.78rem',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',textAlign:'right',fontFamily:'var(--font)'}} />
                      </div>
                    );
                  })}
                </div>}
                <div style={{textAlign:'right'}}>
                  <button type="submit" style={{padding:'10px 24px',borderRadius:'100px',border:'none',background:'#ffdd2d',color:'#111',fontSize:'.85rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Провести оплату</button>
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