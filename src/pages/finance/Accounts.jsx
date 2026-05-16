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
  { type: 'transfer', icon: '🔄', label: 'Переводы' },
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
  const [modalBalance, setModalBalance] = useState('0');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState('cash');
  const [transferTo, setTransferTo] = useState('card');
  const [transferAmount, setTransferAmount] = useState('');

  const fetchAccounts = async () => {
    var d = await supabase.from('accounts').select('*');
    if (d.data) {
      if (d.data.length === 0 && user) {
        await supabase.from('accounts').insert([
          { user_id: user.id, name: 'Касса', type: 'cash', balance: 0 },
          { user_id: user.id, name: 'Бизнес-карта', type: 'card', balance: 0 },
          { user_id: user.id, name: 'Расчётный счёт', type: 'transfer', balance: 0 },
        ]).select();
        var r = await supabase.from('accounts').select('*');
        if (r.data) setAccounts(r.data);
      } else {
        setAccounts(d.data);
      }
    }
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
    // Баланс = начальный остаток (balance) + доходы − расходы
    let bal = parseFloat(acct.balance) || 0;
    (transactions || []).forEach(t => {
      if (t.account_id === acct.id) {
        bal += Number(t.amount || 0) * (t.type === 'income' ? 1 : -1);
      }
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

  const getAccount = (type) => accounts.find(a => a?.type === type);

  const openAddModal = () => {
    setEditingId(null);
    setModalName('');
    setModalType('cash');
    setModalBalance('0');
    setShowModal(true);
  };

  const openEditModal = (acct) => {
    setEditingId(acct.id);
    setModalName(acct.name);
    setModalType(acct.type);
    setModalBalance(String(parseFloat(acct.balance) || 0));
    setShowModal(true);
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    if (!modalName.trim()) return;
    const initialBalance = parseFloat(modalBalance) || 0;
    try {
      if (editingId) {
        await supabase.from('accounts').update({
          name: modalName.trim(), type: modalType, balance: initialBalance
        }).eq('id', editingId);
        setAccounts(prev => prev.map(a => a.id === editingId ? {...a, name: modalName.trim(), type: modalType, balance: initialBalance} : a));
      } else {
        const { data } = await supabase.from('accounts').insert({
          user_id: user.id, name: modalName.trim(), type: modalType, balance: initialBalance
        }).select();
        if (data && data.length > 0) setAccounts(prev => [...prev, data[0]]);
      }
      setShowModal(false);
      setEditingId(null);
    } catch (err) { alert(err.message); }
  };

  const remove = async (acct) => {
    if (!acct) return;
    // Проверяем, есть ли транзакции на этом счету
    const hasTx = (transactions || []).some(t => t.account_id === acct.id);
    if (hasTx) {
      return alert('Нельзя удалить счёт — на нём есть движения. Сначала удалите транзакции.');
    }
    if (!confirm('Удалить счёт «' + acct.name + '»?')) return;
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

  const totalBalance = accounts.reduce((s, a) => s + getBalance(a.type), 0);

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
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
            <button className="btn btn-outline" onClick={function () { setShowTransferModal(true); }}>🔄 Перевод между счетами</button>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111', marginBottom: '1rem' }}>
            {totalBalance.toLocaleString()}₽
          </div>
          {accMeta.filter(t => getAccount(t.type)).map(a => {
            const acct = getAccount(a.type);
            const balance = getBalance(a.type);
            const mv = getMovements(a.type);
            const initial = parseFloat(acct.balance) || 0;
            return (
              <div key={a.type} style={{
                display: 'flex', alignItems: 'center', padding: '.75rem 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '1.5rem', marginRight: '.75rem' }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.9rem', fontWeight: 600 }}>{a.label}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
                    <span style={{color:'var(--muted)'}}>{acct?.name}</span>
                    <span style={{margin:'0 .35rem'}}>·</span>
                    <span style={{color:'var(--muted)'}}>Было: {initial.toLocaleString()}₽</span>
                    <span style={{margin:'0 .35rem'}}>·</span>
                    <span style={{color:'#16a34a'}}>Доход: +{mv.income.toLocaleString()}₽</span>
                    <span style={{margin:'0 .35rem'}}>·</span>
                    <span style={{color:'#dc2626'}}>Расход: −{mv.expense.toLocaleString()}₽</span>
                  </div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: balance >= 0 ? '#16a34a' : '#dc2626', marginRight: '1rem' }}>
                  {balance.toLocaleString()}₽
                </div>
                <button className="act-btn prod-edit-btn" onClick={function () { openEditModal(acct); }}>Ред.</button>
                <div className="prod-more-wrap">
                  <button className="act-btn prod-more-btn" onClick={toggleMenu}>⋯</button>
                  <div className="prod-dropdown">
                    <button onClick={function () { remove(acct); }} style={{ color: '#dc3545' }}>Удалить</button>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay active" onClick={function (e) { if (e.target.className === 'modal-overlay active') { setShowModal(false); setEditingId(null); } }}>
          <div className="modal-box">
            <button className="modal-close" onClick={function () { setShowModal(false); setEditingId(null); }}>&times;</button>
            <h2>{editingId ? 'Редактировать счёт' : 'Добавить счёт'}</h2>
            <div className="sub">{editingId ? 'Измените данные счёта' : 'Введите название и начальный остаток'}</div>
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
              <div className="form-group">
                <label>Начальный остаток (₽)</label>
                <input type="number" placeholder="0" min="0" step="0.01"
                  value={modalBalance} onChange={function (e) { setModalBalance(e.target.value); }} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editingId ? 'Сохранить' : 'Создать'}</button>
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
