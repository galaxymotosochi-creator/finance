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
  // Если период — полные календарные месяцы
  var total=0;
  var cur=new Date(f);
  while(cur<=t){
    var y=cur.getFullYear(), m=cur.getMonth();
    var last=new Date(y,m+1,0); // последний день месяца
    var monthEnd=last<t?last:t;
    var monthStart=(cur.getTime()===f.getTime())?f:new Date(y,m,1);
    var daysInM=daysInMonth(y,m+1);
    var daysWorked=Math.round((monthEnd-monthStart)/(1000*60*60*24))+1;
    if(daysWorked===daysInM){
      total+=monthlySalary; // полный месяц
    } else {
      total+=monthlySalary/daysInM*daysWorked; // часть месяца
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

  // Form
  const [fEmpId, setFEmpId] = useState('');
  const [fPeriodFrom, setFPeriodFrom] = useState('');
  const [fPeriodTo, setFPeriodTo] = useState('');
  const [fBaseSalary, setFBaseSalary] = useState(0);
  const [fCommissionPct, setFCommissionPct] = useState(0);
  const [fSalesTotal, setFSalesTotal] = useState('');
  const [fCommissionAmt, setFCommissionAmt] = useState(0);
  const [fSalaryTotal, setFSalaryTotal] = useState(0);
  const [fBonusAmt, setFBonusAmt] = useState('');
  const [fBonusComment, setFBonusComment] = useState('');
  const [fDeductAmt, setFDeductAmt] = useState('');
  const [fDeductComment, setFDeductComment] = useState('');
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

  // Пересчёт при изменении периода, оклада, комиссии
  useEffect(() => {
    const sal = calcProportionalSalary(fBaseSalary, fPeriodFrom, fPeriodTo);
    setFSalaryTotal(sal);
    setFDays(calcDays(fPeriodFrom, fPeriodTo));

    const sales = parseFloat(fSalesTotal) || 0;
    setFCommissionAmt(Math.round(sales * fCommissionPct / 100));
  }, [fBaseSalary, fPeriodFrom, fPeriodTo, fSalesTotal, fCommissionPct]);

  const grandTotal = fSalaryTotal + fCommissionAmt + (parseFloat(fBonusAmt)||0) - (parseFloat(fDeductAmt)||0);

  const openAdd = () => {
    setEditId(null); setFEmpId(''); setFPeriodFrom(''); setFPeriodTo('');
    setFBaseSalary(0); setFCommissionPct(0); setFSalesTotal('');
    setFCommissionAmt(0); setFSalaryTotal(0); setFBonusAmt('');
    setFBonusComment(''); setFDeductAmt(''); setFDeductComment('');
    setFStatus('pending'); setFDate(new Date().toISOString().split('T')[0]); setFDays(0);
    setShow(true);
  };

  const openEdit = (s) => {
    setEditId(s.id); setFEmpId(s.employee_id||'');
    setFPeriodFrom(s.period_from||''); setFPeriodTo(s.period_to||'');
    setFBaseSalary(s.base_salary||0); setFCommissionPct(s.commission_percent||0);
    setFSalesTotal(String(s.sales_total||'')); setFCommissionAmt(s.commission_amount||0);
    setFSalaryTotal(s.base_salary||0); setFBonusAmt(String(s.bonus_amount||''));
    setFBonusComment(s.bonus_comment||''); setFDeductAmt(String(s.deduct_amount||''));
    setFDeductComment(s.deduct_comment||''); setFStatus(s.status||'pending');
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
        bonus_amount: parseFloat(fBonusAmt)||0,
        bonus_comment: fBonusComment,
        deduct_amount: parseFloat(fDeductAmt)||0,
        deduct_comment: fDeductComment,
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
        <div><h1>Зарплата</h1><div className="sub">Расчёт и выплата заработной платы</div></div>
        <div className="page-actions"><button className="btn-green" onClick={openAdd}>+ Начислить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {loading ? (
        <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>
      ) : (
      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table>
          <thead id="salaryColHeaders"><tr>
            <th>Сотрудник</th><th>Период</th><th className="tr">Оклад</th><th className="tr">Продажи</th>
            <th className="tr">%</th><th className="tr">Комиссия</th><th className="tr">Премия</th><th className="tr">Вычеты</th>
            <th className="tr">Итого</th><th>Статус</th><th style={{width:'90px'}}></th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan="11"><div className="empty-products"><div className="big-icon">💼</div><p>Начислений пока нет</p></div></td></tr>
            ) : list.map(s => (
              <tr key={s.id}>
                <td><div className="prod-name" style={{fontSize:'.85rem'}}>{s.employee_name||'—'}</div></td>
                <td style={{fontSize:.82+'rem'}}>{s.period_from?fmtD(s.period_from)+' – '+fmtD(s.period_to):'—'}</td>
                <td className="tr">{s.base_salary?s.base_salary.toLocaleString()+'₽':'—'}</td>
                <td className="tr">{s.sales_total?s.sales_total.toLocaleString()+'₽':'—'}</td>
                <td className="tr">{s.commission_percent?s.commission_percent+'%':'—'}</td>
                <td className="tr">{s.commission_amount?s.commission_amount.toLocaleString()+'₽':'—'}</td>
                <td className="tr" style={{color:s.bonus_amount>0?'#16a34a':''}}>{s.bonus_amount?s.bonus_amount.toLocaleString()+'₽':'—'}</td>
                <td className="tr" style={{color:s.deduct_amount>0?'#dc2626':''}}>{s.deduct_amount?s.deduct_amount.toLocaleString()+'₽':'—'}</td>
                <td className="tr" style={{fontWeight:600}}>{Number(s.amount).toLocaleString()}₽</td>
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
            ))}
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

              {/* Расчёт */}
              <div className="emp-section-label">Расчёт</div>
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
              <div className="form-row">
                <div className="form-group">
                  <label>Сумма (₽)</label>
                  <input type="number" value={fBonusAmt} onChange={e=>setFBonusAmt(e.target.value)} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label>Примечание</label>
                  <input type="text" value={fBonusComment} onChange={e=>setFBonusComment(e.target.value)} placeholder="За что" />
                </div>
              </div>

              {/* Вычеты */}
              <div className="emp-section-label">Вычеты</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Сумма (₽)</label>
                  <input type="number" value={fDeductAmt} onChange={e=>setFDeductAmt(e.target.value)} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label>Примечание</label>
                  <input type="text" value={fDeductComment} onChange={e=>setFDeductComment(e.target.value)} placeholder="За что" />
                </div>
              </div>

              <div className="form-group">
                <label>Статус</label>
                <select value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                  <option value="pending">Начислено</option>
                  <option value="paid">Выплачено</option>
                </select>
              </div>

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.75rem',padding:'.75rem',background:'#f8f9fa',borderRadius:'.75rem'}}>
                <div>
                  <div style={{fontSize:'.78rem',color:'var(--muted)'}}>Оклад {fSalaryTotal.toLocaleString()}₽ + Комиссия {fCommissionAmt.toLocaleString()}₽ + Премия {(parseFloat(fBonusAmt)||0).toLocaleString()}₽ — Вычеты {(parseFloat(fDeductAmt)||0).toLocaleString()}₽</div>
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

      {/* МОДАЛКА ВЫБОРА СЧЁТА */}
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
                Выберите счёт для списания
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
    </>
  );
}
