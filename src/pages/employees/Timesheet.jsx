import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const STATUS_OPTS = [
  { value: 'present', icon: '✅', label: 'Работал' },
  { value: 'sick', icon: '🏥', label: 'Больничный' },
  { value: 'vacation', icon: '🏖', label: 'Отпуск' },
  { value: 'absent', icon: '❌', label: 'Прогул' },
  { value: 'remote', icon: '🏠', label: 'Удалёнка' },
];

const STATUS_ICONS = { present:'✅', sick:'🏥', vacation:'🏖', absent:'❌', remote:'🏠' };
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export default function Timesheet() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [showDay, setShowDay] = useState(null); // date string YYYY-MM-DD
  const [editEmp, setEditEmp] = useState(null); // employee_id being edited in modal
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }
    try {
      const [empRes, entRes] = await Promise.all([
        supabase.from('employees').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('timesheet_entries').select('*').eq('user_id', user.id),
      ]);
      if (empRes.error) { alert('Ошибка: ' + empRes.error.message); return; }
      if (empRes.data) setEmployees(empRes.data);
      if (entRes.data) setEntries(entRes.data);
    } catch (e) { alert('Ошибка загрузки: ' + e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const firstD = new Date(year, month, 1).getDay();
  const offset = firstD === 0 ? 6 : firstD - 1;
  const daysInM = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let d = 1; d <= daysInM; d++) days.push(d);

  const getDayEntries = (d) => {
    const ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    return entries.filter(e => e.date && e.date.startsWith(ds));
  };

  const getDayStat = (d) => {
    const de = getDayEntries(d);
    const hasBonus = de.some(e => (e.bonus_amount || 0) > 0);
    const hasDeduct = de.some(e => (e.deduct_amount || 0) > 0);
    const hasSick = de.some(e => e.status === 'sick');
    return { hasBonus, hasDeduct, hasSick };
  };

  const openDay = (d) => {
    const ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    setShowDay(ds);
    setEditEmp(null);
  };

  const getEntry = (empId, dateStr) => entries.find(e => e.employee_id === empId && e.date && e.date.startsWith(dateStr));

  const saveEntry = async (empId, field, val) => {
    if (!user || !showDay) return;
    setSaving(true);
    try {
      const existing = getEntry(empId, showDay);
      if (existing) {
        await supabase.from('timesheet_entries').update({ [field]: val }).eq('id', existing.id);
      } else {
        await supabase.from('timesheet_entries').insert({
          user_id: user.id, employee_id: empId, date: showDay,
          [field]: val,
        });
      }
      await load();
    } catch (e) { alert('Ошибка: ' + e.message); }
    setSaving(false);
  };

  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const fmtDate = (ds) => { if (!ds) return ''; const p = ds.split('-'); return p.length === 3 ? p[2] + '.' + p[1] : ds; };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const dayEntries = showDay ? entries.filter(e => e.date && e.date.startsWith(showDay)) : [];
  const dayBonuses = dayEntries.filter(e => (e.bonus_amount || 0) > 0);
  const dayDeducts = dayEntries.filter(e => (e.deduct_amount || 0) > 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Табель</h1>
          <div className="sub">Учёт рабочего времени, бонусы и штрафы</div>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {loading ? (
        <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>
      ) : (
        <div className="promo-calendar-wrap">
          {/* Навигация по месяцам */}
          <div className="promo-cal-header">
            <button className="promo-cal-nav" onClick={prevMonth}>‹</button>
            <div className="promo-cal-month">{MONTHS[month]} {year}</div>
            <button className="promo-cal-nav" onClick={nextMonth}>›</button>
          </div>

          {/* Сетка */}
          <div className="promo-cal-grid">
            {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w => <div key={w} className="wd">{w}</div>)}
            {days.map((d, i) => {
              if (!d) return <div key={'e' + i} className="day other">&nbsp;</div>;
              const stat = getDayStat(d);
              return (
                <div key={d}
                  className={'day' + (isToday(d) ? ' today' : '')}
                  onClick={() => openDay(d)}>
                  {d}
                  <div style={{display:'flex',gap:'2px',justifyContent:'center',marginTop:'2px'}}>
                    {stat.hasBonus && <span className="promo-dot active" />}
                    {stat.hasSick && <span className="promo-dot planned" />}
                    {stat.hasDeduct && <span className="promo-dot ended" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Легенда */}
          <div className="promo-cal-legend" style={{marginTop:'.5rem'}}>
            <span><span className="promo-dot active" /> Бонус</span>
            <span><span className="promo-dot planned" /> Больничный</span>
            <span><span className="promo-dot ended" /> Штраф</span>
          </div>
        </div>
      )}

      {/* МОДАЛКА ДНЯ */}
      {showDay && (()=>{
        const [localStatuses, setLocalStatuses] = useState({});
        const [newBonus, setNewBonus] = useState({empId:'',amount:'',comment:''});
        const [newDeduct, setNewDeduct] = useState({empId:'',amount:'',comment:''});
        const [saving, setSaving] = useState(false);
        useEffect(() => {
          const st = {};
          employees.forEach(emp => {
            const entry = getEntry(emp.id, showDay);
            st[emp.id] = entry ? entry.status : 'present';
          });
          setLocalStatuses(st);
        }, [showDay, employees.length, entries.length]);

        const saveAll = async () => {
          setSaving(true);
          try {
            for (const empId of Object.keys(localStatuses)) {
              const entry = getEntry(empId, showDay);
              if (entry) {
                await supabase.from('timesheet_entries').update({ status: localStatuses[empId] }).eq('id', entry.id);
              } else {
                await supabase.from('timesheet_entries').insert({
                  user_id: user.id, employee_id: empId, date: showDay, status: localStatuses[empId],
                });
              }
            }
            if (newBonus.empId && newBonus.amount) {
              const entry = getEntry(newBonus.empId, showDay);
              if (entry) {
                await supabase.from('timesheet_entries').update({
                  bonus_amount: (entry.bonus_amount || 0) + parseFloat(newBonus.amount),
                  bonus_comment: entry.bonus_comment ? entry.bonus_comment + '; ' + newBonus.comment : newBonus.comment,
                }).eq('id', entry.id);
              } else {
                await supabase.from('timesheet_entries').insert({
                  user_id: user.id, employee_id: newBonus.empId, date: showDay,
                  status: 'present', bonus_amount: parseFloat(newBonus.amount), bonus_comment: newBonus.comment,
                });
              }
            }
            if (newDeduct.empId && newDeduct.amount) {
              const entry = getEntry(newDeduct.empId, showDay);
              if (entry) {
                await supabase.from('timesheet_entries').update({
                  deduct_amount: (entry.deduct_amount || 0) + parseFloat(newDeduct.amount),
                  deduct_comment: entry.deduct_comment ? entry.deduct_comment + '; ' + newDeduct.comment : newDeduct.comment,
                }).eq('id', entry.id);
              } else {
                await supabase.from('timesheet_entries').insert({
                  user_id: user.id, employee_id: newDeduct.empId, date: showDay,
                  status: 'present', deduct_amount: parseFloat(newDeduct.amount), deduct_comment: newDeduct.comment,
                });
              }
            }
            await load();
            setShowDay(null);
          } catch (err) { alert('Ошибка: ' + err.message); }
          setSaving(false);
        };

        const dayE = showDay ? entries.filter(e => e.date && e.date.startsWith(showDay)) : [];
        const dayB = dayE.filter(e => (e.bonus_amount || 0) > 0);
        const dayD = dayE.filter(e => (e.deduct_amount || 0) > 0);

        return (
          <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowDay(null); }}>
            <div className="modal-box" style={{maxWidth:'520px'}}>
              <button className="modal-close" onClick={() => setShowDay(null)}>&times;</button>
              <h2>🗓 {fmtDate(showDay)}</h2>
              <div className="sub">Статусы сотрудников и события дня</div>

              {/* Сотрудники */}
              <div className="emp-section-label">Статус сотрудников</div>
              {employees.length === 0 ? (
                <p style={{fontSize:'.82rem',color:'var(--muted)',marginBottom:'.5rem'}}>Нет сотрудников</p>
              ) : employees.map(emp => (
                <div key={emp.id} style={{display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.35rem'}}>
                  <span style={{fontSize:'.82rem',minWidth:'120px',fontWeight:500}}>{emp.name}</span>
                  <select className="emp-rule-select" value={localStatuses[emp.id]||'present'}
                    onChange={e => setLocalStatuses({...localStatuses, [emp.id]: e.target.value})}
                    style={{flex:1}}>
                    {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                  </select>
                </div>
              ))}

              {/* Бонусы */}
              <div className="emp-section-label" style={{marginTop:'.75rem'}}>Бонусы</div>
              {dayB.map(e => (
                <div key={e.id} className="emp-rule-line" style={{marginBottom:'.25rem'}}>
                  <span style={{fontSize:'.82rem',fontWeight:500}}>{employees.find(em => em.id === e.employee_id)?.name || '—'}</span>
                  <span style={{fontSize:'.8rem',color:'var(--muted)',flex:1}}>{e.bonus_comment || ''}</span>
                  <span style={{fontWeight:600,color:'#16a34a'}}>+{Number(e.bonus_amount).toLocaleString()}₽</span>
                </div>
              ))}
              <div className="form-row">
                <div className="form-group">
                  <select value={newBonus.empId} onChange={e => setNewBonus({...newBonus, empId: e.target.value})}>
                    <option value="">— Сотрудник —</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <input type="number" value={newBonus.amount} onChange={e => setNewBonus({...newBonus, amount: e.target.value})} placeholder="Сумма" min="0" />
                </div>
                <div className="form-group">
                  <input type="text" value={newBonus.comment} onChange={e => setNewBonus({...newBonus, comment: e.target.value})} placeholder="За что" />
                </div>
              </div>

              {/* Штрафы */}
              <div className="emp-section-label">Штрафы</div>
              {dayD.map(e => (
                <div key={e.id} className="emp-rule-line" style={{marginBottom:'.25rem'}}>
                  <span style={{fontSize:'.82rem',fontWeight:500}}>{employees.find(em => em.id === e.employee_id)?.name || '—'}</span>
                  <span style={{fontSize:'.8rem',color:'var(--muted)',flex:1}}>{e.deduct_comment || ''}</span>
                  <span style={{fontWeight:600,color:'#dc2626'}}>−{Number(e.deduct_amount).toLocaleString()}₽</span>
                </div>
              ))}
              <div className="form-row">
                <div className="form-group">
                  <select value={newDeduct.empId} onChange={e => setNewDeduct({...newDeduct, empId: e.target.value})}>
                    <option value="">— Сотрудник —</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <input type="number" value={newDeduct.amount} onChange={e => setNewDeduct({...newDeduct, amount: e.target.value})} placeholder="Сумма" min="0" />
                </div>
                <div className="form-group">
                  <input type="text" value={newDeduct.comment} onChange={e => setNewDeduct({...newDeduct, comment: e.target.value})} placeholder="За что" />
                </div>
              </div>

              {/* Итого */}
              <div style={{
                marginTop:'.75rem',padding:'.65rem .75rem',background:'#f8f9fa',borderRadius:'.65rem',
                display:'flex',justifyContent:'space-between',fontSize:'.85rem'
              }}>
                <span>Бонусов: <b style={{color:'#16a34a'}}>{dayB.reduce((s,e)=>s+Number(e.bonus_amount||0),0).toLocaleString()}₽</b></span>
                <span>Штрафов: <b style={{color:'#dc2626'}}>{dayD.reduce((s,e)=>s+Number(e.deduct_amount||0),0).toLocaleString()}₽</b></span>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saving}>
                  {saving ? 'Сохранение...' : '💾 Сохранить'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
