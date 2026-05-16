import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';

const ACC_TYPES = [
  { type: 'cash', icon: '💵', label: 'Наличные' },
  { type: 'card', icon: '💳', label: 'Оплата картой' },
  { type: 'transfer', icon: '🔄', label: 'Перевод' },
  { type: 'checking', icon: '🏦', label: 'Расчётный счёт' },
  { type: 'bank', icon: '🏛️', label: 'Банковский счёт' },
  { type: 'electronic', icon: '🌐', label: 'Электронные деньги' },
  { type: 'reserve', icon: '🔒', label: 'Резерв' },
  { type: 'deposit', icon: '📜', label: 'Депозит' },
];
const SYSTEM_KEY = 'systemAccountIds';

export default function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initDone, setInitDone] = useState(false);
  const [systemIds, setSystemIds] = useState(new Set(JSON.parse(localStorage.getItem(SYSTEM_KEY)||'[]')));
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalName, setModalName] = useState('');
  const [modalType, setModalType] = useState('cash');
  const [modalBalance, setModalBalance] = useState('0');
  const [showInit, setShowInit] = useState(false);
  const [initAmts, setInitAmts] = useState({});
  const [showTransfer, setShowTransfer] = useState(false);
  const [trFrom, setTrFrom] = useState('cash');
  const [trTo, setTrTo] = useState('card');
  const [trAmt, setTrAmt] = useState('');

  const fetchAccounts = async () => {
    var d = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
    if (!d.data) return;
    var seen = {}, toDel = [];
    var cl = d.data.filter(a => { if (seen[a.type]) { toDel.push(a.id); return false; } seen[a.type] = true; return true; });
    if (toDel.length > 0) await supabase.from('accounts').delete().in('id', toDel);
    var need = {cash:!cl.some(a=>a.type==='cash'), card:!cl.some(a=>a.type==='card'), transfer:!cl.some(a=>a.type==='transfer')};
    if (user && (need.cash||need.card||need.transfer)) {
      var cr = [];
      if (need.cash) cr.push({user_id:user.id,name:'Наличные',type:'cash',balance:0});
      if (need.card) cr.push({user_id:user.id,name:'Оплата картой',type:'card',balance:0});
      if (need.transfer) cr.push({user_id:user.id,name:'Перевод',type:'transfer',balance:0});
      if (cr.length > 0) {
        var r = await supabase.from('accounts').insert(cr).select();
        if (r.data) {
          cl = cl.concat(r.data);
          var ids = r.data.map(x => x.id);
          var prev = JSON.parse(localStorage.getItem(SYSTEM_KEY)||'[]');
          localStorage.setItem(SYSTEM_KEY, JSON.stringify([...prev, ...ids]));
          setSystemIds(new Set([...prev, ...ids]));
        }
      }
    }
    setAccounts(cl);
    setInitDone(true);
  };

  const fetchTx = async () => {
    var r = await supabase.from('transactions').select('*').order('created_at', {ascending:false});
    setTransactions(r.data||[]);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); fetchTx(); }, []);

  var getBal = (type) => {
    var ac = accounts.find(a=>a.type===type); if (!ac) return 0;
    var b = parseFloat(ac.balance)||0;
    (transactions||[]).forEach(t=>{if(t.account_id===ac.id)b+=Number(t.amount||0)*(t.type==='income'?1:-1);});
    return b;
  };
  var getMv = (type) => {
    var ac = accounts.find(a=>a.type===type); if (!ac) return {i:0,e:0};
    var i=0,e=0; (transactions||[]).forEach(t=>{if(t.account_id===ac.id){if(t.type==='income')i+=Number(t.amount||0);else e+=Number(t.amount||0);}});
    return {i,e};
  };
  var isSys = (ac) => systemIds.has(ac?.id);

  var openAdd = () => { setEditingId(null); setModalName(''); setModalType('cash'); setModalBalance('0'); setShowModal(true); };
  var openEdit = (ac) => { setEditingId(ac.id); setModalName(ac.name); setModalType(ac.type); setModalBalance(String(parseFloat(ac.balance)||0)); setShowModal(true); };

  var save = async (e) => {
    e.preventDefault(); if (!modalName.trim()) return;
    var ib = parseFloat(modalBalance)||0;
    try {
      if (editingId) {
        await supabase.from('accounts').update({name:modalName.trim(),type:modalType,balance:ib}).eq('id',editingId);
        setAccounts(p=>p.map(a=>a.id===editingId?{...a,name:modalName.trim(),type:modalType,balance:ib}:a));
      } else {
        var r = await supabase.from('accounts').insert({user_id:user.id,name:modalName.trim(),type:modalType,balance:ib}).select();
        if (r.data&&r.data.length>0) setAccounts(p=>[...p,r.data[0]]);
      }
      setShowModal(false); setEditingId(null);
    } catch(err) {alert(err.message);}
  };

  var remove = async (ac) => {
    if (!ac||isSys(ac)) return;
    if ((transactions||[]).some(t=>t.account_id===ac.id)) return alert('Нельзя удалить счёт — на нём есть движения');
    if (!confirm('Удалить счёт "'+ac.name+'"?')) return;
    await supabase.from('accounts').delete().eq('id',ac.id);
    await fetchAccounts();
  };

  var saveInit = async (e) => {
    e.preventDefault();
    try {
      for (var type of Object.keys(initAmts)) {
        var amt = parseFloat(initAmts[type])||0;
        if (amt > 0) {
          await supabase.from('accounts').update({balance:amt}).eq('type',type).eq('user_id',user.id);
        }
      }
      setShowInit(false); setInitAmts({});
      await fetchAccounts();
    } catch(err) {alert(err.message);}
  };

  var goTransfer = async (e) => {
    e.preventDefault();
    if (!trAmt||parseFloat(trAmt)<=0) return;
    var amt=parseFloat(trAmt);
    try {
      var fr=accounts.find(a=>a.type===trFrom), to=accounts.find(a=>a.type===trTo);
      if (!fr||!to) {alert('Счёт не найден');return;}
      if (getBal(trFrom)<amt) {alert('Недостаточно средств');return;}
      await supabase.from('transactions').insert([
        {user_id:user.id,account_id:fr.id,type:'expense',amount:amt,description:'Перевод на '+to.name,date:new Date().toISOString().split('T')[0]},
        {user_id:user.id,account_id:to.id,type:'income',amount:amt,description:'Перевод с '+fr.name,date:new Date().toISOString().split('T')[0]}
      ]);
      setShowTransfer(false); setTrAmt(''); await fetchTx();
    } catch(err) {alert(err.message);}
  };

  var sorted = [...accounts].sort((a,b)=>{if(isSys(a)&&!isSys(b))return -1;if(!isSys(a)&&isSys(b))return 1;return 0;});
  var total = accounts.reduce((s,a)=>s+getBal(a.type),0);

  return (
    <>
      <div className="page-header">
        <div><h1>Счета</h1><div className="sub">Управление счетами</div></div>
        <div className="page-actions"><button className="btn-green" onClick={openAdd}>+ Добавить счёт</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="stock-filterbar" style={{border:'none',paddingTop:0}}>
        <div className="stock-filter-links" style={{marginLeft:0}}>
          <span className="stock-filter-link" onClick={()=>{setInitAmts({});setShowInit(true)}}>📋 Ввести начальные остатки</span>
          <span className="stock-filter-link" onClick={()=>setShowTransfer(true)}>🔄 Перевод между счетами</span>
        </div>
      </div>

      {!loading && initDone && (
        <>
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:'1rem',padding:'1rem 1.25rem',marginBottom:'1rem',boxShadow:'0 .25rem .75rem rgba(0,0,0,.04)'}}>
            <div style={{fontSize:'1.8rem',fontWeight:700,color:'#111'}}>{total.toLocaleString()}₽</div>
            <div style={{fontSize:'.78rem',color:'var(--muted)',marginTop:'.15rem'}}>Общий баланс всех счетов</div>
          </div>
          {sorted.map(a => {
            var m=ACC_TYPES.find(t=>t.type===a.type), ic=m?m.icon:'🏦', lb=m?m.label:a.type;
            var bl=getBal(a.type), mv=getMv(a.type), in0=parseFloat(a.balance)||0;
            return (
              <div key={a.id} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:'.85rem',padding:'.85rem',marginBottom:'.5rem',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.35rem'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
                    <span style={{fontSize:'1.5rem'}}>{ic}</span>
                    <div><div style={{fontWeight:600,fontSize:'.85rem'}}>{a.name}</div><div style={{fontSize:'.72rem',color:'var(--muted)'}}>{lb}</div></div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
                    <button className="act-btn prod-edit-btn" onClick={()=>openEdit(a)}>Ред.</button>
                    {!isSys(a) && (
                      <div className="prod-more-wrap">
                        <button className="act-btn prod-more-btn" onClick={e=>{e.stopPropagation();var el=e.currentTarget.nextElementSibling;el.classList.add('open');setTimeout(()=>document.addEventListener('click',function h(){el.classList.remove('open');document.removeEventListener('click',h)}),10)}}>⋯</button>
                        <div className="prod-dropdown"><button onClick={()=>remove(a)} style={{color:'#dc3545'}}>Удалить</button></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="nav-sep" style={{margin:'.35rem 0',width:'100%',opacity:.3}} />
                <div style={{fontSize:'.82rem',color:'var(--muted)',lineHeight:1.6}}>
                  <span>Было: {in0.toLocaleString()}₽</span><span style={{margin:'0 .35rem'}}>·</span>
                  <span style={{color:'#16a34a'}}>+Доход: {mv.i.toLocaleString()}₽</span><span style={{margin:'0 .35rem'}}>·</span>
                  <span style={{color:'#dc2626'}}>−Расход: {mv.e.toLocaleString()}₽</span>
                </div>
                <div style={{fontSize:'1.05rem',fontWeight:700,color:bl>=0?'#16a34a':'#dc2626',marginTop:'.25rem'}}>= {bl.toLocaleString()}₽</div>
              </div>
            );
          })}
        </>
      )}

      {showModal && (
        <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active'){setShowModal(false);setEditingId(null)}}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>{setShowModal(false);setEditingId(null)}}>&times;</button>
            <h2>{editingId?'Редактировать счёт':'Добавить счёт'}</h2>
            <div className="sub">{editingId?'Измените данные счёта':'Введите название и начальный остаток'}</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например, Касса магазина" value={modalName} onChange={e=>setModalName(e.target.value)} required />
              </div>
              {!editingId && (
                <div className="form-group">
                  <label>Тип</label>
                  <select value={modalType} onChange={e=>setModalType(e.target.value)}>
                    {ACC_TYPES.map(t=><option key={t.type} value={t.type}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Начальный остаток (₽)</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={modalBalance} onChange={e=>setModalBalance(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editingId?'Сохранить':'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInit && (
        <div className="modal-overlay active">
          <div className="modal-box" style={{maxWidth:'500px'}}>
            <button className="modal-close" onClick={()=>setShowInit(false)}>&times;</button>
            <h2>Введите первоначальные остатки</h2>
            <div className="sub">Используйте эту функцию при первом заполнении программы</div>
            <form onSubmit={saveInit}>
              {sorted.filter(a => !isSys(a) || parseFloat(a.balance)===0).map(a => {
                var m=ACC_TYPES.find(t=>t.type===a.type), ic=m?m.icon:'🏦', lb=m?m.label:a.type;
                return (
                  <div key={a.id} className="form-group">
                    <label>{ic} {a.name} ({lb})</label>
                    <input type="number" placeholder="0" min="0" step="0.01"
                      value={initAmts[a.type]||""}
                      onChange={function(e){var v=parseFloat(e.target.value)||0;setInitAmts(p=>{var r=Object.assign({},p);r[a.type]=v;return r;})}} />
                  </div>
                );
              })}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="modal-overlay active">
          <div className="modal-box">
            <button className="modal-close" onClick={()=>setShowTransfer(false)}>&times;</button>
            <h2>Перевод между счетами</h2>
            <div className="sub">Переместите деньги между счетами</div>
            <form onSubmit={goTransfer}>
              <div className="form-group">
                <label>С какого счёта</label>
                <select value={trFrom} onChange={e=>setTrFrom(e.target.value)}>
                  {accounts.map(a=>{var m=ACC_TYPES.find(t=>t.type===a.type);return <option key={a.id} value={a.type}>{m?m.icon:''} {a.name} ({getBal(a.type).toLocaleString()}₽)</option>})}
                </select>
              </div>
              <div className="form-group">
                <label>На какой счёт</label>
                <select value={trTo} onChange={e=>setTrTo(e.target.value)}>
                  {accounts.filter(a=>a.type!==trFrom).map(a=>{var m=ACC_TYPES.find(t=>t.type===a.type);return <option key={a.id} value={a.type}>{m?m.icon:''} {a.name}</option>})}
                </select>
              </div>
              <div className="form-group">
                <label>Сумма (₽) *</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={trAmt} onChange={e=>setTrAmt(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Перевести</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
