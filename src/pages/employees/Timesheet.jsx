import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const STATUS_OPTS = [
  { value: 'present', label: 'Работал' },
  { value: 'sick', label: 'Больничный' },
  { value: 'vacation', label: 'Отпуск' },
  { value: 'absent', label: 'Прогул' },
  { value: 'remote', label: 'Удаленка' },
];

const STATUS_MAP = Object.fromEntries(STATUS_OPTS.map(s => [s.value, s.label]));
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const emptyRow = () => ({ empId: '', amount: '', comment: '' });

const PERIOD_OPTS = [
  { key: 'all', label: 'Все время' },
  { key: 'today', label: 'Сегодня' },
  { key: 'yesterday', label: 'Вчера' },
  { key: 'week', label: 'Эта неделя' },
  { key: 'month', label: 'Этот месяц' },
];

const fmtShort = (ds) => { if (!ds) return ''; const p = ds.split('-'); return p.length === 3 ? p[2] + '.' + p[1] : ds; };

export default function Timesheet() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [showDay, setShowDay] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localStatuses, setLocalStatuses] = useState({});
  const [bonusRows, setBonusRows] = useState([emptyRow()]);
  const [deductRows, setDeductRows] = useState([emptyRow()]);

  // Фильтры таблицы
  const [tsPeriod, setTsPeriod] = useState('all');
  const [tsPeriodLabel, setTsPeriodLabel] = useState('Все время');
  const [tsShowPeriod, setTsShowPeriod] = useState(false);
  const [tsPeriodFrom, setTsPeriodFrom] = useState('');
  const [tsPeriodTo, setTsPeriodTo] = useState('');
  const [tsEmpFilter, setTsEmpFilter] = useState([]);
  const [tsShowEmp, setTsShowEmp] = useState(false);
  const [tsTypeFilter, setTsTypeFilter] = useState('all');

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
    const st = {};
    employees.forEach(emp => {
      const entry = getEntry(emp.id, ds);
      st[emp.id] = entry ? entry.status : 'present';
    });
    setLocalStatuses(st);

    const dayEntries = entries.filter(e => e.date && e.date.startsWith(ds));
    const bonusEntries = dayEntries.filter(e => (e.bonus_amount || 0) > 0);
    const deductEntries = dayEntries.filter(e => (e.deduct_amount || 0) > 0);
    if (bonusEntries.length > 0) {
      setBonusRows(bonusEntries.map(e => ({ empId: e.employee_id, amount: String(e.bonus_amount||''), comment: e.bonus_comment||'' })));
    } else {
      setBonusRows([emptyRow()]);
    }
    if (deductEntries.length > 0) {
      setDeductRows(deductEntries.map(e => ({ empId: e.employee_id, amount: String(e.deduct_amount||''), comment: e.deduct_comment||'' })));
    } else {
      setDeductRows([emptyRow()]);
    }
  };

  const getEntry = (empId, dateStr) => entries.find(e => e.employee_id === empId && e.date && e.date.startsWith(dateStr));

  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const fmtDate = (ds) => { if (!ds) return ''; const p = ds.split('-'); return p.length === 3 ? p[2] + '.' + p[1] : ds; };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const updateBonusRow = (idx, field, val) => {
    setBonusRows(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, [field]: val } : r);
      if (field === 'empId' && val && idx === next.length - 1) {
        next.push(emptyRow());
      }
      return next;
    });
  };

  const updateDeductRow = (idx, field, val) => {
    setDeductRows(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, [field]: val } : r);
      if (field === 'empId' && val && idx === next.length - 1) {
        next.push(emptyRow());
      }
      return next;
    });
  };

  const totalBonuses = () => {
    return bonusRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  };

  const totalDeducts = () => {
    return deductRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  };

  // Фильтрация записей для таблицы
  const filteredEntries = useMemo(() => {
    let result = [...entries];
    if (tsEmpFilter.length > 0) {
      result = result.filter(e => tsEmpFilter.includes(e.employee_id));
    }
    // Фильтр по типу (бонусы/штрафы)
    if (tsTypeFilter === 'bonus') {
      result = result.filter(e => (e.bonus_amount || 0) > 0);
    } else if (tsTypeFilter === 'deduct') {
      result = result.filter(e => (e.deduct_amount || 0) > 0);
    }
    if (tsPeriod && tsPeriod !== 'all') {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const d = now.getDate();
      let from = null, to = null;
      if (tsPeriod === 'today') {
        from = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        to = from;
      } else if (tsPeriod === 'yesterday') {
        const yd = new Date(now); yd.setDate(d - 1);
        from = `${yd.getFullYear()}-${String(yd.getMonth()+1).padStart(2,'0')}-${String(yd.getDate()).padStart(2,'0')}`;
        to = from;
      } else if (tsPeriod === 'week') {
        const wd = new Date(now); wd.setDate(d - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        from = `${wd.getFullYear()}-${String(wd.getMonth()+1).padStart(2,'0')}-${String(wd.getDate()).padStart(2,'0')}`;
        to = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      } else if (tsPeriod === 'month') {
        from = `${y}-${String(m+1).padStart(2,'0')}-01`;
        to = `${y}-${String(m+1).padStart(2,'0')}-${String(new Date(y,m+1,0).getDate()).padStart(2,'0')}`;
      } else if (tsPeriod === 'custom' && tsPeriodFrom && tsPeriodTo) {
        from = tsPeriodFrom; to = tsPeriodTo;
      }
      if (from) {
        result = result.filter(e => e.date && e.date >= from && e.date <= to);
      }
    }
    result.sort((a, b) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      return 0;
    });
    return result;
  }, [entries, tsEmpFilter, tsPeriod, tsPeriodFrom, tsPeriodTo, tsTypeFilter]);

  const getEmpName = (id) => employees.find(e => e.id === id)?.name || '—';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Табель</h1>
          <div className="sub">Учет рабочего времени, бонусы и штрафы</div>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {loading ? (
        <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>
      ) : (
        <>
          {/* КАЛЕНДАРЬ */}
          <div className="promo-calendar-wrap">
            <div className="promo-cal-header">
              <button className="promo-cal-nav" onClick={prevMonth}>‹</button>
              <div className="promo-cal-month">{MONTHS[month]} {year}</div>
              <button className="promo-cal-nav" onClick={nextMonth}>›</button>
            </div>
            <div className="promo-cal-grid">
              {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w => <div key={w} className="wd">{w}</div>)}
              {days.map((d, i) => {
                if (!d) return <div key={'e' + i} className="day other">&nbsp;</div>;
                const stat = getDayStat(d);
                return (
                  <div key={d} className={'day' + (isToday(d) ? ' today' : '')} onClick={() => openDay(d)}>
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
            <div className="promo-cal-legend" style={{marginTop:'.5rem'}}>
              <span><span className="promo-dot active" /> Бонус</span>
              <span><span className="promo-dot planned" /> Больничный</span>
              <span><span className="promo-dot ended" /> Штраф</span>
            </div>
          </div>

          {/* ФИЛЬТРЫ */}
          <div className="stock-filterbar" style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.4rem 0',flexWrap:'wrap',marginBottom:'.5rem'}}>
            {/* Период */}
            <div style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
              <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:tsPeriod!=='all'?600:400,color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1,whiteSpace:'nowrap'}}
                onClick={e=>{e.stopPropagation();setTsShowPeriod(!tsShowPeriod);}}>{tsPeriodLabel}</span>
              {tsShowPeriod && (
                <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'190px',padding:'.35rem',zIndex:100}}>
                  {PERIOD_OPTS.map(p => (
                    <div key={p.key} onClick={()=>{setTsPeriod(p.key);setTsPeriodLabel(p.label);setTsShowPeriod(false)}}
                      style={{padding:'.3rem .5rem',fontSize:'.8rem',cursor:'pointer',borderRadius:'4px',color:tsPeriod===p.key?'var(--primary)':'var(--body-color)',fontWeight:tsPeriod===p.key?600:400,background:tsPeriod===p.key?'var(--primary-light)':'transparent'}}>{p.label}</div>
                  ))}
                  <div style={{borderTop:'1px solid var(--border)',marginTop:'.25rem',paddingTop:'.25rem'}}>
                    <div style={{fontSize:'.72rem',color:'var(--muted)',padding:'.2rem .5rem'}}>Свой период</div>
                    <div style={{display:'flex',gap:'.25rem',padding:'.25rem .5rem'}}>
                      <input type="date" value={tsPeriodFrom} onChange={e=>setTsPeriodFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px',fontFamily:'var(--font)'}} />
                      <input type="date" value={tsPeriodTo} onChange={e=>setTsPeriodTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px',fontFamily:'var(--font)'}} />
                    </div>
                    <div style={{padding:'.25rem .5rem'}}>
                      <button onClick={()=>{if(!tsPeriodFrom||!tsPeriodTo)return alert('Выберите обе даты');setTsPeriod('custom');setTsPeriodLabel(fmtShort(tsPeriodFrom)+' — '+fmtShort(tsPeriodTo));setTsShowPeriod(false)}}
                        style={{width:'100%',padding:'.35rem .5rem',fontSize:'.75rem',fontFamily:'var(--font)',background:'var(--primary)',color:'var(--primary-text)',border:'none',borderRadius:'4px',cursor:'pointer',fontWeight:600}}>Применить</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Тип */}
            <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:tsTypeFilter==='bonus'?600:400,color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
              onClick={()=>setTsTypeFilter(tsTypeFilter==='bonus'?'all':'bonus')}>Бонусы</span>
            <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:tsTypeFilter==='deduct'?600:400,color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
              onClick={()=>setTsTypeFilter(tsTypeFilter==='deduct'?'all':'deduct')}>Штрафы</span>
            {/* Сотрудник */}
            <div style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
              <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:tsEmpFilter.length>0?600:400,color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1,whiteSpace:'nowrap'}}
                onClick={e=>{e.stopPropagation();setTsShowEmp(!tsShowEmp);}}>{tsEmpFilter.length>0 ? 'Сотр. '+tsEmpFilter.length : 'Сотрудник'}</span>
              {tsShowEmp && (
                <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'200px',padding:'.35rem',zIndex:100}}>
                  <div style={{display:'flex',gap:'.35rem',marginBottom:'.25rem',borderBottom:'1px solid var(--border)',paddingBottom:'.35rem'}}>
                    <span className="cat-dd-action" onClick={()=>{setTsEmpFilter([]);}}>Очистить</span>
                  </div>
                  <div style={{maxHeight:'180px',overflowY:'auto'}}>
                    {employees.map(emp => (
                      <div key={emp.id} className="cat-dd-item" onClick={()=>{
                        setTsEmpFilter(prev => prev.includes(emp.id) ? prev.filter(e => e !== emp.id) : [...prev, emp.id]);
                      }}>
                        <span className={'cb' + (tsEmpFilter.includes(emp.id) ? ' checked' : '')} style={{width:'16px',height:'16px',border:'1.5px solid var(--border)',borderRadius:'4px',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'.6rem',color:tsEmpFilter.includes(emp.id)?'#fff':'transparent',flexShrink:0}}>
                          {tsEmpFilter.includes(emp.id) ? '✓' : ''}
                        </span>
                        {emp.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ТАБЛИЦА */}
          <div className="product-table">
            <table>
              <thead id="colHeaders" style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase'}}>
                <tr>
                  <th style={{textAlign:'left',paddingLeft:0,width:'22%'}}>Дата</th>
                  <th style={{width:'20%'}}>Сотрудник</th>
                  <th style={{width:'26%'}}>Статус</th>
                  <th style={{width:'16%'}}>Бонус</th>
                  <th style={{width:'16%'}}>Штраф</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:'var(--muted)',fontSize:'.82rem'}}>Нет записей за выбранный период</td></tr>
                ) : (filteredEntries.map(e => (
                  <tr key={e.id}>
                    <td style={{textAlign:'left',paddingLeft:0,fontWeight:500,fontSize:'.8rem'}}>{fmtDate(e.date)}</td>
                    <td style={{fontSize:'.8rem'}}>{getEmpName(e.employee_id)}</td>
                    <td style={{fontSize:'.8rem'}}>{STATUS_MAP[e.status] || e.status || '—'}</td>
                    <td style={{fontSize:'.8rem',color:(e.bonus_amount||0)>0?'#16a34a':'inherit',fontWeight:(e.bonus_amount||0)>0?600:400}}>
                      {(e.bonus_amount||0)>0 ? '+'+Number(e.bonus_amount).toLocaleString()+'₽' : '—'}
                    </td>
                    <td style={{fontSize:'.8rem',color:(e.deduct_amount||0)>0?'#dc2626':'inherit',fontWeight:(e.deduct_amount||0)>0?600:400}}>
                      {(e.deduct_amount||0)>0 ? '-'+Number(e.deduct_amount).toLocaleString()+'₽' : '—'}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* МОДАЛКА ДНЯ */}
      {showDay && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowDay(null); }}>
          <div className="modal-box" style={{maxWidth:'560px'}}>
            <button className="modal-close" onClick={() => setShowDay(null)}>&times;</button>
            <h2>{fmtDate(showDay)}</h2>
            <div className="sub">Статусы сотрудников и события дня</div>

            <div style={{border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden',marginBottom:'.65rem'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.5rem .65rem',background:'#f8f9fa',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:'.82rem',fontWeight:600}}>Статусы сотрудников</span>
                <span style={{fontSize:'.6rem',color:'var(--muted)'}}>▼</span>
              </div>
              <div style={{padding:'.5rem .65rem'}}>
                {employees.map(emp => (
                  <div key={emp.id} style={{display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.35rem'}}>
                    <span style={{fontSize:'.82rem',minWidth:'120px',fontWeight:500}}>{emp.name}</span>
                    <select style={{flex:1,padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',background:'var(--white)',color:'#111'}}
                      value={localStatuses[emp.id]||'present'}
                      onChange={e => setLocalStatuses({...localStatuses, [emp.id]: e.target.value})}>
                      {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div style={{border:'1px solid #bbf7d0',borderRadius:'12px',overflow:'hidden',marginBottom:'.65rem'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.5rem .65rem',background:'#f0fdf4',borderBottom:'1px solid #bbf7d0'}}>
                <span style={{fontSize:'.82rem',fontWeight:600,color:'#16a34a'}}>Бонусы</span>
                <span style={{fontSize:'.6rem',color:'#16a34a'}}>▼</span>
              </div>
              <div style={{padding:'.5rem .65rem'}}>
                {bonusRows.map((row, idx) => {
                  const isLast = idx === bonusRows.length - 1;
                  const hasValue = row.empId && row.amount;
                  return (
                    <div key={idx} style={{display:'flex',gap:'.35rem',marginBottom:'.35rem',alignItems:'center',opacity: isLast && !row.empId ? .65 : 1}}>
                      <select style={{flex:'1 1 130px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',background:'var(--white)',color:'#111',
                        borderStyle:isLast&&!row.empId?'dashed':'solid'}}
                        value={row.empId} onChange={e=>updateBonusRow(idx,'empId',e.target.value)}>
                        <option value="">Сотрудник</option>
                        {employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                      <input type="number" value={row.amount} onChange={e=>updateBonusRow(idx,'amount',e.target.value)} placeholder="Сумма"
                        style={{width:'90px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',borderStyle:isLast&&!row.empId?'dashed':'solid'}} />
                      <input type="text" value={row.comment} onChange={e=>updateBonusRow(idx,'comment',e.target.value)} placeholder="За что"
                        style={{flex:'1 1 80px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',borderStyle:isLast&&!row.empId?'dashed':'solid'}} />
                      {hasValue && <span style={{color:'#16a34a',fontWeight:600,fontSize:'.82rem',minWidth:'60px',textAlign:'right',whiteSpace:'nowrap'}}>+{Number(row.amount).toLocaleString()}₽</span>}
                    </div>
                  );
                })}
                <div style={{fontSize:'.68rem',color:'var(--muted)',marginTop:'2px'}}>Выберите сотрудника — появится новая строка</div>
              </div>
            </div>

            <div style={{border:'1px solid #fecaca',borderRadius:'12px',overflow:'hidden',marginBottom:'.65rem'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.5rem .65rem',background:'#fef2f2',borderBottom:'1px solid #fecaca'}}>
                <span style={{fontSize:'.82rem',fontWeight:600,color:'#dc2626'}}>Штрафы</span>
                <span style={{fontSize:'.6rem',color:'#dc2626'}}>▼</span>
              </div>
              <div style={{padding:'.5rem .65rem'}}>
                {deductRows.map((row, idx) => {
                  const isLast = idx === deductRows.length - 1;
                  const hasValue = row.empId && row.amount;
                  return (
                    <div key={idx} style={{display:'flex',gap:'.35rem',marginBottom:'.35rem',alignItems:'center',opacity: isLast && !row.empId ? .65 : 1}}>
                      <select style={{flex:'1 1 130px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',background:'var(--white)',color:'#111',
                        borderStyle:isLast&&!row.empId?'dashed':'solid'}}
                        value={row.empId} onChange={e=>updateDeductRow(idx,'empId',e.target.value)}>
                        <option value="">Сотрудник</option>
                        {employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                      <input type="number" value={row.amount} onChange={e=>updateDeductRow(idx,'amount',e.target.value)} placeholder="Сумма"
                        style={{width:'90px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',borderStyle:isLast&&!row.empId?'dashed':'solid'}} />
                      <input type="text" value={row.comment} onChange={e=>updateDeductRow(idx,'comment',e.target.value)} placeholder="За что"
                        style={{flex:'1 1 80px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',borderStyle:isLast&&!row.empId?'dashed':'solid'}} />
                      {hasValue && <span style={{color:'#dc2626',fontWeight:600,fontSize:'.82rem',minWidth:'60px',textAlign:'right',whiteSpace:'nowrap'}}>-{Number(row.amount).toLocaleString()}₽</span>}
                    </div>
                  );
                })}
                <div style={{fontSize:'.68rem',color:'var(--muted)',marginTop:'2px'}}>Выберите сотрудника — появится новая строка</div>
              </div>
            </div>

            {(function(){
              const tb = totalBonuses();
              const td = totalDeducts();
              if (tb === 0 && td === 0) return null;
              return (
                <div style={{display:'flex',justifyContent:'space-between',padding:'.65rem .75rem',background:'#f8f9fa',borderRadius:'10px',fontSize:'.85rem',marginBottom:'.75rem'}}>
                  <span>Бонусов: <b style={{color:'#16a34a'}}>{tb.toLocaleString()}₽</b></span>
                  <span>Штрафов: <b style={{color:'#dc2626'}}>{td.toLocaleString()}₽</b></span>
                </div>
              );
            })()}

            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={async () => {
                setSaving(true);
                try {
                  for (const empId of Object.keys(localStatuses)) {
                    const entry = entries.find(e => e.employee_id === empId && e.date && e.date.startsWith(showDay));
                    if (entry) {
                      await supabase.from('timesheet_entries').update({ status: localStatuses[empId] }).eq('id', entry.id);
                    } else {
                      await supabase.from('timesheet_entries').insert({ user_id: user.id, employee_id: empId, date: showDay, status: localStatuses[empId] });
                    }
                  }
                  for (const row of bonusRows) {
                    if (!row.empId || !row.amount) continue;
                    const existing = entries.find(e => e.employee_id === row.empId && e.date && e.date.startsWith(showDay) && (e.bonus_amount||0) > 0);
                    if (existing) {
                      await supabase.from('timesheet_entries').update({ bonus_amount: (existing.bonus_amount||0)+parseFloat(row.amount), bonus_comment: existing.bonus_comment?existing.bonus_comment+'; '+row.comment:row.comment }).eq('id', existing.id);
                    } else {
                      await supabase.from('timesheet_entries').insert({ user_id: user.id, employee_id: row.empId, date: showDay, status: localStatuses[row.empId]||'present', bonus_amount: parseFloat(row.amount), bonus_comment: row.comment });
                    }
                  }
                  for (const row of deductRows) {
                    if (!row.empId || !row.amount) continue;
                    const existing = entries.find(e => e.employee_id === row.empId && e.date && e.date.startsWith(showDay) && (e.deduct_amount||0) > 0);
                    if (existing) {
                      await supabase.from('timesheet_entries').update({ deduct_amount: (existing.deduct_amount||0)+parseFloat(row.amount), deduct_comment: existing.deduct_comment?existing.deduct_comment+'; '+row.comment:row.comment }).eq('id', existing.id);
                    } else {
                      await supabase.from('timesheet_entries').insert({ user_id: user.id, employee_id: row.empId, date: showDay, status: localStatuses[row.empId]||'present', deduct_amount: parseFloat(row.amount), deduct_comment: row.comment });
                    }
                  }
                  await load();
                  setShowDay(null);
                } catch (err) { alert('Ошибка: ' + err.message); }
                setSaving(false);
              }} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
