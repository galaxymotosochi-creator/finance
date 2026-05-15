const fs = require('fs');
const content = `import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions, useAccounts, useCategories } from '../../hooks/useTransactions';

const accMeta = [
  { type: 'cash', icon: '💵', label: 'Наличные' },
  { type: 'card', icon: '💳', label: 'Карта' },
  { type: 'transfer', icon: '🔄', label: 'Перевод' },
];

export default function Transactions() {
  const { user } = useAuth();
  const { transactions, loading, add, remove, refresh } = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();
  const [search, setSearch] = useState('');
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [incName, setIncName] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incDate, setIncDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [incCategory, setIncCategory] = useState('');
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expCategory, setExpCategory] = useState('');
  const [showAccSelect, setShowAccSelect] = useState(false);
  const [pendingTx, setPendingTx] = useState(null);
  const [selectedAcc, setSelectedAcc] = useState('cash');
  const [splitMode, setSplitMode] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({ cash: 0, card: 0, transfer: 0 });

  const txs = transactions || [];
  const accs = accounts || [];
  const cats = categories || [];

  const incomeTotal = txs.filter(t => t?.type === 'income').reduce((s, t) => s + +(t?.amount || 0), 0);
  const expenseTotal = txs.filter(t => t?.type !== 'income').reduce((s, t) => s + +(t?.amount || 0), 0);
  const profit = incomeTotal - expenseTotal;
  const sales = txs.filter(t => t?.type === 'sale');
  const avgCheck = sales.length ? Math.round(sales.reduce((s, t) => s + +(t?.amount || 0), 0) / sales.length) : 0;
  const filtered = txs.filter(tx => !search || (tx?.description || '').toLowerCase().includes(search.toLowerCase()));
  const incomeCats = cats.filter(c => c?.type === 'income');
  const expenseCats = cats.filter(c => c?.type === 'expense' || c?.type === 'supply_expense');

  const seed = async () => {
    try {
      if (accs.length === 0) await supabase.from('accounts').insert([
        { user_id: user.id, name: 'Наличные', type: 'cash' },
        { user_id: user.id, name: 'Карта', type: 'card' },
        { user_id: user.id, name: 'Перевод', type: 'transfer' },
      ]);
      if (cats.length === 0) await supabase.from('categories').insert([
        { user_id: user.id, name: 'Продажи', type: 'income' },
        { user_id: user.id, name: 'Аренда', type: 'expense' },
        { user_id: user.id, name: 'Коммунальные', type: 'expense' },
        { user_id: user.id, name: 'Налоги', type: 'expense' },
        { user_id: user.id, name: 'Зарплата', type: 'expense' },
        { user_id: user.id, name: 'Прочее', type: 'expense' },
        { user_id: user.id, name: 'Прочие доходы', type: 'income' },
      ]);
      await refresh();
    } catch (e) { console.error(e); }
  };

  const handleIncomeSubmit = (e) => {
    e.preventDefault();
    if (!incName || !incAmount) return alert('Заполните название и сумму');
    setPendingTx({ type: 'income', user_id: user.id, description: incName, amount: parseFloat(incAmount), date: incDate || new Date().toISOString().split('T')[0], category_id: incCategory || null });
    setSelectedAcc('cash'); setSplitMode(false); setSplitAmounts({ cash: 0, card: 0, transfer: 0 }); setShowAccSelect(true);
  };

  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    if (!expName || !expAmount) return alert('Заполните название и сумму');
    setPendingTx({ type: 'expense', user_id: user.id, description: expName, amount: parseFloat(expAmount), date: expDate || new Date().toISOString().split('T')[0], category_id: expCategory || null });
    setSelectedAcc('cash'); setSplitMode(false); setSplitAmounts({ cash: 0, card: 0, transfer: 0 }); setShowAccSelect(true);
  };

  const toggleSplit = () => {
    if (!splitMode) {
      const amt = pendingTx ? Math.round((pendingTx.amount || 0) / 3) : 0;
      const total = pendingTx?.amount || 0;
      setSplitAmounts({ cash: amt, card: amt, transfer: total - amt * 2 });
    }
    setSplitMode(!splitMode);
  };

  const confirmAccount = async () => {
    if (!pendingTx) return;
    try {
      if (splitMode) {
        for (const [type, amt] of Object.entries(splitAmounts)) {
          if (amt > 0) {
            const account = accs.find(a => a?.type === type) || accs[0];
            if (account) await add({ ...pendingTx, account_id: account.id, amount: amt });
          }
        }
      } else {
        const account = accs.find(a => a?.type === selectedAcc) || accs[0];
        if (account) await add({ ...pendingTx, account_id: account.id });
        else alert('Сначала нажмите "Заполнить демо-данными"');
      }
      setShowAccSelect(false); setPendingTx(null); setShowIncome(false); setShowExpense(false);
      setIncName(''); setIncAmount('');
      const today = new Date().toISOString().split('T')[0];
      setIncDate(today); setIncCategory('');
      setExpName(''); setExpAmount(''); setExpDate(today); setExpCategory('');
    } catch (err) { alert(err.message); }
  };

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      React.createElement('div', null,
        React.createElement('h1', { style: { fontSize: '1.2rem', fontWeight: 600, margin: 0 } }, 'Транзакции'),
        React.createElement('div', { className: 'sub', style: { fontSize: '.85rem', color: 'var(--muted)', margin: 0 } }, 'Все приходы и расходы в одном месте')
      ),
      React.createElement('div', { style: { display: 'flex', gap: '.5rem' } },
        React.createElement('button', { className: 'btn-red', onClick: () => setShowExpense(true) }, '+ Расход'),
        React.createElement('button', { className: 'btn-green', onClick: () => setShowIncome(true) }, '+ Доход')
      )
    ),
    React.createElement('div', { className: 'nav-sep', style: { margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' } }),
    React.createElement('div', { style: { color: '#888', fontSize: '.85rem', marginTop: '1rem' } },
      'Доходы: ' + incomeTotal.toLocaleString() + '₽ | ',
      'Расходы: ' + expenseTotal.toLocaleString() + '₽ | ',
      'Прибыль: ' + profit.toLocaleString() + '₽'
    ),
    !loading && txs.length === 0
      ? React.createElement('div', { style: { textAlign: 'center', padding: '2rem', color: 'var(--muted)' } },
          React.createElement('p', { style: { marginBottom: '.75rem' } }, 'Пока нет транзакций'),
          React.createElement('button', { onClick: seed, style: { padding: '.5rem 1rem', fontSize: '.82rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--white)', cursor: 'pointer' } }, 'Заполнить демо-данными')
        )
      : null,
    filtered.length > 0
      ? React.createElement('div', { style: { overflowX: 'auto', marginTop: '.5rem' } },
          React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
            React.createElement('thead', null,
              React.createElement('tr', { id: 'colHeaders' },
                React.createElement('th', null, 'Дата'),
                React.createElement('th', null, 'Название'),
                React.createElement('th', null, 'Сумма'),
                React.createElement('th', null, 'Категория'),
                React.createElement('th', { style: { width: '30px' } })
              )
            ),
            React.createElement('tbody', null,
              filtered.map(tx =>
                React.createElement('tr', { key: tx.id, style: { fontSize: '.82rem', borderBottom: '1px solid var(--border)' } },
                  React.createElement('td', { style: { padding: '.5rem .5rem .5rem 0', color: 'var(--muted)', whiteSpace: 'nowrap' } }, tx.date || '—'),
                  React.createElement('td', { style: { padding: '.5rem', fontWeight: 500 } }, tx.description || '—'),
                  React.createElement('td', { style: { padding: '.5rem', fontWeight: 600, whiteSpace: 'nowrap', color: tx.type === 'income' ? '#16a34a' : '#dc2626' } },
                    (tx.type === 'income' ? '+' : '-') + (+(tx.amount || 0)).toLocaleString() + '₽'
                  ),
                  React.createElement('td', { style: { padding: '.5rem', color: 'var(--muted)' } }, (tx.categories?.name) || '—'),
                  React.createElement('td', { style: { padding: '.5rem', textAlign: 'right' } },
                    React.createElement('span', { onClick: () => remove(tx.id), style: { cursor: 'pointer', fontSize: '.7rem', color: 'var(--muted)' } }, '✕')
                  )
                )
              )
            )
          )
        )
      : null,
    showAccSelect
      ? React.createElement('div', { className: 'modal-overlay active' },
          React.createElement('div', { className: 'modal-box', style: { maxWidth: '400px' } },
            React.createElement('h2', null, pendingTx?.type === 'expense' ? 'С какого счета списать?' : 'На какой счет зачислить?'),
            React.createElement('div', { className: 'sub' }, (pendingTx?.type === 'expense' ? 'Сумма расхода' : 'Сумма дохода') + ': ' + (pendingTx?.amount || 0).toLocaleString() + '₽'),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '.5rem', margin: '.75rem 0' } },
              accMeta.map(acc => {
                const sel = selectedAcc === acc.type;
                return React.createElement('div', { key: acc.type, onClick: () => setSelectedAcc(acc.type),
                  style: { display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.65rem .75rem', cursor: 'pointer', borderRadius: 'var(--radius)', background: sel ? 'var(--primary-light)' : 'var(--white)', border: '1.5px solid ' + (sel ? 'var(--primary)' : 'var(--border)') } },
                  React.createElement('div', { style: { width: '18px', height: '18px', border: '2px solid ' + (sel ? 'var(--primary)' : 'var(--border)'), borderRadius: '50%', flexShrink: 0, borderWidth: sel ? '6px' : '2px' } }),
                  React.createElement('span', { style: { fontSize: '1.2rem', flexShrink: 0 } }, acc.icon),
                  React.createElement('span', { style: { flex: 1, fontSize: '.85rem', fontWeight: 500, color: 'var(--body-color)' } }, acc.label),
                  React.createElement('span', { style: { fontSize: '.82rem', fontWeight: 600, color: 'var(--primary)' } }, ((accs.find(a => a?.type === acc.type)?.balance || 0)).toLocaleString() + '₽')
                );
              })
            ),
            React.createElement('div', { className: 'sub', style: { marginBottom: '.75rem', cursor: 'pointer', fontSize: '.82rem', color: 'var(--primary)' }, onClick: toggleSplit }, splitMode ? '➖ Разделить' : '➕ Разделить'),
            React.createElement('button', { className: 'btn btn-primary', onClick: confirmAccount, style: { width: '100%' } },
              (pendingTx?.type === 'expense' ? 'Списать' : 'Зачислить') + ' ' + (pendingTx?.amount || 0).toLocaleString() + '₽'
            )
          )
        )
      : null,
    showIncome && React.createElement('div', { className: 'modal-overlay active' },
      React.createElement('div', { className: 'modal-box' },
        React.createElement('button', { className: 'modal-close', onClick: () => setShowIncome(false) }, '×'),
        React.createElement('h2', null, 'Добавить доход'),
        React.createElement('div', { className: 'sub' }, 'Запишите новый доход'),
        React.createElement('form', { onSubmit: handleIncomeSubmit },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Название *'),
            React.createElement('input', { type: 'text', placeholder: 'Например: инвестиции', value: incName, onChange: e => setIncName(e.target.value), required: true })
          ),
          React.createElement('div', { className: 'form-row' },
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'Сумма (₽) *'),
              React.createElement('input', { type: 'number', placeholder: '0', min: 0, step: '0.01', value: incAmount, onChange: e => setIncAmount(e.target.value), required: true })
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'Дата'),
              React.createElement('input', { type: 'date', value: incDate, onChange: e => setIncDate(e.target.value) })
            )
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Категория'),
            React.createElement('select', { value: incCategory, onChange: e => setIncCategory(e.target.value) },
              React.createElement('option', { value: '' }, '— выберите —'),
              incomeCats.map(c => React.createElement('option', { key: c.id, value: c.id }, c.name))
            )
          ),
          React.createElement('div', { className: 'modal-actions' },
            React.createElement('button', { type: 'submit', className: 'btn btn-primary' }, 'Добавить')
          )
        )
      )
    ),
    showExpense && React.createElement('div', { className: 'modal-overlay active' },
      React.createElement('div', { className: 'modal-box' },
        React.createElement('h2', null, 'Добавить расход'),
        React.createElement('div', { className: 'sub' }, 'Запишите новый расход'),
        React.createElement('form', { onSubmit: handleExpenseSubmit },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Название *'),
            React.createElement('input', { type: 'text', placeholder: 'Например: аренда', value: expName, onChange: e => setExpName(e.target.value), required: true })
          ),
          React.createElement('div', { className: 'form-row' },
            React.createElement('div', { className: 'form-group' },
              React