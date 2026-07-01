import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const STATUS_LABELS = {pending:'Начислено',accrued:'Начислено',paid:'Выплачено',cancelled:'Отменено'};
const STATUS_COLORS = {accrued:'#2563eb',paid:'#16a34a',cancelled:'#dc2626'};
const SALARY_TYPES = [{value:'fixed',label:'Фиксированный оклад'},{value:'shift',label:'За смену'},{value:'piecework',label:'Сдельная'}];

function daysInMonth(y,m){return new Date(y,m,0).getDate()}

function calcProportionalSalary(monthlySalary, from, to){
  if(!monthlySalary||!from||!to) return 0;
  var f=new Date(from), t=new Date(to);
  if(f>t) return 0;
  var lastDay = new Date(t.getFullYear(), t.getMonth()+1, 0);
  if(f.getDate()===1 && t.getTime()===lastDay.getTime()) return Math.round(monthlySalary);
  if(f.getDate()===t.getDate()){
    var monthsDiff = (t.getFullYear()-f.getFullYear())*12 + t.getMonth()-f.getMonth();
    if(monthsDiff === 1) return Math.round(monthlySalary);
  }
  var total=0;
  var cur=new Date(f);
  while(cur<=t){
    var y=cur.getFullYear(), m=cur.getMonth();
    var last=new Date(y,m+1,0);
    var monthEnd=last<t?last:t;
    var monthStart=(cur.getTime()===f.getTime())?f:new Date(y,m,1);
    var daysInM=daysInMonth(y,m+1);
    var daysWorked=Math.round((monthEnd-monthStart)/(1000*60*60*24))+1;
    if(daysWorked===daysInM) total+=monthlySalary;
    else total+=monthlySalary/daysInM*daysWorked;
    cur=new Date(y,m+1,1);
  }
  return Math.round(total);
}

function calcDays(from,to){
  if(!from||!to) return 0;
  return Math.round((new Date(to)-new Date(from))/(1000*60*60*24))+1;
}

const fmtDate = (ds) => { if(!ds) return ''; var p=ds.split('-'); return p.length===3?p[2]+'.'+p[1]:ds; };

