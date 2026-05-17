import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const getSalary = () => JSON.parse(localStorage.getItem('salary88') || '[]');
const setSalary = (list) => localStorage.setItem('salary88', JSON.stringify(list));
const getEmps = () => JSON.parse(localStorage.getItem('employees88') || '[]');

const PERIODS = ['Январь 2026','Февраль 2026','Март 2026','Апрель 2026','Май 2026','Июнь 2026',
  'Июль 2026','Август 2026','Сентябрь 2026','Октябрь 2026','Ноябрь 2026','Декабрь 2026'];
const STATUS_LABELS = {accrued:'Начислено',paid:'Выплачено',cancelled:'Отменено'};
const STATUS_COLORS = {accrued:'#2563eb',paid:'#16a34a',cancelled:'#dc2626'};

export default function Salary() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fEmp, setFEmp] = useState('');
  const [fPeriod, setFPeriod] = useState('Май 2026');
  const [fSalary, setFSalary] = useState('');
  const [fPercent, setFPercent] = useState('');
  const [fBonus, setFBonus] = useState('');
  const [fDeduct, setFDeduct] = useState('');
  const [fStatus, setFStatus] = useState('accrued');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAcc, setShowAcc] = useState(false);
  const [pendingPayId, setPendingPayId] = useState(null);
  const [accs, setAccs] = useState([]);

  useEffect(() => {
    if (user) supabase.from('accounts').select('*').then(r => { if (r.data) setAccs(r.data); });
  }, [user]);

  const load = () => setList(getSalary());
  useEffect(() => { load(); }, []);

  var total = (parseFloat(fSalary)||0) + (parseFloat(fBonus)||0) - (parseFloat(fDeduct)||0);

  const openAdd = () => {
    setEditId(null); setFEmp(''); setFPeriod('Май 2026'); setFSalary('');
    setFPercent(''); setFBonus(''); setFDeduct(''); setFStatus('accrued');
    setFDate(new Date().toISOString().split('T')[0]); setShow(true);
  };

  const openEdit = (s) => {
    setEditId(s.id); setFEmp(String(s.empId)); setFPeriod(s.period);
    setFSalary(String(s.salary||'')); setFPercent(String(s.percent||''));
    setFBonus(String(s.bonus||'')); setFDeduct(String(s.deduct||''));
    setFStatus(s.status||'accrued'); setFDate(s.date||new Date().toISOString().split('T')[0]); setShow(true);
  };

  const save = (e) => {
    e.preventDefault();
    if (!fEmp) return alert('Выберите сотрудника');
    var emp = getEmps().find(x => x.id == fEmp);
    var all = getSalary();
    var obj = {
      empId: parseInt(fEmp), empName: emp ? emp.name : 'Сотрудник',
      period: fPeriod, salary: parseFloat(fSalary)||0, percent: parseFloat(fPercent)||0,
      bonus: parseFloat(fBonus)||0, deduct: parseFloat(fDeduct)||0,
      total: total, status: fStatus, date: fDate
    };
    if (editId) {
      var idx = all.findIndex(x => x.id === editId);
      if (idx >= 0) all[idx] = { ...all[idx], ...obj };
      setSalary(all); load(); setShow(false);
    } else {
      obj.id = Date.now(); all.unshift(obj); setSalary(all); load();
      if (fStatus === 'paid') {
        setPendingPayId(obj.id); setShow(false); setShowAcc(true); return;
      }
      setShow(false);
    }
  };

  const remove = (id) => {
    if (!confirm('Удалить начисление?')) return;
    setSalary(getSalary().filter(x => x.id !== id)); load();
  };

  const confirmPay = async (accId) => {
    var all = getSalary(); var s = all.find(x => x.id === pendingPayId);
    if (!s) return;
    if (user && accId) {
      await supabase.from('transactions').insert({
        user_id: user.id, account_id: accId,
        type: 'expense', amount: s.total,
        description: 'Зарплата: ' + s.empName + ' — ' + s.period, date: s.date
      });
    }
    setShowAcc(false); setPendingPayId(null);
  };

  var btns = [{cls:show?' btn btn-primary':''}];

  return (
    <>
      <div className="page-header">
        <div><h1>Зарплата</h1><div className="sub">Расчёт и выплата заработной платы</div></div>
        <div className="page-actions"><button className="btn-green" onClick={openAdd}>+ Начислить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table>
          <thead id="salaryColHeaders"><tr>
            <th>Сотрудник</th><th>Период</th><th className="tr">Оклад</th><th className="tr">% продаж</th>
            <th className="tr">Премия</th><th className="tr">Вычеты</th><th className="tr">Итого</th><th>Статус</th>
            <th style={{width:'130px'}}></th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan="9"><div className="empty-products"><div className="big-icon">💼</div><p>Начислений пока нет</p></div></td></tr>
            ) : list.map(s => (
              <tr key={s.id}>
                <td><div className="prod-name" style={{fontSize:'.85rem'}}>{s.empName}</div></td>
                <td style={{fontSize:'.82rem'}}>{s.period||'—'}</td>
                <td className="tr">{s.salary?s.salary.toLocaleString()+'₽':'—'}</td>
                <td className="tr">{s.percent?s.percent+'%':'—'}</td>
                <td className="tr" style={{color:s.bonus>0?'#16a34a':''}}>{s.bonus?s.bonus.toLocaleString()+'₽':'—'}</td>
                <td className="tr" style={{color:s.deduct>0?'#dc2626':''}}>{s.deduct?s.deduct.toLocaleString()+'₽':'—'}</td>
                <td className="tr" style={{fontWeight:600}}>{s.total.toLocaleString()}₽</td>
                <td><span className="prod-cat" style={{background:STATUS_COLORS[s.status]+'20',color:STATUS_COLORS[s.status]}}>{STATUS_LABELS[s.status]||s.status}</span></td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <button className="act-btn prod-edit-btn" onClick={()=>openEdit(s)}>Ред.</button>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={e=>{e.stopPropagation();var dd=e.currentTarget.nextElementSibling;document.querySelectorAll('.prod-dropdown.open').forEach(d=>{if(d!==dd)d.classList.remove('open')});dd.classList.toggle('open')}}>⋯</button>
                    <div className="prod-dropdown">
                      {s.status==='accrued'&&<button onClick={()=>{setPendingPayId(s.id);setShowAcc(true)}} style={{color:'#16a34a'}}>Выплатить</button>}
                      <button onClick={()=>remove(s.id)} style={{color:'#dc3545'}}>Удалить</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="modal-overlay active" onClick={e=>{if(e.target.className==='modal-overlay active')setShow(false)}}>
          <div className="modal-box" style={{maxWidth:'550px'}}>
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <h2>{editId?'Редактировать начисление':'Начислить зарплату'}</h2>
            <div className="sub">Заполните данные для начисления</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Сотрудник *</label>
                <select value={fEmp} onChange={e=>setFEmp(e.target.value)} required>
                  <option value="">— выберите —</option>
                  {getEmps().map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Период</label>
                  <select value={fPeriod} onChange={e=>setFPeriod(e.target.value)}>
                    {PERIODS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Дата</label>
                  <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Оклад (₽)</label>
                  <input type="number" value={fSalary} onChange={e=>setFSalary(e.target.value)} placeholder="0" min="0" />
                </div>
                <div className="form-group"><label>% продаж</label>
                  <input type="number" value={fPercent} onChange={e=>setFPercent(e.target.value)} placeholder="0" min="0" max="100" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Премия (₽)</label>
                  <input type="number" value={fBonus} onChange={e=>setFBonus(e.target.value)} placeholder="0" min="0" />
                </div>
                <div className="form-group"><label>Вычеты (₽)</label>
                  <input type="number" value={fDeduct} onChange={e=>setFDeduct(e.target.value)} placeholder="0" min="0" />
                </div>
              </div>
              <div className="form-group">
                <label>Статус</label>
                <select value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                  <option value="accrued">Начислено</option>
                  <option value="paid">Выплачено</option>
                </select>
              </div>
              <div style={{textAlign:'right',fontSize:'1rem',fontWeight:600,marginBottom:'.75rem'}}>Итого: {total.toLocaleString()}₽</div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId?'Сохранить':(fStatus==='paid'?'Выплатить':'Начислить')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAcc && (() => {
        var s = getSalary().find(x => x.id === pendingPayId);
        if (!s) return null;
        return (
          <div className="modal-overlay active">
            <div className="modal-box" style={{maxWidth:'450px'}}>
              <button className="modal-close" onClick={()=>{setShowAcc(false);setPendingPayId(null)}}>&times;</button>
              <h2>💳 Выплата зарплаты</h2>
              <div className="sub" style={{marginBottom:'.5rem'}}>
                {s.empName} — {s.period}: <b>{s.total.toLocaleString()}₽</b>
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
