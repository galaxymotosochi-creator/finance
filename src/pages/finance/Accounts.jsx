import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { getCurrencySymbol } from '../../lib/currency';
import Loader from '../../components/Loader';


const ACC_TYPES = [
  { type: 'cash', icon: '💵', label: 'Наличные' },
  { type: 'cash_register', icon: '🗄️', label: 'Кассовый ящик' },
  { type: 'card', icon: '💳', label: 'Оплата картой' },
  { type: 'transfer', icon: '🔄', label: 'Перевод' },
  { type: 'checking', icon: '🏦', label: 'Расчетный счет' },
  { type: 'bank', icon: '🏛️', label: 'Банковский счет' },
  { type: 'electronic', icon: '🌐', label: 'Электронные деньги' },
  { type: 'reserve', icon: '🔒', label: 'Резерв' },
  { type: 'deposit', icon: '📜', label: 'Депозит' },
  { type: 'custom', icon: '🏦', label: 'Счёт' },
];
const SYSTEM_KEY = 'systemAccountIds';
// Отметка «начальный остаток введён» (даже если это 0) — чтобы счёт с нулём не просил ввод снова
const INIT_DONE_KEY = 'atlaspos_init_done';
const getInitDone = () => { try { return JSON.parse(localStorage.getItem(INIT_DONE_KEY) || '[]'); } catch(e) { return []; } };
const setInitDoneId = (id) => { const l = getInitDone(); if (id != null && !l.includes(String(id))) { l.push(String(id)); localStorage.setItem(INIT_DONE_KEY, JSON.stringify(l)); } };
const isInitDone = (id) => getInitDone().includes(String(id));

