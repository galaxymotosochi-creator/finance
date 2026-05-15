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
    

  const txs = transactions || [];
  const incomeTotal = txs.filter(t => t && t.type === "income").reduce((s, t) => s + (+(t.amount||0)), 0);
  const expenseTotal = txs.filter(t => t && t.type !== "income").reduce((s, t) => s + (+(t.amount||0)), 0);
    const sales = txs.filter(t => t && t.type === "sale");
    return (
    <>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:"1.2rem", fontWeight:600, margin:0 }}>Транзакции</h1>
          <div className="sub" style={{ fontSize:".85rem", color:"var(--muted)", margin:0 }}>Все приходы и расходы в одном месте</div>
        </div>
        <div style={{ display:"flex", gap:".5rem" }}>
          <button className="btn-red" onClick={() => setShowExpense(true)}>+ Расход</button>
          <button className="btn-green" onClick={() => setShowIncome(true)}>+ Доход</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin:".25rem 0", width:"100%", border:"none", borderTop:"1px solid var(--border)" }} />
      <div style={{ marginTop:"1rem", fontSize:".85rem", color:"var(--muted)" }}>
                <div style={{ display:"flex", gap:".5rem", flexWrap:"wrap", margin:".75rem 0" }}>
          <div style={{ flex:1, minWidth:"120px", background:"linear-gradient(135deg,#dcfce7,#bbf7d0)", border:"1px solid #86efac", borderRadius:"10px", padding:".65rem .75rem" }}>
            <div style={{ fontSize:".65rem", color:"#166534", fontWeight:600, textTransform:"uppercase" }}>Выручка</div>
            <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#14532d", marginTop:".1rem" }}>{incomeTotal.toLocaleString()}₽</div>
          </div>
          <div style={{ flex:1, minWidth:"120px", background:"linear-gradient(135deg,#fce7f3,#fbcfe8)", border:"1px solid #f9a8d4", borderRadius:"10px", padding:".65rem .75rem" }}>
            <div style={{ fontSize:".65rem", color:"#9d174d", fontWeight:600, textTransform:"uppercase" }}>Расходы</div>
            <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#831843", marginTop:".1rem" }}>{expenseTotal.toLocaleString()}₽</div>
          </div>
          <div style={{ flex:1, minWidth:"120px", background:"linear-gradient(135deg,#dbeafe,#bfdbfe)", border:"1px solid #93c5fd", borderRadius:"10px", padding:".65rem .75rem" }}>
            <div style={{ fontSize:".65rem", color:"#1e40af", fontWeight:600, textTransform:"uppercase" }}>Прибыль</div>
            <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#1e3a8a", marginTop:".1rem" }}>{profit.toLocaleString()}₽</div>
          </div>
          <div style={{ flex:1, minWidth:"120px", background:"linear-gradient(135deg,#fef3c7,#fde68a)", border:"1px solid #fcd34d", borderRadius:"10px", padding:".65rem .75rem" }}>
            <div style={{ fontSize:".65rem", color:"#92400e", fontWeight:600, textTransform:"uppercase" }}>Средний чек</div>
            <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#78350f", marginTop:".1rem" }}>{avgCheck.toLocaleString()}₽</div>
          </div>
        </div>
      </div>
      <div style={{ textAlign:"center", padding:"2rem", color:"var(--muted)" }}>
        <p>Страница транзакций загружена</p>
      </div>
      {showIncome && <div className="modal-overlay active"><div className="modal-box"><h2>test income</h2></div></div>}
      {showExpense && <div className="modal-overlay active"><div className="modal-box"><h2>test expense</h2></div></div>}
    </>
  );
}
