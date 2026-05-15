import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions, useAccounts, useCategories } from '../../hooks/useTransactions';

const accMeta = [
  { type: 'cash', icon: '\u{1F4B5}', label: '\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435' },
  { type: 'card', icon: '\u{1F4B3}', label: '\u041A\u0430\u0440\u0442\u0430' },
  { type: 'transfer', icon: '\u{1F504}', label: '\u041F\u0435\u0440\u0435\u0432\u043E\u0434' },
];

export default function Transactions() {
  const { user } = useAuth();
  const { transactions, loading, add, remove, refresh } = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  /* Form state */
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [incName, setIncName] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incDate, setIncDate] = useState(new Date().toISOString().split('T')[0]);
  const [incCategory, setIncCategory] = useState('');
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expCategory, setExpCategory] = useState('');

  /* Account select state */
  const [showAccSelect, setShowAccSelect] = useState(false);
  const [pendingTx, setPendingTx] = useState(null);
  const [selectedAcc, setSelectedAcc] = useState('cash');

  const seed = async () => {
    if (accounts.length === 0) {
      await supabase.from('accounts').insert([
        { user_id: user.id, name: '\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435', type: 'cash' },
        { user_id: user.id, name: '\u041A\u0430\u0440\u0442\u0430', type: 'card' },
        { user_id: user.id, name: '\u041F\u0435\u0440\u0435\u0432\u043E\u0434', type: 'transfer' },
      ]);
    }
    if (categories.length === 0) {
      await supabase.from('categories').insert([
        { user_id: user.id, name: '\u041F\u0440\u043E\u0434\u0430\u0436\u0438', type: 'income' },
        { user_id: user.id, name: '\u0410\u0440\u0435\u043D\u0434\u0430', type: 'expense' },
        { user_id: user.id, name: '\u041A\u043E\u043C\u043C\u0443\u043D\u0430\u043B\u044C\u043D\u044B\u0435', type: 'expense' },
        { user_id: user.id, name: '\u041D\u0430\u043B\u043E\u0433\u0438', type: 'expense' },
        { user_id: user.id, name: '\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430', type: 'expense' },
        { user_id: user.id, name: '\u041F\u0440\u043E\u0447\u0435\u0435', type: 'expense' },
        { user_id: user.id, name: '\u041F\u0440\u043E\u0447\u0438\u0435 \u0434\u043E\u0445\u043E\u0434\u044B', type: 'income' },
      ]);
    }
    await refresh();
  };

  /* Income: form -> account select */
  const handleIncomeSubmit = (e) => {
    e.preventDefault();
    if (!incName || !incAmount) { alert('\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438 \u0441\u0443\u043C\u043C\u0443'); return; }
    setPendingTx({
      type: 'income', user_id: user.id,
      description: incName, amount: parseFloat(incAmount),
      date: incDate, category_id: incCategory || null,
    });
    setSelectedAcc('cash');
    setShowAccSelect(true);
  };

  /* Expense: form -> account select */
  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    if (!expName || !expAmount) { alert('\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438 \u0441\u0443\u043C\u043C\u0443'); return; }
    setPendingTx({
      type: 'expense', user_id: user.id,
      description: expName, amount: parseFloat(expAmount),
      date: expDate, category_id: expCategory || null,
    });
    setSelectedAcc('cash');
    setShowAccSelect(true);
  };

  /* Confirm account -> save to DB */
  const confirmAccount = async () => {
    if (!pendingTx) return;
    try {
      const account = accounts.find(a => a.type === selectedAcc) || accounts[0];
      await add({ ...pendingTx, account_id: account?.id });
      setShowAccSelect(false);
      setPendingTx(null);
      setShowIncome(false);
      setShowExpense(false);
      resetForms();
    } catch (err) { alert(err.message); }
  };

  const resetForms = () => {
    setIncName(''); setIncAmount('');
    setIncDate(new Date().toISOString().split('T')[0]); setIncCategory('');
    setExpName(''); setExpAmount('');
    setExpDate(new Date().toISOString().split('T')[0]); setExpCategory('');
  };

  /* Filters */
  const filtered = transactions.filter(tx => {
    if (filterType === 'income') return tx.type === 'income';
    if (filterType === 'expense') return (tx.type === 'expense' || tx.type === 'supply_expense');
    if (search) return tx.description?.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const incomeCats = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense' || c.type === 'supply_expense');
  const incomeTotal = filtered.filter(t => t.type === 'income').reduce((s, t) => s + +t.amount, 0);
  const expenseTotal = filtered.filter(t => t.type !== 'income').reduce((s, t) => s + +t.amount, 0);

  return (
    <>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Транзакции</h1>
          <div className="sub" style={{ fontSize: '.85rem', color: 'var(--muted)', margin: '.15rem 0 0' }}>Все приходы и расходы в одном месте</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="btn-green" onClick={() => setShowIncome(true)}>+ Доход</button>
          <button className="btn-red" onClick={() => setShowExpense(true)}>+ Расход</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      {/* Stats */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '.82rem' }}>
        <span>Доходы: <strong style={{ color: '#16a34a' }}>{incomeTotal.toLocaleString()}₽</strong></span>
        <span>Расходы: <strong style={{ color: '#dc2626' }}>{expenseTotal.toLocaleString()}₽</strong></span>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
          <span style={{ position: 'absolute', left: '.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '.75rem', color: 'var(--muted)' }}>🔍</span>
          <input type="text" placeholder="Быстрый поиск" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '.35rem .35rem .35rem 1.6rem', fontSize: '.8rem', border: '1px solid var(--border)', borderRadius: '6px', outline: 'none', fontFamily: 'var(--font)' }} />
        </div>
        <div className="stock-filter-links">
          <span className="stock-filter-link" onClick={() => setFilterType('all')} style={{ fontWeight: filterType === 'all' ? 600 : 400 }}>Все</span>
          <span className="stock-filter-link" onClick={() => setFilterType('income')} style={{ fontWeight: filterType === 'income' ? 600 : 400 }}>Доходы</span>
          <span className="stock-filter-link" onClick={() => setFilterType('expense')} style={{ fontWeight: filterType === 'expense' ? 600 : 400 }}>Расходы</span>
        </div>
      </div>

      {/* Empty state */}
      {!loading && transactions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          <p style={{ marginBottom: '.75rem' }}>Пока нет транзакций</p>
          <button onClick={seed} style={{ padding: '.5rem 1rem', fontSize: '.82rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--white)', cursor: 'pointer' }}>
            Заполнить демо-данными
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr id="colHeaders">
              <th>Дата</th><th>Название</th><th>Сумма</th><th>Категория</th><th>Счёт</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} style={{ fontSize: '.82rem', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '.5rem .5rem .5rem 0', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{tx.date}</td>
                  <td style={{ padding: '.5rem', fontWeight: 500 }}>{tx.description || '—'}</td>
                  <td style={{ padding: '.5rem', fontWeight: 600, whiteSpace: 'nowrap', color: tx.type === 'income' ? '#16a34a' : '#dc2626' }}>
                    {tx.type === 'income' ? '+' : '-'}{+tx.amount}₽
                  </td>
                  <td style={{ padding: '.5rem', color: 'var(--muted)' }}>{tx.categories?.name || '—'}</td>
                  <td style={{ padding: '.5rem', color: 'var(--muted)' }}>{tx.accounts?.name || '—'}</td>
                  <td style={{ padding: '.5rem', textAlign: 'right' }}>
                    <span onClick={() => remove(tx.id)} style={{ cursor: 'pointer', fontSize: '.7rem', color: 'var(--muted)' }}>✕</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* INCOME MODAL */}
      {showIncome && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowIncome(false); }}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowIncome(false)}>&times;</button>
            <h2>Добавить доход</h2>
            <div className="sub">Запишите новый доход</div>
            <form onSubmit={handleIncomeSubmit}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например: инвестиции, партнёрские, проценты" value={incName} onChange={e => setIncName(e.target.value)} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Сумма (₽) *</label>
                  <input type="number" placeholder="0" min="0" step="0.01" value={incAmount} onChange={e => setIncAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Дата</label>
                  <input type="date" value={incDate} onChange={e => setIncDate(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Категория</label>
                <select value={incCategory} onChange={e => setIncCategory(e.target.value)}>
                  <option value="">— выберите —</option>
                  {incomeCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPENSE MODAL */}
      {showExpense && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowExpense(false); }}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowExpense(false)}>&times;</button>
            <h2>Добавить расход</h2>
            <div className="sub">Запишите новый расход</div>
            <form onSubmit={handleExpenseSubmit}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например: аренда, коммунальные, налоги" value={expName} onChange={e => setExpName(e.target.value)} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Сумма (₽) *</label>
                  <input type="number" placeholder="0" min="0" step="0.01" value={expAmount} onChange={e => setExpAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Дата</label>
                  <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Категория</label>
                <select value={expCategory} onChange={e => setExpCategory(e.target.value)}>
                  <option value="">— выберите —</option>
                  {expenseCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNT SELECT MODAL */}
      {showAccSelect && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') { setShowAccSelect(false); setPendingTx(null); } }}>
          <div className="modal-box" style={{ maxWidth: '400px' }}>
            <button className="modal-close" onClick={() => { setShowAccSelect(false); setPendingTx(null); }}>&times;</button>
            <h2 id="accSelectTitle">{pendingTx?.type === 'expense' ? 'С какого счета списать?' : 'На какой счет зачислить?'}</h2>
            <div className="sub" id="accSelectSub">
              {pendingTx?.type === 'expense' ? 'Сумма расхода' : 'Сумма дохода'}: {pendingTx?.amount.toLocaleString()}₽
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', margin: '.75rem 0' }} id="accSelectList">
              {accMeta.map(acc => {
                const selected = selectedAcc === acc.type;
                const balance = accounts.find(a => a.type === acc.type)?.balance || 0;
                return (
                  <div key={acc.type} className="acc-card" data-acc={acc.type}
                    onClick={() => setSelectedAcc(acc.type)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '.5rem',
                      padding: '.65rem .75rem', cursor: 'pointer', borderRadius: 'var(--radius)',
                      transition: 'all .12s', background: selected ? 'var(--primary-light)' : 'var(--white)',
                      border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                    }}>
                    <div style={{
                      width: '18px', height: '18px', border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '50%', flexShrink: 0, transition: 'all .12s',
                      borderWidth: selected ? '6px' : '2px',
                    }} />
                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{acc.icon}</span>
                    <span style={{ flex: 1, fontSize: '.85rem', fontWeight: 500, color: 'var(--body-color)' }}>{acc.label}</span>
                    <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--primary)' }}>
                      {(balance || 0).toLocaleString()}₽
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="modal-actions" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
              <button type="button" className="btn btn-primary" onClick={confirmAccount} style={{ width: '100%' }}>
                {pendingTx?.type === 'expense' ? 'Списать' : 'Зачислить'} {pendingTx?.amount.toLocaleString()}₽
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
