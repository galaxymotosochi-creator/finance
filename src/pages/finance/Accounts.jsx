import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';

const ACC_TYPES = [
  { type: 'cash', icon: '💵', label: 'Наличные' },
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
  const [modalType, setModalType] = useState('cash');
  const [modalBalance, setModalBalance] = useState('0');
  const [showInit, setShowInit] = useState(false);
  const [initAmts, setInitAmts] = useState({});
  const [showCorrect, setShowCorrect] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteAc, setPendingDeleteAc] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 7000);
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
  var getTypeMeta = (ac) => {
    try {
      var dt = JSON.parse(localStorage.getItem('accountDisplayTypes')||'{}');
      var t = (dt && dt[ac.id]) || ac.type;
      return ACC_TYPES.find(x => x.type === t);
    } catch(e) { return ACC_TYPES.find(x => x.type === ac.type); }
  };
  var isSys = (ac) => systemIds.has(ac?.id);
  var hasAct = (ac) => parseFloat(ac.balance)>0||(transactions||[]).some(t=>t.account_id===ac.id);

  var openAdd = () => { setEditingId(null); setModalName(''); setModalType('cash'); setModalBalance('0'); setShowModal(true); };
  var openEdit = (ac) => {
    if (hasAct(ac)) return alert('Нельзя редактировать счет — на нем есть движения или начальный остаток');
    setEditingId(ac.id); setModalName(ac.name); setModalType(ac.type); setModalBalance('0'); setShowModal(true);
  };

  var save = async (e) => {
    e.preventDefault(); if (!modalName.trim()) return;
    var ib = parseFloat(modalBalance)||0;
    try {
      if (editingId) {
        var up = await supabase.from('accounts').update({name:modalName.trim()}).eq('id',editingId);
        if (up.error) { alert(up.error.message); return; }
        setAccounts(p=>p.map(a=>a.id===editingId?{...a,name:modalName.trim()}:a));
      } else {
        var ins = await supabase.from('accounts').insert({user_id:user.id,name:modalName.trim(),type:modalType,balance:ib}).select();
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
    <>
      {toast && <div className="toast toast-warning"><span style={{display:'inline-flex',alignItems:'center',gap:'.35rem'}}>{toast}<button onClick={()=>setToast(null)} style={{background:'none',border:'none',color:'#fff',fontSize:'1.1rem',cursor:'pointer',padding:'0 0 0 .35rem',lineHeight:1}}>&times;</button></span></div>}
      <div className="page-header">
        <div><h1>Финансовые счета</h1><div className="sub">Управление счетами и учет остатков</div></div>
        <div className="page-actions"><button className="btn-mint" onClick={openAdd}>+ Добавить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="search-row" style={{display:'flex',alignItems:'center',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap'}}>
        <div className="stock-filter-links" style={{display:'flex',alignItems:'center',gap:'.15rem'}}>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
            onClick={()=>{setInitAmts({});setShowInit(true)}}>Ввести начальные остатки</span>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.72rem',color:'#555',cursor:'pointer',borderRight:'none',lineHeight:1}}
            onClick={()=>{setCorAcct('cash');setCorType('income');setCorAmt('');setCorDesc('');setShowCorrect(true)}}>Корректировка баланса</span>
        </div>
      </div>

      {!loading && initDone && (
        <>
          <div style={{display:'flex',alignItems:'center',gap:'.75rem',marginBottom:'1rem',padding:'.85rem 1rem',background:'#ffdd2d',borderRadius:'12px'}}>
            <div style={{fontSize:'1.2rem',fontWeight:800}}>{(total||0).toLocaleString()} ₽</div>
            <div style={{fontSize:'.78rem',color:'rgba(0,0,0,.5)'}}>Общий баланс</div>
          </div>
          <div className="product-table">
            <table>
              <thead id="colHeaders">
                <tr>
                  <th style={{textAlign:'left',paddingLeft:0}}>Счет</th>
                  <th>Начальный остаток</th>
                  <th>Доходы</th>
                  <th>Расходы</th>
                  <th>Баланс</th>
                  <th className="actions"></th>
                </tr>
              </thead>
              <tbody id="dirTableBody">
                {sorted.length === 0 ? (
                  <tr><td colSpan="6"><div className="empty-products"><div className="big-icon">🏦</div><p>Нет счетов</p></div></td></tr>
                ) : sorted.map(a => {
                  var m=ACC_TYPES.find(t=>t.type===a.type), ic=m?m.icon:'🏦', lb=m?m.label:a.type;
                  var bl=getBal(a.type), mv=getMv(a.type), in0=parseFloat(a.balance)||0;
                  return (
                    <tr key={a.id}>
                      <td style={{textAlign:'left'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
                          <div>
                            <div className="prod-name">{a.name}</div>
                            <div className="prod-sku">{lb}</div>
                          </div>
                        </div>
                      </td>
                      <td>{in0.toLocaleString()}₽</td>
                      <td style={{color:'#16a34a',fontWeight:600}}>+{mv.i.toLocaleString()}₽</td>
                      <td style={{color:'#dc2626',fontWeight:600}}>−{mv.e.toLocaleString()}₽</td>
                      <td style={{fontWeight:700,color:bl>=0?'#16a34a':'#dc2626'}}>{bl>=0?'+':''}{bl.toLocaleString()}₽</td>
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
                    <td style={{textAlign:'center',fontWeight:700}}>{accounts.reduce((s,a)=>s+(parseFloat(a.balance)||0),0).toLocaleString()}₽</td>
                    <td></td>
                    <td></td>
                    <td style={{textAlign:'center',fontWeight:700,color:total>=0?'#16a34a':'#dc2626'}}>{total>=0?'+':''}{total.toLocaleString()}₽</td>
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
              {!editingId && (
                <div className="form-group">
                  <label>Тип</label>
                  <select value={modalType} onChange={e=>setModalType(e.target.value)}>
                    {ACC_TYPES.map(t=><option key={t.type} value={t.type}>{t.icon} {t.label}</option>)}
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
                <button type="submit" className="btn btn-account-select">{editingId?'Сохранить':'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCorrect && (
        <div className="modal-overlay active">
          <div className="modal-box" style={{maxWidth:'450px'}}>
            <button className="modal-close" onClick={()=>setShowCorrect(false)}>&times;</button>
            <h2>Корректировка баланса</h2>
            <div className="sub">Исправьте остаток на счете</div>
            <form onSubmit={async (e)=>{e.preventDefault();if(!corAmt||parseFloat(corAmt)<=0)return;var amt=parseFloat(corAmt);try{var ac=accounts.find(a=>a.type===corAcct);if(!ac)return;await supabase.from('transactions').insert({user_id:user.id,account_id:ac.id,type:corType,amount:amt,description:corDesc.trim()||'Корректировка баланса',date:new Date().toISOString().split('T')[0]});setShowCorrect(false);await fetchTx();}catch(err){alert(err.message);}}}>
              <div className="form-group">
                <label>Счет</label>
                <select value={corAcct} onChange={e=>setCorAcct(e.target.value)}>
                  {accounts.map(a=>{var m=ACC_TYPES.find(t=>t.type===a.type);return <option key={a.id} value={a.type}>{m?m.icon:''} {a.name}</option>})}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Тип</label>
                  <select value={corType} onChange={e=>setCorType(e.target.value)}>
                    <option value="income">➕ Приход</option>
                    <option value="expense">➖ Расход</option>
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
        <div className="modal-overlay active">
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
                      value={initAmts[a.type]||""}
                      onChange={function(e){var v=parseFloat(e.target.value)||0;setInitAmts(p=>{var r=Object.assign({},p);r[a.type]=v;return r;})}} />
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
    </>
  );
}
