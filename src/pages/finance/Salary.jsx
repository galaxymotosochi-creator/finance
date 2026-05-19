import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const STATUS_LABELS = {pending:'Начислено',accrued:'Начислено',paid:'Выплачено',cancelled:'Отменено'};
const STATUS_COLORS = {accrued:'#2563eb',paid:'#16a34a',cancelled:'#dc2626'};

function daysInMonth(y,m){return new Date(y,m,0).getDate()}
function dayOfYear(d){return Math.floor((d-new Date(d.getFullYear(),0,0))/(1000*60*60*24))}

// Считает пропорцию оклада за период
function calcProportionalSalary(monthlySalary, from, to){
  if(!monthlySalary||!from||!to) return 0;
  var f=new Date(from), t=new Date(to);
  if(f>t) return 0;

  // Если с 1-го по последний день месяца → полный оклад
  var lastDay = new Date(t.getFullYear(), t.getMonth()+1, 0);
  if(f.getDate()===1 && t.getTime()===lastDay.getTime()) return Math.round(monthlySalary);

  // Если одинаковые числа и разница ровно 1 месяц → полный оклад
  // например 17.05 → 17.06, 01.05 → 01.06
  if(f.getDate()===t.getDate()){
    var monthsDiff = (t.getFullYear()-f.getFullYear())*12 + t.getMonth()-f.getMonth();
    if(monthsDiff === 1) return Math.round(monthlySalary);
  }

  // Иначе — пропорциональный расчет по дням
  var total=0;
  var cur=new Date(f);
  while(cur<=t){
    var y=cur.getFullYear(), m=cur.getMonth();
    var last=new Date(y,m+1,0);
    var monthEnd=last<t?last:t;
    var monthStart=(cur.getTime()===f.getTime())?f:new Date(y,m,1);
    var daysInM=daysInMonth(y,m+1);
    var daysWorked=Math.round((monthEnd-monthStart)/(1000*60*60*24))+1;
    if(daysWorked===daysInM){
      total+=monthlySalary;
    } else {
      total+=monthlySalary/daysInM*daysWorked;
    }
    cur=new Date(y,m+1,1);
  }
  return Math.round(total);
}

