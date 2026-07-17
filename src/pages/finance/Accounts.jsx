import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';

const ACC_TYPES = [
  { type: 'cash', icon: '💵', label: 'Наличные' },
  { type: 'cash_register', icon: '🗄️', label: 'Касса' },
  { type: 'card', icon: '💳', label: 'Оплата картой' },
  { type: 'transfer', icon: '🔄', label: 'Перевод' },
  { type: 'checking', icon: '🏦', label: 'Расчетный счет' },
  { type: 'bank', icon: '🏛️', label: 'Банковский счет' },
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
  const [modalType, setModalType] = useState('custom');
  const [modalBalance, setModalBalance] = useState('0');
  const [modalDesc, setModalDesc] = useState('');
  const [showInit, setShowInit] = useState(false);
  const [initAmts, setInitAmts] = useState({});
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

  const fetchAccounts = async () => {
    try {
      var d = await supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (!d.data) return;
      var cl = d.data;
      var need = {cash:!cl.some(a=>a.type==='cash'), cash_register:!cl.some(a=>a.type==='cash_register')};
      if (user) {
        var cr = [];
        if (need.cash) cr.push({user_id:user.id,name:'Наличные',type:'cash',balance:0,description:'Наличные деньги (не через кассу)'});
        if (need.cash_register) cr.push({user_id:user.id,name:'Касса',type:'cash_register',balance:0,description:'Наличные продажи через кассу'});
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
  var hasAct = (ac) => parseFloat(ac.balance)>0||(transactions||[]).some(t=>t.account_id===ac.id);

  var openAdd = () => { setEditingId(null); setModalName(''); setModalType('cash'); setModalBalance('0'); setModalDesc(''); setShowModal(true); };
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
        setAccounts(p=>p.map(a=>a.id===editingId?{...a,name:modalName.trim(), description:modalDesc.trim()||''}:a));
      } else {
        var ins = await supabase.from('accounts').insert({user_id:user.id,name:modalName.trim(),type:'custom',balance:ib, description:modalDesc.trim()||''}).select();
        if (ins.error) { alert(ins.error.message); return; }
      }
      await fetchAccounts();
      await fetchTx();
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
      await supabase.from('accounts').delete().eq('id',pendingDeleteAc.id);
      await fetchAccounts();
    } catch(err) {setToast('⚠️ '+err.message);}
    setPendingDeleteAc(null);
  };

  var saveInit = async (e) => {
    e.preventDefault();
    try {
      for (var acId of Object.keys(initAmts)) {
        var amt = parseFloat(initAmts[acId])||0;
        if (amt > 0) {
          await supabase.from('accounts').update({balance:amt}).eq('id',acId);
        }
      }
      setShowInit(false); setInitAmts({});
      await fetchAccounts();
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
   if (loading || !initDone) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;
   return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>
      {toast && <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.75rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999,display:'flex',alignItems:'center',gap:'.5rem'}}>{toast}</div>}
      <div className="page-header">
        <div><h1>Счета</h1><div className="sub">Управление счетами и учет остатков</div></div>
        <div className="page-actions"><button className="btn-mint" onClick={openAdd}>+ Добавить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="search-row" style={{display:'flex',alignItems:'center',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap'}}>
        <div className="stock-filter-links" style={{display:'flex',alignItems:'center',gap:'.15rem',marginLeft:'auto'}}>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
            onClick={()=>{setInitAmts({});setShowInit(true)}}>Начальные остатки</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
            onClick={()=>{setCorAcct('cash');setCorType('income');setCorAmt('');setCorDesc('');setShowCorrect(true)}}>Корректировка</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#e65100',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1,fontWeight:600}}
            onClick={()=>{setColAmt('');setColTo('');setShowCollection(true)}}>Инкассация</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
            onClick={()=>{setTrFrom('');setTrTo('');setTrAmt('');setShowTransfer(true)}}>Перевод между счетами</span>
        </div>
      </div>

      {!loading && initDone && (
        <>
          <div style={{display:'inline-flex',alignItems:'center',gap:'.75rem',marginBottom:'1rem',padding:'.85rem 1rem',background:'#ffdd2d',borderRadius:'12px',width:'fit-content'}}>
            <div style={{fontSize:'1.2rem',fontWeight:800}}>{(total||0).toLocaleString()} ₽</div>
            <div style={{fontSize:'.78rem',color:'rgba(0,0,0,.5)'}}>Общий баланс по всем счетам</div>
          </div>
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
                      <td style={{textAlign:'left'}}>{in0.toLocaleString()} ₽</td>
                      <td style={{textAlign:'left',color:'#555'}}>+{mv.i.toLocaleString()} ₽</td>
                      <td style={{textAlign:'left',color:'#555'}}>−{mv.e.toLocaleString()} ₽</td>
                      <td style={{textAlign:'left',color:'#555'}}>{bl>=0?'+':''}{bl.toLocaleString()} ₽</td>
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
                    <td style={{textAlign:'left',fontWeight:700}}>{accounts.reduce((s,a)=>s+(parseFloat(a.balance)||0),0).toLocaleString()} ₽</td>
                    <td style={{textAlign:'left',fontWeight:700,color:'#16a34a'}}>+{incTot.toLocaleString()} ₽</td>
                    <td style={{textAlign:'left',fontWeight:700,color:'#dc2626'}}>−{expTot.toLocaleString()} ₽</td>
                    <td style={{textAlign:'left',fontWeight:700,color:total>=0?'#16a34a':'#dc2626'}}>{total>=0?'+':''}{total.toLocaleString()} ₽</td>
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
                  <label>Начальный остаток (₽)</label>
                  <input type="number" placeholder="0" min="0" step="0.01" value={modalBalance} onChange={e=>setModalBalance(e.target.value)} />
                </div>
              )}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editingId?'Сохранить':'Добавить'}</button>
              </div>
            </form>
      </Modal>

      <Modal open={showCorrect} onClose={()=>setShowCorrect(false)} title="Корректировка баланса" subtitle="Исправьте остаток на счете" width="medium">
            <form onSubmit={async (e)=>{e.preventDefault();if(!corAmt||parseFloat(corAmt)<=0)return;var amt=parseFloat(corAmt);try{var ac=accounts.find(a=>a.type===corAcct);if(!ac)return;await supabase.from('transactions').insert({user_id:user.id,account_id:ac.id,type:corType,amount:amt,description:corDesc.trim()||'Корректировка баланса',date:new Date().toISOString().split('T')[0]});setShowCorrect(false);await fetchTx();}catch(err){alert(err.message);}}}>
              <div className="form-group">
                <label>Счет</label>
                <select value={corAcct} onChange={e=>setCorAcct(e.target.value)}>
                  {accounts.map(a=>{var m=ACC_TYPES.find(t=>t.type===a.type);return <option key={a.id} value={a.type}>{''} {a.name}</option>})}
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
                <button type="submit" className="btn btn-primary">Применить</button>
              </div>
            </form>
      </Modal>

      <Modal open={showInit} onClose={()=>setShowInit(false)} title="Введите первоначальные остатки" subtitle="Используйте эту функцию при первом заполнении программы" width="medium">
            <form onSubmit={saveInit}>
              {sorted.filter(a => !isSys(a) || parseFloat(a.balance)===0).map(a => {
                var m=getTypeMeta(a), ic=m?m.icon:'🏦', lb=m?m.label:a.type;
                return (
                  <div key={a.id} className="form-group">
                    <label>{a.name}</label>
                    <input type="number" placeholder="0" min="0" step="0.01"
                      value={initAmts[a.id]||""}
                      onChange={function(e){var v=parseFloat(e.target.value)||0;setInitAmts(p=>{var r=Object.assign({},p);r[a.id]=v;return r;})}} />
                  </div>
                );
              })}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Сохранить</button>
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
                      return (
                        <tr key={t.id}>
                          <td style={{textAlign:'left',color:'#555'}}>{((t.date||t.created_at||'').split('T')[0]||'').split('-').reverse().join('.')}</td>
                          <td style={{textAlign:'left'}}>
                            <span className="prod-name">{t.description||'—'}</span>
                            <span className="prod-sku">{t.type==='income'?'Доход':'Расход'}</span>
                          </td>
                          <td style={{textAlign:'left',color:'#555'}}>{t.type==='income'?'+':'-'}{amt.toLocaleString()} ₽</td>
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
            <form onSubmit={async (e)=>{e.preventDefault();if(!trFrom||!trTo||trFrom===trTo||!trAmt||parseFloat(trAmt)<=0)return;var amt=parseFloat(trAmt);try{var fromAc=accounts.find(a=>a.id===trFrom);var toAc=accounts.find(a=>a.id===trTo);if(!fromAc||!toAc)return;await supabase.from('transactions').insert({user_id:user.id,account_id:fromAc.id,type:'expense',amount:amt,description:'Перевод со счета '+fromAc.name,date:new Date().toISOString().split('T')[0]});await supabase.from('transactions').insert({user_id:user.id,account_id:toAc.id,type:'income',amount:amt,description:'Перевод на счет '+toAc.name,date:new Date().toISOString().split('T')[0]});setShowTransfer(false);await fetchTx();}catch(err){alert(err.message);}}}>
              <div className="form-group">
                <label>Откуда</label>
                <select value={trFrom} onChange={e=>setTrFrom(e.target.value)} required>
                  <option value="">— выберите —</option>
                  {accounts.filter(a=>a.id!==trTo).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Куда</label>
                <select value={trTo} onChange={e=>setTrTo(e.target.value)} required>
                  <option value="">— выберите —</option>
                  {accounts.filter(a=>a.id!==trFrom).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Сумма (₽)</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={trAmt} onChange={e=>setTrAmt(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Перевести</button>
              </div>
            </form>
      </Modal>

      <Modal open={showConfirm} onClose={()=>{setShowConfirm(false);setPendingDeleteAc(null)}} title="Удалить счет?" subtitle={pendingDeleteAc ? 'Счет «'+pendingDeleteAc.name+'» будет удален навсегда.' : ''} width="narrow"
        actions={<>
          <button className="btn btn-ghost" onClick={()=>{setShowConfirm(false);setPendingDeleteAc(null)}}>Отмена</button>
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
        return (<>
              <div style={{background:'#f5f5f5',borderRadius:'.5rem',padding:'.5rem .75rem',marginBottom:'.75rem',fontSize:'.82rem'}}>
                <span style={{color:'var(--muted)'}}>Баланс Кассы:</span>{' '}
                <span style={{fontWeight:700}}>{cashRegBal.toLocaleString()} ₽</span>
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
                  await supabase.from('transactions').insert([
                    {user_id:user.id,account_id:cashRegAc.id,type:'expense',amount:amt,description:'Инкассация со счета Касса',date:new Date().toISOString().split('T')[0],category_id:colCatId},
                    {user_id:user.id,account_id:toAc.id,type:'income',amount:amt,description:'Инкассация на счет ' + toAc.name,date:new Date().toISOString().split('T')[0],category_id:colCatId}
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
                    {otherAccs.map(function(a){return <option key={a.id} value={a.id}>{a.name}</option>})}
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
