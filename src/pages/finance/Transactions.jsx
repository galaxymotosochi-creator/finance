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
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expCategory, setExpCategory] = useState('');

  const txs = transactions || [];
  const filtered = search ? txs.filter(function(tx){return (tx.description||"").toLowerCase().includes(search.toLowerCase())}) : txs;
  const accs = accounts || [];
  const cats = categories || [];

  const incomeTotal = txs.filter(t => t && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const expenseTotal = txs.filter(t => t && t.type !== 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const profit = incomeTotal - expenseTotal;
  const sales = txs.filter(t => t && t.type === 'sale');
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
    } catch (e) { console.error(e); }
  };

  const openIncome = () => {
    setShowIncome(true);
  };

  const submitIncome = (e) => {
    e.preventDefault();
    if (!incName || !incAmount) { alert('Заполните название и сумму'); return; }
    setPendingTx({
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
      if (splitMode) {
        for (const [type, amt] of Object.entries(splitAmounts)) {
          if (amt > 0) {
            const acct = accs.find(a => a?.type === type) || accs[0];
            if (acct) await add({ ...pendingTx, account_id: acct.id, amount: amt });
          }
        }
      } else {
        const acct = accs.find(a => a?.type === selectedAcc) || accs[0];
        if (acct) await add({ ...pendingTx, account_id: acct.id });
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
          <button className="btn-red" onClick={() => setShowExpense(true)}>+ Расход</button>
          <button className="btn-green" onClick={() => setShowIncome(true)}>+ Доход</button>
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
          <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"var(--primary)",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}>📅 Период</span>
          <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"var(--primary)",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}>Скачать</span>
          <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".9rem",color:"var(--primary)",cursor:"pointer",borderRight:"none",lineHeight:1}}>⚙️</span>
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
          <p style={{ marginBottom: '.75rem' }}>Пока нет транзакций</p>
          <button onClick={seed} style={{ padding: '.5rem 1rem', fontSize: '.82rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--white)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Заполнить демо-данными
          </button>
        </div>
      )}

      {txs.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: '.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr id="colHeaders">
              <th>Дата</th><th>Название</th><th>Сумма</th><th>Категория</th>
            </tr></thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} style={{ fontSize: '.82rem', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '.5rem .5rem .5rem 0', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{tx.date}</td>
                  <td style={{ padding: '.5rem', fontWeight: 500 }}>{tx.description || '—'}</td>
                  <td style={{ padding: '.5rem', fontWeight: 600, whiteSpace: 'nowrap', color: tx.type === 'income' ? '#16a34a' : '#dc2626' }}>
                    {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()}₽
                  </td>
                  <td style={{ padding: '.5rem', color: 'var(--muted)' }}>{tx.categories?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showIncome && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==="modal-overlay active")setShowIncome(false)}}>
          <div className="modal-box">
            <button className="modal-close" onClick={function(){setShowIncome(false)}}>&times;</button>
            <h2>Добавить доход</h2>
            <div className="sub">Запишите новый доход</div>
            <form onSubmit={function(e){
              e.preventDefault();
              if(!incName || !incAmount){alert("Заполните название и сумму");return}
              setPendingTx({type:"income",user_id:user.id,description:incName,amount:parseFloat(incAmount),date:incDate,category_id:incCategory||null});
              setSelectedAcc("cash");setSplitMode(false);setSplitAmounts({cash:0,card:0,transfer:0});setShowAccSelect(true);
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
                <button type="submit" className="btn btn-primary">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExpense && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==="modal-overlay active")setShowExpense(false)}}>
          <div className="modal-box">
            <button className="modal-close" onClick={function(){setShowExpense(false)}}>&times;</button>
            <h2>Добавить расход</h2>
            <div className="sub">Запишите новый расход</div>
            <form onSubmit={function(e){
              e.preventDefault();
              if(!expName || !expAmount){alert("Заполните название и сумму");return}
              setPendingTx({type:"expense",user_id:user.id,description:expName,amount:parseFloat(expAmount),date:expDate,category_id:expCategory||null});
              setSelectedAcc("cash");setSplitMode(false);setSplitAmounts({cash:0,card:0,transfer:0});setShowAccSelect(true);
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
                <button type="submit" className="btn btn-primary">Добавить</button>
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
              {[{type:"cash",icon:"💵",label:"Наличные"},{type:"card",icon:"💳",label:"Карта"},{type:"transfer",icon:"🔄",label:"Перевод"}].map(function(a){
                var sel = selectedAcc === a.type;
                return (
                  <div key={a.type} onClick={function(){setSelectedAcc(a.type)}} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".65rem .75rem",cursor:"pointer",borderRadius:"var(--radius)",background:sel?"var(--primary-light)":"var(--white)",border:"1.5px solid "+(sel?"var(--primary)":"var(--border)")}}>
                    <div style={{width:"18px",height:"18px",border:"2px solid "+(sel?"var(--primary)":"var(--border)"),borderRadius:"50%",flexShrink:0,borderWidth:sel?"6px":"2px"}} />
                    <span style={{fontSize:"1rem"}}>{a.icon}</span>
                    <span style={{flex:1,fontSize:".85rem",fontWeight:500}}>{a.label}</span>
                    <span style={{fontSize:".82rem",fontWeight:600,color:"var(--primary)"}}>{((accs||[]).find(function(x){return x&&x.type===a.type})||{}).balance||0}₽</span>
                  </div>
                );
              })}
            </div>
            <div className="sub" style={{marginBottom:".75rem",cursor:"pointer",fontSize:".82rem",color:"var(--primary)"}} onClick={function(){
              if(!splitMode){var amt=pendingTx?Math.round((pendingTx.amount||0)/3):0;var total=pendingTx?pendingTx.amount:0;setSplitAmounts({cash:amt,card:amt,transfer:total-amt*2})}
              setSplitMode(!splitMode)
            }}>{splitMode ? "➖ Разделить" : "➕ Разделить"}</div>
            {splitMode && [{type:"cash",icon:"💵",label:"Наличные"},{type:"card",icon:"💳",label:"Карта"},{type:"transfer",icon:"🔄",label:"Перевод"}].map(function(a){
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
              <button className="btn btn-primary" onClick={async function(){
                if(!pendingTx)return;
                try{
                  var accts = accs||[];
                  if(splitMode){
                    var entries = Object.entries(splitAmounts);
                    for(var i=0;i<entries.length;i++){
                      var e=entries[i];
                      if(e[1]>0){var a=accts.find(function(x){return x&&x.type===e[0]})||accts[0];if(a)await add(Object.assign({},pendingTx,{account_id:a.id,amount:e[1]}))}
                    }
                  }else{
                    var a=accts.find(function(x){return x&&x.type===selectedAcc})||accts[0];
                    if(a)await add(Object.assign({},pendingTx,{account_id:a.id}));
                  }
                  setShowAccSelect(false);setPendingTx(null);setShowIncome(false);setShowExpense(false);
                  setIncName("");setIncAmount("");setIncDate(new Date().toISOString().split("T")[0]);setIncCategory("");
                  setExpName("");setExpAmount("");setExpDate(new Date().toISOString().split("T")[0]);setExpCategory("");
                }catch(err){alert(err.message)}
              }} style={{width:"100%"}}>
                {(pendingTx ? (pendingTx.type === "expense" ? "Списать" : "Зачислить") : "") + " " + (pendingTx ? Number(pendingTx.amount).toLocaleString() : "0") + "₽"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
