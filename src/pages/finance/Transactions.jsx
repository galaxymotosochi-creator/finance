import Modal from '../../components/Modal';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions, useAccounts, useCategories } from '../../hooks/useTransactions';
import { getCurrencySymbol } from '../../lib/currency';
import { getSettingsTz } from '../../lib/dates';
import CenterSpinner from '../../components/CenterSpinner';
import SectionHelp from '../../components/SectionHelp';


export default function Transactions() {
  const cur = getCurrencySymbol();
  const loc = useLocation();
  const { user } = useAuth();
  const { transactions, loading, add, remove, update, refresh } = useTransactions();
  const { accounts, refreshAccounts } = useAccounts();
  const { categories, refreshCategories } = useCategories();
  const [dataError, setDataError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [userMap, setUserMap] = useState({});

  // Загружаем ФИО пользователей для колонки Автор
  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id,email'),
      supabase.from('user_profiles').select('user_id,last_name,first_name,patronymic'),
    ]).then(([usersRes, profilesRes]) => {
      const m = {};
      if (usersRes.data) {
        usersRes.data.forEach(u => { m[u.id] = u.email?.split('@')[0] || '—'; });
      }
      if (profilesRes.data) {
        profilesRes.data.forEach(p => {
          const parts = [p.last_name, p.first_name, p.patronymic].filter(Boolean);
          if (parts.length) m[p.user_id] = parts.join(' ');
        });
      }
      setUserMap(m);
    });
  }, []);
  const [origAmount, setOrigAmount] = useState(null);
  const [search, setSearch] = useState('');
  const [txRingOpen, setTxRingOpen] = useState(false);
  const [txKind, setTxKind] = useState('income');
  const openIncome = () => { setTxKind('income'); setSelectedAcc(accs.length > 0 ? accs[0].id : null); setShowIncome(true); };
  const openExpense = () => { setTxKind('expense'); setSelectedAcc(accs.length > 0 ? accs[0].id : null); setShowExpense(true); };
  const [searchFocus, setSearchFocus] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showAccSelect, setShowAccSelect] = useState(false);
  const [pendingTx, setPendingTx] = useState(null);
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [splitMode, setSplitMode] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({});

  const [incName, setIncName] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incDate, setIncDate] = useState(new Date().toISOString().split('T')[0]);
  const [incCategory, setIncCategory] = useState('');
  const [expName, setExpName] = useState('');
  const [txAccountId, setTxAccountId] = useState(null);
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expCategory, setExpCategory] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [ddOpen, setDdOpen] = useState(false);
  const [showOwner, setShowOwner] = useState(false);
  const [ownerMode, setOwnerMode] = useState('deposit');
  const [ownerAcct, setOwnerAcct] = useState('');
  const [ownerAmt, setOwnerAmt] = useState('');
  const [ownerDesc, setOwnerDesc] = useState('');
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trAmt, setTrAmt] = useState('');

  const [period, setPeriod] = useState('all');
  const [periodLabel, setPeriodLabel] = useState('Все время');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [toast, setToast] = useState(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);
  const [showPeriod, setShowPeriod] = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  // Авто-открытие модалки по параметру ?add=income или ?add=expense
  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    if (params.get('add') === 'income') { setShowIncome(true); }
    if (params.get('add') === 'expense') { setShowExpense(true); }
  }, [loc.search]);

  // Проверка ошибок загрузки
  useEffect(() => {
    try {
      if (transactions !== undefined && accounts !== undefined) {
        setDataError(null);
      }
    } catch (e) {
      setDataError('Не удалось загрузить данные. Проверьте соединение.');
    }
  }, [transactions, accounts]);

  const [tblPos, setTblPos] = useState({left:false, right:false});
  const tblElRef = useRef(null);
  const onTblScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left:false, right:false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const checkTbl = () => {
    const el = tblElRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left:false, right:false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  useEffect(() => {
    const t = setTimeout(checkTbl, 120);
    window.addEventListener('resize', checkTbl);
    return () => { clearTimeout(t); window.removeEventListener('resize', checkTbl); };
  });

  // Закрытие выпадающих списков («Тип» и «Все время») по клику в любом месте.
  // Открытие одного автоматически закрывает другой — как в разделе «Чеки».
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.sk-period-wrap')) setShowPeriod(false);
      if (!e.target.closest('.sk-dd-wrap')) {
        document.querySelectorAll('.sk-dd-wrap.open').forEach(w => w.classList.remove('open'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);
  const [typeFilter, setTypeFilterRaw] = useState(null);
  var setTypeFilter = function(t) { setTypeFilterRaw(t); };

  const txs = transactions || [];

  // Взнос/вывод своих денег собственника — двигает баланс счета, но НЕ считается доходом/расходом
  const isOwner = (t) => {
    if (t && (t.kind === 'owner_deposit' || t.kind === 'owner_withdraw')) return true;
    const d = (t && t.description) || '';
    return d.startsWith('Взнос своих денег') || d.startsWith('Вывод своих денег');
  };

  // Фильтр по дате
  var dateFilter = function(tx) {
    if (period === 'all') return true;
    var d = (tx.date || tx.created_at || '').split('T')[0];
    if (period === 'today') return d === new Date().toISOString().split('T')[0];
    if (period === 'yesterday') { var y = new Date(); y.setDate(y.getDate()-1); return d === y.toISOString().split('T')[0]; }
    if (period === 'week') { var w = new Date(); w.setDate(w.getDate()-7); return d >= w.toISOString().split('T')[0]; }
    if (period === 'custom') return d >= periodFrom && d <= periodTo;
    return true;
  };
  const filtered = txs.filter(function(tx){return dateFilter(tx) && (!typeFilter || (tx.type===typeFilter && !isOwner(tx))) && (!search || (tx.description||"").toLowerCase().includes(search.toLowerCase()))});

  // Время операции: реальный момент создания (created_at) в часовом поясе настроек программы
  const fmtTime = function(tx) {
    try {
      var src = tx.created_at || ((tx.date || '').indexOf('T') >= 0 ? tx.date : null);
      var dt = src ? new Date(src) : new Date();
      if (isNaN(dt.getTime())) return '—';
      return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: getSettingsTz() });
    } catch (e) { return '—'; }
  };

  var exportCsv = function(list) {
    // CSV разделяется запятыми — числа без разделителей тысяч (точка для дробной части), валюта по настройкам
    var rows = [['Дата','Название','Сумма','Счет','Категория']];
    list.forEach(function(tx){
      rows.push([(tx.date||tx.created_at||'').split('T')[0],tx.description||'',(tx.type==='income'?'+':'-')+Number(tx.amount||0).toFixed(2)+' '+cur,(accs.find(function(a){return a.id===tx.account_id})?.name)||tx.account_name||'',(cats.find(c => c && c.id === tx.category_id)?.name)||'']);
    });
    var csv = rows.map(function(r){return r.join(',')}).join('\n');
    var blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'transactions.csv'; a.click();
  };

  var accs = accounts || [];
  var accBalance = {};
  accs.forEach(function(a){ accBalance[a.id] = parseFloat(a.balance)||0; });
  txs.forEach(function(t){ if (t.account_id && accBalance[t.account_id] !== undefined) { accBalance[t.account_id] += Number(t.amount||0) * (t.type==='income'?1:-1); } });
  const accIcons = { cash:'💵', card:'💳', transfer:'🔄', checking:'🏦', bank:'🏛️', electronic:'🌐', reserve:'🔒', deposit:'📜' };
  const cats = categories || [];

  // Внутреннее перемещение денег (перевод/инкассация) — по метке kind, для старых данных запасной вариант по названию
  const isTransfer = (t) => {
    if (t && t.kind === 'transfer') return true;
    if (t && t.kind === 'collection') return true;
    const d = (t && t.description) || '';
    const c = cats.find(x => x && x.id === t.category_id);
    const catName = c ? c.name : '';
    return d.startsWith('Перевод со счета') || d.startsWith('Перевод на счет') || d.startsWith('Инкассация') || catName === 'Перевод между счетами' || catName === 'Инкассация';
  };
  const incomeTotal = filtered.filter(t => t && t.type === 'income' && (t.status === 'paid' || !t.status) && !isTransfer(t) && !isOwner(t)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  // Разбивка поступлений: выручка от продаж (категория «Доход от продаж»/смены/чеки) и прочие доходы
  const saleCatTxId = ((cats || []).find(c => c && c.type === 'income' && c.name === 'Доход от продаж') || {}).id || null;
  const salesIncome = filtered.filter(t => t && t.type === 'income' && (t.status === 'paid' || !t.status) && !isTransfer(t) && !isOwner(t) && ((saleCatTxId && String(t.category_id) === String(saleCatTxId)) || (t.description || '').indexOf('Кассовая смена') === 0 || (t.description || '').indexOf('по чеку') >= 0)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const otherIncomeTx = Math.max(0, incomeTotal - salesIncome);
  const expenseTotal = filtered.filter(t => t && t.type !== 'income' && (t.status === 'paid' || !t.status) && !isTransfer(t) && !isOwner(t)).reduce((s, t) => s + (Number(t.amount) || 0), 0);

  // --- Структура доходов/расходов по категориям (для круга и легенды) ---
  const txIncomeList = filtered.filter(t => t && t.type === 'income' && (t.status === 'paid' || !t.status) && !isTransfer(t) && !isOwner(t));
  const txExpenseList = filtered.filter(t => t && t.type !== 'income' && (t.status === 'paid' || !t.status) && !isTransfer(t) && !isOwner(t));
  const buildCatBreakdown = (list, total) => {
    const map = new Map();
    list.forEach(t => {
      const nm = (cats.find(x => x && x.id === t.category_id) || {}).name
        || ((t.description || '').indexOf('Кассовая смена') === 0 || (t.description || '').indexOf('по чеку') >= 0 ? 'Выручка от продаж' : null)
        || 'Без категории';
      map.set(nm, (map.get(nm) || 0) + (Number(t.amount) || 0));
    });
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  };
  const incomeCatsList = buildCatBreakdown(txIncomeList, incomeTotal);
  const expenseCatsList = buildCatBreakdown(txExpenseList, expenseTotal);
  const txProfit = Math.max(0, incomeTotal - expenseTotal);
  const txMargin = incomeTotal > 0 ? Math.round(Math.max(0, incomeTotal - expenseTotal) / incomeTotal * 100) : 0;
  const INC_COLORS = ['#1F75FF', '#4a92ff', '#74aefe', '#a9c8ff', '#cfe2ff'];
  const EXP_COLORS = ['#ffcf2e', '#ffdd2d', '#ffe680', '#fff2b8', '#fff9db'];
  const txRingSegs = [
    ...incomeCatsList.map((c, i) => ({ ...c, color: INC_COLORS[i % INC_COLORS.length], side: 'inc' })),
    ...expenseCatsList.map((c, i) => ({ ...c, color: EXP_COLORS[i % EXP_COLORS.length], side: 'exp' })),
  ].filter(s => s.amount > 0);
  // Дуги круга: доходы занимают свои 100% (половина круга), расходы — свои 100% (вторая половина).
  // Внутри каждой группы сегменты нормируются на её итог — «одна категория дохода» = 100% группы.
  const txIncDeg = (incomeTotal > 0 && expenseTotal > 0) ? 180 : 360;
  let txAccDeg = 0;
  const txRingStops = txRingSegs.map(s => {
    const span = s.side === 'inc'
      ? (incomeTotal ? s.amount / incomeTotal : 0) * txIncDeg
      : (expenseTotal ? s.amount / expenseTotal : 0) * (360 - txIncDeg);
    const from = txAccDeg / 360 * 100;
    txAccDeg += span;
    const to = txAccDeg / 360 * 100;
    return s.color + ' ' + from.toFixed(2) + '% ' + to.toFixed(2) + '%';
  }).join(', ');
  const sales = txs.filter(t => t && t.type === 'sale' && !isTransfer(t) && !isOwner(t));
  const avgCheck = sales.length ? Math.round(sales.reduce((s, t) => s + (Number(t.amount) || 0), 0) / sales.length) : 0;
  const balanceTotal = accs.reduce((s, a) => s + (accBalance[a.id] || 0), 0);

  const seed = async () => {
    try {
      if (accs.length === 0) {
        await supabase.from('accounts').insert([
          { user_id: user.id, name: 'Наличные', type: 'cash' },
        ]);
      }
      if (cats.length === 0) {
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
      refreshAccounts();
      refreshCategories();
    } catch (e) { console.error(e); }
  };


  // Сброс всех полей форм операции (доход/расход)
  const resetForms = function() {
    setIncName(''); setIncAmount(''); setIncDate(new Date().toISOString().split('T')[0]); setIncCategory('');
    setExpName(''); setExpAmount(''); setExpDate(new Date().toISOString().split('T')[0]); setExpCategory('');
  };

  const catNameById = (id) => { const c = (cats || []).find(x => x.id === id); return c ? c.name : ''; };

  // Прямое сохранение дохода/расхода с выбранным в форме счетом (без промежуточной модалки)
  const doTx = async (txData) => {
    try {
      let list = accs;
      if (list.length === 0) {
        await supabase.from('accounts').insert([{ user_id: user.id, name: 'Наличные', type: 'cash' }]);
        const r = await refreshAccounts();
        list = r || [];
      }
      const acct = list.find(a => a && String(a.id) === String(selectedAcc)) || list[0];
      if (!acct) { alert('Нет доступных счетов. Сначала создайте счет в разделе «Счета».'); return; }
      if (txData.type === 'expense') {
        const curBal = accBalance[acct.id] || 0;
        if (txData.amount > curBal) {
          alert('На счете «' + acct.name + '» недостаточно средств (доступно ' + Math.round(curBal).toLocaleString() + ' ' + cur + ').\nВыберите другой счет.');
          return;
        }
      }
      await add({ ...txData, account_id: acct.id });
      setShowIncome(false);
      setShowExpense(false);
      setEditingId(null);
      resetForms();
      setToast((txData.type === 'income' ? 'Доход' : 'Расход') + ' успешно добавлен!');
    } catch (err) { alert(err.message); }
  };

  const submitIncome = (e) => {
    e.preventDefault();
    if (!incAmount) { alert('Введите сумму'); return; }
    setPendingTx({
      id: editingId,
      type: 'income', user_id: user.id,
      description: incName, amount: parseFloat(incAmount),
      date: incDate, category_id: incCategory || null,
    });
    setSelectedAcc(accs.length > 0 ? accs[0].id : null);
    setSplitMode(false);
    setSplitAmounts({});
    setShowAccSelect(true);
  };

  const submitExpense = (e) => {
    e.preventDefault();
    if (!expAmount) { alert('Введите сумму'); return; }
    setPendingTx({
      id: editingId,
      type: 'expense', user_id: user.id,
      description: expName, amount: parseFloat(expAmount),
      date: expDate, category_id: expCategory || null,
    });
    setSelectedAcc(accs.length > 0 ? accs[0].id : null);
    setSplitMode(false);
    setSplitAmounts({});
    setShowAccSelect(true);
  };

  const confirmTx = async () => {
    if (!pendingTx) return;
    try {
      var isEdit = !!pendingTx.id;
      var txData = { account_id: null, user_id: pendingTx.user_id, amount: pendingTx.amount, description: pendingTx.description, date: pendingTx.date, category_id: pendingTx.category_id, type: pendingTx.type };
      if (splitMode) {
        // Проверка: сумма по счетам должна совпадать с суммой операции
        var splitSum = accs.reduce(function(s,a){return s + (parseFloat(splitAmounts[a.id])||0);},0);
        if (Math.abs(splitSum - pendingTx.amount) > 0.01) {
          alert('Сумма по счетам (' + Math.round(splitSum).toLocaleString() + ' ₽) не совпадает с суммой операции (' + Math.round(pendingTx.amount).toLocaleString() + ' ₽)');
          return;
        }
        for (const a of accs) {
          var amt = splitAmounts[a.id] || 0;
          if (amt > 0) {
            if (isEdit) await update(pendingTx.id, { ...txData, account_id: a.id, amount: amt });
            else await add({ ...txData, account_id: a.id, amount: amt });
          }
        }
      } else {
        if (accs.length === 0) {
          await supabase.from('accounts').insert([
            { user_id: user.id, name: 'Наличные', type: 'cash' },
          ]);
          var r = await refreshAccounts();
          accs = r || [];
        }
        var acct = accs.find(a => a?.id === selectedAcc) || accs[0];
        if (!acct) {
          alert('Нет доступных счетов. Сначала создайте счет в разделе "Финансовые счета".');
          return;
        }
        // Защита от ухода в минус: списать можно только в пределах баланса счета.
        // Если не хватает — разделите сумму на несколько счетов или выберите другой счет.
        if (pendingTx.type === 'expense') {
          var curBal = accBalance[acct.id] || 0;
          if (pendingTx.amount > curBal) {
            alert('На счете «' + acct.name + '» недостаточно средств (доступно ' + Math.round(curBal).toLocaleString() + ' ' + cur + ').\nРазделите сумму на несколько счетов (кнопка «+ Разделить») или выберите другой счет.');
            return;
          }
        }
        if (isEdit) await update(pendingTx.id, { ...txData, account_id: acct.id });
        else await add({ ...txData, account_id: acct.id });
      }
      setShowAccSelect(false);
      setPendingTx(null);
      setShowIncome(false);
      setShowExpense(false);
      setIncName('');
      setIncAmount('');
      setIncDate(new Date().toISOString().split('T')[0]);
      setIncCategory('');
      setExpName('');
      setExpAmount('');
      setExpDate(new Date().toISOString().split('T')[0]);
      setExpCategory('');
      if (isEdit) { setToast('Сумма успешно изменена!'); }
      else { setToast((pendingTx.type === 'income' ? 'Доход' : 'Расход') + ' успешно добавлен!'); }
    } catch (err) { alert(err.message); }
  };

  
  const editTx = function(tx) {
    var isExp = tx.type !== 'income';
    setEditingId(tx.id);setTxAccountId(tx.account_id || null);setOrigAmount(tx.amount);
    if (isExp) {
      setExpName(tx.description || '');
      setExpAmount(String(tx.amount || ''));
      setExpDate(tx.date || '');
      setExpCategory(tx.category_id || '');
      setShowExpense(true);
    } else {
      setIncName(tx.description || '');
      setIncAmount(String(tx.amount || ''));
      setIncDate(tx.date || '');
      setIncCategory(tx.category_id || '');
      setShowIncome(true);
    }
  };
  // Служебные категории (перевод между счетами, инкассация) не предлагаем в выборе —
  // это не доход и не расход бизнеса, а перемещение своих денег
  const SERVICE_CATS = ['Перевод между счетами', 'Инкассация'];
  const isServiceCat = (c) => c && SERVICE_CATS.indexOf(c.name) !== -1;
  const incomeCats = cats.filter(c => c?.type === 'income' && !isServiceCat(c));
  const expenseCats = cats.filter(c => (c?.type === 'expense' || c?.type === 'supply_expense') && !isServiceCat(c));
  if (dataError) return (
    <div className="empty-products" style={{marginTop:'1rem'}}>
      <div style={{fontSize:'2rem',marginBottom:'.5rem'}}>⚠️</div>
      <p>{dataError}</p>
      <button onClick={()=>{setDataError(null);refresh()}}
        style={{marginTop:'.75rem',padding:'.5rem 1.2rem',borderRadius:'100px',border:'none',background:'#000',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:'.82rem',fontFamily:'inherit'}}>Повторить</button>
    </div>
  );
   if (loading) return <CenterSpinner />;
   return (
    <div>
      <div className="sk-bar">
        <div className="grow">
          <div style={{display:'flex',alignItems:'center'}}>
            <h1>Доходы и расходы</h1>
            <SectionHelp
              title="Раздел «Доходы и расходы»"
              intro="Все поступления, списания и переводы между счетами."
              faq={[
                { q: 'С чего начать работу? (по шагам)', a: (
                  <ol style={{paddingLeft:'1.15rem',margin:0}}>
                    <li style={{marginBottom:'.5rem'}}>Нажмите кнопку <b>«Добавить ▾»</b> справа вверху — откроется меню.</li>
                    <li style={{marginBottom:'.5rem'}}>Выберите <b>«Добавить расход»</b> — деньги списываются со счета, категория уходит в расходы.</li>
                    <li style={{marginBottom:'.5rem'}}>Или <b>«Добавить доход»</b> — поступление на счет, категория в доходы.</li>
                    <li>Нужно перекинуть деньги между своими счетами — <b>«Перевод между счетами»</b>. Это не доход и не расход бизнеса.</li>
                  </ol>
                ) },
                { q: 'Что означает каждая кнопка на странице?', a: (
                  <ul>
                    <li><b>Добавить ▾</b> — меню со всеми операциями: доход, расход, перевод, свои деньги.</li>
                    <li><b>Плашки сверху</b> — доходы, расходы, баланс счетов и прибыль за выбранный период.</li>
                    <li><b>Строка операции</b> — дата, время, название, сумма, счет и категория.</li>
                    <li><b>⋯ в строке</b> — редактировать или удалить операцию.</li>
                    <li><b>?</b> — эта справка.</li>
                  </ul>
                ) },
                { q: 'Что такое «Взнос / вывод своих денег»?', a: (
                  <p>Это личные деньги владельца: взнос — когда вкладываете свои средства в бизнес, вывод — когда забираете. Такие операции <b>не считаются</b> доходом или расходом бизнеса и не входят в прибыль.</p>
                ) },
                { q: 'Чем перевод отличается от расхода?', a: (
                  <p><b>Перевод</b> — деньги переходят между вашими счетами, общий баланс не меняется. <b>Расход</b> — деньги уходят из бизнеса, баланс уменьшается. Перевод в прибыли не участвует.</p>
                ) },
              ]}
            />
          </div>
          <div className="sub">Поступления, списания и переводы между счетами</div>
        </div>
        <div className="sk-bar-acts">
          <div className="sk-dd-wrap" style={{position:'relative'}}>
            <button className="sk-dd-btn" onClick={function(e){e.stopPropagation();document.querySelectorAll('.sk-dd-wrap.open').forEach(function(w){w.classList.remove('open')});e.currentTarget.parentElement.classList.toggle('open')}}>Добавить <span className="car">▾</span></button>
            <div className="sk-dd-menu" style={{minWidth:'260px'}}>
              {[{
                label:'Добавить расход', sub:'Списание средств',
                act:function(){setEditingId(null);resetForms();openExpense()}
              },{
                label:'Добавить доход', sub:'Поступление средств',
                act:function(){setEditingId(null);resetForms();openIncome()}
              },{
                label:'Перевод между счетами', sub:'Перемещение средств',
                act:function(){setTrFrom(accs.length > 0 ? accs[0].id : '');setTrTo(accs.length > 1 ? accs[1].id : '');setTrAmt('');setShowTransfer(true)}
              },{
                label:'Взнос / вывод своих денег', sub:'Личные деньги владельца',
                act:function(){setOwnerMode('deposit');setOwnerAcct(accs.length?accs[0].id:'');setOwnerAmt('');setOwnerDesc('');setShowOwner(true)}
              }].map(function(o){
                return (
                  <button key={o.label} type="button" onClick={function(e){e.currentTarget.closest('.sk-dd-wrap').classList.remove('open');o.act()}} style={{display:'block',padding:'10px 12px'}}>
                    <span style={{display:'block',fontSize:'13px',fontWeight:600,color:'#040506'}}>{o.label}</span>
                    <span style={{display:'block',fontSize:'11px',color:'#8a93a2',marginTop:'2px'}}>{o.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      {/* Панель фильтров — одна капсула, как в «Чеках» */}
      <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap',border:'1px solid '+(searchFocus?'#111':'#e2e2e6'),borderRadius:'999px',padding:'5px 6px 5px 14px',background:'#fff',boxShadow:searchFocus?'0 2px 10px rgba(0,0,0,.12)':'0 1px 3px rgba(0,0,0,.05)',transition:'border-color .15s, box-shadow .15s'}}
        onFocus={()=>setSearchFocus(true)} onBlur={()=>setSearchFocus(false)}>
          <span style={{display:'flex',color:searchFocus?'#111':'#999',transition:'color .15s',flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input type="text" placeholder="Поиск…" value={search} onChange={function(e){setSearch(e.target.value)}}
            autoComplete="off"
            style={{border:'none',outline:'none',flex:'1 1 60px',minWidth:0,width:'100%',fontSize:'.78rem',fontFamily:'var(--font)',background:'none',padding:0}} />
        <span style={{width:'1px',height:'20px',background:'#eef1f6',flexShrink:0}}></span>
        <div className="sk-dd-wrap">
          <button type="button" style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={e=>{e.stopPropagation();setShowPeriod(false);setShowDownload(false);const w=e.currentTarget.parentElement;w.classList.toggle('open')}}>{typeFilter === 'income' ? 'Доходы' : typeFilter === 'expense' ? 'Расходы' : 'Все'} <span className="car-tri">▾</span></button>
          <div className="sk-dd-menu">
            {[
              { v:null, label:'Все' },
              { v:'income', label:'Доходы' },
              { v:'expense', label:'Расходы' },
            ].map(o => (
              <button key={String(o.v)} type="button"
                style={typeFilter===o.v?{background:'#E6F0FF',color:'#0d4ea8',fontWeight:700}:undefined}
                onClick={e=>{e.currentTarget.closest('.sk-dd-wrap').classList.remove('open');setTypeFilter(o.v)}}>{o.label}</button>
            ))}
          </div>
        </div>
        <div className="sk-period-wrap" style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <button style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={e=>{e.stopPropagation();document.querySelectorAll('.sk-dd-wrap.open').forEach(w=>w.classList.remove('open'));setShowDownload(false);setShowPeriod(!showPeriod)}}>
            {periodLabel}
            <span className="car-tri">▾</span>
          </button>
          {showPeriod && (
            <div onClick={e=>e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'210px',padding:'.4rem',zIndex:100}}>
              {[{key:'all',label:'Все время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Эта неделя'}].map(p=>{
                const isActive = period === p.key;
                return (
                  <div key={p.key} onClick={()=>{setPeriod(p.key);setPeriodLabel(p.label);setShowPeriod(false)}}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.5rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                    {p.label}
                  </div>
                );
              })}
              <div style={{borderTop:'1px solid rgba(29,120,252,.14)',paddingTop:'.4rem',marginTop:'.25rem'}}>
                <div style={{fontSize:'.72rem',color:'#5b6472',padding:'.2rem .55rem',marginBottom:'.3rem',fontWeight:600}}>Свой период</div>
                <div style={{display:'flex',gap:'.3rem',padding:'.2rem .55rem'}}>
                  <input type="date" value={periodFrom} onChange={e=>setPeriodFrom(e.target.value)} style={{flex:1,minWidth:0,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                  <input type="date" value={periodTo} onChange={e=>setPeriodTo(e.target.value)} style={{flex:1,minWidth:0,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                </div>
                <div style={{padding:'.3rem .55rem 0',textAlign:'center'}}>
                  <button onClick={()=>{if(!periodFrom||!periodTo)return alert('Выберите обе даты');setPeriod('custom');setPeriodLabel(periodFrom.split('-').reverse().join('.')+' — '+periodTo.split('-').reverse().join('.'));setShowPeriod(false)}}
                    className="sk-dd-btn" style={{padding:'.5rem 1.1rem'}}>Применить</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <button type="button" title="Скачать" aria-label="Скачать"
            style={{width:'26px',height:'26px',flexShrink:0,border:'none',borderRadius:'100px',background:'linear-gradient(135deg,#1F75FF,#0d4ea8)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',boxShadow:'0 8px 18px -8px rgba(29,120,252,.8)',transition:'transform .15s',animation:'skpulse 2s ease-in-out infinite'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.animationPlayState='paused'}}
            onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.animationPlayState='running'}}
            onClick={e=>{e.stopPropagation();setShowDownload(!showDownload);setShowPeriod(false)}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
          </button>
          {showDownload && (
            <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'230px',padding:'.5rem',zIndex:100}}>
              <div style={{fontSize:'.72rem',color:'#9aa3b0',marginBottom:'.5rem',padding:'0 .25rem'}}>
                Вы скачиваете отчет за <b>{periodLabel.toLowerCase()}</b>.
              </div>
              <div style={{display:'flex',gap:'.35rem',justifyContent:'center'}}>
                <span onClick={()=>{exportCsv(filtered);setShowDownload(false)}}
                  style={{padding:'.4rem .8rem',fontSize:'.75rem',fontWeight:600,borderRadius:'100px',cursor:'pointer',background:'#111',color:'#fff',border:'none',fontFamily:'var(--font)'}}>Скачать</span>
                <span onClick={()=>{setShowDownload(false);setShowPeriod(true)}}
                  style={{padding:'.4rem .8rem',fontSize:'.75rem',borderRadius:'100px',cursor:'pointer',background:'transparent',border:'1px solid rgba(29,120,252,.22)',color:'#1567d8',fontFamily:'var(--font)'}}>Изменить даты</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!loading && (
        <div className="tx-card">
          <div className="tx-ring-block">
            <div className="tx-ring" style={{background: txRingStops ? 'conic-gradient(' + txRingStops + ')' : '#eef4ff'}}>
              {txRingSegs.map((s, i) => {
                const total = s.side === 'inc' ? incomeTotal : expenseTotal;
                const spanDeg = total ? (s.amount / total) * (s.side === 'inc' ? txIncDeg : (360 - txIncDeg)) : 0;
                const beforeDeg = txRingSegs.slice(0, i).reduce((x, y) => {
                  const t = y.side === 'inc' ? incomeTotal : expenseTotal;
                  return x + (t ? (y.amount / t) * (y.side === 'inc' ? txIncDeg : (360 - txIncDeg)) : 0);
                }, 0);
                const ang = (beforeDeg + spanDeg / 2) - 90;
                const rad = ang * Math.PI / 180;
                const x = Math.round(Math.cos(rad) * 56);
                const y = Math.round(Math.sin(rad) * 56);
                const pct = total ? Math.round(s.amount / total * 100) : 0;
                if (pct < 4) return null;
                return <span key={i} className="tx-ring-pct" style={{left:'calc(50% + '+x+'px)', top:'calc(50% + '+y+'px)', background:s.side === 'inc' ? '#1F75FF' : '#ffcf2e', color:s.side === 'inc' ? '#fff' : '#111'}}>{pct}%</span>;
              })}
              <div className="in">
                <div className="t">Прибыль</div>
                <div className="v">{(incomeTotal - expenseTotal) >= 0 ? '+' : ''}{(incomeTotal - expenseTotal).toLocaleString()} {cur}</div>
              </div>
            </div>
            <div className={'tx-legend' + (txRingOpen ? '' : ' tx-collapse')}>
              <div className="tx-grp-h"><span className="dot" style={{width:'11px',height:'11px',borderRadius:'3px',background:'#1F75FF'}}></span>Доходы<span className="grp-amt">+{incomeTotal.toLocaleString()} {cur}</span></div>
              <div className="tx-sub">
                {incomeCatsList.length === 0 && <div style={{fontSize:'.78rem',color:'var(--sk-muted)'}}>Нет доходов за период</div>}
                {incomeCatsList.map((c, i) => (
                  <div key={i}>
                    <div className="tx-leg"><span className="dot" style={{background:INC_COLORS[i % INC_COLORS.length]}}></span><span className="nm">{c.name}</span><span className="pct">{incomeTotal ? Math.round(c.amount / incomeTotal * 100) : 0}%</span><span className="amt">+{c.amount.toLocaleString()} {cur}</span></div>
                    <div className="tx-leg-bar"><i style={{width:(incomeTotal ? c.amount / incomeTotal * 100 : 0) + '%', background:INC_COLORS[i % INC_COLORS.length]}}></i></div>
                  </div>
                ))}
              </div>
              <div className="tx-grp-h"><span className="dot" style={{width:'11px',height:'11px',borderRadius:'3px',background:'#ffcf2e'}}></span>Расходы<span className="grp-amt">−{expenseTotal.toLocaleString()} {cur}</span></div>
              <div className="tx-sub">
                {expenseCatsList.length === 0 && <div style={{fontSize:'.78rem',color:'var(--sk-muted)'}}>Нет расходов за период</div>}
                {expenseCatsList.map((c, i) => (
                  <div key={i}>
                    <div className="tx-leg"><span className="dot" style={{background:EXP_COLORS[i % EXP_COLORS.length]}}></span><span className="nm">{c.name}</span><span className="pct">{expenseTotal ? Math.round(c.amount / expenseTotal * 100) : 0}%</span><span className="amt">−{c.amount.toLocaleString()} {cur}</span></div>
                    <div className="tx-leg-bar"><i style={{width:(expenseTotal ? c.amount / expenseTotal * 100 : 0) + '%', background:EXP_COLORS[i % EXP_COLORS.length]}}></i></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {(incomeCatsList.length > 2 || expenseCatsList.length > 2) && (
            <div className="tx-toggle-row">
              <button type="button" className={'tx-toggle' + (txRingOpen ? ' open' : '')} onClick={() => setTxRingOpen(!txRingOpen)}>
                <span className="car">▾</span><span>{txRingOpen ? 'Свернуть категории' : 'Раскрыть категории'}</span>
              </button>
            </div>
          )}
        </div>
      )}



      {txs.length > 0 ? (
        <div className="sk-tablewrap">
          <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
          <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}} data-arrow="top"></div>
          <div className="sk-card" style={{position:'relative',flex:1,overflowX:'auto',overflowY:'auto',WebkitOverflowScrolling:'touch',minHeight:0}} ref={tblElRef} onScroll={onTblScroll}>
          <table className="sk-table sk-tx-table">
            <thead id="colHeaders">
              <tr>
                <th style={{textAlign:'left'}}>Дата</th>
                <th style={{textAlign:'left'}}>Время</th>
                <th style={{textAlign:'left'}}>Название</th>
                <th style={{textAlign:'left'}}>Сумма</th>
                <th style={{textAlign:'left'}}>Счет</th>
                <th style={{textAlign:'left'}}>Категория</th>
                <th style={{textAlign:'left'}}>Автор</th>
                <th className="actions"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id}>
                  <td style={{textAlign:'left'}}>{tx.date ? ((tx.date||'').split('T')[0]||'').split('-').reverse().join('.') : '—'}</td>
                  <td style={{textAlign:'left'}}>{fmtTime(tx)}</td>
                  <td style={{textAlign:'left'}}>{tx.description || '—'}{tx.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</td>
                  <td style={{textAlign:'left'}}>{tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()} {cur}</td>
                  <td style={{textAlign:'left'}}>{(accs.find(a => a.id === tx.account_id)?.name) || tx.account_name || '—'}</td>
                  <td style={{textAlign:'left'}}>{(cats.find(c => c && c.id === tx.category_id)?.name) || '—'}</td>
                  <td style={{textAlign:'left'}}>{userMap[tx.user_id] || '—'}</td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    <div className="prod-more-wrap" style={{display:'inline-block',position:'relative'}}>
                      <button className="sk-more" onClick={function(e){
                        e.stopPropagation();
                        var el = e.currentTarget.nextElementSibling;
                        el.classList.add('open');
                        var h = function(){el.classList.remove('open'); document.removeEventListener('click',h)};
                        setTimeout(function(){document.addEventListener('click',h)}, 10);
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={function(){editTx(tx)}}>Редактировать</button>
                        <button onClick={async function(){await remove(tx.id);setToast('Транзакция успешно удалена!')}} style={{color:'#dc3545'}}>Удалить</button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="sk-card"><div className="sk-empty">История операций пуста</div></div>
      )}
      <Modal open={showTransfer} onClose={()=>setShowTransfer(false)} title="Перевод между счетами" subtitle="Перемещение средств со счета на счет" width="medium">
            <form onSubmit={async function(e){
              e.preventDefault();
              if (!trAmt||parseFloat(trAmt)<=0) {alert('Введите сумму');return;}
              var amt=parseFloat(trAmt);
              try {
                var fr=accs.find(function(a){return a.id===trFrom}), to=accs.find(function(a){return a.id===trTo});
                if (!fr||!to) {alert('Выберите оба счета');return;}
                var frBal = accBalance[fr.id] || 0;
                if (amt > frBal) { alert('Недостаточно средств на счете «' + fr.name + '». Баланс: ' + Math.round(frBal).toLocaleString() + ' ₽'); return; }
                // Найти или создать категорию «Перевод между счетами»
                var trCatId = null;
                var { data: foundCat } = await supabase.from('categories').select('id').eq('user_id', user.id).eq('name', 'Перевод между счетами').maybeSingle();
                if (foundCat) { trCatId = foundCat.id; }
                else {
                  var { data: newCat } = await supabase.from('categories').insert({
                    user_id: user.id, name: 'Перевод между счетами', type: 'income'
                  }).select('id').maybeSingle();
                  if (newCat) trCatId = newCat.id;
                }
                await supabase.from('transactions').insert([
                  {user_id:user.id,account_id:fr.id,type:'expense',amount:amt,description:'Перевод со счета '+fr.name,date:new Date().toISOString().split('T')[0],category_id:trCatId,kind:'transfer',transfer_id:Date.now()},
                  {user_id:user.id,account_id:to.id,type:'income',amount:amt,description:'Перевод на счет '+to.name,date:new Date().toISOString().split('T')[0],category_id:trCatId,kind:'transfer',transfer_id:Date.now()}
                ]);
                setShowTransfer(false); setTrAmt(''); await refresh();
                setToast('Перевод успешно выполнен!');
              } catch(err) {alert(err.message);}
            }}>
              <div className="form-group">
                <label>С какого счета списать</label>
                <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
                  {accs.length === 0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет счетов</div>}
                  {accs.map(function(a){
                    const sel=String(a.id)===String(trFrom);
                    return (
                      <div key={a.id} onClick={function(){setTrFrom(a.id);if(String(a.id)===String(trTo))setTrTo('')}}
                        style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#E6F0FF':'#fff',border:'1.5px solid '+(sel?'#1F75FF':'rgba(0,0,0,.26)')}}>
                        <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(sel?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:sel?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                        <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                        <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(accBalance[a.id]||0).toLocaleString()} {cur}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label>На какой счет зачислить</label>
                <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
                  {accs.filter(function(a){return String(a.id)!==String(trFrom)}).length===0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет счетов</div>}
                  {accs.filter(function(a){return String(a.id)!==String(trFrom)}).map(function(a){
                    const sel=String(a.id)===String(trTo);
                    return (
                      <div key={a.id} onClick={function(){setTrTo(a.id)}}
                        style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#E6F0FF':'#fff',border:'1.5px solid '+(sel?'#1F75FF':'rgba(0,0,0,.26)')}}>
                        <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(sel?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:sel?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                        <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                        <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(accBalance[a.id]||0).toLocaleString()} {cur}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label>Сумма </label>
                <input type="number" placeholder="0" min="0" step="0.01" value={trAmt} onChange={function(e){setTrAmt(e.target.value)}} required />
              </div>
              <div className="modal-actions">
                <button type="submit" className="sk-dd-btn">Сохранить</button>
              </div>
            </form>
      </Modal>
      {/* Модалка «Свои деньги владельца»: взнос/вывод — не влияет на прибыль */}
      <Modal open={showOwner} onClose={()=>setShowOwner(false)} title="Собственные средства предпринимателя" subtitle="Личные средства — не считаются доходом и не влияют на прибыль" width="medium">
            <form onSubmit={async function(e){
              e.preventDefault();
              const amt = parseFloat(ownerAmt);
              if (!amt || amt <= 0) return alert('Введите сумму');
              const acct = accs.find(a => a.id === ownerAcct);
              if (!acct) return alert('Выберите счет');
              // Нельзя вывести больше, чем есть на счете
              if (ownerMode === 'withdraw') {
                const bal = accBalance[acct.id] || 0;
                if (amt > bal) return alert('Недостаточно средств на счете «' + acct.name + '». Доступно: ' + Math.round(bal).toLocaleString() + ' ' + cur);
              }
              try {
                const isDeposit = ownerMode === 'deposit';
                await add({
                  user_id: user.id,
                  account_id: acct.id,
                  type: isDeposit ? 'income' : 'expense',
                  amount: amt,
                  description: (isDeposit ? 'Взнос своих денег' : 'Вывод своих денег') + (ownerDesc.trim() ? ' — ' + ownerDesc.trim() : ''),
                  date: new Date().toISOString().split('T')[0],
                  kind: isDeposit ? 'owner_deposit' : 'owner_withdraw',
                  category_id: null,
                });
                setShowOwner(false); setOwnerAmt(''); setOwnerDesc('');
                setToast((isDeposit ? 'Взнос' : 'Вывод') + ' своих денег: ' + amt.toLocaleString() + ' ' + cur);
              } catch(err) { alert('Ошибка: ' + err.message); }
            }}>
              <div className="form-group">
                <label>Операция</label>
                <div style={{display:'flex',gap:'.5rem'}}>
                  <button type="button" onClick={()=>setOwnerMode('deposit')} style={{flex:1,padding:'.6rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:ownerMode==='deposit'?'none':'1.5px solid #e8e8ec',background:ownerMode==='deposit'?'linear-gradient(135deg,#1F75FF,#0d4ea8)':'#fff',color:ownerMode==='deposit'?'#fff':'#888',transition:'all .12s'}}>Взнос (доложить)</button>
                  <button type="button" onClick={()=>setOwnerMode('withdraw')} style={{flex:1,padding:'.6rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:ownerMode==='withdraw'?'none':'1.5px solid #e8e8ec',background:ownerMode==='withdraw'?'linear-gradient(135deg,#1F75FF,#0d4ea8)':'#fff',color:ownerMode==='withdraw'?'#fff':'#888',transition:'all .12s'}}>Вывод (забрать)</button>
                </div>
              </div>
              <div className="form-group">
                <label>Счет</label>
                <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
                  {accs.length === 0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет счетов</div>}
                  {accs.map(function(a){
                    const sel = String(a.id) === String(ownerAcct);
                    return (
                      <div key={a.id} onClick={()=>setOwnerAcct(a.id)}
                        style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#E6F0FF':'#fff',border:'1.5px solid '+(sel?'#1F75FF':'rgba(0,0,0,.26)')}}>
                        <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(sel?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:sel?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                        <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                        <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(accBalance[a.id]||0).toLocaleString()} {cur}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label>Сумма</label>
                <input type="number" min="0" step="0.01" value={ownerAmt} onChange={e=>setOwnerAmt(e.target.value)} placeholder="0" autoFocus />
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <input type="text" value={ownerDesc} onChange={e=>setOwnerDesc(e.target.value)} placeholder="Например: аренда за сентябрь" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="sk-dd-btn">Сохранить</button>
              </div>
            </form>
      </Modal>
      <Modal open={showIncome} onClose={function(){setShowIncome(false);setEditingId(null)}} title={editingId ? "Редактировать доход" : "Добавить доход"} subtitle="Поступление средств" width="medium">

            <form onSubmit={async function(e){
              e.preventDefault();
              if(!incAmount){alert("Введите сумму");return}
              if(editingId){
                var amtChanged = parseFloat(incAmount) !== parseFloat(origAmount);
                if(amtChanged){
                  update(editingId,{description:(incName.trim()||catNameById(incCategory)||'Доход'),amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                  setShowIncome(false);setEditingId(null);resetForms();
                  setPendingTx({id:editingId,type:'income',user_id:user.id,description:(incName.trim()||catNameById(incCategory)||'Доход'),amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                  setSelectedAcc(txAccountId || (accs.length > 0 ? accs[0].id : null));
                } else {
                  update(editingId,{description:(incName.trim()||catNameById(incCategory)||'Доход'),amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                  setShowIncome(false);setEditingId(null);resetForms();
                  setToast('Сумма успешно изменена!');
                }
              }else{
                // Доход добавляется сразу с выбранным в форме счетом (без промежуточной модалки)
                await doTx({type:"income",user_id:user.id,description:(incName.trim()||catNameById(incCategory)||'Доход'),amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
              }
            }}>
              {!editingId && (
              <div className="form-group">
                <label>Тип операции</label>
                <div style={{display:'flex',gap:'.4rem'}}>
                  <button type="button" onClick={function(){setIncCategory('')}}
                    style={{flex:1,padding:'.55rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:'none',background:'linear-gradient(135deg,#1F75FF,#0d4ea8)',color:'#fff',transition:'all .12s'}}>+ Доход</button>
                  <button type="button" onClick={function(){setShowIncome(false);setExpName(incName);setExpAmount(incAmount);setExpDate(incDate);setExpCategory('');setSelectedAcc(accs.length > 0 ? accs[0].id : null);setShowExpense(true)}}
                    style={{flex:1,padding:'.55rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:'1.5px solid #e8e8ec',background:'#fff',color:'#888',transition:'all .12s'}}>− Расход</button>
                </div>
              </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Дата</label>
                  <input type="date" value={incDate} onChange={function(e){setIncDate(e.target.value)}} />
                </div>
                <div className="form-group">
                  <label>Категория</label>
                  <CategorySelect cats={incomeCats} value={incCategory} onChange={setIncCategory} />
                </div>
              </div>
              <div className="form-group">
                <label>Сумма </label>
                <input type="number" placeholder="0" min="0" step="0.01" value={incAmount} onChange={function(e){setIncAmount(e.target.value)}} required />
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <input type="text" placeholder="Например: инвестиции, партнерские, проценты" value={incName} onChange={function(e){setIncName(e.target.value)}} />
              </div>
          <div className="form-group">
            <label>{txKind === 'expense' ? 'С какого счета списать' : 'На какой счет зачислить'}</label>
            <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
              {accs.length === 0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет счетов</div>}
              {accs.map(function(a){
                var sel = String(a.id) === String(selectedAcc);
                return (
                  <div key={a.id} onClick={function(){setSelectedAcc(a.id)}}
                    style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#E6F0FF':'#fff',border:'1.5px solid '+(sel?'#1F75FF':'rgba(0,0,0,.26)')}}>
                    <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(sel?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:sel?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                    <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                    <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(accBalance[a.id]||0).toLocaleString()} {cur}</span>
                  </div>
                );
              })}
            </div>
          </div>
              <div className="modal-actions">
                <button type="submit" className="sk-dd-btn">Сохранить</button>
              </div>
            </form>
      </Modal>

      <Modal open={showExpense} onClose={function(){setShowExpense(false);setEditingId(null)}} title={editingId ? "Редактировать расход" : "Добавить расход"} subtitle="Списание средств" width="medium">
            <form onSubmit={async function(e){
              e.preventDefault();
              if(!expAmount){alert("Введите сумму");return}
              if(editingId){
                var amtChanged = parseFloat(expAmount) !== parseFloat(origAmount);
                if(amtChanged){
                  update(editingId,{description:(expName.trim()||catNameById(expCategory)||'Расход'),amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                  setShowExpense(false);setEditingId(null);resetForms();
                  setPendingTx({id:editingId,type:'expense',user_id:user.id,description:(expName.trim()||catNameById(expCategory)||'Расход'),amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                  setSelectedAcc(txAccountId || (accs.length > 0 ? accs[0].id : null));
                } else {
                  update(editingId,{description:(expName.trim()||catNameById(expCategory)||'Расход'),amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                  setShowExpense(false);setEditingId(null);resetForms();
                  setToast('Сумма успешно изменена!');
                }
              }else{
                // Расход добавляется сразу с выбранным в форме счетом (без промежуточной модалки)
                await doTx({type:"expense",user_id:user.id,description:(expName.trim()||catNameById(expCategory)||'Расход'),amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
              }
            }}>
              {!editingId && (
              <div className="form-group">
                <label>Тип операции</label>
                <div style={{display:'flex',gap:'.4rem'}}>
                  <button type="button" onClick={function(){setShowExpense(false);setIncName(expName);setIncAmount(expAmount);setIncDate(expDate);setIncCategory('');setSelectedAcc(accs.length > 0 ? accs[0].id : null);setShowIncome(true)}}
                    style={{flex:1,padding:'.55rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:'1.5px solid #e8e8ec',background:'#fff',color:'#888',transition:'all .12s'}}>+ Доход</button>
                  <button type="button" onClick={function(){setExpCategory('')}}
                    style={{flex:1,padding:'.55rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:'none',background:'linear-gradient(135deg,#1F75FF,#0d4ea8)',color:'#fff',transition:'all .12s'}}>− Расход</button>
                </div>
              </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Дата</label>
                  <input type="date" value={expDate} onChange={function(e){setExpDate(e.target.value)}} />
                </div>
                <div className="form-group">
                  <label>Категория</label>
                  <CategorySelect cats={expenseCats} value={expCategory} onChange={setExpCategory} />
                </div>
              </div>
              <div className="form-group">
                <label>Сумма </label>
                <input type="number" placeholder="0" min="0" step="0.01" value={expAmount} onChange={function(e){setExpAmount(e.target.value)}} required />
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <input type="text" placeholder="Например: аренда за сентябрь, запчасти на скутер" value={expName} onChange={function(e){setExpName(e.target.value)}} />
              </div>
          <div className="form-group">
            <label>{txKind === 'expense' ? 'С какого счета списать' : 'На какой счет зачислить'}</label>
            <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
              {accs.length === 0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет счетов</div>}
              {accs.map(function(a){
                var sel = String(a.id) === String(selectedAcc);
                return (
                  <div key={a.id} onClick={function(){setSelectedAcc(a.id)}}
                    style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#E6F0FF':'#fff',border:'1.5px solid '+(sel?'#1F75FF':'rgba(0,0,0,.26)')}}>
                    <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(sel?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:sel?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                    <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                    <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(accBalance[a.id]||0).toLocaleString()} {cur}</span>
                  </div>
                );
              })}
            </div>
          </div>
              <div className="modal-actions">
                <button type="submit" className="sk-dd-btn">Сохранить</button>
              </div>
            </form>
      </Modal>
      <Modal open={showAccSelect} onClose={function(){setShowAccSelect(false);setPendingTx(null)}} title={pendingTx && pendingTx.type === "expense" ? "С какого счета списать?" : "На какой счет зачислить?"} subtitle={pendingTx ? (pendingTx.type === "expense" ? "Сумма расхода" : "Сумма дохода") + ": " + Number(pendingTx.amount).toLocaleString() + " " + cur : ""} width="medium">
            <div style={{display:"flex",flexDirection:"column",gap:".35rem",margin:".25rem 0 .5rem"}}>
              {accs.map(function(a){
                var sel = selectedAcc === a.id;
                return (
                  <div key={a.id} onClick={function(){setSelectedAcc(a.id)}}
                    style={{display:"flex",alignItems:"center",gap:".5rem",padding:".6rem .75rem",cursor:"pointer",borderRadius:".6rem",background:sel?"#fff9db":"#fff",border:"1.5px solid "+(sel?"#ffdd2d":"rgba(0,0,0,.26)")}}>
                    <span style={{width:"18px",height:"18px",flexShrink:0,border:"2px solid "+(sel?"#111":"#cfcfd6"),borderRadius:"50%",borderWidth:sel?"6px":"2px",boxSizing:"border-box",display:"inline-block"}} />
                    <span style={{flex:1,fontSize:".875rem",fontWeight:500,color:"#222",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
                    <span style={{fontSize:".875rem",fontWeight:700,color:"#111",whiteSpace:"nowrap"}}>{(accBalance[a.id] || 0).toLocaleString()} {cur}</span>
                  </div>
                );
              })}
              {accs.length === 0 && <div style={{padding:".4rem .25rem",fontSize:".8rem",color:"var(--muted)"}}>Нет счетов. Добавьте в разделе Счета</div>}
            </div>
            {accs.length > 1 && (
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:".35rem",padding:".5rem .75rem",cursor:"pointer",borderRadius:".6rem",border:"1.5px dashed #cfcfd6",fontSize:".78rem",color:"#888",fontWeight:600,transition:"background .12s",marginBottom:".75rem"}}
                onClick={function(){setSplitAmounts({});setSplitMode(!splitMode)}}>{splitMode ? "− Не разделять" : "+ Разделить на несколько счетов"}</div>
            )}
            {splitMode && <div style={{padding:".5rem 0",display:"flex",flexDirection:"column",gap:".35rem",marginBottom:".5rem"}}>
              {accs.map(function(a){
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".1rem .2rem"}}>
                    <span style={{flex:1,fontSize:".875rem",fontWeight:500,color:"#222"}}>{a.name}</span>
                    <span style={{fontSize:".75rem",color:"#888"}}>{(accBalance[a.id] || 0).toLocaleString()} {cur}</span>
                    <input type="number" value={splitAmounts[a.id]||""} onChange={function(e){var v=parseFloat(e.target.value)||0;setSplitAmounts(function(p){var r=Object.assign({},p);r[a.id]=v;return r})}}
                      style={{width:"100px",padding:".35rem .5rem",fontSize:".78rem",border:"1.5px solid rgba(0,0,0,.26)",borderRadius:"8px",outline:"none",textAlign:"right",fontFamily:"var(--font)"}} />
                  </div>
                );
              })}
            </div>}
            <div className="modal-actions">
              <button type="button" onClick={function(){confirmTx()}}
                style={{display:"block",margin:"0 auto",padding:"12px 34px",border:"none",borderRadius:"10px",background:"#111",color:"#fff",fontFamily:"inherit",fontSize:"14px",fontWeight:700,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,.15)",transition:"all .12s"}}
                onMouseEnter={function(e){e.currentTarget.style.background="#000"}}
                onMouseLeave={function(e){e.currentTarget.style.background="#111"}}>
                {(pendingTx ? (pendingTx.type === "expense" ? "Списать" : "Зачислить") : "") + " " + (pendingTx ? Number(pendingTx.amount).toLocaleString() : "0") + " " + cur}
              </button>
            </div>
      </Modal>
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.65rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}
    </div>
  );
}

// Выпадающий список категорий в фирменном стиле (квадрат-чекбокс, поиск не нужен — как в «Товарах»)
function CategorySelect({ cats, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const list = cats || [];
  const sel = list.find(c => String(c.id) === String(value));
  useEffect(() => {
    const h = (e) => { if (!e.target.closest('.cat-sel-wrap')) setOpen(false); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);
  return (
    <div className="cat-sel-wrap" style={{position:'relative'}}>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.5rem',width:'100%',padding:'.5rem .65rem',border:'1.5px solid ' + (open ? '#111' : 'rgba(0,0,0,.26)'),borderRadius:'var(--radius-md)',background:'var(--body-bg)',fontFamily:'var(--font)',fontSize:'.875rem',color:sel ? '#333' : '#8a93a2',cursor:'pointer',textAlign:'left',boxSizing:'border-box',minHeight:'38px',outline:'none',boxShadow:open ? '0 0 0 3px rgba(17,17,17,.07)' : 'none',transition:'border-color .15s, box-shadow .15s'}}>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sel ? sel.name : (placeholder || 'Выберите категорию')}</span>
        <span style={{fontSize:'9px',color:'#5b6472',transform:open?'rotate(180deg)':'none',transition:'transform .2s'}}>▾</span>
      </button>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',padding:'.35rem',zIndex:80,maxHeight:'220px',overflowY:'auto'}}>
          {list.length === 0 && <div style={{padding:'.4rem .55rem',fontSize:'.78rem',color:'#8a93a2'}}>Нет категорий</div>}
          {list.map(c => {
            const on = String(c.id) === String(value);
            return (
              <button key={c.id} type="button" onClick={() => { onChange(on ? '' : c.id); setOpen(false); }}
                style={{display:'flex',alignItems:'center',gap:'.5rem',width:'100%',padding:'.45rem .55rem',borderRadius:'.5rem',border:'none',background:on?'#E6F0FF':'none',fontFamily:'inherit',fontSize:'.8rem',fontWeight:on?700:400,color:'#3a3a3f',cursor:'pointer',textAlign:'left'}}>
                <span style={{width:'8px',height:'8px',borderRadius:'50%',background:on?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                {c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
