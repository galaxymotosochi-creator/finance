import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';

const accMeta = [
  { type: 'cash', icon: '💵', label: 'Наличные' },
  { type: 'checking', icon: '🏦', label: 'Расчётный счёт' },
  { type: 'card', icon: '💳', label: 'Бизнес-карта' },
  { type: 'bank', icon: '🏛️', label: 'Банковский счёт' },
  { type: 'electronic', icon: '🌐', label: 'Электронные деньги' },
  { type: 'reserve', icon: '🔒', label: 'Резерв' },
  { type: 'deposit', icon: '📜', label: 'Депозит' },
];

export default function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalName, setModalName] = useState('');
  const [modalType, setModalType] = useState('cash');
  const [showInitModal, setShowInitModal] = useState(false);
  const [initAmounts, setInitAmounts] = useState({});
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState('cash');
  const [transferTo, setTransferTo] = useState('card');
  const [transferAmount, setTransferAmount] = useState('');

  const fetchAccounts = async () => {
    var d = await supabase.from('accounts').select('*');
    if (d.data) setAccounts(d.data);
  };

  const fetchTx = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });
    setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); fetchTx(); }, []);

  const getBalance = (type) => {
    const acct = accounts.find(a => a?.type === type);
    if (!acct) return 0;
    let bal = 0;
    (transactions || []).forEach(t => {
      if (t.account_id === acct.id) {
        bal += Number(t.amount || 0) * (t.type === 'income' ? 1 : -1);
      }
    });
    return bal;
  };

  const getAccount = (type) => accounts.find(a => a?.type === type);

  const openAddModal = () => {
    setEditingId(null);
    setModalName('');
    setModalType('cash');
    setShowModal(true);
  };

  const openEditModal = (acct) => {
    setEditingId(acct.id);
    setModalName(acct.name);
    setModalType(acct.type);
    setShowModal(true);
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    if (!modalName.trim()) return;
    try {
      if (editingId) {
        await supabase.from('accounts').update({ name: modalName.trim(), type: modalType }).eq('id', editingId);
      } else {
        await supabase.from('accounts').insert({ user_id: user.id, name: modalName.trim(), type: modalType });
      }
      setShowModal(false);
      setEditingId(null);
      await fetchAccounts();
    } catch (err) { alert(err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Удалить счёт?')) return;
    await supabase.from('accounts').delete().eq('id', id);
    await fetchAccounts();
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    var el = e.currentTarget.nextElementSibling;
    el.classList.add('open');
    var h = function () { el.classList.remove('open'); document.removeEventListener('click', h); };
    setTimeout(function () { document.addEventListener('click', h); }, 10);
  };

  const saveInitBalances = async (e) => {
    e.preventDefault();
    try {
      for (const type of ['cash', 'card', 'transfer']) {
        const amt = parseFloat(initAmounts[type]) || 0;
        if (amt > 0) {
          const acct = getAccount(type);
          if (acct) {
            await supabase.from('transactions').insert({
              user_id: user.id, account_id: acct.id,
              type: 'income', amount: amt,
              description: 'Первоначальный остаток',
              date: new Date().toISOString().split('T')[0],
            });
          }
        }
      }
      setShowInitModal(false);
      await fetchTx();
    } catch (err) { alert(err.message); }
  };

  const doTransfer = async (e) => {
    e.preventDefault();
    if (!transferAmount || parseFloat(transferAmount) <= 0) return;
    const amt = parseFloat(transferAmount);
    try {
      const from = getAccount(transferFrom);
      const to = getAccount(transferTo);
      if (!from || !to) { alert('Счёт не найден'); return; }
      if (getBalance(transferFrom) < amt) { alert('Недостаточно средств'); return; }
      await supabase.from('transactions').insert([
        { user_id: user.id, account_id: from.id, type: 'expense', amount: amt, description: 'Перевод на ' + to.name, date: new Date().toISOString().split('T')[0] },
        { user_id: user.id, account_id: to.id, type: 'income', amount: amt, description: 'Перевод с ' + from.name, date: new Date().toISOString().split('T')[0] },
      ]);
      setShowTransferModal(false);
      setTransferAmount('');
      await fetchTx();
    } catch (err) { alert(err.message); }
  };

  const totalBalance = accounts.reduce(function (s, a) { return s + getBalance(a.type); }, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Счета</h1>
          <div className="sub" style={{ fontSize: '.85rem', color: 'var(--muted)', margin: 0 }}>Управление счетами</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAddModal}>+ Добавить счёт</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      {!loading && accounts.length > 0 && (
        <>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111', marginBottom: '1rem' }}>
            {totalBalance.toLocaleString()}₽
          </div>
          {accMeta.filter(t => getAccount(t.type)).map(a => {
            const acct = getAccount(a.type);
            const balance = getBalance(a.type);
            return (
              <div key={a.type} style={{
                display: 'flex', alignItems: 'center', padding: '.75rem 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '1.5rem', marginRight: '.75rem' }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.9rem', fontWeight: 600 }}>{a.label}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{acct?.name}</div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: balance >= 0 ? '#16a34a' : '#dc2626', marginRight: '1rem' }}>
                  {balance.toLocaleString()}₽
                </div>
                <button className="act-btn prod-edit-btn" onClick={function () { openEditModal(acct); }}>Ред.</button>
                <div className="prod-more-wrap">
                  <button className="act-btn prod-more-btn" onClick={toggleMenu}>⋯</button>
                  <div className="prod-dropdown">
                    <button onClick={function () { remove(acct.id); }} style={{ color: '#dc3545' }}>Удалить</button>
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.5rem' }}>
            <button className="btn btn-outline" onClick={function () { setShowInitModal(true); }}>📋 Ввести первоначальные остатки</button>
            <button className="btn btn-outline" onClick={function () { setShowTransferModal(true); }}>🔄 Перевод между счетами</button>
          </div>
        </>
      )}

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay active" onClick={function (e) { if (e.target.className === 'modal-overlay active') { setShowModal(false); setEditingId(null); } }}>
          <div className="modal-box">
            <button className="modal-close" onClick={function () { setShowModal(false); setEditingId(null); }}>&times;</button>
            <h2>{editingId ? 'Редактировать счёт' : 'Добавить счёт'}</h2>
            <div className="sub">Введите название и выберите тип</div>
            <form onSubmit={saveAccount}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например, Касса магазина" value={modalName} onChange={function (e) { setModalName(e.target.value); }} required />
              </div>
              <div className="form-group">
                <label>Тип</label>
                <select value={modalType} onChange={function (e) { setModalType(e.target.value); }}>
                  <option value="cash">💵 Наличные</option>
                  <option value="checking">🏦 Расчётный счёт</option>
                  <option value="card">💳 Бизнес-карта</option>
                  <option value="bank">🏛️ Банковский счёт</option>
                  <option value="electronic">🌐 Электронные деньги</option>
                  <option value="reserve">🔒 Резерв</option>
                  <option value="deposit">📜 Депозит</option>
                </select>
              </div>
              <div className="modal-actions">
                
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INITIAL BALANCE MODAL */}
      {showInitModal && (
        <div className="modal-overlay active">
          <div className="modal-box">
            <button className="modal-close" onClick={function () { setShowInitModal(false); }}>&times;</button>
            <h2>Ввести первоначальные остатки</h2>
            <div className="sub">Укажите начальный баланс по каждому счёту</div>
            <form onSubmit={saveInitBalances}>
              {accMeta.filter(t => getAccount(t.type)).map(a => (
                <div key={a.type} className="form-group">
                  <label>{a.icon} {a.label}</label>
                  <input type="number" placeholder="0" min="0" step="0.01"
                    value={initAmounts[a.type] || ""} onChange={function (e) {
                      var v = parseFloat(e.target.value) || 0;
                      setInitAmounts(function (p) { var r = Object.assign({}, p); r[a.type] = v; return r; });
                    }} />
                </div>
              ))}
              <div className="modal-actions">
                
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER MODAL */}
      {showTransferModal && (
        <div className="modal-overlay active">
          <div className="modal-box">
            <button className="modal-close" onClick={function () { setShowTransferModal(false); }}>&times;</button>
            <h2>Перевод между счетами</h2>
            <div className="sub">Переместите деньги между счетами</div>
            <form onSubmit={doTransfer}>
              <div className="form-group">
                <label>С какого счёта</label>
                <select value={transferFrom} onChange={function (e) { setTransferFrom(e.target.value); }}>
                  {accMeta.filter(t => getAccount(t.type)).map(function(a){return <option key={a.type} value={a.type}>{a.icon} {a.label} ({getBalance(a.type).toLocaleString()}₽)</option>})}
                </select>
              </div>
              <div className="form-group">
                <label>На какой счёт</label>
                <select value={transferTo} onChange={function (e) { setTransferTo(e.target.value); }}>
                  {accMeta.filter(t => getAccount(t.type) && t.type !== transferFrom).map(a => (
                    <option key={a.type} value={a.type}>{a.icon} {a.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Сумма (₽) *</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={transferAmount} onChange={function (e) { setTransferAmount(e.target.value); }} required />
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