export default function Accounts() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initDone, setInitDone] = useState(false);
  const [systemIds, setSystemIds] = useState(new Set(JSON.parse(localStorage.getItem(SYSTEM_KEY)||'[]')));
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalName, setModalName] = useState('');
  const [modalType, setModalType] = useState('custom');
  const [modalBalance, setModalBalance] = useState('0');
  const [modalDesc, setModalDesc] = useState('');
  const [showInit, setShowInit] = useState(false);
  const [initAmts, setInitAmts] = useState({});
  const [newAccs, setNewAccs] = useState([]);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trAmt, setTrAmt] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteAc, setPendingDeleteAc] = useState(null);
  const [showCollection, setShowCollection] = useState(false);
  const [colAmt, setColAmt] = useState('');
  const [colTo, setColTo] = useState('');
  const [viewAcTx, setViewAcTx] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const [corAcct, setCorAcct] = useState('cash');
  const [corType, setCorType] = useState('income');
  const [corAmt, setCorAmt] = useState('');
  const [corDesc, setCorDesc] = useState('');
  // Свои деньги владельца (взнос/вывод) — не влияют на прибыль
  const [showOwner, setShowOwner] = useState(false);
  const [ownerMode, setOwnerMode] = useState('deposit');
  const [ownerAcct, setOwnerAcct] = useState('');
  const [ownerAmt, setOwnerAmt] = useState('');
  const [ownerDesc, setOwnerDesc] = useState('');

  const fetchAccounts = async () => {
    try {
      var d = await supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (!d.data) return;
      var cl = d.data;
      var need = {cash:!cl.some(a=>a.type==='cash'), cash_register:!cl.some(a=>a.type==='cash_register')};
      if (user) {
        var cr = [];
        if (need.cash) cr.push({user_id:user.id,name:'Наличные',type:'cash',balance:0,description:'Деньги вне кассы (сейф) — сюда инкассируется'});
        if (need.cash_register) cr.push({user_id:user.id,name:'Кассовый ящик',type:'cash_register',balance:0,description:'Наличные от продаж — лежат в ящике кассы'});
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
    } catch(e) { console.error('Accounts fetch error:', e); }
    setInitDone(true);
  };

  const fetchTx = async () => {
    try {
      var r = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', {ascending:false});
      setTransactions(r.data||[]);
    } catch(e) { console.error('Tx fetch error:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); fetchTx(); }, []);

  // Оптимистичная синхронизация: счета и операции появляются сразу (с красной точкой), даже офлайн
  const reloadAll = () => { fetchAccounts(); fetchTx(); };
  useOptimisticSync({ table: 'accounts', setList: setAccounts, onSynced: reloadAll });
  useOptimisticSync({ table: 'transactions', setList: setTransactions, onSynced: reloadAll });

  // Онбординг: показываем «Первоначальные остатки», пока есть невведённые счета и нет учтённых данных
  useEffect(() => {
    if (initDone && !loading) {
      const hasData = accounts.some(a => parseFloat(a.balance) > 0) || transactions.length > 0;
      const hasPending = accounts.some(a => parseFloat(a.balance) === 0 && !isInitDone(a.id));
      if (!hasData && hasPending) setShowInit(true);
    }
  }, [initDone, loading, accounts, transactions]);

  var getBal = (ac) => {
    if (!ac) return 0;
    var b = parseFloat(ac.balance)||0;
    (transactions||[]).forEach(t=>{if(t.account_id===ac.id)b+=Number(t.amount||0)*(t.type==='income'?1:-1);});
    return b;
  };
  var getMv = (ac) => {
    if (!ac) return {i:0,e:0};
    var i=0,e=0; (transactions||[]).forEach(t=>{if(t.account_id===ac.id){if(t.type==='income')i+=Number(t.amount||0);else e+=Number(t.amount||0);}});
    return {i,e};
  };
  var getTypeMeta = (ac) => {
    try {
      var dt = JSON.parse(localStorage.getItem('accountDisplayTypes')||'{}');
      var t = (dt && dt[ac.id]) || ac.type;
      return ACC_TYPES.find(x => x.type === t);
    } catch(e) { return ACC_TYPES.find(x => x.type === ac.type); }
  };
  var isSys = (ac) => systemIds.has(ac?.id);
  var hasAct = (ac) => (transactions||[]).some(t=>t.account_id===ac.id);

  var openAdd = () => { setEditingId(null); setModalName(''); setModalType('custom'); setModalBalance('0'); setModalDesc(''); setShowModal(true); };
  var openEdit = (ac) => {
    if (hasAct(ac)) return setToast('⚠️ Нельзя редактировать счет — на нем есть движения');
    setEditingId(ac.id); setModalName(ac.name); setModalType(ac.type); setModalBalance('0'); setModalDesc(ac.description||''); setShowModal(true);
  };

  var save = async (e) => {
    e.preventDefault(); if (!modalName.trim()) return;
    var ib = parseFloat(modalBalance)||0;
    try {
      if (editingId) {
        var up = await supabase.from('accounts').update({name:modalName.trim(), description:modalDesc.trim()||''}).eq('id',editingId);
        if (up.error) { alert(up.error.message); return; }
        if (!up.queued) setAccounts(p=>p.map(a=>a.id===editingId?{...a,name:modalName.trim(), description:modalDesc.trim()||''}:a));
      } else {
        var ins = await supabase.from('accounts').insert({user_id:user.id,name:modalName.trim(),type:modalType,balance:ib, description:modalDesc.trim()||''}).select();
        if (ins.error) { alert(ins.error.message); return; }
      }
      if (!((up && up.queued) || (ins && ins.queued))) { await fetchAccounts(); await fetchTx(); }
      setShowModal(false); setEditingId(null);
    } catch(err) {alert(err.message);}
  };

  var remove = (ac) => {
    if (!ac||isSys(ac)) return;
    if ((transactions||[]).some(t=>t.account_id===ac.id)) {
      setToast('⚠️ Нельзя удалить счет — на нем есть движения');
      return;
    }
    setPendingDeleteAc(ac);
    setShowConfirm(true);
  };

  var confirmDelete = async () => {
    if (!pendingDeleteAc) return;
    setShowConfirm(false);
    try {
      const { error, queued } = await supabase.from('accounts').delete().eq('id', pendingDeleteAc.id);
      if (error) return setToast('⚠️ ' + error.message);
      if (!queued) await fetchAccounts();
    } catch(err) { setToast('⚠️ ' + err.message); }
    setPendingDeleteAc(null);
  };

  // Счёт, которому ещё не ввели начальный остаток (баланс 0 и нет отметки о вводе)
  var notInit = (a) => parseFloat(a.balance) === 0 && !isInitDone(a.id);

  var saveInit = async (e) => {
    e.preventDefault();
    try {
      var anyQueued = false;
      // Считаем введённым только то, что реально заполнено: «0» — это введённый ноль,
      // пустое поле — предприниматель ничего не вводил (счёт остаётся невведённым)
      for (var ac of accounts) {
        if (parseFloat(ac.balance) !== 0 || isInitDone(ac.id)) continue;
        var raw = initAmts[ac.id];
        if (raw === undefined || raw === '') continue;
        var amt = parseFloat(raw) || 0;
        var r = await supabase.from('accounts').update({ balance: amt }).eq('id', ac.id);
        if (r.error) throw r.error;
        if (r.queued) anyQueued = true;
        setInitDoneId(ac.id);
      }
      // Новые счета из модалки — каждый добавляется строкой «+ Добавить счёт»
      for (var na of newAccs) {
        if (na.name && na.name.trim()) {
          var ir = await supabase.from('accounts').insert({user_id:user.id, name:na.name.trim(), type:na.type||'custom', balance:parseFloat(na.amt)||0, description:(na.desc||'').trim() || null}).select();
          if (ir.error) throw ir.error;
          if (!ir.queued && ir.data && ir.data[0]) setInitDoneId(ir.data[0].id);
        }
      }
      setShowInit(false); setInitAmts({}); setNewAccs([]);
      if (!anyQueued) await fetchAccounts();
    } catch(err) {alert(err.message);}
  };

  var sorted = [...accounts].sort((a,b)=>{if(isSys(a)&&!isSys(b))return -1;if(!isSys(a)&&isSys(b))return 1;return 0;});
  // Общий баланс: начальный остаток + транзакции по каждому счету (по id, а не по type)
  var balById = {};
  (transactions||[]).forEach(t => {
    if (!balById[t.account_id]) balById[t.account_id] = 0;
    balById[t.account_id] += Number(t.amount||0) * (t.type === 'income' ? 1 : -1);
  });
  var total = accounts.reduce((s,a) => s + (parseFloat(a.balance)||0) + (balById[a.id]||0), 0);
   if (loading || !initDone) return <Loader />;
   return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>
      {toast && <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.75rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999,display:'flex',alignItems:'center',gap:'.5rem'}}>{toast}</div>}
      <div className="page-header">
        <div><h1>Счета</h1><div className="sub">Управление счетами и учет остатков</div></div>
        <div className="page-actions"><button className="btn-mint" onClick={openAdd} style={{background:'#111',color:'#fff',border:'none',borderRadius:'100px',padding:'.5rem .9rem',fontWeight:600,fontFamily:'var(--font)',cursor:'pointer',fontSize:'.78rem'}}>+ Добавить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="search-row" style={{display:'flex',alignItems:'center',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap'}}>
        <div className="stock-filter-links" style={{display:'flex',alignItems:'center',gap:'.15rem',marginLeft:'auto'}}>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
            onClick={()=>{setInitAmts({});setNewAccs([]);setShowInit(true)}}>Начальные остатки</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
            onClick={()=>{setCorAcct(accounts[0]?.id||'');setCorType('income');setCorAmt('');setCorDesc('');setShowCorrect(true)}}>Корректировка</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#dc2626',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1,fontWeight:600}}
            onClick={()=>{setColAmt('');setColTo('');setShowCollection(true)}}>Инкассация</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',lineHeight:1}}
            onClick={()=>{setTrFrom('');setTrTo('');setTrAmt('');setShowTransfer(true)}}>Перевод между счетами</span>
        </div>
      </div>

      {!loading && initDone && (
        <>
          {/* Общий баланс счетов — отдельная плашка */}
          <div style={{display:'inline-flex',alignItems:'center',gap:'.75rem',marginBottom:'.5rem',padding:'.8rem 1.1rem',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',boxShadow:'0 1px 3px rgba(0,0,0,.05)'}}>
            <div style={{display:'flex',flexDirection:'column'}}>
              <span style={{fontSize:'.66rem',color:'rgba(0,0,0,.5)',textTransform:'uppercase',fontWeight:600}}>Общий баланс счетов</span>
              <span style={{fontSize:'1.2rem',fontWeight:800,color:'#111'}}>{(total||0).toLocaleString()} {cur}</span>
            </div>
          </div>
          {/* Свои деньги владельца — отдельная плашка */}
          {(()=>{
            var oIn=0,oOut=0;
            (transactions||[]).forEach(function(t){if(t.kind==='owner_deposit')oIn+=Number(t.amount||0);else if(t.kind==='owner_withdraw')oOut+=Number(t.amount||0);});
            if(oIn===0&&oOut===0){(transactions||[]).forEach(function(t){var dd=t.description||'';if(dd.startsWith('Взнос своих денег'))oIn+=Number(t.amount||0);else if(dd.startsWith('Вывод своих денег'))oOut+=Number(t.amount||0);});}
            return (
              <div style={{display:'flex',alignItems:'center',gap:'1.1rem',marginBottom:'1rem',padding:'.7rem 1rem',background:'linear-gradient(135deg,#ffdd2d,#fff9db)',border:'1px solid #fcd34d',borderRadius:'12px',flexWrap:'wrap',width:'100%'}}>
                <div style={{display:'flex',flexDirection:'column'}}><span style={{fontSize:'.66rem',color:'rgba(0,0,0,.5)',textTransform:'uppercase',fontWeight:600}}>Внесено своих средств</span><span style={{fontSize:'1rem',fontWeight:800,color:'#111'}}>+{oIn.toLocaleString()} {cur}</span></div>
                <div style={{display:'flex',flexDirection:'column'}}><span style={{fontSize:'.66rem',color:'rgba(0,0,0,.5)',textTransform:'uppercase',fontWeight:600}}>Выведено</span><span style={{fontSize:'1rem',fontWeight:800,color:'#111'}}>-{oOut.toLocaleString()} {cur}</span></div>
                <div style={{display:'flex',flexDirection:'column'}}><span style={{fontSize:'.66rem',color:'rgba(0,0,0,.5)',textTransform:'uppercase',fontWeight:600}}>Сейчас в бизнесе</span><span style={{fontSize:'1rem',fontWeight:800,color:'#111'}}>{(oIn-oOut).toLocaleString()} {cur}</span></div>
                <div style={{display:'flex',flexDirection:'column',gap:'.3rem',marginLeft:'auto'}}>
                  <button type="button" onClick={()=>{setOwnerMode('deposit');setOwnerAcct(accounts[0]?.id||'');setOwnerAmt('');setOwnerDesc('');setShowOwner(true)}}
                    style={{padding:'.3rem .8rem',borderRadius:'100px',border:'none',background:'#111',color:'#fff',fontSize:'.72rem',fontWeight:700,cursor:'pointer',fontFamily:'var(--font)',whiteSpace:'nowrap'}}>+ Внести</button>
                  <button type="button" onClick={()=>{setOwnerMode('withdraw');setOwnerAcct(accounts[0]?.id||'');setOwnerAmt('');setOwnerDesc('');setShowOwner(true)}}
                    style={{padding:'.3rem .8rem',borderRadius:'100px',border:'none',background:'#111',color:'#fff',fontSize:'.72rem',fontWeight:700,cursor:'pointer',fontFamily:'var(--font)',whiteSpace:'nowrap'}}>− Забрать</button>
                </div>
              </div>
            );
          })()}
          <div className="product-table" style={{flex:1,overflowY:'auto',overflowX:'auto',WebkitOverflowScrolling:'touch',minHeight:0}}>
            <table className="data-table">
              <thead id="colHeaders">
                <tr>
                  <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left',paddingLeft:0}}>Счет</th>
                  <th style={{textAlign:'left'}}>Начальный остаток</th>
                  <th style={{textAlign:'left'}}>Поступления</th>
                  <th style={{textAlign:'left'}}>Расходы</th>
                  <th style={{textAlign:'left'}}>Баланс</th>
                  <th className="actions" style={{textAlign:'left'}}></th>
                </tr>
              </thead>
              <tbody id="dirTableBody">
                {sorted.length === 0 ? (
                  <tr><td colSpan="6"><div className="empty-products"><div className="big-icon">🏦</div><p>Нет счетов</p></div></td></tr>
                ) : sorted.map(a => {
                  var m=ACC_TYPES.find(t=>t.type===a.type), lb=m?m.label:a.type;
                  var bl=getBal(a), mv=getMv(a), in0=parseFloat(a.balance)||0;
                  return (
                    <tr key={a.id}>
                      <td style={{textAlign:'left'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
                          <div style={{cursor:'pointer'}} onClick={()=>setViewAcTx(a)}>
                            <div className="prod-name">{a.name}</div>
                            <div className="prod-sku">{a.description || lb}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{textAlign:'left'}}>{in0.toLocaleString()} {cur}</td>
                      <td style={{textAlign:'left',color:'#555'}}>+{mv.i.toLocaleString()} {cur}</td>
                      <td style={{textAlign:'left',color:'#555'}}>−{mv.e.toLocaleString()} {cur}</td>
                      <td style={{textAlign:'left',color:'#555'}}>{bl>=0?'+':''}{bl.toLocaleString()} {cur}</td>
                      <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                        {!isSys(a) ? (
                          <div className="prod-more-wrap" style={{display:'inline-block',position:'relative'}}>
                            <button className="act-btn prod-more-btn" onClick={e=>{e.stopPropagation();var el=e.currentTarget.nextElementSibling;el.classList.add('open');var _r=el.getBoundingClientRect();if(_r.bottom>window.innerHeight)el.classList.add('up');else el.classList.remove('up');setTimeout(()=>document.addEventListener('click',function h(){el.classList.remove('open');document.removeEventListener('click',h)}),10)}}>⋯</button>
                            <div className="prod-dropdown">
                              <button onClick={()=>openEdit(a)}>Редактировать</button>
                              <button onClick={()=>remove(a)} style={{color:'#dc3545'}}>Удалить</button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length > 0 && (() => {
                  const incTot = accounts.reduce((s,a) => { const mv=getMv(a); return s + mv.i; }, 0);
                  const expTot = accounts.reduce((s,a) => { const mv=getMv(a); return s + mv.e; }, 0);
                  return (
                  <tr className="total-row">
                    <td style={{fontWeight:600,textAlign:'left'}}>Итого</td>
                    <td style={{textAlign:'left',fontWeight:700}}>{accounts.reduce((s,a)=>s+(parseFloat(a.balance)||0),0).toLocaleString()} {cur}</td>
                    <td style={{textAlign:'left',fontWeight:700,color:'#16a34a'}}>+{incTot.toLocaleString()} {cur}</td>
                    <td style={{textAlign:'left',fontWeight:700,color:'#dc2626'}}>−{expTot.toLocaleString()} {cur}</td>
                    <td style={{textAlign:'left',fontWeight:700,color:total>=0?'#16a34a':'#dc2626'}}>{total>=0?'+':''}{total.toLocaleString()} {cur}</td>
                    <td></td>
                  </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={showModal} onClose={()=>{setShowModal(false);setEditingId(null)}} title={editingId?'Редактировать счет':'Добавить счет'} subtitle={editingId?'Измените данные счета':'Настройка нового кошелька, расчетного счета или кассы'} width="medium">
        <form onSubmit={save}>
              <div className="form-group">
                <label>Название</label>
                <input type="text" placeholder="Например: расчетный счет (Т-Банк), карта (Сбер)" value={modalName} onChange={e=>setModalName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <input type="text" placeholder="Например: основная касса в магазине" value={modalDesc} onChange={e=>setModalDesc(e.target.value)} />
              </div>
              {!editingId && (
                <div className="form-group">
                  <label>Тип счёта</label>
                  <select value={modalType} onChange={e=>setModalType(e.target.value)}>
                    {ACC_TYPES.filter(t => !((t.type==='cash'||t.type==='cash_register') && accounts.some(a=>a.type===t.type))).map(t=><option key={t.type} value={t.type}>{t.label}</option>)}
                  </select>
                </div>
              )}
              {!editingId && (
                <div className="form-group">
                  <label>Начальный остаток (₽)</label>
                  <input type="number" placeholder="0" min="0" step="0.01" value={modalBalance} onChange={e=>setModalBalance(e.target.value)} />
                </div>
              )}
              <div className="modal-actions">
                <button type="submit" className="btn btn-dark">{editingId?'Сохранить':'Добавить'}</button>
              </div>
            </form>
      </Modal>

      <Modal open={showCorrect} onClose={()=>setShowCorrect(false)} title="Корректировка баланса" subtitle="Исправьте остаток на счете" width="medium">
            <form onSubmit={async (e)=>{e.preventDefault();if(!corAmt||parseFloat(corAmt)<=0)return;var amt=parseFloat(corAmt);try{var ac=accounts.find(a=>a.id===corAcct);if(!ac)return;// Защита: баланс не может уйти в минус
              if(corType==='expense'){var cb=getBal(ac);if(amt>cb)return alert('На счёте «'+ac.name+'» недостаточно средств (доступно '+Math.round(cb).toLocaleString()+' '+cur+'). Баланс не может уйти в минус — выберите другой счёт или сначала пополните этот.');}
              await supabase.from('transactions').insert({user_id:user.id,account_id:ac.id,type:corType,amount:amt,description:corDesc.trim()||'Корректировка баланса',date:new Date().toISOString().split('T')[0]});setShowCorrect(false);await fetchTx();}catch(err){alert(err.message);}}}>
              <div className="form-group">
                <label>Счет</label>
                <select value={corAcct} onChange={e=>setCorAcct(e.target.value)}>
                  {accounts.map(a=>{var m=ACC_TYPES.find(t=>t.type===a.type);return <option key={a.id} value={a.id}>{''} {a.name} ({Math.round(getBal(a)).toLocaleString()} {cur})</option>})}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Тип</label>
                  <select value={corType} onChange={e=>setCorType(e.target.value)}>
                    <option value="income">Приход</option>
                    <option value="expense">Расход</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Сумма (₽)</label>
                  <input type="number" placeholder="0" min="0" step="0.01" value={corAmt} onChange={e=>setCorAmt(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <input type="text" placeholder="Корректировка баланса" value={corDesc} onChange={e=>setCorDesc(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-dark">Применить</button>
              </div>
            </form>
      </Modal>

      <Modal open={showOwner} onClose={()=>setShowOwner(false)} title="Свои деньги владельца" subtitle="Личные средства — не считаются доходом и не влияют на прибыль" width="medium">
            <form onSubmit={async (e)=>{e.preventDefault();var amt=parseFloat(ownerAmt);if(!amt||amt<=0)return alert('Введите сумму');try{var ac=accounts.find(a=>a.id===ownerAcct);if(!ac)return alert('Выберите счёт');// Нельзя вывести больше, чем есть на счёте
              if(ownerMode==='withdraw'){var bal=getBal(ac);if(amt>bal)return alert('Недостаточно средств на счёте «'+ac.name+'». Доступно: '+Math.round(bal).toLocaleString()+' '+cur);}
              var isDeposit=ownerMode==='deposit';var res=await supabase.from('transactions').insert({user_id:user.id,account_id:ac.id,type:isDeposit?'income':'expense',amount:amt,description:(isDeposit?'Взнос своих денег':'Вывод своих денег')+(ownerDesc.trim()?' — '+ownerDesc.trim():''),date:new Date().toISOString().split('T')[0],kind:isDeposit?'owner_deposit':'owner_withdraw',category_id:null});if(res.error)throw res.error;setShowOwner(false);setOwnerAmt('');setOwnerDesc('');if(!res.queued)await fetchTx();setToast((isDeposit?'Взнос':'Вывод')+' своих денег: '+amt.toLocaleString()+' '+cur);}catch(err){alert(err.message);}}}>
              <div className="form-group">
                <label>Операция</label>
                <div style={{display:'flex',gap:'.5rem'}}>
                  <button type="button" onClick={()=>setOwnerMode('deposit')} style={{flex:1,padding:'.6rem .5rem',borderRadius:'8px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8rem',fontWeight:600,border:'1.5px solid '+(ownerMode==='deposit'?'var(--secondary)':'var(--border)'),background:ownerMode==='deposit'?'var(--secondary-light)':'transparent',color:ownerMode==='deposit'?'var(--secondary)':'#555'}}>Взнос (доложить)</button>
                  <button type="button" onClick={()=>setOwnerMode('withdraw')} style={{flex:1,padding:'.6rem .5rem',borderRadius:'8px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8rem',fontWeight:600,border:'1.5px solid '+(ownerMode==='withdraw'?'var(--secondary)':'var(--border)'),background:ownerMode==='withdraw'?'var(--secondary-light)':'transparent',color:ownerMode==='withdraw'?'var(--secondary)':'#555'}}>Вывод (забрать)</button>
                </div>
              </div>
              <div className="form-group">
                <label>Счет</label>
                <select value={ownerAcct} onChange={e=>setOwnerAcct(e.target.value)}>
                  {accounts.map(a=>{var m=ACC_TYPES.find(t=>t.type===a.type);return <option key={a.id} value={a.id}>{m?m.icon+' ':''}{a.name} ({Math.round(getBal(a)).toLocaleString()} {cur})</option>})}
                </select>
              </div>
              <div className="form-group">
                <label>Сумма ({cur})</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={ownerAmt} onChange={e=>setOwnerAmt(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Комментарий (необязательно)</label>
                <input type="text" placeholder="Например: аренда за сентябрь" value={ownerDesc} onChange={e=>setOwnerDesc(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-dark">{ownerMode==='deposit' ? 'Внести деньги' : 'Забрать деньги'}</button>
              </div>
            </form>
      </Modal>

      <Modal open={showInit} onClose={()=>setShowInit(false)} title={sorted.filter(notInit).length ? "Введите первоначальные остатки" : "Начальные остатки"} subtitle={sorted.filter(notInit).length ? "Введите балансы счетов. Если на счету ноль — оставьте 0 и нажмите «Сохранить»: это тоже нормально" : "Все начальные остатки уже внесены. Изменить баланс счёта можно через «Корректировку»"} width="medium">
            <form onSubmit={saveInit}>
              {sorted.filter(notInit).map(a => {
                var m=getTypeMeta(a), ic=m?m.icon:'🏦', lb=m?m.label:a.type;
                return (
                  <div key={a.id} className="form-group">
                    <label>{a.name}</label>
                    <input type="number" placeholder="0" min="0" step="0.01"
                      value={initAmts[a.id]||""}
                      onChange={function(e){setInitAmts(p=>{var r=Object.assign({},p);r[a.id]=e.target.value;return r;})}} />
                  </div>
                );
              })}
              {sorted.filter(notInit).length === 0 && (
                <div style={{padding:'.25rem 0'}}></div>
              )}
              {sorted.filter(notInit).length > 0 && (
              <div className="form-group" style={{marginTop:'.75rem',paddingTop:'.75rem',borderTop:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.5rem'}}>
                  <label style={{margin:0}}>Новые счета</label>
                  <button type="button" onClick={()=>setNewAccs([...newAccs, {name:'',amt:'',desc:'',type:'custom'}])}
                    style={{background:'none',border:'none',padding:'.15rem .4rem',margin:0,fontFamily:'inherit',fontSize:'.82rem',color:'var(--secondary)',cursor:'pointer',lineHeight:1,fontWeight:400}}>
                    + Добавить счёт
                  </button>
                </div>
                {newAccs.map(function(na, idx){
                  return (
                    <div key={idx} style={{padding:'.5rem 0',borderTop:'1px solid var(--border)'}}>
                      <div style={{display:'flex',gap:'.5rem'}}>
                        <input placeholder="Название счёта" value={na.name} onChange={e=>{var r=[...newAccs];r[idx]={...r[idx],name:e.target.value};setNewAccs(r);}} style={{flex:1}} />
                        <input type="number" placeholder="Остаток" min="0" step="0.01" value={na.amt} onChange={e=>{var r=[...newAccs];r[idx]={...r[idx],amt:e.target.value};setNewAccs(r);}} style={{width:'100px'}} />
                        <button type="button" onClick={()=>setNewAccs(newAccs.filter(function(_,i){return i!==idx}))} style={{background:'none',border:'none',color:'#dc3545',cursor:'pointer',fontSize:'1rem',lineHeight:1,padding:'0 .2rem'}} title="Удалить">×</button>
                      </div>
                      <input placeholder="Комментарий (необязательно)" value={na.desc} onChange={e=>{var r=[...newAccs];r[idx]={...r[idx],desc:e.target.value};setNewAccs(r);}} style={{marginTop:'.4rem',width:'100%'}} />
                      <select value={na.type} onChange={e=>{var r=[...newAccs];r[idx]={...r[idx],type:e.target.value};setNewAccs(r);}} style={{marginTop:'.4rem',width:'100%'}}>
                        {ACC_TYPES.filter(t => !((t.type==='cash'||t.type==='cash_register') && accounts.some(a=>a.type===t.type))).map(t=><option key={t.type} value={t.type}>{t.label}</option>)}
                      </select>
                    </div>
                  );
                })}
                {newAccs.length === 0 && (
                  <div style={{fontSize:'.78rem',color:'var(--muted)'}}>Нажмите «+ Добавить счёт», чтобы завести ещё один. Все счета сохранятся кнопкой «Сохранить».</div>
                )}
              </div>
              )}
              <div className="modal-actions">
                {sorted.filter(notInit).length > 0 && (<>
                  <button type="button" className="btn btn-outline" onClick={()=>{setShowInit(false);setNewAccs([])}}>Пропустить</button>
                  <button type="submit" className="btn btn-dark">Сохранить</button>
                </>)}
                {sorted.filter(notInit).length === 0 && (
                  <button type="button" className="btn btn-outline" onClick={()=>setShowInit(false)}>Закрыть</button>
                )}
              </div>
            </form>
      </Modal>

      <Modal open={viewAcTx} onClose={()=>setViewAcTx(null)} title={viewAcTx?.name||''}
        subtitle={viewAcTx?.description||''} width="medium">
        {viewAcTx && (<>
            <div style={{fontSize:'.8rem',color:'var(--muted)',marginBottom:'.5rem'}}>История операций по счету</div>
            <div className="product-table" style={{flex:1,overflowY:'auto'}}>
              <table className="data-table">
                <thead id="colHeaders">
                  <tr>
                    <th style={{textAlign:'left',paddingLeft:0,minWidth:'100px'}}>Дата</th>
                    <th style={{textAlign:'left'}}>Описание</th>
                    <th style={{width:'80px'}}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {(()=>{
                    var txList = (transactions||[]).filter(t=>t.account_id===viewAcTx.id).sort((a,b)=>(b.date||b.created_at||'').localeCompare(a.date||a.created_at||''));
                    if (txList.length===0) return <tr><td colSpan="3"><div className="empty-products"><div className="big-icon">📋</div><p>Нет операций по счету</p></div></td></tr>;
                    return txList.map(t=>{
                      var amt=Number(t.amount||0);
                      var isOwnerTx = t.kind === 'owner_deposit' || t.kind === 'owner_withdraw' || (t.description||'').startsWith('Взнос своих денег') || (t.description||'').startsWith('Вывод своих денег');
                      return (
                        <tr key={t.id}>
                          <td style={{textAlign:'left',color:'#555'}}>{((t.date||t.created_at||'').split('T')[0]||'').split('-').reverse().join('.')}</td>
                          <td style={{textAlign:'left'}}>
                            <span className="prod-name">{t.description||'—'}</span>
                            <span className="prod-sku">{isOwnerTx ? (t.type==='income'?'Взнос своих денег':'Вывод своих денег') : (t.type==='income'?'Доход':'Расход')}</span>
                          </td>
                          <td style={{textAlign:'left',color:'#111'}}>{t.type==='income'?'+':'-'}{amt.toLocaleString()} {cur}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
        </>)}
      </Modal>

      <Modal open={showTransfer} onClose={()=>setShowTransfer(false)} title="Перевод между счетами" subtitle="Перемещение средств между счетами" width="medium">
            <form onSubmit={async (e)=>{e.preventDefault();if(!trFrom||!trTo||trFrom===trTo||!trAmt||parseFloat(trAmt)<=0)return;var amt=parseFloat(trAmt);try{var fromAc=accounts.find(a=>a.id===trFrom);var toAc=accounts.find(a=>a.id===trTo);if(!fromAc||!toAc)return;var fromBal=getBal(fromAc);if(amt>fromBal)return alert('Недостаточно средств на счете «'+fromAc.name+'». Баланс: '+fromBal.toLocaleString()+' ₽');var tid=Date.now();await supabase.from('transactions').insert({user_id:user.id,account_id:fromAc.id,type:'expense',amount:amt,description:'Перевод со счета '+fromAc.name,date:new Date().toISOString().split('T')[0],kind:'transfer',transfer_id:tid});await supabase.from('transactions').insert({user_id:user.id,account_id:toAc.id,type:'income',amount:amt,description:'Перевод на счет '+toAc.name,date:new Date().toISOString().split('T')[0],kind:'transfer',transfer_id:tid});setShowTransfer(false);await fetchTx();}catch(err){alert(err.message);}}}>
              <div className="form-group">
                <label>Откуда</label>
                <select value={trFrom} onChange={e=>setTrFrom(e.target.value)} required>
                  <option value="">— выберите —</option>
                  {accounts.filter(a=>a.id!==trTo).map(a=><option key={a.id} value={a.id}>{a.name} ({Math.round(getBal(a)).toLocaleString()} {cur})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Куда</label>
                <select value={trTo} onChange={e=>setTrTo(e.target.value)} required>
                  <option value="">— выберите —</option>
                  {accounts.filter(a=>a.id!==trFrom).map(a=><option key={a.id} value={a.id}>{a.name} ({Math.round(getBal(a)).toLocaleString()} {cur})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Сумма (₽)</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={trAmt} onChange={e=>setTrAmt(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-dark">Перевести</button>
              </div>
            </form>
      </Modal>

      <Modal open={showConfirm} onClose={()=>{setShowConfirm(false);setPendingDeleteAc(null)}} title="Удалить счет?" subtitle={pendingDeleteAc ? 'Счет «'+pendingDeleteAc.name+'» будет удален навсегда.' + ((parseFloat(pendingDeleteAc.balance)||0)>0 ? ' На счету '+(parseFloat(pendingDeleteAc.balance)||0).toLocaleString()+' ₽ — они исчезнут из учёта.' : '') : ''} width="narrow"
        actions={<>
          <button type="button" className="btn btn-outline" onClick={()=>{setShowConfirm(false);setPendingDeleteAc(null)}}>Отмена</button>
          <button className="btn btn-primary" style={{background:'#dc2626',color:'#fff'}} onClick={confirmDelete}>Да, удалить</button>
        </>}>
      </Modal>

      {/* Инкассация */}
      <Modal open={showCollection} onClose={()=>setShowCollection(false)} title="Инкассация" subtitle="Изъятие наличных из кассы" width="medium">
        {(()=>{
        var cashRegAc = accounts.find(a => a.type === 'cash_register');
        var cashRegBal = 0;
        if (cashRegAc) {
          cashRegBal = parseFloat(cashRegAc.balance)||0;
          (transactions||[]).forEach(function(t){if(t.account_id===cashRegAc.id) cashRegBal += Number(t.amount||0) * (t.type==='income'?1:-1);});
        }
        var otherAccs = accounts.filter(function(a){return a.id !== cashRegAc?.id;});
        if (!cashRegAc) return (<>
              <div style={{padding:'1rem 0',fontSize:'.85rem',color:'var(--muted)'}}>Счёт «Кассовый ящик» не найден. Обновите страницу — он создастся автоматически.</div>
              <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={()=>setShowCollection(false)}>Закрыть</button></div>
        </>);
        return (<>
              <div style={{background:'#f5f5f5',borderRadius:'.5rem',padding:'.5rem .75rem',marginBottom:'.75rem',fontSize:'.82rem'}}>
                <span style={{color:'var(--muted)'}}>Баланс Кассы:</span>{' '}
                <span style={{fontWeight:700}}>{cashRegBal.toLocaleString()} {cur}</span>
              </div>
              <form onSubmit={async function(e){
                e.preventDefault();
                var amt = parseFloat(colAmt);
                if (!amt || amt <= 0) return alert('Введите сумму');
                if (amt > cashRegBal) return alert('Недостаточно средств в кассе. Баланс: ' + cashRegBal.toLocaleString() + ' ₽');
                if (!colTo) return alert('Выберите счёт получателя');
                var toAc = accounts.find(a => a.id === colTo);
                if (!toAc) return alert('Счёт не найден');
                try {
                  // Категория «Инкассация»
                  var colCatId = null;
                  var { data: foundCat } = await supabase.from('categories').select('id').eq('user_id', user.id).eq('name', 'Инкассация').maybeSingle();
                  if (foundCat) colCatId = foundCat.id;
                  else {
                    var { data: newCat } = await supabase.from('categories').insert({user_id:user.id,name:'Инкассация',type:'expense'}).select('id').maybeSingle();
                    if (newCat) colCatId = newCat.id;
                  }
                  // Расход с Кассы + доход на выбранный счёт
                  var tid = Date.now();
                  await supabase.from('transactions').insert([
                    {user_id:user.id,account_id:cashRegAc.id,type:'expense',amount:amt,description:'Инкассация из кассового ящика',date:new Date().toISOString().split('T')[0],category_id:colCatId,kind:'collection',transfer_id:tid},
                    {user_id:user.id,account_id:toAc.id,type:'income',amount:amt,description:'Инкассация на счет ' + toAc.name,date:new Date().toISOString().split('T')[0],category_id:colCatId,kind:'collection',transfer_id:tid}
                  ]);
                  setShowCollection(false);
                  await fetchTx();
                } catch(err) {alert(err.message);}
              }}>
                <div className="form-group">
                  <label>Сумма (₽)</label>
                  <input type="number" placeholder="0" min="0" step="0.01" value={colAmt} onChange={function(e){setColAmt(e.target.value)}} required autoFocus />
                </div>
                <div className="form-group">
                  <label>Куда зачислить</label>
                  <select value={colTo} onChange={function(e){setColTo(e.target.value)}} required>
                    <option value="">— выберите счёт —</option>
                    {otherAccs.map(function(a){return <option key={a.id} value={a.id}>{a.name} ({Math.round(getBal(a)).toLocaleString()} {cur})</option>})}
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowCollection(false)}>Отмена</button>
                  <button type="submit" style={{padding:'.5rem 1.2rem',fontSize:'.82rem',fontWeight:600,borderRadius:'8px',border:'none',cursor:'pointer',background:'#e65100',color:'#fff',fontFamily:'inherit'}}>Инкассировать</button>
                </div>
              </form>
        </>
        );
      })()}
      </Modal>
    </div>
  );
}
