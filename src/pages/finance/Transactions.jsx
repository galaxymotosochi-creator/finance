import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions, useAccounts, useCategories } from '../../hooks/useTransactions';

export default function Transactions() {
  const { user } = useAuth();
  const { transactions, loading, add, remove, refresh } = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();
  const [search, setSearch] = useState('');
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [filterType, setFilterType] = useState('all');

  /* Form state (income) */
  const [incName, setIncName] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incDate, setIncDate] = useState(new Date().toISOString().split('T')[0]);
  const [incCategory, setIncCategory] = useState('');
  const [incAccount, setIncAccount] = useState('');

  /* Form state (expense) */
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expCategory, setExpCategory] = useState('');
  const [expAccount, setExpAccount] = useState('');

  /* Seed data if empty */
  const seed = async () => {
    if (accounts.length === 0) {
      await supabase.from('accounts').insert([
        { user_id: user.id, name: 'Наличные', type: 'cash' },
        { user_id: user.id, name: 'Карта', type: 'card' },
        { user_id: user.id, name: 'Перевод', type: 'transfer' },
      ]);
    }
    if (categories.length === 0) {
      await supabase.from('categories').insert([
        { user_id: user.id, name: 'Продажи', type: 'income' },
        { user_id: user.id, name: 'Аренда', type: 'expense' },
        { user_id: user.id, name: 'Коммунальные', type: 'expense' },
        { user_id: user.id, name: 'Налоги', type: 'expense' },
        { user_id: user.id, name: 'Зарплата', type: 'expense' },
        { user_id: user.id, name: 'Прочее', type: 'expense' },
        { user_id: user.id, name: 'Прочие доходы', type: 'income' },
      ]);
    }
    await refresh();
  };

  const handleAddIncome = async (e) => {
    e.preventDefault();
    try {
      await add({
        user_id: user.id,
        account_id: incAccount || accounts[0]?.id,
        category_id: incCategory || categories.filter(c => c.type === 'income')[0]?.id,
        type: 'income',
        amount: parseFloat(incAmount),
        description: incName,
        date: incDate,
      });
      setShowIncome(false);
      resetIncomeForm();
    } catch (err) { alert(err.message); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      await add({
        user_id: user.id,
        account_id: expAccount || accounts[0]?.id,
        category_id: expCategory || categories.filter(c => c.type === 'expense')[0]?.id,
        type: 'expense',
        amount: parseFloat(expAmount),
        description: expName,
        date: expDate,
      });
      setShowExpense(false);
      resetExpenseForm();
    } catch (err) { alert(err.message); }
  };

  const resetIncomeForm = () => { setIncName(''); setIncAmount(''); setIncDate(new Date().toISOString().split('T')[0]); setIncCategory(''); setIncAccount(''); };
  const resetExpenseForm = () => { setExpName(''); setExpAmount(''); setExpDate(new Date().toISOString().split('T')[0]); setExpCategory(''); setExpAccount(''); };

  /* Filter by type */
  const filtered = transactions.filter(tx => {
    if (filterType === 'income') return tx.type === 'income';
    if (filterType === 'expense') return tx.type === 'expense' || tx.type === 'supply_expense';
    if (search) return tx.description?.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const incomeCats = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense' || c.type === 'supply_expense');

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Транзакции</h1>
          <div className="sub" style={{ fontSize: '.85rem', color: 'var(--muted)', margin: '.15rem 0 0' }}>
            Все приходы и расходы
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="btn-green" onClick={() => setShowIncome(true)}>+ Доход</button>
          <button className="btn-red" onClick={() => setShowExpense(true)}>+ Расход</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.5rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '.82rem', color: 'var(--body-color)' }}>
        <span>Доходы: <strong style={{ color: '#16a34a' }}>{filtered.filter(t => t.type === 'income').reduce((s, t) => s + +t.amount, 0).toLocaleString()}₽</strong></span>
        <span>Расходы: <strong style={{ color: '#dc2626' }}>{filtered.filter(t => t.type !== 'income').reduce((s, t) => s + +t.amount, 0).toLocaleString()}₽</strong></span>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
          <span style={{ position: 'absolute', left: '.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '.75rem', color: 'var(--muted)' }}>🔍</span>
          <input type="text" placeholder="Поиск" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '.35rem .35rem .35rem 1.6rem', fontSize: '.8rem', border: '1px solid var(--border)', borderRadius: '6px', outline: 'none', fontFamily: 'var(--font)' }} />
        </div>
        <span className="stock-filter-link" onClick={() => setFilterType('all')}
          style={{ fontWeight: filterType === 'all' ? 600 : 400, color: filterType === 'all' ? 'var(--primary)' : 'var(--muted)' }}>Все</span>
        <span className="stock-filter-link" onClick={() => setFilterType('income')}
          style={{ fontWeight: filterType === 'income' ? 600 : 400, color: filterType === 'income' ? 'var(--primary)' : 'var(--muted)' }}>Доходы</span>
        <span className="stock-filter-link" onClick={() => setFilterType('expense')}
          style={{ fontWeight: filterType === 'expense' ? 600 : 400, color: filterType === 'expense' ? 'var(--primary)' : 'var(--muted)' }}>Расходы</span>
      </div>

      {/* Seed button if empty */}
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
            <thead>
              <tr id="colHeaders">
                <th>Дата</th>
                <th>Название</th>
                <th>Сумма</th>
                <th>Категория</th>
                <th>Счёт</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} style={{ fontSize: '.82rem', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '.5rem .5rem .5rem 0', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{tx.date}</td>
                  <td style={{ padding: '.5rem', fontWeight: 500 }}>{tx.description || '—'}</td>
                  <td style={{
                    padding: '.5rem', fontWeight: 600, whiteSpace: 'nowrap',
                    color: tx.type === 'income' ? '#16a34a' : '#dc2626',
                  }}>
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
        <div className="modal-overlay active" onClick={e => e.target.className === 'modal-overlay active' && setShowIncome(false)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowIncome(false)}>&times;</button>
            <h2>Добавить доход</h2>
            <div className="sub">Запишите новый доход</div>
            <form onSubmit={handleAddIncome}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например: инвестиции, партнёрские" value={incName} onChange={e => setIncName(e.target.value)} required />
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
              <div className="form-group">
                <label>Счёт</label>
                <select value={incAccount} onChange={e => setIncAccount(e.target.value)}>
                  <option value="">— выберите —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
        <div className="modal-overlay active" onClick={e => e.target.className === 'modal-overlay active' && setShowExpense(false)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowExpense(false)}>&times;</button>
            <h2>Добавить расход</h2>
            <div className="sub">Запишите новый расход</div>
            <form onSubmit={handleAddExpense}>
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
              <div className="form-group">
                <label>Счёт</label>
                <select value={expAccount} onChange={e => setExpAccount(e.target.value)}>
                  <option value="">— выберите —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
