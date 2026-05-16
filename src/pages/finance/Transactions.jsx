import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions, useAccounts, useCategories } from '../../hooks/useTransactions';

export default function Transactions() {
  const { user } = useAuth();
  const { transactions, loading, add, remove, update, refresh } = useTransactions();
  const { accounts, refreshAccounts } = useAccounts();
  const { categories, refreshCategories } = useCategories();
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showAccSelect, setShowAccSelect] = useState(false);
  const [pendingTx, setPendingTx] = useState(null);
  const [selectedAcc, setSelectedAcc] = useState('cash');
  const [splitMode, setSplitMode] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({ cash: 0, card: 0, transfer: 0 });

  const [incName, setIncName] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incDate, setIncDate] = useState(new Date().toISOString().split('T')[0]);
  const [incCategory, setIncCategory] = useState('');
  const [expName, setExpName] = useState('');
  const [txAccountId, setTxAccountId] = useState(null);
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expCategory, setExpCategory] = useState('');

  // Период
  const [period, setPeriod] = useState('all');
  const [periodLabel, setPeriodLabel] = useState('Всё время');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [showPeriod, setShowPeriod] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);

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
    var rows = [['Дата','Описание','Тип','Счёт','Сумма']];
    list.forEach(function(tx){
      rows.push([(tx.date||tx.created_at||'').split('T')[0],tx.description||'',tx.type||'',tx.account_name||'',tx.amount||'']);
    });
    var csv = rows.map(function(r){return r.join(',')}).join('\n');
    var blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'transactions.csv'; a.click();
  };

  var accs = accounts || [];
  const cats = categories || [];

  const incomeTotal = txs.filter(t => t && t.type === 'income' && !(t.description||'').startsWith('Перевод')).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const expenseTotal = txs.filter(t => t && t.type !== 'income' && !(t.description||'').startsWith('Перевод')).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const profit = incomeTotal - expenseTotal;
  const sales = txs.filter(t => t && t.type === 'sale' && !(t.description||'').startsWith('Перевод'));
  const avgCheck = sales.length ? Math.round(sales.reduce((s, t) => s + (Number(t.amount) || 0), 0) / sales.length) : 0;

  const seed = async () => {
    try {
      if (accs.length === 0) {
        await supabase.from('accounts').insert([
          { user_id: user.id, name: 'Наличные', type: 'cash' },
          { user_id: user.id, name: 'Карта', type: 'card' },
          { user_id: user.id, name: 'Перевод', type: 'transfer' },
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
    setSelectedAcc('cash');
    setSplitMode(false);
    setSplitAmounts({ cash: 0, card: 0, transfer: 0 });
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
    setSplitAmounts({ cash: 0, card: 0, transfer: 0 });
    setShowAccSelect(true);
  };

  const confirmTx = async () => {
    if (!pendingTx) return;
    try {
      var isEdit = !!pendingTx.id;
      var txData = { account_id: null, user_id: pendingTx.user_id, amount: pendingTx.amount, description: pendingTx.description, date: pendingTx.date, category_id: pendingTx.category_id, type: pendingTx.type };
      if (splitMode) {
        for (const [type, amt] of Object.entries(splitAmounts)) {
          if (amt > 0) {
            var a = accs.find(x => x?.type === type) || accs[0];
            if (a) {
              if (isEdit) await update(pendingTx.id, { ...txData, account_id: a.id, amount: amt });
              else await add({ ...txData, account_id: a.id, amount: amt });
            }
          }
        }
      } else {
        if (accs.length === 0) {
          await supabase.from('accounts').insert([
            { user_id: user.id, name: 'Наличные', type: 'cash' },
            { user_id: user.id, name: 'Карта', type: 'card' },
            { user_id: user.id, name: 'Перевод', type: 'transfer' },
          ]);
          var r = await refreshAccounts();
          accs = r || [];
        }
        var acct = accs.find(a => a?.type === selectedAcc) || accs[0];
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
    setEditingId(tx.id);setTxAccountId(tx.account_id || null);
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Транзакции</h1>
          <div className="sub">Все приходы и расходы в одном месте</div>
        </div>
        <div className="page-actions">
          <button className="btn-red" onClick={function(){setEditingId(null);setShowExpense(true)}}>+ Расход</button>
          <button className="btn-green" onClick={function(){setEditingId(null);setShowIncome(true)}}>+ Доход</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      <div className="search-row" style={{display:"flex",alignItems:"center",marginBottom:".5rem"}}>
        <div className="stock-search" style={{display:"flex",alignItems:"center",gap:".3rem",width:"30%",minWidth:"180px",maxWidth:"400px",border:"1px solid var(--border)",borderRadius:"6px",padding:"7px .5rem",background:"var(--white)"}}>
          <span style={{fontSize:".75rem",color:"var(--muted)",lineHeight:1}}>🔍</span>
          <input type="text" placeholder="Быстрый поиск" value={search} onChange={function(e){setSearch(e.target.value)}}
            style={{border:"none",outline:"none",flex:1,fontSize:".8rem",fontFamily:"var(--font)",background:"none",padding:0}} />
        </div>
        <div className="stock-filter-links" style={{display:"flex",alignItems:"center",gap:".15rem",marginLeft:"auto"}}>
          <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",fontWeight:typeFilter==='income'?600:400,color:typeFilter==='income'?'var(--primary)':'var(--muted)',cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
            onClick={()=>setTypeFilter(typeFilter==='income'?null:'income')}>Доход</span>
          <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",fontWeight:typeFilter==='expense'?600:400,color:typeFilter==='expense'?'var(--primary)':'var(--muted)',cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
            onClick={()=>setTypeFilter(typeFilter==='expense'?null:'expense')}>Расход</span>
          <div style={{position:'relative'}}>
            <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",fontWeight:period!=='all'?600:400,color:"var(--primary)",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
              onClick={()=>{setShowPeriod(!showPeriod);setShowDownload(false)}}>{periodLabel}</span>
            {showPeriod && (
              <div style={{position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'190px',padding:'.35rem',zIndex:100}}>
                {[{key:'all',label:'Всё время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Эта неделя'}].map(p=>(
                  <div key={p.key} onClick={()=>{setPeriod(p.key);setPeriodLabel(p.label);setShowPeriod(false)}}
                    style={{padding:'.3rem .5rem',fontSize:'.8rem',cursor:'pointer',borderRadius:'4px',color:period===p.key?'var(--primary)':'var(--body-color)',fontWeight:period===p.key?600:400,background:period===p.key?'var(--primary-light)':'transparent'}}>{p.label}</div>
                ))}
                <div style={{borderTop:'1px solid var(--border)',marginTop:'.25rem',paddingTop:'.25rem'}}>
                  <div style={{fontSize:'.72rem',color:'var(--muted)',padding:'.2rem .5rem'}}>Свой период</div>
                  <div style={{display:'flex',gap:'.25rem',padding:'.25rem .5rem'}}>
                    <input type="date" value={periodFrom} onChange={e=>setPeriodFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px'}} />
                    <input type="date" value={periodTo} onChange={e=>setPeriodTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px'}} />
                  </div>
                  <div style={{padding:'.25rem .5rem'}}>
                    <button onClick={()=>{if(!periodFrom||!periodTo)return alert('Выберите обе даты');setPeriod('custom');setPeriodLabel(periodFrom.split('-').reverse().join('.')+' — '+periodTo.split('-').reverse().join('.'));setShowPeriod(false)}}
                      style={{width:'100%',padding:'.3rem',background:'var(--primary)',color:'#fff',border:'none',borderRadius:'5px',fontSize:'.72rem',cursor:'pointer',fontFamily:'var(--font)'}}>Применить</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{position:'relative'}}>
            <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"var(--primary)",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
              onClick={()=>{setShowDownload(!showDownload);setShowPeriod(false)}}>Скачать</span>
            {showDownload && (
              <div style={{position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'230px',padding:'.45rem',zIndex:100}}>
                <div style={{fontSize:'.72rem',color:'var(--muted)',textAlign:'center',marginBottom:'.35rem'}}>
                  Вы скачиваете отчёт за <b>{periodLabel.toLowerCase()}</b>. Измените даты чтобы выбрать другой период.
                </div>
                <div style={{display:'flex',gap:'.35rem',justifyContent:'center'}}>
                  <span onClick={()=>{exportCsv(filtered);setShowDownload(false)}} style={{padding:'.25rem .6rem',fontSize:'.78rem',borderRadius:'5px',cursor:'pointer',background:'var(--primary)',color:'#fff',fontFamily:'var(--font)'}}>Скачать</span>
                  <span onClick={()=>{setShowDownload(false);setShowPeriod(true)}} style={{padding:'.25rem .6rem',fontSize:'.78rem',borderRadius:'5px',cursor:'pointer',background:'transparent',border:'1px solid var(--border)',color:'var(--muted)',fontFamily:'var(--font)'}}>Изменить даты</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!loading && (
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '.75rem 0' }}>
          <div style={{ flex: 1, minWidth: '120px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '10px', padding: '.65rem .75rem' }}>
            <div style={{ fontSize: '.65rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>ВЫРУЧКА</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#14532d', marginTop: '.1rem' }}>{incomeTotal.toLocaleString()}₽</div>
          </div>
          <div style={{ flex: 1, minWidth: '120px', background: '#fce7f3', border: '1px solid #f9a8d4', borderRadius: '10px', padding: '.65rem .75rem' }}>
            <div style={{ fontSize: '.65rem', color: '#9d174d', fontWeight: 600, textTransform: 'uppercase' }}>РАСХОДЫ</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#831843', marginTop: '.1rem' }}>{expenseTotal.toLocaleString()}₽</div>
          </div>
          <div style={{ flex: 1, minWidth: '120px', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '10px', padding: '.65rem .75rem' }}>
            <div style={{ fontSize: '.65rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>ПРИБЫЛЬ</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e3a8a', marginTop: '.1rem' }}>{profit.toLocaleString()}₽</div>
          </div>
          <div style={{ flex: 1, minWidth: '120px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px', padding: '.65rem .75rem' }}>
            <div style={{ fontSize: '.65rem', color: '#92400e', fontWeight: 600, textTransform: 'uppercase' }}>СРЕДНИЙ ЧЕК</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#78350f', marginTop: '.1rem' }}>{avgCheck.toLocaleString()}₽</div>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          <p>Пока нет транзакций</p>
        </div>
      )}

      {txs.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: '.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr id="colHeaders">
              <th>Дата</th><th>Название</th><th>Сумма</th><th>Категория</th><th className="actions"></th>
            </tr></thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} style={{ fontSize: '.82rem', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '.5rem .5rem .5rem 0', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{tx.date ? tx.date.split("-").reverse().join(".") : "—"}</td>
                  <td style={{ padding: '.5rem', fontWeight: 500, textAlign: 'center' }}>{tx.description || '—'}</td>
                  <td style={{ padding: '.5rem', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center', color: tx.type === 'income' ? '#16a34a' : '#dc2626' }}>
                    {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()}₽
                  </td>
                  <td style={{ padding: '.5rem', color: 'var(--muted)' , textAlign: 'center' }}>{tx.categories?.name || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="act-btn prod-edit-btn" onClick={function(){editTx(tx)}}>Ред.</button>
                    <div className="prod-more-wrap">
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
      )}
      {showIncome && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==="modal-overlay active"){setShowIncome(false);setEditingId(null)}}}>
          <div className="modal-box">
            <button className="modal-close" onClick={function(){setShowIncome(false);setEditingId(null)}}>&times;</button>
            <h2>{editingId ? "Редактировать доход" : "Добавить доход"}</h2>
            <div className="sub">Запишите новый доход</div>
            <form onSubmit={function(e){
              e.preventDefault();
              if(!incName || !incAmount){alert("Заполните название и сумму");return}
              if(editingId){
                update(editingId,{description:incName,amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                setShowIncome(false);setEditingId(null);resetForms();
              }else{
                setPendingTx({type:"income",user_id:user.id,description:incName,amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
                setSelectedAcc("cash");setSplitMode(false);setSplitAmounts({cash:0,card:0,transfer:0});setShowAccSelect(true);
              }
            }}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например: инвестиции, партнёрские, проценты" value={incName} onChange={function(e){setIncName(e.target.value)}} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Сумма (₽) *</label>
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
                <button type="submit" className="btn btn-primary">{editingId ? "Сохранить" : "Добавить"}</button>
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
            <div className="sub">Запишите новый расход</div>
            <form onSubmit={function(e){
              e.preventDefault();
              if(!expName || !expAmount){alert("Заполните название и сумму");return}
              if(editingId){
                update(editingId,{description:expName,amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                setShowExpense(false);setEditingId(null);resetForms();
              }else{
                setPendingTx({type:"expense",user_id:user.id,description:expName,amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
                setSelectedAcc("cash");setSplitMode(false);setSplitAmounts({cash:0,card:0,transfer:0});setShowAccSelect(true);
              }
            }}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например: аренда, коммунальные, налоги" value={expName} onChange={function(e){setExpName(e.target.value)}} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Сумма (₽) *</label>
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
                <button type="submit" className="btn btn-primary">{editingId ? "Сохранить" : "Добавить"}</button>
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
            <div className="sub">{(pendingTx ? (pendingTx.type === "expense" ? "Сумма расхода" : "Сумма дохода") : "") + ": " + (pendingTx ? Number(pendingTx.amount).toLocaleString() : "0") + "₽"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:".5rem",margin:".75rem 0"}}>
              {[{type:"cash",icon:"💵",label:"Наличные"},{type:"checking",icon:"🏦",label:"Расчётный счёт"},{type:"card",icon:"💳",label:"Бизнес-карта"},{type:"bank",icon:"🏛️",label:"Банковский счёт"},{type:"electronic",icon:"🌐",label:"Электронные деньги"},{type:"reserve",icon:"🔒",label:"Резерв"},{type:"deposit",icon:"📜",label:"Депозит"}].map(function(a){
                var sel = selectedAcc === a.type;
                return (
                  <div key={a.type} onClick={function(){setSelectedAcc(a.type)}} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".65rem .75rem",cursor:"pointer",borderRadius:"var(--radius)",background:sel?"var(--primary-light)":"var(--white)",border:"1.5px solid "+(sel?"var(--primary)":"var(--border)")}}>
                    <div style={{width:"18px",height:"18px",border:"2px solid "+(sel?"var(--primary)":"var(--border)"),borderRadius:"50%",flexShrink:0,borderWidth:sel?"6px":"2px"}} />
                    <span style={{fontSize:"1rem"}}>{a.icon}</span>
                    <span style={{flex:1,fontSize:".85rem",fontWeight:500}}>{a.label}</span>
                    <span style={{fontSize:".82rem",fontWeight:600,color:"var(--primary)"}}>{(function(){var b=0;(txs||[]).forEach(function(t){if(t.account_id){var ac=(accs||[]).find(function(x){return x&&x.type===a.type});if(ac&&t.account_id===ac.id){b+=Number(t.amount||0)*(t.type==="income"?1:-1)}}});return b})()}₽</span>
                  </div>
                );
              })}
            </div>
            <div className="sub" style={{marginBottom:".75rem",cursor:"pointer",fontSize:".82rem",color:"var(--primary)"}} onClick={function(){
              if(!splitMode){var amt=pendingTx?Math.round((pendingTx.amount||0)/3):0;var total=pendingTx?pendingTx.amount:0;setSplitAmounts({cash:amt,card:amt,transfer:total-amt*2})}
              setSplitMode(!splitMode)
            }}>{splitMode ? "➖ Разделить" : "➕ Разделить"}</div>
            {splitMode && [{type:"cash",icon:"💵",label:"Наличные"},{type:"checking",icon:"🏦",label:"Расчётный счёт"},{type:"card",icon:"💳",label:"Бизнес-карта"},{type:"bank",icon:"🏛️",label:"Банковский счёт"},{type:"electronic",icon:"🌐",label:"Электронные деньги"},{type:"reserve",icon:"🔒",label:"Резерв"},{type:"deposit",icon:"📜",label:"Депозит"}].map(function(a){
              return (
                <div key={a.type} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".35rem 0"}}>
                  <span style={{fontSize:"1rem",width:"24px",textAlign:"center"}}>{a.icon}</span>
                  <span style={{flex:1,fontSize:".8rem"}}>{a.label}</span>
                  <input type="number" value={splitAmounts[a.type]||""} onChange={function(e){var v=parseFloat(e.target.value)||0;setSplitAmounts(function(p){var r=Object.assign({},p);r[a.type]=v;return r})}}
                    style={{width:"100px",padding:".35rem .4rem",fontSize:".8rem",border:"1px solid var(--border)",borderRadius:"5px",outline:"none",textAlign:"center",fontFamily:"var(--font)"}} />
                </div>
              );
            })}
            <div className="modal-actions" style={{marginTop:".5rem",borderTop:"none",paddingTop:0}}>
              <button className="btn btn-primary" onClick={function(){confirmTx()}} style={{width:"100%"}}>
                {(pendingTx ? (pendingTx.type === "expense" ? "Списать" : "Зачислить") : "") + " " + (pendingTx ? Number(pendingTx.amount).toLocaleString() : "0") + "₽"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
