import Modal from '../../components/Modal';
import SectionHelp from '../../components/SectionHelp';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { fmtDate } from '../../lib/dates';
import { getCurrencySymbol } from '../../lib/currency';
import Loader from '../../components/Loader';



const SUPPLY_STATUSES = ['ordered','transit','received'];
const SUPPLY_LABELS = {ordered:'Заказано',transit:'В пути',received:'Оприходовано'};
const SUPPLY_COLORS = {ordered:'#2563eb',transit:'#d97706',received:'#16a34a'};
const PAY_LABELS = {unpaid:'Не оплачено',partially_paid:'Частично оплачено',paid:'Оплачено'};
const PAY_COLORS = {unpaid:'#dc2626',partially_paid:'#d97706',paid:'#16a34a'};

function getPayStatus(s) {
  const total = s.total || (s.items||[]).reduce((sum,it) => sum + it.qty*it.cost, 0) || (s.qty||0)*(s.cost||0) || 0;
  const paid = s.paid || 0;
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partially_paid';
  return 'unpaid';
}

export default function Supplies() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paySplit, setPaySplit] = useState(false);
  const [splitAmts, setSplitAmts] = useState({});
  const loc = useLocation();
  const [supplies, setSuppliesState] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false); // модалка редактирования поставки
  const [expandedId, setExpandedId] = useState(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(null);
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
      navigate('/stock/supply/new');
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
    try {
      const [supRes, prodRes, suppRes, accRes, txRes] = await Promise.all([
        supabase.from('supplies').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('*').eq('user_id', user.id).limit(1000),
      ]);
      if (supRes.error) throw supRes.error;
      if (supRes.data) setSuppliesState(supRes.data);
      if (prodRes.data) setProducts(prodRes.data);
      if (suppRes.data) setSuppliers(suppRes.data);
      if (accRes.data) setPayAccounts(accRes.data);
      if (txRes.data) setPayTxList(txRes.data);
    } catch (e) {
      alert('Ошибка загрузки поставок: ' + (e.message || 'неизвестная ошибка'));
    }
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

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'supplies', setList: setSuppliesState, onSynced: load });
  useOptimisticSync({ table: 'transactions', setList: setPayTxList, onSynced: load });
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
    navigate('/stock/supply/new');
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
    const total = fItems.reduce((acc, it) => acc + it.qty * it.cost, 0);
    const obj = { user_id: user.id, supplier_name: fSupName.trim(), invoice: fInvoice.trim(), items: fItems, total, status: fStatus, date: new Date().toISOString().split('T')[0] };
    let queued = false;
    if (editId) {
      // Не затираем оплату при редактировании (раньше paid сбрасывался в 0 — задолженность росла)
      const cur = supplies.find(x => x.id === editId);
      obj.paid = cur?.paid || 0;
      obj.payments = cur?.payments || [];
      const res = await supabase.from('supplies').update(obj).eq('id', editId).eq('user_id', user.id);
      if (res.error) return showToast('Ошибка: ' + res.error.message);
      queued = res.queued;
    } else {
      obj.paid = 0;
      const res = await supabase.from('supplies').insert({ ...obj, id: Date.now() });
      if (res.error) return showToast('Ошибка: ' + res.error.message);
      queued = res.queued;
    }
    if (!queued) await load(); setShowModal(false); setEditId(null);
    showToast('Поставка сохранена');
  };

  const cycleStatus = async (id) => {
    const s = supplies.find(x => x.id === id);
    if (!s) return;
    const idx = SUPPLY_STATUSES.indexOf(s.status || 'ordered');
    const nextStatus = SUPPLY_STATUSES[(idx + 1) % SUPPLY_STATUSES.length];
    setShowStatusConfirm({ id, nextStatus });
  };

  const confirmStatusChange = async () => {
    if (!showStatusConfirm) return;
    const { id, nextStatus } = showStatusConfirm;
    const s = supplies.find(x => x.id === id);
    if (!s) return;
    const res = await supabase.from('supplies').update({ status: nextStatus }).eq('id', id).eq('user_id', user.id);
    setShowStatusConfirm(null);
    if (!res.queued) await load();
  };

  const edit = (id) => {
    const s = supplies.find(x => x.id === id);
    if (!s) return;
    if (s.status === 'received') return alert('Оприходованную поставку редактировать нельзя');
    setEditId(id); setFInvoice(s.invoice||''); setFSupName(s.supplier_name||'');
    setFStatus(s.status||'ordered'); setFPaid(String(s.paid||0));
    setFItems((s.items||[{prodId:s.prodId,name:'Товар',qty:s.qty||0,cost:s.cost||0}]).slice());
    setShowModal(true);
  };

  const remove = async (id) => {
    if (!confirm('Удалить поставку?')) return;
    const { error, queued } = await supabase.from('supplies').delete().eq('id', id);
    if (error) return alert('Ошибка удаления: ' + error.message);
    if (!queued) await load();
  };

  const copy = async (id) => {
    const s = supplies.find(x => x.id === id);
    if (!s) return;
    const { error, queued } = await supabase.from('supplies').insert({ ...s, id: Date.now(), invoice: (s.invoice||'') + ' (копия)', created_at: new Date().toISOString() });
    if (error) return showToast('Ошибка: ' + error.message);
    if (!queued) await load(); showToast('📋 Поставка скопирована');
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
        if (bal < amt) return alert('Недостаточно средств на ' + ac.name + '. Доступно: ' + bal.toLocaleString() + ' ' + cur + '. Разделите оплату на несколько счетов или выберите другой счёт.');
        await supabase.from('transactions').insert({
          user_id: user.id, account_id: ac.id, type: 'expense', amount: amt,
          description: 'Оплата поставки ' + (s.invoice||''), date: new Date().toISOString().split('T')[0]
        });
        if (!Array.isArray(s.payments)) s.payments = [];
        s.payments.push({ amount: amt, method: ac.name, date: new Date().toLocaleDateString('ru-RU') });
      }
    } else {
      const amount = parseFloat(document.getElementById('payAmount').value) || 0;
      const acId = document.getElementById('payMethod').value;
      if (amount <= 0) return alert('Введите сумму');
      if (!acId) return alert('Выберите счет');
      if (amount > debt + 0.01) return alert('Сумма больше задолженности (' + debt.toLocaleString() + ' ₽)');
      var ac = payAccounts.find(function(a){return a.id === acId;});
      var bal = parseFloat(ac?.balance)||0;
      payTxList.forEach(function(t){if(t.account_id===acId)bal+=Number(t.amount||0)*(t.type==='income'?1:-1)});
      if (bal < amount) return alert('Недостаточно средств на счете. Доступно: ' + bal.toLocaleString() + ' ' + cur + '. Разделите оплату на несколько счетов или выберите другой счёт.');
      const { error: txErr } = await supabase.from('transactions').insert({
        user_id: user.id, account_id: acId, type: 'expense', amount: amount,
        description: 'Оплата поставки ' + (s.invoice||''), date: new Date().toISOString().split('T')[0]
      });
      if (txErr) return alert('Ошибка создания операции: ' + txErr.message);
      if (!Array.isArray(s.payments)) s.payments = [];
      s.payments.push({ amount, method: ac?.name||'', date: new Date().toLocaleDateString('ru-RU') });
    }
    const totalPaid = (s.payments||[]).reduce((sum,p) => sum + (parseFloat(p.amount)||0), 0);
    const { error: payUpdateErr, queued: payQueued } = await supabase.from('supplies').update({ paid: totalPaid }).eq('id', showPay).eq('user_id', user.id); if (payUpdateErr) { showToast('Ошибка обновления: ' + payUpdateErr.message); return; }
    if (!payQueued) await load(); setShowPay(null); setPaySplit(false); setSplitAmts({});
    showToast('Оплата проведена');
  };

  const totalItems = (s) => (s.items||[s]).length;
  
  if (loading) return <Loader />;

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1>Поставки</h1>
            <SectionHelp
              title="Раздел «Поставки»"
              intro="Поставки — это поступления товаров от поставщиков. Здесь видно, что и по какой цене вы закупили, на каком этапе поставка и сколько за неё ещё должны."
              blocks={[
                { title: 'Кнопка «+ Добавить поставку»', items: [
                  <>Открывает форму новой поставки: поставщик, номер накладной, статус и список товаров (выбираете товар, количество и закупочную цену).</>,
                ]},
                { title: 'Столбцы таблицы', items: [
                  <><b>№</b> — номер поставки по порядку.</>,
                  <><b>Дата</b> — когда оформлена поставка.</>,
                  <><b>Поставщик</b> — от кого закупка.</>,
                  <><b>Товары / Кол-во</b> — что входит в поставку и сколько всего штук.</>,
                  <><b>Поставка</b> — статус: Заказано → В пути → Оприходовано. Клик по статусу — перевести на следующий этап.</>,
                  <><b>Оплата</b> — Не оплачено / Частично / Оплачено. Клик — отметить оплату.</>,
                  <><b>Сумма</b> — общая стоимость закупки.</>,
                  <><b>Задолж.</b> — сколько ещё должны поставщику.</>,
                  <><b>Детали</b> — раскрывает состав поставки (товары, количество, суммы). Клик по строке — тоже.</>,
                ]},
                { title: 'Статусы поставки', items: [
                  <><b>Заказано</b> (синий) — договорились с поставщиком, товар ещё не отправлен.</>,
                  <><b>В пути</b> (оранжевый) — товар едет к вам.</>,
                  <><b>Оприходовано</b> (зелёный) — товар получен и добавлен на склад. Остатки выросли, себестоимость пересчиталась.</>,
                ]},
                { title: 'Оплата поставки', items: [
                  <>Клик по статусу оплаты открывает окно: выбираете счёт и сумму.</>,
                  <>Деньги списываются со счёта — в «Движении денег» появится операция расхода.</>,
                  <>Оплатить можно частями: сначала часть, потом остальное — статус станет «Частично оплачено».</>,
                ]},
                { title: 'Кнопка ⋯ у поставки', items: [
                  <><b>Редактировать</b> — изменить поставку (пока она не оприходована).</>,
                  <><b>Копировать</b> — создать похожую поставку с тем же составом.</>,
                  <><b>Удалить</b> — убрать поставку из списка.</>,
                ]},
              ]}
            />
          </div>
          <div className="sub">Учет поступлений товаров от поставщиков</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" style={{color:"#222",fontWeight:400}} onClick={() => navigate('/stock/supply/new')}>+ Добавить поставку</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table className="data-table">
          <thead id="supplyColHeaders">
            <tr>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left',width:'30px'}}>№</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Дата</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Поставщик</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Товары</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left',width:'50px'}}>Кол-во</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Поставка</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Оплата</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Сумма</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Задолж.</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}></th>
            </tr>
          </thead>
          <tbody id="supplyTableBody">
            {supplies.length === 0 ? (
              <tr><td colSpan="10"><div className="empty-products"><div className="big-icon">📦</div><p>Список поставок пуст</p><p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Оформите первое поступление товаров от поставщика</p></div></td></tr>
            ) : supplies.map((s, i) => {
              const total = s.total || (s.items||[]).reduce((sum,it) => sum + it.qty*it.cost, 0) || (s.qty||0)*(s.cost||0);
              const payStatus = getPayStatus(s);
              const supSt = SUPPLY_LABELS[s.status||'ordered']||'Заказано';
              const paySt = PAY_LABELS[payStatus]||'Не оплачено';
              const supColor = SUPPLY_COLORS[s.status||'ordered']||'#2563eb';
              const payColor = PAY_COLORS[payStatus]||'#dc2626';
              return (
                <>
                <tr key={s.id} onClick={function(e){if(!e.target.closest('span')&&!e.target.closest('.prod-more-wrap'))setExpandedId(s.id === expandedId ? null : s.id)}} style={{cursor:'pointer'}}>
                  <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}>{i + 1}</td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}>{(()=>{if(!s.date)return'—';try{var sp=s.date.split('T'),d=sp[0].split('-'),t=sp[1]?sp[1].split(':').slice(0,2).join(':'):'';if(d.length!==3)return s.date;var mn=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];return parseInt(d[2])+' '+mn[parseInt(d[1])-1]+(t?', '+t:'')}catch(e){return s.date}})()}</td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap'}}><span className="prod-cat">{s.supplier_name||'—'}{s.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</span></td>
                  <td style={{textAlign:'left',color:'#222',fontSize:'.78rem',maxWidth:'160px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(s.items||[]).map(it=>it.name).join(', ') || '—'}</td>
                  <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}>{totalItems(s)}</td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap'}}>
                    <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.78rem',color:"#222",background:supColor+'18',cursor:'pointer',whiteSpace:'nowrap'}}
                      onClick={() => s.status !== 'received' && cycleStatus(s.id)}>{supSt}</span>
                  </td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap'}}>
                    <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.78rem',color:"#222",background:payColor+'18',cursor:'pointer',whiteSpace:'nowrap'}}
                      onClick={() => payStatus !== 'paid' && setShowPay(s.id)}>{paySt}</span>
                  </td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}><span className="num">{Number(total).toLocaleString()}₽</span></td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}>{(s.paid||0) < total ? (total - (s.paid||0)).toLocaleString() + '₽' : '—'}</td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap'}}>
                    <span onClick={() => setExpandedId(s.id === expandedId ? null : s.id)}
                      style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.78rem',color:'#222',background:'#eee',cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}}>Детали</span>
                    <div style={{display:'inline-block',position:'relative',marginLeft:'4px'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" style={{fontWeight:400,color:"#222"}} onClick={(e) => {
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
                {expandedId === s.id && (() => {
                  const items = s.items || [{name:'Товар',qty:s.qty||0,cost:s.cost||0}];
                  const total = s.total || items.reduce((sum,it) => sum + it.qty*it.cost, 0);
                  const payStatus = getPayStatus(s);
                  return (
                    <tr>
                      <td colSpan="10" style={{padding:0}}>
                        <div style={{margin:"8px 0",background:"#fff",borderRadius:"14px",padding:"14px 16px",boxShadow:"0 2px 12px rgba(0,0,0,.06)",border:"1px solid #f0f0f0"}}>
                          <div style={{display:"flex",color:"#222",fontWeight:400,paddingBottom:"6px",marginBottom:"8px",borderBottom:"1px solid #f0f0f0"}}>
                            <span style={{flex:1}}>ТОВАР</span>
                            <span style={{width:"70px",textAlign:"center"}}>КОЛ-ВО</span>
                            <span style={{width:"80px",textAlign:"right"}}>СУММА</span>
                          </div>
                          {items.map((it,i) => (
                            <div key={i} style={{display:"flex",fontSize:".78rem",color:"#222",padding:"4px 0",borderBottom:"1px solid #f8f8f8"}}>
                              <span style={{flex:1}}>{it.name}</span>
                              <span style={{width:"70px",textAlign:"center"}}>{it.qty}</span>
                              <span style={{width:"80px",textAlign:"right"}}>{(it.qty*it.cost).toLocaleString()} {cur}</span>
                            </div>
                          ))}
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:".78rem",color:"#222",fontWeight:500,paddingTop:"8px",marginTop:"0"}}>
                            <span>Итого:</span>
                            <span>{total.toLocaleString()} {cur}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Модалка редактирования поставки (была потеряна при рефакторинге — кнопка «Редактировать» не работала) */}
      <Modal open={showModal} onClose={()=>{setShowModal(false);setEditId(null)}} title={editId ? 'Редактировать поставку' : 'Новая поставка'} subtitle="Заказ или поступление товаров от поставщика" width="medium">
        <form onSubmit={save}>
          <div style={{display:'flex',gap:'.5rem'}}>
            <div className="form-group" style={{flex:1}}>
              <label>Поставщик</label>
              <input type="text" value={fSupName} onChange={e=>setFSupName(e.target.value)} placeholder="Название поставщика" />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>Накладная №</label>
              <input type="text" value={fInvoice} onChange={e=>setFInvoice(e.target.value)} placeholder="Номер документа" />
            </div>
          </div>
          <div className="form-group">
            <label>Статус</label>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)}>
              <option value="ordered">Заказано</option>
              <option value="transit">В пути</option>
            </select>
          </div>
          <div className="form-group">
            <label>Товары</label>
            <div style={{border:'1px solid var(--border)',borderRadius:'8px',padding:'.4rem',maxHeight:'180px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'.25rem'}}>
              {fItems.length === 0 && <div style={{fontSize:'.76rem',color:'var(--muted)',padding:'.3rem'}}>Товары не добавлены</div>}
              {fItems.map((it,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:'.4rem',fontSize:'.8rem'}}>
                  <span style={{flex:1}}>{it.name}</span>
                  <span style={{width:'50px',textAlign:'right'}}>{it.qty} × {it.cost}₽</span>
                  <button type="button" onClick={()=>removeItem(i)} style={{background:'none',border:'none',color:'#dc3545',cursor:'pointer',fontSize:'1rem',padding:'0 .2rem'}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:'.3rem',marginTop:'.35rem'}}>
              <select value={fAddProd} onChange={e=>setFAddProd(e.target.value)} style={{flex:1,padding:'.3rem .4rem',fontSize:'.78rem',border:'1.5px solid var(--border)',borderRadius:'8px',fontFamily:'var(--font)'}}>
                <option value="">— товар —</option>
                {products.filter(p=>p.type==='product'||p.type==='combo').map(p=><option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </select>
              <input type="number" value={fAddQty} onChange={e=>setFAddQty(e.target.value)} placeholder="Кол-во" style={{width:'70px',padding:'.3rem .4rem',fontSize:'.78rem',border:'1.5px solid var(--border)',borderRadius:'8px',fontFamily:'var(--font)'}} />
              <input type="number" value={fAddCost} onChange={e=>setFAddCost(e.target.value)} placeholder="Цена" style={{width:'80px',padding:'.3rem .4rem',fontSize:'.78rem',border:'1.5px solid var(--border)',borderRadius:'8px',fontFamily:'var(--font)'}} />
              <button type="button" onClick={addItem} style={{padding:'.3rem .7rem',fontSize:'.78rem',borderRadius:'8px',border:'none',background:'#ffdd2d',color:'#111',cursor:'pointer',fontFamily:'inherit'}}>+</button>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={()=>{setShowModal(false);setEditId(null)}}>Отмена</button>
            <button type="submit" className="btn btn-primary">Сохранить</button>
          </div>
        </form>
      </Modal>

      <Modal open={showStatusConfirm} onClose={()=>setShowStatusConfirm(null)} width="narrow">
        {showStatusConfirm && (() => {
        const s = supplies.find(x => x.id === showStatusConfirm.id);
        if (!s) return null;
        const idx = SUPPLY_STATUSES.indexOf(s.status || 'ordered');
        const nextSt = SUPPLY_STATUSES[(idx + 1) % SUPPLY_STATUSES.length];
        const curLbl = SUPPLY_LABELS[s.status||'ordered']||'';
        const nextLbl = SUPPLY_LABELS[nextSt]||'';
        const nextColor = SUPPLY_COLORS[nextSt]||'#2563eb';
        const hints = {
          ordered:'Товар заказан у поставщика, но ещё не отправлен. Можно редактировать состав поставки.',
          transit:'Поставка в пути. Товар скоро поступит на склад.',
          received:'Товар поступил на склад и готов к продаже. Редактирование недоступно.'
        };
        return (<>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'.5rem',marginBottom:'16px'}}>
                <span style={{padding:'.3rem .7rem',borderRadius:'100px',fontSize:'.78rem',color:'#222',background:SUPPLY_COLORS[s.status||'ordered']+'18',whiteSpace:'nowrap'}}>{curLbl}</span>
                <span style={{fontSize:'.78rem',color:'#222'}}>→</span>
                <span style={{padding:'.3rem .7rem',borderRadius:'100px',fontSize:'.78rem',color:'#222',background:nextColor+'18',whiteSpace:'nowrap'}}>{nextLbl}</span>
              </div>
              <div style={{fontSize:'.76rem',color:'#222',lineHeight:1.6,marginBottom:'16px',padding:'10px 12px',background:'#f9f9f9',borderRadius:'8px'}}>{hints[nextSt]||''}</div>
              <div style={{display:'flex',gap:'.5rem',justifyContent:'center'}}>
                <button type="button" className="btn btn-outline" onClick={()=>setShowStatusConfirm(null)}>Отмена</button>
                <button type="button" onClick={confirmStatusChange}
                  style={{padding:'8px 20px',borderRadius:'100px',border:'none',background:'#ffdd2d',color:'#222',fontSize:'.78rem',cursor:'pointer',fontFamily:'inherit'}}>Подтвердить</button>
              </div>
        </>);})()}
      </Modal>
      
      <Modal open={showPay} onClose={()=>setShowPay(null)} title="Оплата поставки" width="medium">
        {showPay && (() => {
        const s = supplies.find(x => x.id === showPay);
        if (!s) return null;
        const total = s.total || (s.items||[]).reduce((sum,it)=>sum+it.qty*it.cost,0) || 0;
        const paid = s.paid || 0;
        const debt = total - paid;
        return (<>
              <div style={{background:'#f9f9f9',borderRadius:'10px',padding:'10px',marginBottom:'12px',fontSize:'.78rem',lineHeight:2}}>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#222',fontSize:'.78rem'}}>Поставщик:</span><span style={{fontSize:'.78rem',color:'#222'}}>{s.supplier_name || s.invoice || '—'}</span></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#222',fontSize:'.78rem'}}>Сумма накладной:</span><span style={{fontSize:'.78rem',color:'#222'}}>{total.toLocaleString()} {cur}</span></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#222',fontSize:'.78rem'}}>Уже оплачено:</span><span style={{fontSize:'.78rem',color:'#222'}}>{paid.toLocaleString()} {cur}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #e8e8e8',paddingTop:'4px',marginTop:'4px'}}><span style={{fontSize:'.78rem',color:'#222'}}>Остаток:</span><span style={{fontSize:'.78rem',color:'#222'}}>{debt.toLocaleString()} {cur}</span></div>
              </div>
              <form onSubmit={confirmPay}>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{fontSize:'.78rem',color:'#222'}}>Сумма</label>
                    <input type="number" id="payAmount" defaultValue={debt>0?debt.toFixed(2):''} min="0" step="0.01" required />
                  </div>
                  <div className="form-group">
                    <label style={{fontSize:'.78rem',color:'#222'}}>Счет списания</label>
                    <select id="payMethod">
                      <option value="">— выберите счет —</option>
                      {payAccounts.map(function(a){var bal=parseFloat(a.balance)||0;payTxList.forEach(function(t){if(t.account_id===a.id)bal+=Number(t.amount||0)*(t.type==='income'?1:-1)});return <option key={a.id} value={a.id}>{a.name} ({bal.toLocaleString()} {cur})</option>})}
                    </select>
                  </div>
                </div>
                <div style={{fontSize:'.78rem',color:'var(--secondary)',cursor:'pointer',marginBottom:'.5rem',fontWeight:500,marginTop:'.25rem'}} onClick={function(){setPaySplit(!paySplit);if(!paySplit)setSplitAmts({})}}>+ Разделить</div>
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
                  <button type="submit" style={{padding:'10px 24px',borderRadius:'100px',border:'none',background:'#ffdd2d',color:'#111',fontSize:'.78rem',cursor:'pointer',fontFamily:'inherit'}}>Провести оплату</button>
                </div>
              </form>
        </>);
      })()}
      </Modal>

      {/* Toast */}
      {toast && (
        <div id="toast" style={{
          position:'fixed', bottom:'1.5rem', left:'50%', transform:'translateX(-50%)',
          background:'#fff', border:'1px solid #e5e7eb', borderRadius:'.75rem',
          padding:'.65rem 1.2rem', fontSize:'.85rem', color:'#222',
          boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)', zIndex:9999,
          display:'flex', alignItems:'center', gap:'.5rem'
        }}>
          {toast}
        </div>
      )}
    </>
  );
}