// Считает общие календарные дни в периоде
function calcDays(from,to){
  if(!from||!to) return 0;
  return Math.round((new Date(to)-new Date(from))/(1000*60*60*24))+1;
}

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
  const [detailEmpId, setDetailEmpId] = useState(null);

  // Form
  const [fEmpId, setFEmpId] = useState('');
  const [fPeriodFrom, setFPeriodFrom] = useState('');
  const [fPeriodTo, setFPeriodTo] = useState('');
  const [fBaseSalary, setFBaseSalary] = useState(0);
  const [fCommissionPct, setFCommissionPct] = useState(0);
  const [fSalesTotal, setFSalesTotal] = useState('');
  const [fCommissionAmt, setFCommissionAmt] = useState(0);
  const [fSalaryTotal, setFSalaryTotal] = useState(0);
  const [fBonuses, setFBonuses] = useState([]); // [{amount, comment}]
  const [fDeductions, setFDeductions] = useState([]); // [{amount, comment}]
  const [fPayType, setFPayType] = useState('salary');
  const [existingDebt, setExistingDebt] = useState(0);
  const [fStatus, setFStatus] = useState('pending');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [fDays, setFDays] = useState(0);

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }
    try {
      const [salRes, empRes, accRes] = await Promise.all([
        supabase.from('salary').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('employees').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        user ? supabase.from('accounts').select('*') : Promise.resolve({data:[]}),
      ]);
      if (salRes.error) { alert('Ошибка загрузки: ' + salRes.error.message); return; }
      if (salRes.data) setList(salRes.data);
      if (empRes.data) setEmployees(empRes.data);
      if (accRes.data) setAccs(accRes.data);
    } catch (e) { alert('Ошибка загрузки: ' + e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // При выборе сотрудника — подтянуть данные
  useEffect(() => {
    if (!fEmpId) return;
    const emp = employees.find(e => e.id === fEmpId);
    if (emp) {
      setFBaseSalary(emp.base_salary || 0);
      // Ищем правило all+product или all+service для commission %
      const rules = emp.bonus_rules || [];
      const allRule = rules.find(r => r.scope === 'all');
      setFCommissionPct(allRule ? allRule.rate : 0);
    }
  }, [fEmpId, employees]);

  // Пересчет при изменении периода, оклада, комиссии
  useEffect(() => {
    if (fPayType !== 'salary') { setFSalaryTotal(0); setFCommissionAmt(0); setFDays(0); return; }
    const sal = calcProportionalSalary(fBaseSalary, fPeriodFrom, fPeriodTo);
    setFSalaryTotal(sal);
    setFDays(calcDays(fPeriodFrom, fPeriodTo));

    const sales = parseFloat(fSalesTotal) || 0;
    setFCommissionAmt(Math.round(sales * fCommissionPct / 100));
  }, [fBaseSalary, fPeriodFrom, fPeriodTo, fSalesTotal, fCommissionPct, fPayType]);

  // Считаем долг сотрудника при выборе
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

  const bonusTotal = fBonuses.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
  const deductTotal = fDeductions.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
  const grandTotal = fSalaryTotal + fCommissionAmt + bonusTotal - deductTotal;

  const openAdd = () => {
    console.log('openAdd called');
    setEditId(null); setFEmpId(''); setFPeriodFrom(''); setFPeriodTo('');
    setFBaseSalary(0); setFCommissionPct(0); setFSalesTotal('');
    setFCommissionAmt(0); setFSalaryTotal(0); setFBonuses([]); setFDeductions([]);
    setFPayType('salary'); setFStatus('pending'); setFDate(new Date().toISOString().split('T')[0]); setFDays(0); setExistingDebt(0);
    setShow(true);
  };

  const openEdit = (s) => {
    setEditId(s.id); setFEmpId(s.employee_id||'');
    setFPeriodFrom(s.period_from||''); setFPeriodTo(s.period_to||'');
    setFBaseSalary(s.base_salary||0); setFCommissionPct(s.commission_percent||0);
    setFSalesTotal(String(s.sales_total||'')); setFCommissionAmt(s.commission_amount||0);
    setFSalaryTotal(s.base_salary||0);
    // Восстанавливаем массивы из JSONB или из старых полей
    if(s.bonus_items && Array.isArray(s.bonus_items)) setFBonuses(s.bonus_items);
    else setFBonuses(s.bonus_amount ? [{amount: s.bonus_amount, comment: s.bonus_comment||''}] : []);
    if(s.deduct_items && Array.isArray(s.deduct_items)) setFDeductions(s.deduct_items);
    else setFDeductions(s.deduct_amount ? [{amount: s.deduct_amount, comment: s.deduct_comment||''}] : []); setFPayType(s.pay_type||'salary'); setFStatus(s.status||'pending');
    setFDate(s.date||new Date().toISOString().split('T')[0]); setFDays(s.days_worked||0);
    setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fEmpId) return alert('Выберите сотрудника');
    if (!fPeriodFrom || !fPeriodTo) return alert('Выберите период');
    if (!user) return alert('Ошибка: пользователь не авторизован');
    const emp = employees.find(e => e.id === fEmpId);
    try {
      const obj = {
        user_id: user.id,
        employee_id: fEmpId,
        employee_name: emp ? emp.name : 'Сотрудник',
        period_from: fPeriodFrom,
        period_to: fPeriodTo,
        period_start: fPeriodFrom,
        period_end: fPeriodTo,
        base_salary: fBaseSalary,
        commission_percent: fCommissionPct,
        sales_total: parseFloat(fSalesTotal)||0,
        commission_amount: fCommissionAmt,
        bonus_amount: bonusTotal,
        bonus_comment: fBonuses.map(i => (i.comment||'') + ': ' + (parseFloat(i.amount)||0).toLocaleString()+'₽').join('; '),
        bonus_items: fBonuses,
        deduct_amount: deductTotal,
        deduct_comment: fDeductions.map(i => (i.comment||'') + ': ' + (parseFloat(i.amount)||0).toLocaleString()+'₽').join('; '),
        deduct_items: fDeductions,
        days_worked: fDays,
        amount: grandTotal,
        status: fStatus,
        paid_at: fStatus === 'paid' ? fDate : null,
      };
      if (editId) {
        await supabase.from('salary').update(obj).eq('id', editId);
      } else {
        await supabase.from('salary').insert(obj);
      }
      await load(); setShow(false);
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Удалить начисление?')) return;
    try { await supabase.from('salary').delete().eq('id', id); await load(); }
    catch (err) { alert('Ошибка удаления: ' + err.message); }
  };

  const confirmPay = async (accId) => {
    try {
      const { data: rows } = await supabase.from('salary').select('*').eq('id', pendingPayId);
      if (!rows || rows.length === 0) return;
      const s = rows[0];
      await supabase.from('transactions').insert({
        user_id: user.id, account_id: accId,
        type: 'expense', amount: s.amount,
        description: 'Зарплата: ' + (s.employee_name || 'Сотрудник') + ' — ' + (s.period_from || '') + ' / ' + (s.period_to || ''),
        date: fDate,
      });
      await supabase.from('salary').update({ status: 'paid', paid_at: fDate }).eq('id', pendingPayId);
      await load();
      setShowAcc(false); setPendingPayId(null);
    } catch (err) { alert('Ошибка выплаты: ' + err.message); }
  };

  const fmtD = (d) => { if(!d) return '—'; const p=d.split('-'); return p.length===3?p[2]+'.'+p[1]+'.'+p[0].slice(2):d; };

  return (
    <>
      <div className="page-header">
        <div><h1>Учет зарплаты</h1><div className="sub">Расчет начислений, бонусов и выплат команде</div></div>
        <div className="page-actions"><button className="btn-green" onClick={()=>{console.log('click');openAdd()}}>+ Начислить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {loading ? (
        <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>
      ) : (
      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table>
          <thead id="salaryColHeaders"><tr>
            <th>Сотрудник</th><th>Тип</th><th>Период</th><th>Оклад</th><th>Продажи</th>
            <th>%</th><th>Комиссия</th><th>Премия</th><th>Вычеты</th>
            <th>Итого</th><th>Статус</th><th style={{width:'90px'}}></th>
          </tr></thead>
          <tbody id="salaryTableBody">
            {list.length === 0 ? (
              <tr><td colSpan="12"><div className="empty-products"><div className="big-icon">💼</div><p>Начислений пока нет</p></div></td></tr>
            ) : list.map(s => {
              const ptLabels = {salary:'Зарплата',advance:'Аванс',bonus:'Бонус'};
              return (
              <tr key={s.id}>
                <td><div className="prod-name" style={{fontSize:'.85rem',cursor:'pointer',color:'var(--primary)'}} onClick={()=>setDetailEmpId(s.employee_id)}>{s.employee_name||'—'}</div></td>
                <td style={{fontSize:'.78rem'}}><span className="prod-cat" style={{background: (s.pay_type==='advance'?'#fef3c7':s.pay_type==='bonus'?'#eaf5ff':'#f1f3f5'),color:(s.pay_type==='advance'?'#92400e':s.pay_type==='bonus'?'var(--primary)':'var(--muted)')}}>{ptLabels[s.pay_type]||'Зарплата'}</span></td>
                <td style={{fontSize:'.82rem'}}>{s.period_from?fmtD(s.period_from)+' – '+fmtD(s.period_to):'—'}</td>
                <td>{s.base_salary?s.base_salary.toLocaleString()+'₽':'—'}</td>
                <td>{s.sales_total?s.sales_total.toLocaleString()+'₽':'—'}</td>
                <td>{s.commission_percent?s.commission_percent+'%':'—'}</td>
                <td>{s.commission_amount?s.commission_amount.toLocaleString()+'₽':'—'}</td>
                <td style={{color:s.bonus_amount>0?'#16a34a':''}}>{s.bonus_amount?s.bonus_amount.toLocaleString()+'₽':'—'}</td>
                <td style={{color:s.deduct_amount>0?'#dc2626':''}}>{s.deduct_amount?s.deduct_amount.toLocaleString()+'₽':'—'}</td>
                <td style={{fontWeight:600}}>{Number(s.amount).toLocaleString()}₽</td>
                <td><span className="prod-cat" style={{background:STATUS_COLORS[s.status]+'20',color:STATUS_COLORS[s.status]}}>{STATUS_LABELS[s.status]||s.status}</span></td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <button className="act-btn prod-edit-btn" onClick={()=>openEdit(s)}>Ред.</button>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={e=>{e.stopPropagation();var dd=e.currentTarget.nextElementSibling;document.querySelectorAll('.prod-dropdown.open').forEach(d=>{if(d!==dd)d.classList.remove('open')});dd.classList.toggle('open')}}>⋯</button>
                    <div className="prod-dropdown">
                      {(s.status==='pending'||s.status==='accrued')&&<button onClick={()=>{setPendingPayId(s.id);setShowAcc(true)}} style={{color:'#16a34a'}}>Выплатить</button>}
                      <button onClick={()=>remove(s.id)} style={{color:'#dc3545'}}>Удалить</button>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
      )}

      {/* МОДАЛКА НАЧИСЛЕНИЯ */}
      {show && (
        <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active')setShow(false)}}>
          <div className="modal-box" style={{maxWidth:'580px'}}>
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <h2>{editId?'Редактировать':'Начислить зарплату'}</h2>
            <div className="sub">Выберите сотрудника и период</div>
            <form onSubmit={save}>

              {/* Сотрудник */}
              <div className="form-group">
                <label>Сотрудник *</label>
                <select value={fEmpId} onChange={e=>setFEmpId(e.target.value)} required>
                  <option value="">— выберите —</option>
                  {employees.map(e=><option key={e.id} value={e.id}>{e.name} {e.base_salary ? '— '+e.base_salary.toLocaleString()+'₽' : ''}</option>)}
                </select>
              </div>

              {/* Период */}
              <div className="form-row">
                <div className="form-group">
                  <label>Начало периода *</label>
                  <input type="date" value={fPeriodFrom} onChange={e=>setFPeriodFrom(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Конец периода *</label>
                  <input type="date" value={fPeriodTo} onChange={e=>setFPeriodTo(e.target.value)} required />
                </div>
              </div>

              {/* Расчет */}
              <div className="emp-section-label">Расчет</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Оклад (мес.)</label>
                  <input type="number" value={fBaseSalary} onChange={e=>setFBaseSalary(parseFloat(e.target.value)||0)} min="0" />
                  {fDays>0&&<div className="emp-hint">{fDays} дн. = {fSalaryTotal.toLocaleString()}₽</div>}
                </div>
                <div className="form-group">
                  <label>% с продаж</label>
                  <input type="number" value={fCommissionPct} onChange={e=>setFCommissionPct(parseFloat(e.target.value)||0)} min="0" max="100" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Продажи за период (₽)</label>
                  <input type="number" value={fSalesTotal} onChange={e=>setFSalesTotal(e.target.value)} min="0" placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Комиссия</label>
                  <input type="text" value={fCommissionAmt.toLocaleString()+'₽'} disabled style={{background:'#f8f9fa'}} />
                </div>
              </div>

              {/* Премия */}
              <div className="emp-section-label">Премия</div>
              {fBonuses.map((item, i) => (
                <div key={i} className="form-row" style={{alignItems:'center'}}>
                  <div className="form-group">
                    <label>Сумма (₽)</label>
                    <input type="number" value={item.amount} onChange={e=>{const n=[...fBonuses]; n[i]={...n[i],amount:e.target.value}; setFBonuses(n)}} placeholder="0" min="0" />
                  </div>
                  <div className="form-group">
                    <label>Примечание</label>
                    <input type="text" value={item.comment} onChange={e=>{const n=[...fBonuses]; n[i]={...n[i],comment:e.target.value}; setFBonuses(n)}} placeholder="За что" />
                  </div>
                  <button type="button" className="emp-row-rm" onClick={()=>setFBonuses(fBonuses.filter((_,j)=>j!==i))} style={{marginTop:'1.2rem'}}>✕</button>
                </div>
              ))}
              <button type="button" className="emp-rule-add" onClick={()=>setFBonuses([...fBonuses,{amount:'',comment:''}])}>+ Добавить премию</button>

              {/* Вычеты */}
              <div className="emp-section-label" style={{marginTop:'.75rem'}}>Вычеты</div>
              {fDeductions.map((item, i) => (
                <div key={i} className="form-row" style={{alignItems:'center'}}>
                  <div className="form-group">
                    <label>Сумма (₽)</label>
                    <input type="number" value={item.amount} onChange={e=>{const n=[...fDeductions]; n[i]={...n[i],amount:e.target.value}; setFDeductions(n)}} placeholder="0" min="0" />
                  </div>
                  <div className="form-group">
                    <label>Примечание</label>
                    <input type="text" value={item.comment} onChange={e=>{const n=[...fDeductions]; n[i]={...n[i],comment:e.target.value}; setFDeductions(n)}} placeholder="За что" />
                  </div>
                  <button type="button" className="emp-row-rm" onClick={()=>setFDeductions(fDeductions.filter((_,j)=>j!==i))} style={{marginTop:'1.2rem'}}>✕</button>
                </div>
              ))}
              <button type="button" className="emp-rule-add" onClick={()=>setFDeductions([...fDeductions,{amount:'',comment:''}])}>+ Добавить вычет</button>

              <div className="form-group">
                <label>Статус</label>
                <select value={fPayType} onChange={e=>setFPayType(e.target.value)}>
                  <option value="salary">Зарплата</option>
                  <option value="advance">Аванс</option>
                  <option value="bonus">Бонус</option>
                </select>
              </div>

              {existingDebt !== 0 && (
                <div style={{background:'#fef3c7',border:'1px solid #f59e0b',borderRadius:'.75rem',padding:'.5rem .75rem',marginBottom:'.75rem',fontSize:'.82rem',display:'flex',alignItems:'center',gap:'.5rem'}}>
                  <span>⚠️</span>
                  <span>
                    <b>У сотрудника {(existingDebt>0)?'невыплаченных':'переплата'}: {Math.abs(existingDebt).toLocaleString()}₽</b>
                    {fPayType === 'salary' && existingDebt > 0 && (
                      <span> — после начисления долг будет {(existingDebt + grandTotal).toLocaleString()}₽</span>
                    )}
                  </span>
                </div>
              )}

              <div className="form-group">
                <label>Статус</label>
                <select value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                  <option value="pending">Начислено</option>
                  <option value="paid">Выплачено</option>
                </select>
              </div>

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.75rem',padding:'.75rem',background:'#f8f9fa',borderRadius:'.75rem'}}>
                <div>
                  <div style={{fontSize:'.78rem',color:'var(--muted)'}}>Оклад {fSalaryTotal.toLocaleString()}₽ + Комиссия {fCommissionAmt.toLocaleString()}₽ + Премия {bonusTotal.toLocaleString()}₽ — Вычеты {deductTotal.toLocaleString()}₽</div>
                </div>
                <div style={{fontSize:'1.2rem',fontWeight:700,color:'var(--primary)'}}>{grandTotal.toLocaleString()}₽</div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId?'Сохранить':'Начислить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛКА ВЫБОРА СЧЕТА */}
      {showAcc && (()=>{
        const item = list.find(x => x.id === pendingPayId);
        if (!item) return null;
        return (
          <div className="modal-overlay active">
            <div className="modal-box" style={{maxWidth:'450px'}}>
              <button className="modal-close" onClick={()=>{setShowAcc(false);setPendingPayId(null)}}>&times;</button>
              <h2>💳 Выплата зарплаты</h2>
              <div className="sub" style={{marginBottom:'.5rem'}}>
                {item.employee_name||'Сотрудник'} — <b>{Number(item.amount).toLocaleString()}₽</b>
              </div>
              <div style={{marginBottom:'1rem',fontSize:'.82rem',color:'var(--muted)'}}>
                Выберите счет для списания
              </div>
              {accs.map(a => (
                <div key={a.id} onClick={()=>confirmPay(a.id)}
                  style={{display:'flex',alignItems:'center',padding:'.65rem .75rem',border:'1.5px solid var(--border)',borderRadius:'.85rem',marginBottom:'.35rem',cursor:'pointer',background:'var(--white)'}}>
                  <div style={{fontSize:'1.2rem',marginRight:'.65rem'}}>🏦</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:'.85rem'}}>{a.name}</div>
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{a.type||''}</div>
                  </div>
                  <span style={{fontWeight:600,fontSize:'.85rem',color:'#dc2626'}}>Списать</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* МОДАЛКА ДЕТАЛЕЙ СОТРУДНИКА */}
      {detailEmpId && (()=>{
        const emp = employees.find(e => e.id === detailEmpId);
        const empRecords = list.filter(s => s.employee_id === detailEmpId);
        const ptLabels = {salary:'Зарплата',advance:'Аванс',bonus:'Бонус'};
        const STL = {pending:'⏳',paid:'✅',accrued:'⏳',cancelled:'❌'};
        const nac = empRecords.filter(s => s.pay_type==='salary' && s.status!=='cancelled').reduce((sum,s)=>sum+(Number(s.amount)||0),0);
        const paid = empRecords.filter(s => s.status==='paid').reduce((sum,s)=>sum+(Number(s.amount)||0),0);
        const adv = empRecords.filter(s => s.pay_type==='advance').reduce((sum,s)=>sum+(Number(s.amount)||0),0);
        const bonus = empRecords.filter(s => s.pay_type==='bonus'&&s.status!=='cancelled').reduce((sum,s)=>sum+(Number(s.amount)||0),0);
        const debt = nac - paid - adv;
        return (
          <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active')setDetailEmpId(null)}}>
            <div className="modal-box" style={{maxWidth:'500px'}}>
              <button className="modal-close" onClick={()=>setDetailEmpId(null)}>&times;</button>
              <h2>👤 {emp ? emp.name : 'Сотрудник'}</h2>
              <div className="sub">История начислений и выплат</div>

              {/* Сводка */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.5rem',marginBottom:'1rem'}}>
                <div className="emp-detail-stat"><span className="lbl">Начислено</span><span className="val">{nac.toLocaleString()}₽</span></div>
                <div className="emp-detail-stat"><span className="lbl">Выплачено</span><span className="val" style={{color:'#16a34a'}}>{paid.toLocaleString()}₽</span></div>
                <div className="emp-detail-stat"><span className="lbl">Авансы</span><span className="val">{adv.toLocaleString()}₽</span></div>
                <div className="emp-detail-stat"><span className="lbl">Бонусы</span><span className="val" style={{color:'var(--primary)'}}>{bonus.toLocaleString()}₽</span></div>
                <div className="emp-detail-stat" style={{gridColumn:'1/-1'}}>
                  <span className="lbl">Долг</span>
                  <span className="val" style={{color:debt>0?'#dc2626':'#16a34a',fontWeight:700}}>{debt>0?debt.toLocaleString()+'₽':'✅'} </span>
                </div>
              </div>

              {/* История */}
              <div className="emp-section-label">История</div>
              {empRecords.length === 0 ? (
                <div style={{textAlign:'center',padding:'1rem',color:'var(--muted)',fontSize:'.82rem'}}>Нет записей</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'.25rem'}}>
                  {empRecords.map(s => (
                    <div key={s.id} className="emp-detail-row">
                      <span className="emp-detail-status">{STL[s.status]||'⏳'}</span>
                      <span className="emp-detail-type"><span className="prod-cat" style={{background:(s.pay_type==='advance'?'#fef3c7':s.pay_type==='bonus'?'#eaf5ff':'#f1f3f5'),color:(s.pay_type==='advance'?'#92400e':s.pay_type==='bonus'?'var(--primary)':'var(--muted)')}}>{ptLabels[s.pay_type]||'Зарплата'}</span></span>
                      <span className="emp-detail-date">{s.period_from?fmtD(s.period_from):(s.created_at?fmtD(s.created_at.split('T')[0]):'—')}</span>
                      <span className="emp-detail-amount" style={{color:(s.pay_type==='advance'||s.status==='paid')?'#dc2626':(s.pay_type==='bonus'?'var(--primary)':'')}}>
                        {(s.status==='paid'||s.pay_type==='advance'?'−':'+')}{Number(s.amount).toLocaleString()}₽
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
