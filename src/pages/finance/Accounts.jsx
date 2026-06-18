import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
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
    var d = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
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
        <div><h1>Финансовые счета</h1><div className="sub">Управление счетами и учет остатков</div></div>
        <div className="page-actions"><button className="btn-mint" onClick={openAdd}>+ Добавить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="search-row" style={{display:'flex',alignItems:'center',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap'}}>
        <div className="stock-filter-links" style={{display:'flex',alignItems:'center',gap:'.15rem',marginLeft:'auto'}}>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
            onClick={()=>{setInitAmts({});setShowInit(true)}}>Ввести начальные остатки</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'none',lineHeight:1}}
            onClick={()=>{setCorAcct('cash');setCorType('income');setCorAmt('');setCorDesc('');setShowCorrect(true)}}>Корректировка баланса</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#e65100',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1,fontWeight:600}}
            onClick={()=>{setColAmt('');setColTo('');setShowCollection(true)}}>Инкассировать</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
            onClick={()=>{setTrFrom('');setTrTo('');setTrAmt('');setShowTransfer(true)}}>Перевод между счетами</span>
        </div>
      </div>

      {!loading && initDone && (
        <>
          <div style={{display:'flex',alignItems:'center',gap:'.75rem',marginBottom:'1rem',padding:'.85rem 1rem',background:'#ffdd2d',borderRadius:'12px'}}>
            <div style={{fontSize:'1.2rem',fontWeight:800}}>{(total||0).toLocaleString()} ₽</div>
            <div style={{fontSize:'.78rem',color:'rgba(0,0,0,.5)'}}>Общий баланс</div>
          </div>
          <div className="product-table" style={{flex:1,overflowY:'auto',overflowX:'auto',WebkitOverflowScrolling:'touch',minHeight:0}}>
            <table>
              <thead id="colHeaders">
                <tr>
                  <th style={{textAlign:'left',paddingLeft:0}}>Счет</th>
                  <th>Начальный остаток</th>
                  <th>Поступления</th>
                  <th>Расходы</th>
                  <th>Баланс</th>
                  <th className="actions"></th>
                </tr>
              </thead>
              <tbody id="dirTableBody">
                {sorted.length === 0 ? (
                  <tr><td colSpan="6"><div className="empty-products"><div className="big-icon">🏦</div><p>Нет счетов</p></div></td></tr>
                ) : sorted.map(a => {
                  var m=ACC_TYPES.find(t=>t.type===a.type), lb=m?m.label:a.type;
                  var bl=getBal(a.type), mv=getMv(a.type), in0=parseFloat(a.balance)||0;
                  return (
                    <tr key={a.id}>
                      <td style={{textAlign:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
                          <div style={{cursor:'pointer'}} onClick={()=>setViewAcTx(a)}>
                            <div className="prod-name">{a.name}</div>
                            <div className="prod-sku">{a.description || lb}</div>
                          </div>
                        </div>
                      </td>
                      <td>{in0.toLocaleString()} ₽</td>
                      <td style={{color:'#16a34a',fontWeight:600}}>+{mv.i.toLocaleString()} ₽</td>
                      <td style={{color:'#dc2626',fontWeight:600}}>−{mv.e.toLocaleString()} ₽</td>
                      <td style={{fontWeight:700,color:bl>=0?'#16a34a':'#dc2626'}}>{bl>=0?'+':''}{bl.toLocaleString()} ₽</td>
                      <td style={{textAlign:'right'}}>
                        <button className="act-btn prod-edit-btn" onClick={()=>openEdit(a)}>Ред.</button>
                        {!isSys(a) && (
                          <div className="prod-more-wrap" style={{display:'inline-block',position:'relative'}}>
                            <button className="act-btn prod-more-btn" onClick={e=>{e.stopPropagation();var el=e.currentTarget.nextElementSibling;el.classList.add('open');var _r=el.getBoundingClientRect();if(_r.bottom>window.innerHeight)el.classList.add('up');else el.classList.remove('up');setTimeout(()=>document.addEventListener('click',function h(){el.classList.remove('open');document.removeEventListener('click',h)}),10)}}>⋯</button>
                            <div className="prod-dropdown"><button onClick={()=>remove(a)} style={{color:'#dc3545'}}>Удалить</button></div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length > 0 && (
                  <tr className="total-row">
                    <td style={{fontWeight:600,textAlign:'left'}}>Итого</td>
                    <td style={{textAlign:'center',fontWeight:700}}>{accounts.reduce((s,a)=>s+(parseFloat(a.balance)||0),0).toLocaleString()} ₽</td>
                    <td></td>
                    <td></td>
                    <td style={{textAlign:'center',fontWeight:700,color:total>=0?'#16a34a':'#dc2626'}}>{total>=0?'+':''}{total.toLocaleString()} ₽</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active'){setShowModal(false);setEditingId(null)}}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>{setShowModal(false);setEditingId(null)}}>&times;</button>
            <h2>{editingId?'Редактировать счет':'Добавить счет'}</h2>
            <div className="sub">{editingId?'Измените данные счета':'Настройка нового кошелька, расчетного счета или кассы'}</div>
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
                <button type="submit" className="btn btn-account-select">{editingId?'Сохранить':'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCorrect && (
        <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active'){setShowCorrect(false)}}}>
          <div className="modal-box" style={{maxWidth:'450px'}}>
            <button className="modal-close" onClick={()=>setShowCorrect(false)}>&times;</button>
            <h2>Корректировка баланса</h2>
            <div className="sub">Исправьте остаток на счете</div>
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
                <button type="submit" className="btn btn-account-select">Применить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInit && (
        <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active'){setShowInit(false)}}}>
          <div className="modal-box" style={{maxWidth:'500px'}}>
            <button className="modal-close" onClick={()=>setShowInit(false)}>&times;</button>
            <h2>Введите первоначальные остатки</h2>
            <div className="sub">Используйте эту функцию при первом заполнении программы</div>
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
                <button type="submit" className="btn btn-account-select">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewAcTx && (
        <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active'){setViewAcTx(null)}}}>
          <div className="modal-box" style={{maxWidth:'520px',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
            <button className="modal-close" onClick={()=>setViewAcTx(null)}>&times;</button>
            <h2>{viewAcTx.name}</h2>
            <div className="sub" style={{marginBottom:'.5rem'}}>{viewAcTx.description || (function(){var m=ACC_TYPES.find(t=>t.type===viewAcTx.type);return m?m.label:viewAcTx.type;})()}</div>
            <div style={{fontSize:'.8rem',color:'var(--muted)',marginBottom:'.5rem'}}>История операций по счету</div>
            <div className="product-table" style={{flex:1,overflowY:'auto'}}>
              <table>
                <thead id="colHeaders">
                  <tr>
                    <th style={{textAlign:'left',paddingLeft:0,minWidth:'100px'}}>Дата</th>
                    <th style={{textAlign:'center'}}>Описание</th>
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
                          <td style={{textAlign:'left',fontSize:'.78rem',color:'var(--muted)'}}>{((t.date||t.created_at||'').split('T')[0]||'').split('-').reverse().join('.')}</td>
                          <td style={{textAlign:'left'}}>
                            <span className="prod-name">{t.description||'—'}</span>
                            <span className="prod-sku">{t.type==='income'?'Доход':'Расход'}</span>
                          </td>
                          <td style={{textAlign:'center',fontWeight:600,color:t.type==='income'?'#16a34a':'#dc2626'}}>{t.type==='income'?'+':'-'}{amt.toLocaleString()} ₽</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active'){setShowTransfer(false)}}}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <button className="modal-close" onClick={()=>setShowTransfer(false)}>&times;</button>
            <h2>Перевод между счетами</h2>
            <div className="sub" style={{marginBottom:'1rem'}}>Перемещение средств между счетами</div>
            <form onSubmit={async (e)=>{e.preventDefault();if(!trFrom||!trTo||trFrom===trTo||!trAmt||parseFloat(trAmt)<=0)return;var amt=parseFloat(trAmt);try{var fromAc=accounts.find(a=>a.id===trFrom);var toAc=accounts.find(a=>a.id===trTo);if(!fromAc||!toAc)return;await supabase.from('transactions').insert({user_id:user.id,account_id:fromAc.id,type:'expense',amount:amt,description:'Перевод на '+toAc.name,date:new Date().toISOString().split('T')[0]});await supabase.from('transactions').insert({user_id:user.id,account_id:toAc.id,type:'income',amount:amt,description:'Перевод с '+fromAc.name,date:new Date().toISOString().split('T')[0]});setShowTransfer(false);await fetchTx();}catch(err){alert(err.message);}}}>
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
                <button type="submit" className="btn btn-account-select">Перевести</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setShowConfirm(false)}}}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <h2 style={{fontSize:'1rem'}}>Удалить счет?</h2>
            <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.75rem 0',lineHeight:1.5}}>Счет «{pendingDeleteAc?.name}» будет удален навсегда.</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={()=>{setShowConfirm(false);setPendingDeleteAc(null)}}>Отмена</button>
              <button className="btn btn-primary" onClick={confirmDelete} style={{marginLeft:'.5rem'}}>Да, удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* Инкассация */}
      {showCollection && (()=>{
        var cashRegAc = accounts.find(a => a.type === 'cash_register');
        var cashRegBal = 0;
        if (cashRegAc) {
          cashRegBal = parseFloat(cashRegAc.balance)||0;
          (transactions||[]).forEach(function(t){if(t.account_id===cashRegAc.id) cashRegBal += Number(t.amount||0) * (t.type==='income'?1:-1);});
        }
        var otherAccs = accounts.filter(function(a){return a.id !== cashRegAc?.id;});
        return (
          <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setShowCollection(false)}}}>
            <div className="modal-box" style={{maxWidth:'420px'}}>
              <button className="modal-close" onClick={()=>setShowCollection(false)}>&times;</button>
              <h2>🏦 Инкассация</h2>
              <div className="sub" style={{marginBottom:'.75rem'}}>Изъятие наличных из кассы</div>
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
                    {user_id:user.id,account_id:cashRegAc.id,type:'expense',amount:amt,description:'Инкассация на ' + toAc.name,date:new Date().toISOString().split('T')[0],category_id:colCatId},
                    {user_id:user.id,account_id:toAc.id,type:'income',amount:amt,description:'Инкассация с кассы',date:new Date().toISOString().split('T')[0],category_id:colCatId}
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
                  <button type="submit" className="btn btn-account-select" style={{background:'#e65100',color:'#fff'}}>Инкассировать</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
