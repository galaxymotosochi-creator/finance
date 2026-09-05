import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions, useAccounts, useCategories } from '../../hooks/useTransactions';
import { getCurrencySymbol } from '../../lib/currency';
import { getSettingsTz } from '../../lib/dates';
import CenterSpinner from '../../components/CenterSpinner';


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

  // Закрытие дропдаунов при клике вне
  useEffect(() => {
    if (!showPeriod && !showDownload) return;
    const handler = () => { setShowPeriod(false); setShowDownload(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showPeriod, showDownload]);
  const [typeFilter, setTypeFilterRaw] = useState(null);
  var setTypeFilter = function(t) { setTypeFilterRaw(t); };

  const txs = transactions || [];

  // Взнос/вывод своих денег собственника — двигает баланс счёта, но НЕ считается доходом/расходом
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

  const openIncome = () => {
    setShowIncome(true);
  };

  // Сброс всех полей форм операции (доход/расход)
  const resetForms = function() {
    setIncName(''); setIncAmount(''); setIncDate(new Date().toISOString().split('T')[0]); setIncCategory('');
    setExpName(''); setExpAmount(''); setExpDate(new Date().toISOString().split('T')[0]); setExpCategory('');
  };

  const catNameById = (id) => { const c = (cats || []).find(x => x.id === id); return c ? c.name : ''; };

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
    setSelectedAcc('cash');
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
          alert('Нет доступных счетов. Сначала создайте счёт в разделе "Финансовые счета".');
          return;
        }
        // Защита от ухода в минус: списать можно только в пределах баланса счёта.
        // Если не хватает — разделите сумму на несколько счетов или выберите другой счёт.
        if (pendingTx.type === 'expense') {
          var curBal = accBalance[acct.id] || 0;
          if (pendingTx.amount > curBal) {
            alert('На счёте «' + acct.name + '» недостаточно средств (доступно ' + Math.round(curBal).toLocaleString() + ' ' + cur + ').\nРазделите сумму на несколько счетов (кнопка «+ Разделить») или выберите другой счёт.');
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
  const incomeCats = cats.filter(c => c?.type === 'income');
  const expenseCats = cats.filter(c => c?.type === 'expense' || c?.type === 'supply_expense');
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
      <div className="page-header">
        <div>
          <h1>Доходы и расходы</h1>
          <div className="sub">Поступления, списания и переводы между счетами</div>
        </div>
        <div className="page-actions">
          <div style={{position:'relative',display:'inline-block'}}>
            <button className="btn btn-dark" onClick={function(){setDdOpen(!ddOpen)}} style={{padding:'.5rem .9rem',fontWeight:600,borderRadius:'10px',display:'inline-flex',alignItems:'center',gap:'.35rem'}}>Добавить операцию <span style={{fontSize:'9px',lineHeight:1}}>▾</span></button>
            {ddOpen && (
              <div>
                <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:75}} onClick={function(){setDdOpen(false)}} />
                <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,background:'#fff',borderRadius:'16px',boxShadow:'0 14px 40px rgba(0,0,0,.16)',padding:'7px',minWidth:'280px',zIndex:76}}>
                  <button type="button" onClick={function(){setDdOpen(false);setEditingId(null);resetForms();setShowExpense(true)}}
                    style={{display:'block',width:'100%',padding:'.5rem .7rem',borderRadius:'10px',cursor:'pointer',border:'none',background:'none',fontFamily:'var(--font)',textAlign:'left',transition:'background .1s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f6f6f8'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}>
                    <span style={{display:'block',fontSize:'.8125rem',fontWeight:600,color:'#222'}}>Добавить расход</span>
                    <span style={{display:'block',fontSize:'.7rem',color:'#999',marginTop:'1px'}}>Списание средств</span>
                  </button>
                  <button type="button" onClick={function(){setDdOpen(false);setEditingId(null);resetForms();setShowIncome(true)}}
                    style={{display:'block',width:'100%',padding:'.5rem .7rem',borderRadius:'10px',cursor:'pointer',border:'none',background:'none',fontFamily:'var(--font)',textAlign:'left',transition:'background .1s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f6f6f8'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}>
                    <span style={{display:'block',fontSize:'.8125rem',fontWeight:600,color:'#222'}}>Добавить доход</span>
                    <span style={{display:'block',fontSize:'.7rem',color:'#999',marginTop:'1px'}}>Поступление средств</span>
                  </button>
                  <button type="button" onClick={function(){setDdOpen(false);setTrFrom('');setTrTo('');setTrAmt('');setShowTransfer(true)}}
                    style={{display:'block',width:'100%',padding:'.5rem .7rem',borderRadius:'10px',cursor:'pointer',border:'none',background:'none',fontFamily:'var(--font)',textAlign:'left',transition:'background .1s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f6f6f8'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}>
                    <span style={{display:'block',fontSize:'.8125rem',fontWeight:600,color:'#222'}}>Перевод между счетами</span>
                    <span style={{display:'block',fontSize:'.7rem',color:'#999',marginTop:'1px'}}>Перемещение средств</span>
                  </button>
                  <button type="button" onClick={function(){setDdOpen(false);setOwnerMode('deposit');setOwnerAcct(accs.length?accs[0].id:'');setOwnerAmt('');setOwnerDesc('');setShowOwner(true)}}
                    style={{display:'block',width:'100%',padding:'.5rem .7rem',borderRadius:'10px',cursor:'pointer',border:'none',background:'none',fontFamily:'var(--font)',textAlign:'left',transition:'background .1s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f6f6f8'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}>
                    <span style={{display:'block',fontSize:'.8125rem',fontWeight:600,color:'#222'}}>Взнос / вывод своих денег</span>
                    <span style={{display:'block',fontSize:'.7rem',color:'#999',marginTop:'1px'}}>Личные деньги владельца</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      <div className="search-row" style={{display:"flex",alignItems:"center",marginBottom:".5rem",width:'100%',flexWrap:'nowrap'}}>
        <div className="stock-search" style={{display:"flex",alignItems:"center",gap:".4rem",width:"15%",minWidth:"110px",maxWidth:"200px",border:"1px solid "+(searchFocus?'#111':'#e2e2e6'),borderRadius:"100px",padding:"8px 16px",background:"#fff",boxShadow:searchFocus?'0 2px 8px rgba(0,0,0,.12)':'0 1px 3px rgba(0,0,0,.05)',transition:'border-color .15s, box-shadow .15s'}}
          onFocus={()=>setSearchFocus(true)} onBlur={()=>setSearchFocus(false)}>
          <span style={{display:'flex',color:searchFocus?'#111':'#999',transition:'color .15s'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input type="text" placeholder="Быстрый поиск" value={search} onChange={function(e){setSearch(e.target.value)}}
            style={{border:"none",outline:"none",flex:1,fontSize:".8rem",fontFamily:"var(--font)",background:"none",padding:0}} />
        </div>
        <div className="stock-filter-links" style={{display:"flex",alignItems:"center",gap:".15rem",marginLeft:"auto"}}>
          <div style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
            <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"#555",cursor:"pointer",borderRight:"none",lineHeight:1,whiteSpace:'nowrap'}}
              onClick={e=>{e.stopPropagation();setShowPeriod(!showPeriod);setShowDownload(false)}}>{periodLabel}</span>
            {showPeriod && (
              <div onClick={e=>e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'210px',padding:'.35rem',zIndex:100}}>
                {[{key:'all',label:'Все время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Эта неделя'}].map(p=>{
                  const isActive = period === p.key;
                  return (
                    <div key={p.key} onClick={()=>{setPeriod(p.key);setPeriodLabel(p.label);setShowPeriod(false)}}
                      style={{display:'flex',alignItems:'center',gap:'.35rem',padding:'.3rem .5rem',borderRadius:'4px',cursor:'pointer',fontSize:'.78rem',color:'#555',background:'transparent'}}>
                      <input type="checkbox" checked={isActive} onChange={()=>{}} style={{cursor:"pointer",margin:0}} />
                      {p.label}
                    </div>
                  );
                })}
                <div style={{borderTop:'1px solid var(--border)',paddingTop:'.35rem',marginTop:'.15rem'}}>
                  <div style={{fontSize:'.72rem',color:'var(--muted)',padding:'.2rem .5rem',marginBottom:'.25rem'}}>Свой период</div>
                  <div style={{display:'flex',gap:'.25rem',padding:'.25rem .5rem'}}>
                    <input type="date" value={periodFrom} onChange={e=>setPeriodFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px',fontFamily:'var(--font)',outline:'none'}} />
                    <input type="date" value={periodTo} onChange={e=>setPeriodTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px',fontFamily:'var(--font)',outline:'none'}} />
                  </div>
                  <div style={{padding:'.25rem .5rem'}}>
                    <button onClick={()=>{if(!periodFrom||!periodTo)return alert('Выберите обе даты');setPeriod('custom');setPeriodLabel(periodFrom.split('-').reverse().join('.')+' — '+periodTo.split('-').reverse().join('.'));setShowPeriod(false)}}
                      style={{width:'100%',padding:'.35rem .5rem',fontSize:'.75rem',fontFamily:'var(--font)',background:'var(--secondary)',color:'#fff',border:'none',borderRadius:'4px',cursor:'pointer',fontWeight:600}}>Применить</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",fontWeight:typeFilter==='expense'?600:400,color:"#555",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
            onClick={()=>setTypeFilter(typeFilter==='expense'?null:'expense')}>Расходы</span>
          <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",fontWeight:typeFilter==='income'?600:400,color:"#555",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
            onClick={()=>setTypeFilter(typeFilter==='income'?null:'income')}>Доходы</span>
          <div style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1}}>
            <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"#555",cursor:"pointer",borderRight:"none",lineHeight:1}}
              onClick={e=>{e.stopPropagation();setShowDownload(!showDownload);setShowPeriod(false)}}>Скачать</span>
            {showDownload && (
              <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'230px',padding:'.35rem',zIndex:100}}>
                <div style={{fontSize:'.72rem',color:'var(--muted)',marginBottom:'.5rem',padding:'0 .25rem'}}>
                  Вы скачиваете отчет за <b>{periodLabel.toLowerCase()}</b>.
                </div>
                <div style={{display:'flex',gap:'.35rem',justifyContent:'center'}}>
                  <span onClick={()=>{exportCsv(filtered);setShowDownload(false)}}
                    style={{padding:'.35rem .7rem',fontSize:'.75rem',fontWeight:600,borderRadius:'6px',cursor:'pointer',background:'var(--secondary)',color:'#fff',border:'none',fontFamily:'var(--font)'}}>Скачать</span>
                  <span onClick={()=>{setShowDownload(false);setShowPeriod(true)}}
                    style={{padding:'.35rem .7rem',fontSize:'.75rem',borderRadius:'6px',cursor:'pointer',background:'transparent',border:'1px solid var(--border)',color:'var(--muted)',fontFamily:'var(--font)'}}>Изменить даты</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', margin: '.75rem 0' }}>
          <div style={{ background: 'linear-gradient(135deg,#ffdd2d,#fff9db)', borderRadius: '16px', padding: '12px 14px', boxShadow: '0 2px 10px rgba(255,205,0,.3)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,.55)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Выручка от продаж</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111', whiteSpace: 'nowrap' }}>+{salesIncome.toLocaleString()} {cur}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#ffdd2d,#fff9db)', borderRadius: '16px', padding: '12px 14px', boxShadow: '0 2px 10px rgba(255,205,0,.3)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,.55)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Прочие доходы</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111', whiteSpace: 'nowrap' }}>{otherIncomeTx > 0 ? '+' : ''}{otherIncomeTx.toLocaleString()} {cur}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#ffdd2d,#fff9db)', borderRadius: '16px', padding: '12px 14px', boxShadow: '0 2px 10px rgba(255,205,0,.3)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,.55)', marginBottom: '6px', whiteSpace: 'nowrap' }}>Расходы</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111', whiteSpace: 'nowrap' }}>{expenseTotal.toLocaleString()} {cur}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#ffdd2d,#fff9db)', borderRadius: '16px', padding: '12px 14px', boxShadow: '0 2px 10px rgba(255,205,0,.3)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,.55)', marginBottom: '6px', whiteSpace: 'nowrap' }}>Баланс счетов</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: balanceTotal < 0 ? '#c62828' : '#111', whiteSpace: 'nowrap' }}>{balanceTotal.toLocaleString()} {cur}</div>
          </div>
        </div>
      )}



      {txs.length > 0 ? (
        <div className="product-table" style={{ overflowX: 'auto', marginTop: '.5rem' }}>
          <table className="data-table" style={{ minWidth: '700px', width: '100%', borderCollapse: 'collapse' }}>
            <thead id="colHeaders">
              <tr>
                <th style={{width:'9%',paddingLeft:0,textAlign:'left'}}>Дата</th>
                <th style={{width:'6%',textAlign:'left'}}>Время</th>
                <th style={{width:'30%',textAlign:'left'}}>Название</th>
                <th style={{width:'12%',textAlign:'left'}}>Сумма</th>
                <th style={{width:'15%',textAlign:'left'}}>Счет</th>
                <th style={{width:'15%',textAlign:'left'}}>Категория</th>
                <th style={{width:'10%',textAlign:'left'}}>Автор</th>
                <th style={{width:'0',padding:0,textAlign:'left'}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id}>
                  <td style={{ padding: '.5rem .5rem .5rem 0', color: '#222', whiteSpace: 'nowrap', textAlign: 'left',borderRight:'1px solid rgba(0,0,0,.08)' }}>{tx.date ? ((tx.date||'').split('T')[0]||'').split('-').reverse().join('.') : '—'}</td>
                  <td style={{ padding: '.5rem', color: '#222', whiteSpace: 'nowrap', textAlign: 'left',borderRight:'1px solid rgba(0,0,0,.08)' }}>{fmtTime(tx)}</td>
                  <td style={{ padding: '.5rem', color: '#222', textAlign: 'left',borderRight:'1px solid rgba(0,0,0,.08)' }}>{tx.description || '—'}{tx.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</td>
                  <td style={{ padding: '.5rem', color: '#222', whiteSpace: 'nowrap', textAlign: 'left',borderRight:'1px solid rgba(0,0,0,.08)' }}>
                    <span>{tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()} {cur}</span>
                  </td>
                  <td style={{ padding: '.5rem', color: '#222', textAlign: 'left',borderRight:'1px solid rgba(0,0,0,.08)' }}>{(accs.find(a => a.id === tx.account_id)?.name) || tx.account_name || '—'}</td>
                  <td style={{ padding: '.5rem', color: '#222', textAlign: 'left',borderRight:'1px solid rgba(0,0,0,.08)' }}><span className="prod-cat">{(cats.find(c => c && c.id === tx.category_id)?.name) || '—'}</span></td>
                  <td style={{ padding: '.5rem', color: '#222', textAlign: 'left',borderRight:'1px solid rgba(0,0,0,.08)' }}>{userMap[tx.user_id] || '—'}</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap',borderRight:'none' }}>
                    <div className="prod-more-wrap" style={{display:'inline-block',position:'relative'}}>
                      <button className="act-btn prod-more-btn" onClick={function(e){
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
      ) : (
        <div className="empty-products">
          <div className="big-icon">💸</div>
          <p>История операций пуста</p>
          <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Зафиксируйте первую финансовую операцию, чтобы начать учет</p>
        </div>
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
                <label>С какого счета</label>
                <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
                  {accs.length === 0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет счетов</div>}
                  {accs.map(function(a){
                    const sel=String(a.id)===String(trFrom);
                    return (
                      <div key={a.id} onClick={function(){setTrFrom(a.id);if(String(a.id)===String(trTo))setTrTo('')}}
                        style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#fff9db':'#fff',border:'1.5px solid '+(sel?'#ffdd2d':'rgba(0,0,0,.26)')}}>
                        <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(sel?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:sel?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                        <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                        <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(accBalance[a.id]||0).toLocaleString()} {cur}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label>На какой счет</label>
                <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
                  {accs.filter(function(a){return String(a.id)!==String(trFrom)}).length===0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет счетов</div>}
                  {accs.filter(function(a){return String(a.id)!==String(trFrom)}).map(function(a){
                    const sel=String(a.id)===String(trTo);
                    return (
                      <div key={a.id} onClick={function(){setTrTo(a.id)}}
                        style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#fff9db':'#fff',border:'1.5px solid '+(sel?'#ffdd2d':'rgba(0,0,0,.26)')}}>
                        <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(sel?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:sel?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                        <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                        <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(accBalance[a.id]||0).toLocaleString()} {cur}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label>Сумма (₽)</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={trAmt} onChange={function(e){setTrAmt(e.target.value)}} required />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-dark">Перевести</button>
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
              if (!acct) return alert('Выберите счёт');
              // Нельзя вывести больше, чем есть на счёте
              if (ownerMode === 'withdraw') {
                const bal = accBalance[acct.id] || 0;
                if (amt > bal) return alert('Недостаточно средств на счёте «' + acct.name + '». Доступно: ' + Math.round(bal).toLocaleString() + ' ' + cur);
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
                  <button type="button" onClick={()=>setOwnerMode('deposit')} style={{flex:1,padding:'.6rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:ownerMode==='deposit'?'none':'1.5px solid #e8e8ec',background:ownerMode==='deposit'?'linear-gradient(135deg,#ffdd2d,#fff9db)':'#fff',color:ownerMode==='deposit'?'#111':'#888',transition:'all .12s'}}>Взнос (доложить)</button>
                  <button type="button" onClick={()=>setOwnerMode('withdraw')} style={{flex:1,padding:'.6rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:ownerMode==='withdraw'?'none':'1.5px solid #e8e8ec',background:ownerMode==='withdraw'?'linear-gradient(135deg,#ffdd2d,#fff9db)':'#fff',color:ownerMode==='withdraw'?'#111':'#888',transition:'all .12s'}}>Вывод (забрать)</button>
                </div>
              </div>
              <div className="form-group">
                <label>Счёт</label>
                <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
                  {accs.length === 0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет счетов</div>}
                  {accs.map(function(a){
                    const sel = String(a.id) === String(ownerAcct);
                    return (
                      <div key={a.id} onClick={()=>setOwnerAcct(a.id)}
                        style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#fff9db':'#fff',border:'1.5px solid '+(sel?'#ffdd2d':'rgba(0,0,0,.26)')}}>
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
                <button type="submit" style={{display:'block',margin:'0 auto',padding:'12px 34px',border:'none',borderRadius:'10px',background:'#111',color:'#fff',fontFamily:'inherit',fontSize:'14px',fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.15)',transition:'all .12s'}} onMouseEnter={e=>{e.currentTarget.style.background='#000'}} onMouseLeave={e=>{e.currentTarget.style.background='#111'}}>{ownerMode==='deposit' ? 'Внести деньги' : 'Забрать деньги'}</button>
              </div>
            </form>
      </Modal>
      <Modal open={showIncome} onClose={function(){setShowIncome(false);setEditingId(null)}} title={editingId ? "Редактировать доход" : "Добавить доход"} subtitle="Поступление средств" width="medium">

            <form onSubmit={function(e){
              e.preventDefault();
              if(!incAmount){alert("Введите сумму");return}
              if(editingId){
                var amtChanged = parseFloat(incAmount) !== parseFloat(origAmount);
                if(amtChanged){
                  update(editingId,{description:(incName.trim()||catNameById(incCategory)||'Доход'),amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                  setShowIncome(false);setEditingId(null);resetForms();
                  setPendingTx({id:editingId,type:'income',user_id:user.id,description:(incName.trim()||catNameById(incCategory)||'Доход'),amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                  setSelectedAcc(txAccountId || (accs.length > 0 ? accs[0].id : null));setShowAccSelect(true);
                } else {
                  update(editingId,{description:(incName.trim()||catNameById(incCategory)||'Доход'),amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                  setShowIncome(false);setEditingId(null);resetForms();
                  setToast('Сумма успешно изменена!');
                }
              }else{
                setPendingTx({type:"income",user_id:user.id,description:(incName.trim()||catNameById(incCategory)||'Доход'),amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                setSelectedAcc(accs.length > 0 ? accs[0].id : null);setSplitMode(false);setSplitAmounts({});setShowAccSelect(true);
              }
            }}>
              {!editingId && (
              <div className="form-group">
                <label>Тип операции</label>
                <div style={{display:'flex',gap:'.4rem'}}>
                  <button type="button" onClick={function(){setIncCategory('')}}
                    style={{flex:1,padding:'.55rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:'none',background:'linear-gradient(135deg,#ffdd2d,#fff9db)',color:'#111',transition:'all .12s'}}>+ Доход</button>
                  <button type="button" onClick={function(){setShowIncome(false);setExpName(incName);setExpAmount(incAmount);setExpDate(incDate);setExpCategory('');setShowExpense(true)}}
                    style={{flex:1,padding:'.55rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:'1.5px solid #e8e8ec',background:'#fff',color:'#888',transition:'all .12s'}}>− Расход</button>
                </div>
              </div>
              )}
              <div className="form-group">
                <label>Категория</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'.35rem'}}>
                  {incomeCats.length === 0 && <div style={{padding:'.2rem 0',fontSize:'.8rem',color:'var(--muted)'}}>Нет категорий — добавьте в разделе «Категории»</div>}
                  {incomeCats.map(function(c){const on=String(incCategory)===String(c.id);return (
                    <button key={c.id} type="button" onClick={function(){setIncCategory(on?'':c.id)}}
                      style={{padding:'.42rem .85rem',borderRadius:'100px',border:'1.5px solid '+(on?'#111':'#e4e4e8'),background:on?'#111':'#fff',fontSize:'.78rem',fontWeight:500,color:on?'#fff':'#666',cursor:'pointer',fontFamily:'var(--font)',transition:'all .12s'}}>{c.name}</button>
                  );})}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Сумма (₽)</label>
                  <input type="number" placeholder="0" min="0" step="0.01" value={incAmount} onChange={function(e){setIncAmount(e.target.value)}} required />
                </div>
                <div className="form-group">
                  <label>Дата</label>
                  <input type="date" value={incDate} onChange={function(e){setIncDate(e.target.value)}} />
                </div>
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <input type="text" placeholder="Например: инвестиции, партнерские, проценты" value={incName} onChange={function(e){setIncName(e.target.value)}} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-dark">{editingId ? "Сохранить" : "Добавить"}</button>
              </div>
            </form>
      </Modal>

      <Modal open={showExpense} onClose={function(){setShowExpense(false);setEditingId(null)}} title={editingId ? "Редактировать расход" : "Добавить расход"} subtitle="Списание средств" width="medium">
            <form onSubmit={function(e){
              e.preventDefault();
              if(!expAmount){alert("Введите сумму");return}
              if(editingId){
                var amtChanged = parseFloat(expAmount) !== parseFloat(origAmount);
                if(amtChanged){
                  update(editingId,{description:(expName.trim()||catNameById(expCategory)||'Расход'),amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                  setShowExpense(false);setEditingId(null);resetForms();
                  setPendingTx({id:editingId,type:'expense',user_id:user.id,description:(expName.trim()||catNameById(expCategory)||'Расход'),amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                  setSelectedAcc(txAccountId || (accs.length > 0 ? accs[0].id : null));setShowAccSelect(true);
                } else {
                  update(editingId,{description:(expName.trim()||catNameById(expCategory)||'Расход'),amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                  setShowExpense(false);setEditingId(null);resetForms();
                  setToast('Сумма успешно изменена!');
                }
              }else{
                setPendingTx({type:"expense",user_id:user.id,description:(expName.trim()||catNameById(expCategory)||'Расход'),amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                setSelectedAcc(accs.length > 0 ? accs[0].id : null);setSplitMode(false);setSplitAmounts({});setShowAccSelect(true);
              }
            }}>
              {!editingId && (
              <div className="form-group">
                <label>Тип операции</label>
                <div style={{display:'flex',gap:'.4rem'}}>
                  <button type="button" onClick={function(){setShowExpense(false);setIncName(expName);setIncAmount(expAmount);setIncDate(expDate);setIncCategory('');setShowIncome(true)}}
                    style={{flex:1,padding:'.55rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:'1.5px solid #e8e8ec',background:'#fff',color:'#888',transition:'all .12s'}}>+ Доход</button>
                  <button type="button" onClick={function(){setExpCategory('')}}
                    style={{flex:1,padding:'.55rem .5rem',borderRadius:'10px',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.8125rem',fontWeight:600,border:'none',background:'linear-gradient(135deg,#ffdd2d,#fff9db)',color:'#111',transition:'all .12s'}}>− Расход</button>
                </div>
              </div>
              )}
              <div className="form-group">
                <label>Категория</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'.35rem'}}>
                  {expenseCats.length === 0 && <div style={{padding:'.2rem 0',fontSize:'.8rem',color:'var(--muted)'}}>Нет категорий — добавьте в разделе «Категории»</div>}
                  {expenseCats.map(function(c){const on=String(expCategory)===String(c.id);return (
                    <button key={c.id} type="button" onClick={function(){setExpCategory(on?'':c.id)}}
                      style={{padding:'.42rem .85rem',borderRadius:'100px',border:'1.5px solid '+(on?'#111':'#e4e4e8'),background:on?'#111':'#fff',fontSize:'.78rem',fontWeight:500,color:on?'#fff':'#666',cursor:'pointer',fontFamily:'var(--font)',transition:'all .12s'}}>{c.name}</button>
                  );})}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Сумма (₽)</label>
                  <input type="number" placeholder="0" min="0" step="0.01" value={expAmount} onChange={function(e){setExpAmount(e.target.value)}} required />
                </div>
                <div className="form-group">
                  <label>Дата</label>
                  <input type="date" value={expDate} onChange={function(e){setExpDate(e.target.value)}} />
                </div>
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <input type="text" placeholder="Например: аренда за сентябрь, запчасти на скутер" value={expName} onChange={function(e){setExpName(e.target.value)}} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-dark">{editingId ? "Сохранить" : "Добавить"}</button>
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
