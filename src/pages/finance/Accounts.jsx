import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';

const ACC_TYPES = [
  { type: 'cash', icon: '💵', label: 'Наличные' },
  { type: 'transfer', icon: '🔄', label: 'Перевод' },
  { type: 'card', icon: '💳', label: 'Оплата картой' },
];

const DEFAULT_TYPES = new Set(['cash', 'transfer', 'card']);

export default function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initDone, setInitDone] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalName, setModalName] = useState('');
  const [modalType, setModalType] = useState('cash');
  const [modalBalance, setModalBalance] = useState('0');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState('cash');
  const [transferTo, setTransferTo] = useState('card');
  const [transferAmount, setTransferAmount] = useState('');

  const fetchAccounts = async () => {
    var d = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
    if (!d.data) return;
    // Удаляем дубли
    var seen = {}, toDelete = [];
    var cleaned = d.data.filter(a => {
      if (seen[a.type]) { toDelete.push(a.id); return false; }
      seen[a.type] = true; return true;
    });
    if (toDelete.length > 0) await supabase.from('accounts').delete().in('id', toDelete);
    // Создаём стандартные, если нет
    var needCash = !cleaned.some(a => a.type === 'cash');
    var needCard = !cleaned.some(a => a.type === 'card');
    var needTransfer = !cleaned.some(a => a.type === 'transfer');
    if (user && (needCash || needCard || needTransfer)) {
      var toCreate = [];
      if (needCash) toCreate.push({ user_id: user.id, name: 'Наличные', type: 'cash', balance: 0 });
      if (needTransfer) toCreate.push({ user_id: user.id, name: 'Перевод', type: 'transfer', balance: 0 });
      if (needCard) toCreate.push({ user_id: user.id, name: 'Оплата картой', type: 'card', balance: 0 });
      if (toCreate.length > 0) {
        var r = await supabase.from('accounts').insert(toCreate).select();
        if (r.data) cleaned = cleaned.concat(r.data);
      }
    }
    setAccounts(cleaned);
    setInitDone(true);
  };

  const fetchTx = async () => {
    const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); fetchTx(); }, []);

  const getBalance = (type) => {
    const acct = accounts.find(a => a?.type === type);
    if (!acct) return 0;
    let bal = parseFloat(acct.balance) || 0;
    (transactions || []).forEach(t => {
      if (t.account_id === acct.id) bal += Number(t.amount || 0) * (t.type === 'income' ? 1 : -1);
    });
    return bal;
  };

  const getMovements = (type) => {
    const acct = accounts.find(a => a?.type === type);
    if (!acct) return { income: 0, expense: 0 };
    let inc = 0, exp = 0;
    (transactions || []).forEach(t => {
      if (t.account_id === acct.id) {
        if (t.type === 'income') inc += Number(t.amount || 0);
        else exp += Number(t.amount || 0);
      }
    });
    return { income: inc, expense: exp };
  };

  const isDefault = (acct) => DEFAULT_TYPES.has(acct?.type);

  const openAddModal = () => {
    setEditingId(null); setModalName(''); setModalType('cash'); setModalBalance('0'); setShowModal(true);
  };

  const openEditModal = (acct) => {
    setEditingId(acct.id); setModalName(acct.name); setModalType(acct.type);
    setModalBalance(String(parseFloat(acct.balance) || 0)); setShowModal(true);
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    if (!modalName.trim()) return;
    var ib = parseFloat(modalBalance) || 0;
    try {
      if (editingId) {
        await supabase.from('accounts').update({ name: modalName.trim(), type: modalType, balance: ib }).eq('id', editingId);
        setAccounts(prev => prev.map(a => a.id === editingId ? {...a, name: modalName.trim(), type: modalType, balance: ib} : a));
      } else {
        var r = await supabase.from('accounts').insert({ user_id: user.id, name: modalName.trim(), type: modalType, balance: ib }).select();
        if (r.data && r.data.length > 0) setAccounts(prev => [...prev, r.data[0]]);
      }
      setShowModal(false); setEditingId(null);
    } catch (err) { alert(err.message); }
  };

  const remove = async (acct) => {
    if (!acct) return;
    if (isDefault(acct)) return alert('Это базовый счёт, его нельзя удалить');
    if ((transactions || []).some(t => t.account_id === acct.id)) return alert('Нельзя удалить счёт — на нём есть движения');
    if (!confirm('Удалить счёт "' + acct.name + '"?')) return;
    await supabase.from('accounts').delete().eq('id', acct.id);
    await fetchAccounts();
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    var el = e.currentTarget.nextElementSibling;
    el.classList.add('open');
    var h = function () { el.classList.remove('open'); document.removeEventListener('click', h); };
    setTimeout(function () { document.addEventListener('click', h); }, 10);
  };

  const doTransfer = async (e) => {
    e.preventDefault();
    if (!transferAmount || parseFloat(transferAmount) <= 0) return;
    var amt = parseFloat(transferAmount);
    try {
      var from = accounts.find(a => a.type === transferFrom);
      var to = accounts.find(a => a.type === transferTo);
      if (!from || !to) { alert('Счёт не найден'); return; }
      if (getBalance(transferFrom) < amt) { alert('Недостаточно средств'); return; }
      await supabase.from('transactions').insert([
        { user_id: user.id, account_id: from.id, type: 'expense', amount: amt, description: 'Перевод на ' + to.name, date: new Date().toISOString().split('T')[0] },
        { user_id: user.id, account_id: to.id, type: 'income', amount: amt, description: 'Перевод с ' + from.name, date: new Date().toISOString().split('T')[0] },
      ]);
      setShowTransferModal(false); setTransferAmount('');
      await fetchTx();
    } catch (err) { alert(err.message); }
  };

  var sorted = [...accounts].sort((a, b) => {
    if (isDefault(a) && !isDefault(b)) return -1;
    if (!isDefault(a) && isDefault(b)) return 1;
    return 0;
  });

  var total = accounts.reduce((s, a) => s + getBalance(a.type), 0);

  return (
    <>
      <div className="page-header">
        <div><h1>Счета</h1><div className="sub">Управление счетами</div></div>
        <div className="page-actions"><button className="btn-green" onClick={openAddModal}>+ Добавить счёт</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {!loading && initDone && (
        <>
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:'1rem',padding:'1rem 1.25rem',marginBottom:'1rem',boxShadow:'0 .25rem .75rem rgba(0,0,0,.04)'}}>
            <div style={{fontSize:'1.8rem',fontWeight:700,color:'#111'}}>{total.toLocaleString()}₽</div>
            <div style={{fontSize:'.78rem',color:'var(--muted)',marginTop:'.15rem'}}>Общий баланс всех счетов</div>
          </div>

          {sorted.map(a => {
            var meta = ACC_TYPES.find(t => t.type === a.type);
            var icon = meta ? meta.icon : '🏦';
            var label = meta ? meta.label : a.type;
            var bal = getBalance(a.type);
            var mv = getMovements(a.type);
            var init = parseFloat(a.balance) || 0;
            return (
              <div key={a.id} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:'.85rem',padding:'.85rem',marginBottom:'.5rem',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.35rem'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
                    <span style={{fontSize:'1.5rem'}}>{icon}</span>
                    <div>
                      <div style={{fontWeight:600,fontSize:'.85rem'}}>{a.name}</div>
                      <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{label}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
                    <button className="act-btn prod-edit-btn" onClick={() => openEditModal(a)}>Ред.</button>
                    {!isDefault(a) && (
                      <div className="prod-more-wrap">
                        <button className="act-btn prod-more-btn" onClick={toggleMenu}>⋯</button>
                        <div className="prod-dropdown"><button onClick={() => remove(a)} style={{color:'#dc3545'}}>Удалить</button></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="nav-sep" style={{margin:'.35rem 0',width:'100%',opacity:.3}} />
                <div style={{fontSize:'.82rem',color:'var(--muted)',lineHeight:1.6}}>
                  <span>Было: {init.toLocaleString()}₽</span>
                  <span style={{margin:'0 .35rem'}}>·</span>
                  <span style={{color:'#16a34a'}}>+Доход: {mv.income.toLocaleString()}₽</span>
                  <span style={{margin:'0 .35rem'}}>·</span>
                  <span style={{color:'#dc2626'}}>−Расход: {mv.expense.toLocaleString()}₽</span>
                </div>
                <div style={{fontSize:'1.05rem',fontWeight:700,color:bal>=0?'#16a34a':'#dc2626',marginTop:'.25rem'}}>
                  = {bal.toLocaleString()}₽
                </div>
              </div>
            );
          })}

          <div style={{display:'flex',gap:'.5rem',marginTop:'.75rem'}}>
            <button className="btn btn-outline" onClick={() => setShowTransferModal(true)}>🔄 Перевод между счетами</button>
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setShowModal(false);setEditingId(null)}}}>
          <div className="modal-box">
            <button className="modal-close" onClick={function(){setShowModal(false);setEditingId(null)}}>&times;</button>
            <h2>{editingId?'Редактировать счёт':'Добавить счёт'}</h2>
            <div className="sub">{editingId?'Измените данные счёта':'Введите название и начальный остаток'}</div>
            <form onSubmit={saveAccount}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например, Касса магазина" value={modalName} onChange={function(e){setModalName(e.target.value)}} required />
              </div>
              {!editingId && (
                <div className="form-group">
                  <label>Тип</label>
                  <select value={modalType} onChange={function(e){setModalType(e.target.value)}}>
                    {ACC_TYPES.map(t => <option key={t.type} value={t.type}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Начальный остаток (₽)</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={modalBalance} onChange={function(e){setModalBalance(e.target.value)}} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editingId?'Сохранить':'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="modal-overlay active">
          <div className="modal-box">
            <button className="modal-close" onClick={function(){setShowTransferModal(false)}}>&times;</button>
            <h2>Перевод между счетами</h2>
            <div className="sub">Переместите деньги между счетами</div>
            <form onSubmit={doTransfer}>
              <div className="form-group">
                <label>С какого счёта</label>
                <select value={transferFrom} onChange={function(e){setTransferFrom(e.target.value)}}>
                  {accounts.map(a => {var m=ACC_TYPES.find(t=>t.type===a.type);return <option key={a.id} value={a.type}>{m?m.icon:''} {a.name} ({getBalance(a.type).toLocaleString()}₽)</option>})}
                </select>
              </div>
              <div className="form-group">
                <label>На какой счёт</label>
                <select value={transferTo} onChange={function(e){setTransferTo(e.target.value)}}>
                  {accounts.filter(a => a.type !== transferFrom).map(a => {var m=ACC_TYPES.find(t=>t.type===a.type);return <option key={a.id} value={a.type}>{m?m.icon:''} {a.name}</option>})}
                </select>
              </div>
              <div className="form-group">
                <label>Сумма (₽) *</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={transferAmount} onChange={function(e){setTransferAmount(e.target.value)}} required />
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
