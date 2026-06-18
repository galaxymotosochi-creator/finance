import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions, useAccounts, useCategories } from '../../hooks/useTransactions';

export default function Transactions() {
  const { user } = useAuth();
  const { transactions, loading, add, remove, update, refresh } = useTransactions();
  const { accounts, refreshAccounts } = useAccounts();
  const { categories, refreshCategories } = useCategories();
  const [editingId, setEditingId] = useState(null);
  const [origAmount, setOrigAmount] = useState(null);
  const [search, setSearch] = useState('');
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
  const [showActionSelect, setShowActionSelect] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trAmt, setTrAmt] = useState('');

  // Период — сохраняем в localStorage
  var saved = (function(){try{return JSON.parse(localStorage.getItem('txFilters')||'{}')}catch(e){return {}}})();
  const [period, setPeriodRaw] = useState(saved.period||'all');
  const [periodLabel, setPeriodLabelRaw] = useState(saved.periodLabel||'Все время');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [showPeriod, setShowPeriod] = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  // Закрытие дропдаунов при клике вне
  useEffect(() => {
    if (!showPeriod && !showDownload) return;
    const handler = () => { setShowPeriod(false); setShowDownload(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showPeriod, showDownload]);
  const [typeFilter, setTypeFilterRaw] = useState(saved.typeFilter||null);
  var saveFilters = function(p, pl, tf) {
    try {
      localStorage.setItem('txFilters', JSON.stringify({period:p||period,periodLabel:pl||periodLabel,typeFilter:tf!==undefined?tf:typeFilter}));
    } catch(e) {}
  };
  var setPeriod = function(p) { setPeriodRaw(p); saveFilters(p, null, null); };
  var setPeriodLabel = function(l) { setPeriodLabelRaw(l); saveFilters(null, l, null); };
  var setTypeFilter = function(t) { setTypeFilterRaw(t); saveFilters(null, null, t); };

  const txs = transactions || [];
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
  const filtered = txs.filter(function(tx){return dateFilter(tx) && (!typeFilter || tx.type===typeFilter) && (!search || (tx.description||"").toLowerCase().includes(search.toLowerCase()))});

  var exportCsv = function(list) {
    var rows = [['Дата','Описание','Тип','Счет','Сумма']];
    list.forEach(function(tx){
      rows.push([(tx.date||tx.created_at||'').split('T')[0],tx.description||'',tx.type||'',tx.account_name||'',tx.amount||'']);
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

  const incomeTotal = txs.filter(t => t && t.type === 'income' && !(t.description||'').startsWith('Перевод')).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const expenseTotal = txs.filter(t => t && t.type !== 'income' && !(t.description||'').startsWith('Перевод')).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const profit = incomeTotal - expenseTotal;
  const sales = txs.filter(t => t && t.type === 'sale' && !(t.description||'').startsWith('Перевод'));
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

  const submitIncome = (e) => {
    e.preventDefault();
    if (!incName || !incAmount) { alert('Заполните название и сумму'); return; }
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
    if (!expName || !expAmount) { alert('Заполните название и сумму'); return; }
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
        if (acct) {
          if (isEdit) await update(pendingTx.id, { ...txData, account_id: acct.id });
          else await add({ ...txData, account_id: acct.id });
        }
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
   if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;
   return (
    <div>
      <div className="page-header">
        <div>
          <h1>Движение денег</h1>
          <div className="sub">Доходы, расходы и перемещения</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={function(){setShowActionSelect(true)}} style={{background:'var(--primary)',color:'var(--primary-text)',border:'none',borderRadius:'100px',padding:'.5rem .8rem',fontWeight:'600',fontFamily:'var(--font)',cursor:'pointer',fontSize:'.78rem'}}>+ Операция</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      <div className="search-row" style={{display:"flex",alignItems:"center",marginBottom:".5rem",width:'100%',flexWrap:'nowrap'}}>
        <div className="stock-search" style={{display:"flex",alignItems:"center",gap:".3rem",width:"30%",minWidth:"180px",maxWidth:"400px",borderRadius:"6px",padding:"7px .5rem",background:"var(--body-bg)"}}>
          <span style={{fontSize:".75rem",color:"var(--muted)",lineHeight:1}}>🔍</span>
          <input type="text" placeholder="Быстрый поиск" value={search} onChange={function(e){setSearch(e.target.value)}}
            style={{border:"none",outline:"none",flex:1,fontSize:".8rem",fontFamily:"var(--font)",background:"none",padding:0}} />
        </div>
        <div className="stock-filter-links" style={{display:"flex",alignItems:"center",gap:".15rem",marginLeft:"auto"}}>
          <div style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
            <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",fontWeight:period!=='all'?600:400,color:"#555",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1,whiteSpace:'nowrap'}}
              onClick={e=>{e.stopPropagation();setShowPeriod(!showPeriod);setShowDownload(false)}}>{periodLabel}</span>
            {showPeriod && (
              <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'190px',padding:'.35rem',zIndex:100}}>
                <div style={{display:'flex',gap:'.35rem',marginBottom:'.25rem',borderBottom:'1px solid var(--border)',paddingBottom:'.35rem'}}>
                    <span style={{fontSize:'.7rem',color:'var(--secondary)',cursor:'pointer',padding:'.2rem .35rem',borderRadius:'4px'}}
                      onClick={()=>{setPeriod('all');setPeriodLabel('Все время');}}>Очистить</span>
                  </div>
                {[{key:'all',label:'Все время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Эта неделя'}].map(p=>{
                  const isActive = period === p.key;
                  return (
                    <div key={p.key} onClick={()=>{setPeriod(p.key);setPeriodLabel(p.label);setShowPeriod(false)}}
                      style={{display:'flex',alignItems:'center',gap:'.35rem',padding:'.3rem .5rem',borderRadius:'4px',cursor:'pointer',fontSize:'.8rem',color:isActive?'var(--secondary)':'var(--body-color)',fontWeight:isActive?600:400,background:isActive?'var(--secondary-light)':'transparent'}}>
                      <input type="checkbox" checked={isActive} onChange={()=>{}} style={{accentColor:'#111',cursor:'pointer',margin:0}} />
                      {p.label}
                    </div>
                  );
                })}
                <div style={{borderTop:'1px solid var(--border)',marginTop:'.35rem',paddingTop:'.35rem'}}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', margin: '.75rem 0' }}>
          <div style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden', border:"1px solid var(--border)",boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ height: '3px', background: '#4caf50' }}></div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '.62rem', fontWeight: 500, color: 'rgba(0,0,0,.45)', marginBottom: '4px' }}>Поступления</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111' }}>{incomeTotal.toLocaleString()} ₽</div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden', border:"1px solid var(--border)",boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ height: '3px', background: '#e53935' }}></div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '.62rem', fontWeight: 500, color: 'rgba(0,0,0,.45)', marginBottom: '4px' }}>Расходы</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111' }}>{expenseTotal.toLocaleString()} ₽</div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden', border:"1px solid var(--border)",boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ height: '3px', background: '#ff9800' }}></div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '.62rem', fontWeight: 500, color: 'rgba(0,0,0,.45)', marginBottom: '4px' }}>Прибыль</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: profit < 0 ? '#dc2626' : '#111' }}>{profit.toLocaleString()} ₽</div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden', border:"1px solid var(--border)",boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ height: '3px', background: '#1e88e5' }}></div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '.62rem', fontWeight: 500, color: 'rgba(0,0,0,.45)', marginBottom: '4px' }}>Баланс счетов</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: balanceTotal < 0 ? '#dc2626' : '#111' }}>{balanceTotal.toLocaleString()} ₽</div>
            </div>
          </div>
        </div>
      )}



      {txs.length > 0 ? (
        <div className="product-table" style={{ overflowX: 'auto', marginTop: '.5rem' }}>
          <table style={{ minWidth: '700px', width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr id="colHeaders">
              <th>Дата</th><th>Название</th><th>Сумма</th><th>Счет</th><th>Категория</th><th className="actions"></th>
            </tr></thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} style={{ fontSize: '.82rem', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '.5rem .5rem .5rem 0', fontWeight: 500, whiteSpace: 'nowrap', textAlign: 'left' }}>{tx.date ? tx.date.split("-").reverse().join(".") : "—"}</td>
                  <td style={{ padding: '.5rem', fontWeight: 500 }}>{tx.description || '—'}</td>
                  <td style={{ padding: '.5rem', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center', color: tx.type === 'income' ? '#16a34a' : '#dc2626' }}>
                    {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()} ₽
                  </td>
                  <td style={{ padding: '.5rem', fontWeight: 500, textAlign: 'center' }}>{(accs.find(a => a.id === tx.account_id)?.name) || tx.account_name || '—'}</td>
                  <td style={{ padding: '.5rem', textAlign: 'center' }}><span className="prod-cat">{tx.categories?.name || '—'}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="act-btn prod-edit-btn" onClick={function(){editTx(tx)}}>Ред.</button>
                    <div className="prod-more-wrap" style={{display:'inline-block',position:'relative'}}>
                      <button className="act-btn prod-more-btn" onClick={function(e){
                        e.stopPropagation();
                        var el = e.currentTarget.nextElementSibling;
                        el.classList.add('open');
                        var h = function(){el.classList.remove('open'); document.removeEventListener('click',h)};
                        setTimeout(function(){document.addEventListener('click',h)}, 10);
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={function(){remove(tx.id)}} style={{color:'#dc3545'}}>Удалить</button>
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
      {showActionSelect && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==="modal-overlay active"){setShowActionSelect(false)}}}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <button className="modal-close" onClick={()=>setShowActionSelect(false)}>&times;</button>
            <h2>Что вы хотите сделать?</h2>
            <div className="sub" style={{marginBottom:'1rem'}}>Выберите тип операции</div>
            <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
              <button onClick={function(){setShowActionSelect(false);setEditingId(null);setShowExpense(true)}}
                style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.7rem .8rem',borderRadius:'8px',border:'1px solid var(--border)',background:'transparent',cursor:'pointer',fontSize:'.82rem',fontFamily:'var(--font)',fontWeight:500,color:'var(--body-color)',textAlign:'left',width:'100%',transition:'all .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--secondary-light)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div><div style={{fontWeight:600}}>Добавить расход</div><div style={{fontSize:'.72rem',color:'var(--muted)',fontWeight:400}}>Списание средств</div></div>
              </button>
              <button onClick={function(){setShowActionSelect(false);setEditingId(null);setShowIncome(true)}}
                style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.7rem .8rem',borderRadius:'8px',border:'1px solid var(--border)',background:'transparent',cursor:'pointer',fontSize:'.82rem',fontFamily:'var(--font)',fontWeight:500,color:'var(--body-color)',textAlign:'left',width:'100%',transition:'all .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--secondary-light)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div><div style={{fontWeight:600}}>Добавить доход</div><div style={{fontSize:'.72rem',color:'var(--muted)',fontWeight:400}}>Поступление средств</div></div>
              </button>
              <button onClick={function(){setShowActionSelect(false);setShowTransfer(true);setTrFrom('');setTrTo('');setTrAmt('')}}
                style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.7rem .8rem',borderRadius:'8px',border:'1px solid var(--border)',background:'transparent',cursor:'pointer',fontSize:'.82rem',fontFamily:'var(--font)',fontWeight:500,color:'var(--body-color)',textAlign:'left',width:'100%',transition:'all .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--secondary-light)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div><div style={{fontWeight:600}}>Перевод между счетами</div><div style={{fontSize:'.72rem',color:'var(--muted)',fontWeight:400}}>Перемещение средств между счетами</div></div>
              </button>
            </div>
          </div>
        </div>
      )}
      {showTransfer && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==="modal-overlay active"){setShowTransfer(false)}}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>setShowTransfer(false)}>&times;</button>
            <h2>Перевод между счетами</h2>
            <div className="sub">Перемещение средств со счета на счет</div>
            <form onSubmit={async function(e){
              e.preventDefault();
              if (!trAmt||parseFloat(trAmt)<=0) {alert('Введите сумму');return;}
              var amt=parseFloat(trAmt);
              try {
                var fr=accs.find(function(a){return a.id===trFrom}), to=accs.find(function(a){return a.id===trTo});
                if (!fr||!to) {alert('Выберите оба счета');return;}
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
                  {user_id:user.id,account_id:fr.id,type:'expense',amount:amt,description:'Перевод со счета '+fr.name,date:new Date().toISOString().split('T')[0],category_id:trCatId},
                  {user_id:user.id,account_id:to.id,type:'income',amount:amt,description:'Перевод на счет '+to.name,date:new Date().toISOString().split('T')[0],category_id:trCatId}
                ]);
                setShowTransfer(false); setTrAmt(''); await refresh();
              } catch(err) {alert(err.message);}
            }}>
              <div className="form-group">
                <label>С какого счета</label>
                <select value={trFrom} onChange={function(e){setTrFrom(e.target.value)}} required>
                  <option value="">— выберите —</option>
                  {accs.map(function(a){return <option key={a.id} value={a.id}>{a.name} ({(accBalance[a.id]||0).toLocaleString()} ₽)</option>})}
                </select>
              </div>
              <div className="form-group">
                <label>На какой счет</label>
                <select value={trTo} onChange={function(e){setTrTo(e.target.value)}} required>
                  <option value="">— выберите —</option>
                  {accs.filter(function(a){return a.id!==trFrom}).map(function(a){return <option key={a.id} value={a.id}>{a.name} ({(accBalance[a.id]||0).toLocaleString()} ₽)</option>})}
                </select>
              </div>
              <div className="form-group">
                <label>Сумма (₽)</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={trAmt} onChange={function(e){setTrAmt(e.target.value)}} required />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-account-select">Перевести</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showIncome && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==="modal-overlay active"){setShowIncome(false);setEditingId(null)}}}>
          <div className="modal-box">
            <button className="modal-close" onClick={function(){setShowIncome(false);setEditingId(null)}}>&times;</button>
            <h2>{editingId ? "Редактировать доход" : "Добавить доход"}</h2>

            <form onSubmit={function(e){
              e.preventDefault();
              if(!incName || !incAmount){alert("Заполните название и сумму");return}
              if(editingId){
                var amtChanged = parseFloat(incAmount) !== parseFloat(origAmount);
                if(amtChanged){
                  update(editingId,{description:incName,amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                  setShowIncome(false);setEditingId(null);resetForms();
                  setPendingTx({id:editingId,type:'income',user_id:user.id,description:incName,amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                  setSelectedAcc(accs.length > 0 ? accs[0].id : null);setShowAccSelect(true);
                } else {
                  update(editingId,{description:incName,amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                  setShowIncome(false);setEditingId(null);resetForms();
                }
              }else{
                setPendingTx({type:"income",user_id:user.id,description:incName,amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                setSelectedAcc("cash");setSplitMode(false);setSplitAmounts({cash:0,card:0,transfer:0});setShowAccSelect(true);
              }
            }}>
              <div className="form-group">
                <label>Название</label>
                <input type="text" placeholder="Например: инвестиции, партнерские, проценты" value={incName} onChange={function(e){setIncName(e.target.value)}} required />
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
                <label>Категория</label>
                <select value={incCategory} onChange={function(e){setIncCategory(e.target.value)}}>
                  <option value="">— выберите —</option>
                  {(cats||[]).filter(function(c){return c&&c.type==="income"}).map(function(c){return <option key={c.id} value={c.id}>{c.name}</option>})}
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-account-select">{editingId ? "Сохранить" : "Добавить"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExpense && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==="modal-overlay active"){setShowExpense(false);setEditingId(null)}}}>
          <div className="modal-box">
            <button className="modal-close" onClick={function(){setShowExpense(false);setEditingId(null)}}>&times;</button>
            <h2>{editingId ? "Редактировать расход" : "Добавить расход"}</h2>

            <form onSubmit={function(e){
              e.preventDefault();
              if(!expName || !expAmount){alert("Заполните название и сумму");return}
              if(editingId){
                var amtChanged = parseFloat(expAmount) !== parseFloat(origAmount);
                if(amtChanged){
                  update(editingId,{description:expName,amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                  setShowExpense(false);setEditingId(null);resetForms();
                  setPendingTx({id:editingId,type:'expense',user_id:user.id,description:expName,amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                  setSelectedAcc(accs.length > 0 ? accs[0].id : null);setShowAccSelect(true);
                } else {
                  update(editingId,{description:expName,amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                  setShowExpense(false);setEditingId(null);resetForms();
                }
              }else{
                setPendingTx({type:"expense",user_id:user.id,description:expName,amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                setSelectedAcc(accs.length > 0 ? accs[0].id : null);setSplitMode(false);setSplitAmounts({});setShowAccSelect(true);
              }
            }}>
              <div className="form-group">
                <label>Название</label>
                <input type="text" placeholder="Например: аренда, коммунальные, налоги" value={expName} onChange={function(e){setExpName(e.target.value)}} required />
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
                <label>Категория</label>
                <select value={expCategory} onChange={function(e){setExpCategory(e.target.value)}}>
                  <option value="">— выберите —</option>
                  {(cats||[]).filter(function(c){return c&&(c.type==="expense"||c.type==="supply_expense")}).map(function(c){return <option key={c.id} value={c.id}>{c.name}</option>})}
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-account-select">{editingId ? "Сохранить" : "Добавить"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAccSelect && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==="modal-overlay active"){setShowAccSelect(false);setPendingTx(null)}}}>
          <div className="modal-box" style={{maxWidth:"400px"}}>
            <button className="modal-close" onClick={function(){setShowAccSelect(false);setPendingTx(null)}}>&times;</button>
            <h2>{pendingTx && pendingTx.type === "expense" ? "С какого счета списать?" : "На какой счет зачислить?"}</h2>
            <div className="sub">{(pendingTx ? (pendingTx.type === "expense" ? "Сумма расхода" : "Сумма дохода") : "") + ": " + (pendingTx ? Number(pendingTx.amount).toLocaleString() : "0") + " ₽"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:".5rem",margin:".75rem 0"}}>
              {accs.map(function(a){
                var sel = selectedAcc === a.id;
                var ic = accIcons[a.type] || '🏦';
                return (
                  <div key={a.id} onClick={function(){setSelectedAcc(a.id)}} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".65rem .75rem",cursor:"pointer",borderRadius:".6rem",background:sel?"var(--secondary-light)":"var(--body-bg)",border:"1.5px solid "+(sel?"var(--secondary)":"var(--border)")}}>
                    <div style={{width:"18px",height:"18px",border:"2px solid "+(sel?"var(--secondary)":"var(--border)"),borderRadius:"50%",flexShrink:0,borderWidth:sel?"6px":"2px"}} />
                    
                    <span style={{flex:1,fontSize:".85rem",fontWeight:500}}>{a.name}</span>
                    <span style={{fontSize:".82rem",fontWeight:600,color:"#111"}}>{(function(){var b=0;(txs||[]).forEach(function(t){if(t.account_id&&t.account_id===a.id){b+=Number(t.amount||0)*(t.type==="income"?1:-1)}});return b.toLocaleString()})()} ₽</span>
                  </div>
                );
              })}
              {accs.length === 0 && <div style={{textAlign:"center",padding:"1rem",color:"var(--muted)",fontSize:".85rem"}}>Нет счетов. Добавьте в разделе Счета</div>}
            </div>
            <div className="sub" style={{marginBottom:".75rem",cursor:"pointer",fontSize:".82rem",color:"var(--secondary)"}} onClick={function(){
              setSplitAmounts({});
              setSplitMode(!splitMode)
            }}>{splitMode ? "+ Разделить" : "+ Разделить"}</div>
            {splitMode && <div style={{padding:".5rem 0",borderTop:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:".35rem"}}>
              {accs.map(function(a){
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:".5rem"}}>
                    <span style={{flex:1,fontSize:".8rem",fontWeight:500}}>{a.name}</span>
                    <input type="number" value={splitAmounts[a.id]||""} onChange={function(e){var v=parseFloat(e.target.value)||0;setSplitAmounts(function(p){var r=Object.assign({},p);r[a.id]=v;return r})}}
                      style={{width:"100px",padding:".35rem .5rem",fontSize:".78rem",border:"1.5px solid var(--border)",borderRadius:"8px",outline:"none",textAlign:"right",fontFamily:"var(--font)"}} />
                  </div>
                );
              })}
            </div>}
            <div style={{padding:"1rem 1.25rem",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end"}}>
              <button onClick={function(){confirmTx()}}
                style={{padding:".45rem 1.2rem",fontSize:".8rem",fontWeight:700,borderRadius:"100px",border:"none",cursor:"pointer",background:"#ffdd2d",color:"#111",fontFamily:"var(--font)"}}>
                {(pendingTx ? (pendingTx.type === "expense" ? "Списать" : "Зачислить") : "") + " " + (pendingTx ? Number(pendingTx.amount).toLocaleString() : "0") + " ₽"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