export default function Salary() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [accs, setAccs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showAcc, setShowAcc] = useState(false);
  const [pendingPayId, setPendingPayId] = useState(null);

  // Form
  const [fEmpId, setFEmpId] = useState('');
  const [fPeriodFrom, setFPeriodFrom] = useState('');
  const [fPeriodTo, setFPeriodTo] = useState('');
  const [fBaseSalary, setFBaseSalary] = useState(0);
  const [fSalaryType, setFSalaryType] = useState('fixed');
  const [fSalaryTotal, setFSalaryTotal] = useState(0);
  const [fDays, setFDays] = useState(0);
  const [fPayType, setFPayType] = useState('salary');
  const [existingDebt, setExistingDebt] = useState(0);
  const [fStatus, setFStatus] = useState('pending');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);

  // Timesheet data
  const [tsEntries, setTsEntries] = useState([]);
  const [bonusChecks, setBonusChecks] = useState({});
  const [deductChecks, setDeductChecks] = useState({});
  const [tsLoaded, setTsLoaded] = useState(false);
  const [salarySplitMode, setSalarySplitMode] = useState(false);
  const [salarySplitAmounts, setSalarySplitAmounts] = useState({});

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }
    try {
      const [salRes, empRes, accRes] = await Promise.all([
        supabase.from('salary').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('employees').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        user ? supabase.from('accounts').select('*') : Promise.resolve({data:[]}),
      ]);
      if (salRes.error) { alert('Ошибка загрузки: ' + salRes.error.message); setLoading(false); return; }
      if (salRes.data) setList(salRes.data);
      if (empRes.data) setEmployees(empRes.data);
      if (accRes.data) setAccs(accRes.data);
    } catch (e) { alert('Ошибка загрузки: ' + e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Загрузка табеля при выборе сотрудника + периода
  useEffect(() => {
    if (!fEmpId || !fPeriodFrom || !fPeriodTo) { setTsEntries([]); setBonusChecks({}); setDeductChecks({}); setTsLoaded(false); return; }
    (async () => {
      setTsLoaded(false);
      try {
        const { data } = await supabase
          .from('timesheet_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('employee_id', fEmpId)
          .gte('date', fPeriodFrom)
          .lte('date', fPeriodTo);
        const entries = data || [];
        setTsEntries(entries);
        const bc = {}; const dc = {};
        entries.forEach(e => {
          if ((e.bonus_amount||0) > 0) bc[e.id] = true;
          if ((e.deduct_amount||0) > 0) dc[e.id] = true;
        });
        setBonusChecks(bc);
        setDeductChecks(dc);
        setTsLoaded(true);
      } catch(e) { setTsLoaded(true); }
    })();
  }, [fEmpId, fPeriodFrom, fPeriodTo, user]);

  // Подтянуть оклад из сотрудника
  useEffect(() => {
    if (!fEmpId) return;
    const emp = employees.find(e => e.id === fEmpId);
    if (emp) setFBaseSalary(emp.base_salary || 0);
  }, [fEmpId, employees]);

  // Пересчет
  useEffect(() => {
    if (fSalaryType === 'fixed') {
      const sal = calcProportionalSalary(fBaseSalary, fPeriodFrom, fPeriodTo);
      setFSalaryTotal(sal);
    } else if (fSalaryType === 'shift') {
      const days = calcDays(fPeriodFrom, fPeriodTo);
      setFSalaryTotal(fBaseSalary * days);
    } else {
      setFSalaryTotal(fBaseSalary || 0);
    }
    setFDays(calcDays(fPeriodFrom, fPeriodTo));
  }, [fBaseSalary, fPeriodFrom, fPeriodTo, fSalaryType]);

  // Долг
  useEffect(() => {
    if (!fEmpId) return;
    const debt = list
      .filter(s => s.employee_id === fEmpId && s.status !== 'cancelled' && s.pay_type !== 'bonus')
      .reduce((sum, s) => {
        const amt = Number(s.amount) || 0;
        return s.status === 'paid' ? sum - amt :
          s.pay_type === 'advance' ? sum - amt : sum + amt;
      }, 0);
    setExistingDebt(debt);
  }, [fEmpId, list]);

  const tsBonuses = tsEntries.filter(e => (e.bonus_amount||0) > 0);
  const tsDeducts = tsEntries.filter(e => (e.deduct_amount||0) > 0);
  const checkedBonusTotal = tsBonuses.filter(e => bonusChecks[e.id]).reduce((s,e) => s + Number(e.bonus_amount||0), 0);
  const checkedDeductTotal = tsDeducts.filter(e => deductChecks[e.id]).reduce((s,e) => s + Number(e.deduct_amount||0), 0);
  const grandTotal = fSalaryTotal + checkedBonusTotal - checkedDeductTotal;

  const openAdd = () => {
    setEditId(null); setFEmpId(''); setFPeriodFrom(''); setFPeriodTo('');
    setFBaseSalary(0); setFSalaryType('fixed'); setFSalaryTotal(0); setFDays(0);
    setFPayType('salary'); setFStatus('pending'); setFDate(new Date().toISOString().split('T')[0]);
    setExistingDebt(0); setTsEntries([]); setBonusChecks({}); setDeductChecks({});
    setShow(true);
  };

  const openEdit = (s) => {
    setEditId(s.id); setFEmpId(s.employee_id||'');
    setFPeriodFrom(s.period_from||''); setFPeriodTo(s.period_to||'');
    setFBaseSalary(s.base_salary||0); setFSalaryType('fixed');
    setFSalaryTotal(s.base_salary||0); setFDays(s.days_worked||0);
    setFPayType(s.pay_type||'salary'); setFStatus(s.status||'pending');
    setFDate(s.date||new Date().toISOString().split('T')[0]);
    // Восстанавливаем checked из bonus_items/deduct_items
    const bc = {}; const dc = {};
    if (s.bonus_items && Array.isArray(s.bonus_items)) s.bonus_items.forEach(i => { if (i.tsEntryId) bc[i.tsEntryId] = true; });
    if (s.deduct_items && Array.isArray(s.deduct_items)) s.deduct_items.forEach(i => { if (i.tsEntryId) dc[i.tsEntryId] = true; });
    setBonusChecks(bc); setDeductChecks(dc);
    setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fEmpId) return alert('Выберите сотрудника');
    if (!fPeriodFrom || !fPeriodTo) return alert('Выберите период');
    if (!user) return alert('Ошибка: пользователь не авторизован');
    const emp = employees.find(e => e.id === fEmpId);
    try {
      const takeBonus = tsBonuses.filter(e => bonusChecks[e.id]);
      const takeDeduct = tsDeducts.filter(e => deductChecks[e.id]);
      const obj = {
        user_id: user.id, employee_id: fEmpId, employee_name: emp ? emp.name : 'Сотрудник',
        period_from: fPeriodFrom, period_to: fPeriodTo, period_start: fPeriodFrom, period_end: fPeriodTo,
        base_salary: fBaseSalary, days_worked: fDays,
        amount: grandTotal, status: fStatus, pay_type: fPayType,
        bonus_amount: checkedBonusTotal, bonus_items: takeBonus.map(e => ({ tsEntryId: e.id, date: e.date, amount: e.bonus_amount, comment: e.bonus_comment||'' })),
        deduct_amount: checkedDeductTotal, deduct_items: takeDeduct.map(e => ({ tsEntryId: e.id, date: e.date, amount: e.deduct_amount, comment: e.deduct_comment||'' })),
        paid_at: fStatus === 'paid' ? fDate : null,
      };
      if (editId) { await supabase.from('salary').update(obj).eq('id', editId); }
      else { await supabase.from('salary').insert(obj); }
      await load(); setShow(false);
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Удалить начисление?')) return;
    try { await supabase.from('salary').delete().eq('id', id); await load(); }
    catch (err) { alert('Ошибка удаления: ' + err.message); }
  };

  const getAccountBalance = (a) => parseFloat(a.balance || a.initial_balance || 0);

  const confirmPay = async (accId, splitAmts) => {
    try {
      const { data: rows } = await supabase.from('salary').select('*').eq('id', pendingPayId);
      if (!rows || !rows.length) return;
      const s = rows[0];

      // Найти или создать категорию «Зарплата»
      var salaryCatId = null;
      var { data: foundCats } = await supabase.from('categories').select('id').eq('user_id', user.id).eq('name', 'Зарплата').maybeSingle();
      if (foundCats) {
        salaryCatId = foundCats.id;
      } else {
        var { data: newCat } = await supabase.from('categories').insert({
          user_id: user.id, name: 'Зарплата', type: 'expense'
        }).select('id').maybeSingle();
        if (newCat) salaryCatId = newCat.id;
      }

      // Проверка баланса
      if (splitAmts && Object.keys(splitAmts).length > 0) {
        for (const [aid, amt] of Object.entries(splitAmts)) {
          if (amt <= 0) continue;
          const acct = accs.find(a => a.id === aid);
          const balance = acct ? getAccountBalance(acct) : 0;
          if (balance < amt) {
            return alert('Недостаточно средств на счету ' + (acct?.name || 'счёт') + '. Доступно: ' + balance.toLocaleString() + ' ₽, нужно: ' + amt.toLocaleString() + ' ₽');
          }
        }
      } else {
        const acct = accs.find(a => a.id === accId);
        const balance = acct ? getAccountBalance(acct) : 0;
        if (balance < s.amount) {
          return alert('Недостаточно средств на счету ' + (acct?.name || 'счёт') + '. Доступно: ' + balance.toLocaleString() + ' ₽, нужно: ' + Number(s.amount).toLocaleString() + ' ₽');
        }
      }

      if (splitAmts && Object.keys(splitAmts).length > 0) {
        for (const [aid, amt] of Object.entries(splitAmts)) {
          if (amt <= 0) continue;
          await supabase.from('transactions').insert({
            user_id: user.id, account_id: aid,
            type: 'expense', amount: amt,
            description: 'Зарплата: ' + (s.employee_name || 'Сотрудник') + ' — ' + (s.period_from || '') + ' / ' + (s.period_to || ''),
            date: fDate, category_id: salaryCatId,
          });
        }
      } else {
        await supabase.from('transactions').insert({
          user_id: user.id, account_id: accId,
          type: 'expense', amount: s.amount,
          description: 'Зарплата: ' + (s.employee_name || 'Сотрудник') + ' — ' + (s.period_from || '') + ' / ' + (s.period_to || ''),
          date: fDate, category_id: salaryCatId,
        });
      }
      await supabase.from('salary').update({ status: 'paid', paid_at: fDate }).eq('id', pendingPayId);
      await load(); setShowAcc(false); setPendingPayId(null); setSalarySplitMode(false); setSalarySplitAmounts({});
    } catch (err) { alert('Ошибка выплаты: ' + err.message); }
  };

  const toggleBonus = (id) => setBonusChecks(prev => ({...prev, [id]: !prev[id]}));
  const toggleDeduct = (id) => setDeductChecks(prev => ({...prev, [id]: !prev[id]}));

  const abbreviateName = (name) => {
    if (!name) return '—';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const surname = parts[0];
    const initials = parts.slice(1).map(p => p.charAt(0) + '.').join(' ');
    return surname + ' ' + initials;
  };

  const fmtD = (d) => { if(!d) return '—'; var p=d.split('-'); return p.length===3?p[2]+'.'+p[1]+'.'+p[0].slice(2):d; };

  return (
    <>
      <div className="page-header">
        <div><h1>Зарплата</h1><div className="sub">Расчет начислений с привязкой к табелю</div></div>
        <div className="page-actions"><button className="btn-mint" onClick={openAdd}>+ Начислить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {loading ? (
        <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>
      ) : (
      <div className="product-table" style={{overflowX:'auto'}}>
        <table>
          <thead id="salaryColHeaders"><tr>
            <th>Сотрудник</th><th>Период</th><th>Оклад</th><th>Премия</th>
            <th>Вычеты</th><th>Итого</th><th>Статус</th><th style={{width:'90px'}}></th>
          </tr></thead>
          <tbody id="salaryTableBody">
            {list.length === 0 ? (
              <tr><td colSpan="8"><div className="empty-products"><div className="big-icon">💼</div><p>История начислений пуста</p>
                    <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Начислите зарплату с привязкой к табелю</p></div></td></tr>
            ) : list.map(s => (
              <tr key={s.id}>
                <td><div className="prod-name" style={{whiteSpace:'nowrap'}} onClick={()=>{}}>{abbreviateName(s.employee_name)||'—'}</div></td>
                <td style={{whiteSpace:'nowrap',color:'#555'}}>{s.period_from?fmtD(s.period_from)+' – '+fmtD(s.period_to):'—'}</td>
                <td style={{whiteSpace:'nowrap',color:'#555'}}>{s.base_salary?s.base_salary.toLocaleString()+' ₽':'—'}</td>
                <td style={{whiteSpace:'nowrap',color:'#555'}}>{s.bonus_amount?s.bonus_amount.toLocaleString()+' ₽':'—'}</td>
                <td style={{whiteSpace:'nowrap',color:'#555'}}>{s.deduct_amount?s.deduct_amount.toLocaleString()+' ₽':'—'}</td>
                <td style={{whiteSpace:'nowrap',color:'#555'}}>{Number(s.amount).toLocaleString()} ₽</td>
                <td style={{color:'#555'}}>{(s.status==='pending'||s.status==='accrued')
                  ? <span onClick={()=>{setPendingPayId(s.id);setShowAcc(true)}}
                      style={{padding:'.2rem .5rem',fontSize:'.72rem',borderRadius:'6px',border:'none',cursor:'pointer',background:'#16a34a',color:'#fff',fontFamily:'var(--font)',whiteSpace:'nowrap',display:'inline-block'}}>Выплатить</span>
                  : <span className="prod-cat">{STATUS_LABELS[s.status]||s.status}</span>}</td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={e=>{e.stopPropagation();var dd=e.currentTarget.nextElementSibling;document.querySelectorAll('.prod-dropdown.open').forEach(d=>{if(d!==dd)d.classList.remove('open')});dd.classList.toggle('open')}}>⋯</button>
                    <div className="prod-dropdown">
                      <button onClick={()=>openEdit(s)}>Редактировать</button>
                      <button onClick={()=>remove(s.id)} style={{color:'#dc3545'}}>Удалить</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* МОДАЛКА НАЧИСЛЕНИЯ */}
      {show && (
        <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active')setShow(false)}}>
          <div className="modal-box" style={{maxWidth:'560px',padding:0,overflow:'hidden',borderRadius:'16px'}}>
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)'}}>
              <h2>{editId?'Редактировать':'Начислить зарплату'}</h2>
              <div className="sub" style={{margin:0,marginTop:'2px'}}>Выберите сотрудника и период</div>
            </div>
            <form onSubmit={save} style={{padding:'1rem 1.25rem',display:'flex',flexDirection:'column',gap:'.75rem'}}>

              {/* Сотрудник + период */}
              <div style={{fontSize:'.72rem',fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.04em'}}>Сотрудник и период</div>
              <div style={{display:'flex',gap:'.35rem',alignItems:'center'}}>
                <select value={fEmpId} onChange={e=>setFEmpId(e.target.value)} required
                  style={{flex:3,minWidth:'180px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',lineHeight:'1.3',boxSizing:'border-box',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',background:'var(--white)',color:'#111'}}>
                  <option value="">— выберите —</option>
                  {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <input type="date" value={fPeriodFrom} onChange={e=>setFPeriodFrom(e.target.value)} required
                  style={{flex:1,minWidth:'115px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',lineHeight:'1.3',boxSizing:'border-box',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none'}} />
                <input type="date" value={fPeriodTo} onChange={e=>setFPeriodTo(e.target.value)} required
                  style={{flex:1,minWidth:'115px',padding:'.3rem .4rem',fontSize:'.72rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none'}} />
              </div>

              {/* Расчет */}
              <div style={{background:'#f8f9fa',borderRadius:'12px',padding:'.75rem'}}>
                <div style={{fontSize:'.72rem',fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:'.5rem'}}>Расчет</div>
                <div style={{display:'flex',gap:'.35rem',flexWrap:'wrap',marginBottom:'.65rem'}}>
                  {SALARY_TYPES.map(t => (
                    <span key={t.value} onClick={()=>setFSalaryType(t.value)}
                      style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'.2rem .5rem',fontSize:'.72rem',borderRadius:'100px',cursor:'pointer',fontWeight:500,
                        background:fSalaryType===t.value?'var(--primary)':'#f1f3f5',color:fSalaryType===t.value?'#000':'var(--muted)'}}>{t.label}</span>
                  ))}
                </div>
                <div style={{display:'flex',gap:'.35rem',alignItems:'flex-start'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'.68rem',color:'var(--muted)',marginBottom:'4px'}}>{fSalaryType === 'shift' ? 'Ставка за смену' : 'Оклад'}</div>
                    <input type="number" value={fBaseSalary||""} onChange={e=>setFBaseSalary(e.target.value?parseFloat(e.target.value):0)}
                      style={{width:'100%',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',lineHeight:'1.3',boxSizing:'border-box',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none'}} />
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'.68rem',color:'var(--muted)',marginBottom:'4px'}}>Отработано</div>
                    <div style={{padding:'.35rem .5rem',fontSize:'.78rem',fontWeight:600,lineHeight:'1.3',boxSizing:'border-box',background:'#f8f9fa',borderRadius:'8px',border:'1.5px solid var(--border)'}}>
                      {fDays} дн. / {calcDays(fPeriodFrom,fPeriodTo)||'?'} дн.
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'.68rem',color:'var(--muted)',marginBottom:'4px'}}>За период</div>
                    <input type="text" value={fSalaryTotal.toLocaleString()+' ₽'} disabled
                      style={{width:'100%',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',lineHeight:'1.3',boxSizing:'border-box',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',background:'#f8f9fa'}} />
                  </div>
                </div>
              {salarySplitMode && (
                <button onClick={()=>confirmPay(null, salarySplitAmounts)}
                  style={{width:'100%',padding:'.45rem 1rem',fontSize:'.8rem',fontWeight:600,borderRadius:'100px',border:'none',cursor:'pointer',background:'var(--secondary)',color:'#fff',fontFamily:'var(--font)',marginTop:'.35rem'}}>Подтвердить разделение</button>
              )}
              </div>

              {/* Премии из табеля */}
              <div style={{border:'1px solid #bbf7d0',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'.5rem .65rem',background:'#f0fdf4',borderBottom:'1px solid #bbf7d0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:'.78rem',fontWeight:600,color:'#16a34a'}}>Премии из табеля</span>
                  <span style={{fontSize:'.68rem',color:'#16a34a'}}>{checkedBonusTotal.toLocaleString()} ₽</span>
                </div>
                <div style={{padding:'.5rem .65rem'}}>
                  {tsBonuses.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fEmpId ? 'Выберите сотрудника' : !tsLoaded ? 'Загрузка...' : 'Нет премий за этот период'}</div>
                  ) : (
                    <>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.75rem',tableLayout:'fixed'}}>
                        <thead><tr><th style={{width:'30px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}></th>
                          <th style={{width:'65px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>Дата</th>
                          <th style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>Сумма</th>
                          <th style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>За что</th>
                        </tr></thead>
                        <tbody>
                          {tsBonuses.map(e => (
                            <tr key={e.id}>
                              <td style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',fontSize:'.72rem'}}>
                                <span onClick={()=>toggleBonus(e.id)}
                                  style={{width:'16px',height:'16px',border:'1.5px solid '+(bonusChecks[e.id]?'#16a34a':'var(--border)'),borderRadius:'4px',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'.6rem',cursor:'pointer',background:bonusChecks[e.id]?'#16a34a':'transparent',color:'#fff'}}>
                                  {bonusChecks[e.id] ? '✓' : ''}
                                </span>
                              </td>
                              <td style={{width:'65px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--body-color)',fontWeight:400,fontSize:'.72rem',textAlign:'left'}}>{fmtDate(e.date)}</td>
                              <td style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'#16a34a',fontWeight:600,fontSize:'.72rem',textAlign:'left'}}>+{Number(e.bonus_amount).toLocaleString()} ₽</td>
                              <td style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:400,fontSize:'.72rem',textAlign:'left'}}>{e.bonus_comment||'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{fontSize:'.65rem',color:'var(--muted)',marginTop:'4px'}}>Снимите галочку — премия останется на будущее</div>
                    </>
                  )}
                </div>
              {salarySplitMode && (
                <button onClick={()=>confirmPay(null, salarySplitAmounts)}
                  style={{width:'100%',padding:'.45rem 1rem',fontSize:'.8rem',fontWeight:600,borderRadius:'100px',border:'none',cursor:'pointer',background:'var(--secondary)',color:'#fff',fontFamily:'var(--font)',marginTop:'.35rem'}}>Подтвердить разделение</button>
              )}
              </div>

              {/* Штрафы из табеля */}
              <div style={{border:'1px solid #fecaca',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'.5rem .65rem',background:'#fef2f2',borderBottom:'1px solid #fecaca',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:'.78rem',fontWeight:600,color:'#dc2626'}}>Штрафы из табеля</span>
                  <span style={{fontSize:'.68rem',color:'#dc2626'}}>-{checkedDeductTotal.toLocaleString()} ₽</span>
                </div>
                <div style={{padding:'.5rem .65rem'}}>
                  {tsDeducts.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fEmpId ? 'Выберите сотрудника' : !tsLoaded ? 'Загрузка...' : 'Нет штрафов за этот период'}</div>
                  ) : (
                    <>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.75rem',tableLayout:'fixed'}}>
                        <thead><tr><th style={{width:'30px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}></th>
                          <th style={{width:'65px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>Дата</th>
                          <th style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>Сумма</th>
                          <th style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>За что</th>
                        </tr></thead>
                        <tbody>
                          {tsDeducts.map(e => (
                            <tr key={e.id}>
                              <td style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',fontSize:'.72rem'}}>
                                <span onClick={()=>toggleDeduct(e.id)}
                                  style={{width:'16px',height:'16px',border:'1.5px solid '+(deductChecks[e.id]?'#dc2626':'var(--border)'),borderRadius:'4px',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'.6rem',cursor:'pointer',background:deductChecks[e.id]?'#dc2626':'transparent',color:'#fff'}}>
                                  {deductChecks[e.id] ? '✓' : ''}
                                </span>
                              </td>
                              <td style={{width:'65px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--body-color)',fontWeight:400,fontSize:'.72rem',textAlign:'left'}}>{fmtDate(e.date)}</td>
                              <td style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'#dc2626',fontWeight:600,fontSize:'.72rem',textAlign:'left'}}>-{Number(e.deduct_amount).toLocaleString()} ₽</td>
                              <td style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:400,fontSize:'.72rem',textAlign:'left'}}>{e.deduct_comment||'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{fontSize:'.65rem',color:'var(--muted)',marginTop:'4px'}}>Снимите галочку — штраф останется на будущее</div>
                    </>
                  )}
                </div>
              {salarySplitMode && (
                <button onClick={()=>confirmPay(null, salarySplitAmounts)}
                  style={{width:'100%',padding:'.45rem 1rem',fontSize:'.8rem',fontWeight:600,borderRadius:'100px',border:'none',cursor:'pointer',background:'var(--secondary)',color:'#fff',fontFamily:'var(--font)',marginTop:'.35rem'}}>Подтвердить разделение</button>
              )}
              </div>

              {/* Долг */}
              {existingDebt !== 0 && (
                <div style={{background:'#fffbeb',border:'1px solid #f59e0b',borderRadius:'10px',padding:'.5rem .65rem',fontSize:'.78rem',display:'flex',gap:'.5rem',alignItems:'center'}}>
                  <span style={{color:'#f59e0b',fontWeight:700}}>⚠</span>
                  <span>Невыплаченных: <b>{Math.abs(existingDebt).toLocaleString()} ₽</b>
                    <span style={{fontSize:'.72rem',color:'var(--muted)',marginLeft:'.35rem'}}>после начисления будет {(existingDebt+grandTotal).toLocaleString()} ₽</span>
                  </span>
                </div>
              )}

              {/* Итого */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.65rem .75rem',background:'#f8f9fa',borderRadius:'10px'}}>
                <div style={{fontSize:'.72rem',color:'var(--muted)'}}>
                  {(()=>{const parts=[];if(fSalaryTotal>0)parts.push((fSalaryType==='shift'?'За смену ':'Оклад ')+fSalaryTotal.toLocaleString()+' ₽');if(checkedBonusTotal>0)parts.push('Премии '+checkedBonusTotal.toLocaleString()+' ₽');if(checkedDeductTotal>0)parts.push('Штрафы '+checkedDeductTotal.toLocaleString()+' ₽');if(parts.length===3)return parts[0]+' + '+parts[1]+' − '+parts[2];if(parts.length===2&&parts[1].includes('Штраф'))return parts[0]+' − '+parts[1];return parts.join(' + ');})()}
                </div>
                <div style={{fontSize:'1.15rem',fontWeight:700}}>{grandTotal.toLocaleString()} ₽</div>
              </div>

              {/* Кнопки */}
              <div style={{display:'flex',justifyContent:'flex-end',gap:'.5rem',alignItems:'center'}}>
                <select value={fStatus} onChange={e=>setFStatus(e.target.value)}
                  style={{padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',lineHeight:'1.3',boxSizing:'border-box',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',background:'var(--white)',color:'#111'}}>
                  <option value="pending">Начислено</option>
                  <option value="paid">Выплачено</option>
                </select>
                <button type="submit"
                  style={{padding:'.4rem 1.2rem',fontSize:'.8rem',fontWeight:600,borderRadius:'100px',border:'none',cursor:'pointer',fontFamily:'var(--font)',background:'var(--primary)',color:'var(--primary-text)',display:'inline-flex',alignItems:'center',gap:'.3rem',width:'auto'}}>
                  {fStatus === 'paid' ? 'Выплатить' : 'Начислить'} {grandTotal.toLocaleString()} ₽
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* МОДАЛКА ВЫБОРА СЧЕТА */}
      {showAcc && (()=>{
        const accsList = accs.filter(a => a.type !== 'credit');
        return (
          <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active'){setShowAcc(false);setPendingPayId(null)}}}>
            <div className="modal-box" style={{maxWidth:'400px'}}>
              <button className="modal-close" onClick={()=>{setShowAcc(false);setPendingPayId(null)}}>&times;</button>
              <h2>Выплата зарплаты</h2>
              <div className="sub">Выберите счет для выплаты</div>
              <div style={{display:'flex',flexDirection:'column',gap:'.35rem',marginTop:'.25rem'}}>
                {accsList.length === 0 && <div style={{padding:'.5rem',fontSize:'.82rem',color:'var(--muted)'}}>Нет доступных счетов</div>}
                {!salarySplitMode ? accsList.map(a => (
                  <div key={a.id} onClick={()=>confirmPay(a.id)}
                    style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.65rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:'var(--body-bg)',border:'1.5px solid var(--border)',fontSize:'.82rem',transition:'background .12s,border-color .12s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='var(--secondary-light)';e.currentTarget.style.borderColor='var(--secondary)'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='var(--body-bg)';e.currentTarget.style.borderColor='var(--border)'}}>
                    <span style={{fontWeight:500}}>{a.name}</span>
                    <span style={{marginLeft:'auto',color:'#111'}}>{Number(a.balance||0).toLocaleString()} ₽</span>
                  </div>
                )) : accsList.map(a => (
                  <div key={a.id} style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.35rem 0'}}>
                    <span style={{flex:1,fontSize:'.8rem',fontWeight:500}}>{a.name}</span>
                    <input type="number" value={salarySplitAmounts[a.id]||''} onChange={e=>{var v=parseFloat(e.target.value)||0;setSalarySplitAmounts(prev=>({...prev,[a.id]:v}))}}
                      style={{width:'100px',padding:'.35rem .5rem',fontSize:'.78rem',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',textAlign:'right',fontFamily:'var(--font)'}} />
                  </div>
                ))}
                {accsList.length > 1 && (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'.35rem',padding:'.5rem .75rem',cursor:'pointer',borderRadius:'.6rem',border:'1.5px dashed var(--secondary)',fontSize:'.78rem',color:'var(--secondary)',fontWeight:600,transition:'background .12s',marginTop:'.15rem'}}
                    onClick={()=>{if(!salarySplitMode){var amt=Math.round((grandTotal||0)/accsList.length);var total=grandTotal||0;var sa={};accsList.forEach(function(a,i){sa[a.id]=i<accsList.length-1?amt:total-amt*(accsList.length-1)});setSalarySplitAmounts(sa)};setSalarySplitMode(!salarySplitMode)}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--secondary-light)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {salarySplitMode ? '+Разделить' : '+Разделить'}
                  </div>
                )}
                {salarySplitMode && (
                  <button onClick={()=>confirmPay(null, salarySplitAmounts)}
                    style={{padding:'.45rem 1.2rem',fontSize:'.8rem',fontWeight:600,borderRadius:'100px',border:'none',cursor:'pointer',background:'var(--primary)',color:'var(--primary-text)',fontFamily:'var(--font)',display:'block',margin:'.15rem auto 0'}}>Подтвердить разделение</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
