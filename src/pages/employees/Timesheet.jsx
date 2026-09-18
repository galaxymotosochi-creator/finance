import Modal from '../../components/Modal';
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';
import SectionHelp from '../../components/SectionHelp';


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
  const cur = getCurrencySymbol();
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
  // Подсказки скролла таблицы (как в «Сотрудниках»)
  const [tblPos, setTblPos] = useState({left:false, right:false});
  const tblElRef = useRef(null);
  const onTblScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left:false, right:false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const checkTbl = () => {
    const el = tblElRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left:false, right:false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const [tsSearch, setTsSearch] = useState('');
  const [tsSearchFocus, setTsSearchFocus] = useState(false);
  const [tsTypeOpen, setTsTypeOpen] = useState(false);

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

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'timesheet_entries', setList: setEntries, onSynced: load });

  // Проверка подсказок скролла — как в «Сотрудниках»
  useEffect(() => {
    const t = setTimeout(checkTbl, 120);
    window.addEventListener('resize', checkTbl);
    return () => { clearTimeout(t); window.removeEventListener('resize', checkTbl); };
  });

  // Закрытие дропдаунов при клике вне
  useEffect(() => {
    const handler = () => {
      setTsShowPeriod(false);
      setTsShowEmp(false);
      setTsTypeOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // При открытии одного дропдауна закрывать другой
  const togglePeriod = (val) => {
    setTsShowPeriod(val);
    if (val) setTsShowEmp(false);
  };
  const toggleEmp = (val) => {
    setTsShowEmp(val);
    if (val) setTsShowPeriod(false);
  };

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
    // Цветные точки статусов: больничный, отпуск, прогул, удаленка
    const dots = [];
    if (de.some(e => e.status === 'sick')) dots.push('#f97316');
    if (de.some(e => e.status === 'vacation')) dots.push('#3b82f6');
    if (de.some(e => e.status === 'absent')) dots.push('#111');
    if (de.some(e => e.status === 'remote')) dots.push('#8b5cf6');
    if (hasBonus) dots.push('#16a34a');
    if (hasDeduct) dots.push('#dc2626');
    return { hasBonus, hasDeduct, dots, hasEntries: de.length > 0 };
  };

  const openDay = (d, dateStr) => {
    const ds = dateStr || (year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
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

  const openDayByDateStr = (dateStr) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return;
    setYear(parseInt(parts[0]));
    setMonth(parseInt(parts[1]) - 1);
    openDay(parseInt(parts[2]), dateStr);
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
    // Поиск по сотруднику, статусу, комментарию
    const q = tsSearch.toLowerCase().trim();
    if (q) {
      result = result.filter(e => {
        const name = (employees.find(x => x.id === e.employee_id)?.name || '').toLowerCase();
        const stat = (STATUS_MAP[e.status] || '').toLowerCase();
        const cmt = (e.comment || '').toLowerCase();
        return name.includes(q) || stat.includes(q) || cmt.includes(q);
      });
    }
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
  }, [entries, employees, tsSearch, tsEmpFilter, tsPeriod, tsPeriodFrom, tsPeriodTo, tsTypeFilter]);

  const deleteEntry = async (id) => {
    if (!confirm('Удалить запись?')) return;
    try {
      const res = await supabase.from('timesheet_entries').delete().eq('id', id);
      if (!res.queued) await load();
    } catch (err) { alert('Ошибка удаления: ' + err.message); }
  };

  const getEmpName = (id) => employees.find(e => e.id === id)?.name || '—';

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>
      <div className="sk-bar" style={{flexWrap:'nowrap'}}>
        <div className="grow" style={{minWidth:0}}>
          <div style={{display:'flex',alignItems:'center'}}>
            <h1>Табель</h1>
            <SectionHelp
              title="Раздел «Табель»"
              intro="Табель — учет рабочего времени. Здесь отмечаются отработанные дни, больничные и отпуска. От табеля считается процент от выручки."
              faq={[
                { q: 'Как отметить день?', a: (
                  <div>Нажмите на день в <b>календаре</b> — откроется окно со статусами сотрудников за этот день.</div>
                ) },
                { q: 'Что за цветные точки в календаре?', a: (
                  <div><b>Зеленая</b> точка — в этот день был бонус, <b>красная</b> — штраф.</div>
                ) },
                { q: 'Зачем нужен табель?', a: (
                  <div>От количества отработанных дней считается <b>процент от выручки</b>. Нет табеля — начислится полный процент.</div>
                ) },
                { q: 'Как переключить месяц?', a: (
                  <div>Стрелками <b>‹ ›</b> над календарем.</div>
                ) },
                { q: 'Кто видит табель?', a: (
                  <div>Все, у кого открыт доступ к разделу <b>«Команда»</b>.</div>
                ) },
              ]}
            />
          </div>
          <div className="sub" style={{maxWidth:'210px'}}>Учет рабочего времени, бонусы и штрафы</div>
        </div>
      </div>

      {loading ? (
        <CenterSpinner />
      ) : (
        <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
          {/* КАЛЕНДАРЬ */}
          <div className="promo-calendar-wrap" style={{background:'#fff',border:'1px solid rgba(29,120,252,.14)',borderRadius:'var(--sk-radius)',padding:'14px 16px',marginBottom:'10px',boxShadow:'none'}}>
            <div className="promo-cal-header" style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
              <button className="promo-cal-nav" onClick={prevMonth} style={{width:'26px',height:'26px',fontSize:'.9rem',borderRadius:'50%',background:'#f8f9fa',border:'1px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontFamily:'inherit',color:'#333'}}>‹</button>
              <div className="promo-cal-month" style={{flex:1,textAlign:'center',fontSize:'.8125rem',fontWeight:600,color:'#333'}}>{MONTHS[month]} {year}</div>
              <button className="promo-cal-nav" onClick={nextMonth} style={{width:'26px',height:'26px',fontSize:'.9rem',borderRadius:'50%',background:'#f8f9fa',border:'1px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontFamily:'inherit',color:'#333'}}>›</button>
            </div>
            <div className="promo-cal-grid" style={{gap:'4px'}}>
              {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w => <div key={w} className="wd" style={{fontSize:'.68rem',fontWeight:600,color:'#98a1b0',paddingBottom:'.35rem'}}>{w}</div>)}
              {days.map((d, i) => {
                if (!d) return <div key={'e' + i} className="day other">&nbsp;</div>;
                const stat = getDayStat(d);
                return (
                  <div key={d} className={'day' + (isToday(d) ? ' today' : '')} onClick={() => openDay(d)}
                    style={{padding:'.45rem .2rem',borderRadius:'10px',fontSize:'.8125rem',...((stat.hasEntries && !isToday(d)) ? {background:'#f0fdf4'} : {})}}>
                    {d}
                    <div style={{display:'flex',gap:'2px',justifyContent:'center',marginTop:'2px'}}>
                      {stat.dots.map((c, idx) => <span key={idx} style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'50%',background:c}} />)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="promo-cal-legend" style={{display:'flex',gap:'14px',marginTop:'10px',paddingTop:'10px',borderTop:'1px solid #f0f3f8',fontSize:'.75rem',color:'#5b6472'}}>
              <span style={{display:'flex',alignItems:'center',gap:'5px'}}><span style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'50%',background:'#16a34a'}} /> Бонус</span>
              <span style={{display:'flex',alignItems:'center',gap:'5px'}}><span style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'50%',background:'#dc2626'}} /> Штраф</span>
            </div>
          </div>

          {/* ПЛАШКА: ПОИСК + ФИЛЬТРЫ (эталон «Поставки») */}
          <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap',border:'1px solid '+(tsSearchFocus?'#111':'#e2e2e6'),borderRadius:'999px',padding:'5px 6px 5px 14px',background:'#fff',boxShadow:tsSearchFocus?'0 2px 10px rgba(0,0,0,.12)':'0 1px 3px rgba(0,0,0,.05)',transition:'border-color .15s, box-shadow .15s'}}>
            <span style={{display:'flex',color:tsSearchFocus?'#111':'#999',transition:'color .15s'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            </span>
            <input type="text" placeholder="Поиск…" value={tsSearch} onChange={e => setTsSearch(e.target.value)}
              onFocus={()=>setTsSearchFocus(true)} onBlur={()=>setTsSearchFocus(false)}
              style={{border:'none',outline:'none',flex:'1 1 60px',minWidth:0,fontSize:'.78rem',fontFamily:'var(--font)',background:'none',padding:0}} />
            <span style={{width:'1px',height:'20px',background:'#eef1f6',flexShrink:0}}></span>

            {/* Фильтр «Период» */}
            <div style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
              <button style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}
                onClick={e=>{e.stopPropagation(); setTsShowEmp(false); setTsTypeOpen(false); setTsShowPeriod(!tsShowPeriod);}}>
                {tsPeriod !== 'all' ? tsPeriodLabel : 'Период'} <span className="car-tri">▾</span>
              </button>
              {tsShowPeriod && (
                <div onClick={e=>e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',left:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'215px',padding:'.4rem',zIndex:100}}>
                  {PERIOD_OPTS.map(p => {
                    const isActive = tsPeriod === p.key;
                    return (
                      <div key={p.key} onClick={()=>{setTsPeriod(p.key);setTsPeriodLabel(p.label);setTsShowPeriod(false);}}
                        style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                        <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                        {p.label}
                      </div>
                    );
                  })}
                  <div style={{borderTop:'1px solid rgba(29,120,252,.14)',paddingTop:'.4rem',marginTop:'.25rem'}}>
                    <div style={{fontSize:'.72rem',color:'#5b6472',padding:'.2rem .55rem',marginBottom:'.3rem',fontWeight:600}}>Свой период</div>
                    <div style={{display:'flex',gap:'.3rem',padding:'.2rem .55rem'}}>
                      <input type="date" value={tsPeriodFrom} onChange={e=>setTsPeriodFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                      <input type="date" value={tsPeriodTo} onChange={e=>setTsPeriodTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                    </div>
                    <div style={{padding:'.3rem .55rem 0',textAlign:'center'}}>
                      <button type="button" onClick={()=>{if(!tsPeriodFrom||!tsPeriodTo)return alert('Выберите обе даты');setTsPeriod('custom');setTsPeriodLabel(fmtShort(tsPeriodFrom)+' — '+fmtShort(tsPeriodTo));setTsShowPeriod(false);}}
                        className="sk-dd-btn" style={{padding:'.5rem 1.1rem',animation:'none'}}>Применить</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Фильтр «Тип» */}
            <div style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
              <button style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}
                onClick={e=>{e.stopPropagation(); setTsShowEmp(false); setTsShowPeriod(false); setTsTypeOpen(!tsTypeOpen);}}>
                {tsTypeFilter === 'bonus' ? 'Бонусы' : tsTypeFilter === 'deduct' ? 'Штрафы' : 'Тип'} <span className="car-tri">▾</span>
              </button>
              {tsTypeOpen && (
                <div onClick={e=>e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',left:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'180px',padding:'.4rem',zIndex:100}}>
                  {[{v:'all',l:'Все записи'},{v:'bonus',l:'Только бонусы'},{v:'deduct',l:'Только штрафы'}].map(o => {
                    const isActive = tsTypeFilter === o.v;
                    return (
                      <div key={o.v} onClick={()=>{setTsTypeFilter(o.v);setTsTypeOpen(false);}}
                        style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                        <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                        {o.l}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Фильтр «Сотрудник» */}
            <div style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
              <button style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}
                onClick={e=>{e.stopPropagation(); setTsShowPeriod(false); setTsTypeOpen(false); setTsShowEmp(!tsShowEmp);}}>
                {tsEmpFilter.length > 0 ? 'Сотрудник · ' + tsEmpFilter.length : 'Сотрудник'} <span className="car-tri">▾</span>
              </button>
              {tsShowEmp && (
                <div onClick={e=>e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'220px',maxHeight:'300px',overflowY:'auto',padding:'.4rem',zIndex:100}}>
                  {employees.length === 0 ? (
                    <div style={{padding:'.5rem .55rem',fontSize:'.78rem',color:'#5b6472'}}>Сотрудников пока нет</div>
                  ) : employees.map(emp => {
                    const isActive = tsEmpFilter.includes(emp.id);
                    return (
                      <div key={emp.id} onClick={()=>{ setTsEmpFilter(prev => prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id]); }}
                        style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                        <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                        {emp.name}
                      </div>
                    );
                  })}
                  {tsEmpFilter.length > 0 && (
                    <div style={{borderTop:'1px solid rgba(29,120,252,.14)',marginTop:'.25rem',paddingTop:'.35rem'}}>
                      <div onClick={()=>setTsEmpFilter([])}
                        style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:'#dc2626',fontWeight:600}}>
                        <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#fecaca',flexShrink:0}}></span>
                        Очистить
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ТАБЛИЦА */}
          <div className="sk-tablewrap" style={{flex:'none',minHeight:'auto'}}>
            <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
            <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}}></div>
            <div className="sk-card" style={{position:'relative',overflowX:'auto',WebkitOverflowScrolling:'touch'}} ref={tblElRef} onScroll={onTblScroll}>
            <table className="sk-table ts-table">
              <thead><tr>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Дата</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Сотрудник</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Статус</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Бонус</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Штраф</th>
                <th style={{width:'70px',textAlign:'left'}}></th>
              </tr></thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-products"><div className="big-icon">📅</div><p>Нет записей за выбранный период</p>
                        <p style={{color:'var(--muted)',margin:'.5rem 0 0'}}>Отметьте день в календаре выше</p></div></td></tr>
                ) : (filteredEntries.map(e => (
                  <tr key={e.id}>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}>{(e.date||'').split('T')[0].split('-').reverse().join('.') || '—'}</td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}>
                      {getEmpName(e.employee_id)}{e.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}
                    </td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}>{STATUS_MAP[e.status] || e.status || '—'}</td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#16a34a'}}>
                      {(e.bonus_amount||0)>0 ? '+'+Number(e.bonus_amount).toLocaleString()+' ₽' : '—'}
                    </td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#dc2626'}}>
                      {(e.deduct_amount||0)>0 ? '-'+Number(e.deduct_amount).toLocaleString()+' ₽' : '—'}
                    </td>
                    <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                      <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                        <button className="sk-more" onClick={(ev) => {
                          ev.stopPropagation();
                          var dd=ev.currentTarget.nextElementSibling;
                          document.querySelectorAll('.prod-dropdown.open').forEach(function(d){if(d!==dd)d.classList.remove('open');});
                          dd.classList.toggle('open');var _r=dd.getBoundingClientRect();if(_r.bottom>window.innerHeight)dd.classList.add('up');else dd.classList.remove('up');
                        }}>⋯</button>
                        <div className="prod-dropdown">
                          <button onClick={() => openDayByDateStr(e.date)}>Редактировать</button>
                          <button onClick={() => deleteEntry(e.id)} style={{color:'#dc3545'}}>Удалить</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА ДНЯ */}
      <Modal open={showDay} onClose={() => setShowDay(null)} title={(showDay||'').split('T')[0].split('-').reverse().join('.') || '—'} subtitle="Статусы сотрудников и события дня" width="wide">

            <div style={{border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden',marginBottom:'.65rem'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.5rem .65rem',background:'#f8f9fa',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:'.82rem',fontWeight:600}}>Статусы сотрудников</span>
                <span style={{fontSize:'.6rem',color:'var(--muted)'}}>▼</span>
              </div>
              <div style={{padding:'.5rem .65rem'}}>
                {employees.map(emp => (
                  <div key={emp.id} style={{display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.35rem'}}>
                    <span style={{fontSize:'.82rem',minWidth:'120px',fontWeight:500}}>{emp.name}</span>
                    <select style={{width:'140px',flexShrink:0,padding:'.35rem .5rem',fontSize:'.8125rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',background:'var(--white)',color:'#111'}}
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
                      {hasValue && <span style={{color:'#16a34a',fontWeight:600,fontSize:'.82rem',minWidth:'60px',textAlign:'right',whiteSpace:'nowrap'}}>+{Number(row.amount).toLocaleString()} {cur}</span>}
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
                      {hasValue && <span style={{color:'#dc2626',fontWeight:600,fontSize:'.82rem',minWidth:'60px',textAlign:'right',whiteSpace:'nowrap'}}>-{Number(row.amount).toLocaleString()} {cur}</span>}
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
                  <span>Бонусов: <b style={{color:'#16a34a'}}>{tb.toLocaleString()} {cur}</b></span>
                  <span>Штрафов: <b style={{color:'#dc2626'}}>{td.toLocaleString()} {cur}</b></span>
                </div>
              );
            })()}

            <div className="modal-actions">
              <button type="button" className="btn btn-dark" onClick={async () => {
                setSaving(true);
                let anyQueued = false;
                try {
                  for (const empId of Object.keys(localStatuses)) {
                    const entry = entries.find(e => e.employee_id === empId && e.date && e.date.startsWith(showDay));
                    if (entry) {
                      const r = await supabase.from('timesheet_entries').update({ status: localStatuses[empId] }).eq('id', entry.id); if (r.queued) anyQueued = true;
                    } else if (localStatuses[empId] && localStatuses[empId] !== 'present') {
                      // Создаем запись только если отметили нестандартный статус —
                      // иначе каждый «Сохранить» плодит «Работал» всем сотрудникам
                      const r = await supabase.from('timesheet_entries').insert({ user_id: user.id, employee_id: empId, date: showDay, status: localStatuses[empId] }); if (r.queued) anyQueued = true;
                    }
                  }
                  // Бонусы: полная перезапись по сотрудникам дня (идемпотентно — повторное
                  // сохранение не удваивает сумму, а убранная строка обнуляет бонус)
                  const bonusByEmp = {};
                  const bonusComments = {};
                  bonusRows.forEach(r => { if (r.empId && r.amount) { bonusByEmp[r.empId] = (bonusByEmp[r.empId]||0) + parseFloat(r.amount); if (r.comment) bonusComments[r.empId] = (bonusComments[r.empId] ? bonusComments[r.empId]+'; ' : '') + r.comment; } });
                  for (const [empId, amount] of Object.entries(bonusByEmp)) {
                    const { data: exB } = await supabase.from('timesheet_entries').select('id').eq('user_id',user.id).eq('employee_id',empId).eq('date',showDay).maybeSingle();
                    if (exB) { const r = await supabase.from('timesheet_entries').update({ bonus_amount: amount, bonus_comment: bonusComments[empId]||'' }).eq('id', exB.id); if (r.queued) anyQueued = true; }
                    else { const r = await supabase.from('timesheet_entries').insert({ user_id: user.id, employee_id: empId, date: showDay, status: localStatuses[empId]||'present', bonus_amount: amount, bonus_comment: bonusComments[empId]||'' }); if (r.queued) anyQueued = true; }
                  }
                  // Обнуляем бонусы, если строки убрали из формы
                  const dayEntriesB = entries.filter(e => e.date && e.date.startsWith(showDay));
                  for (const e of dayEntriesB) {
                    if ((Number(e.bonus_amount)||0) > 0 && !bonusByEmp[e.employee_id]) {
                      const r = await supabase.from('timesheet_entries').update({ bonus_amount: 0, bonus_comment: '' }).eq('id', e.id); if (r.queued) anyQueued = true;
                    }
                  }
                  // Штрафы: так же — полная перезапись
                  const deductByEmp = {};
                  const deductComments = {};
                  deductRows.forEach(r => { if (r.empId && r.amount) { deductByEmp[r.empId] = (deductByEmp[r.empId]||0) + parseFloat(r.amount); if (r.comment) deductComments[r.empId] = (deductComments[r.empId] ? deductComments[r.empId]+'; ' : '') + r.comment; } });
                  for (const [empId, amount] of Object.entries(deductByEmp)) {
                    const { data: exD } = await supabase.from('timesheet_entries').select('id').eq('user_id',user.id).eq('employee_id',empId).eq('date',showDay).maybeSingle();
                    if (exD) { const r = await supabase.from('timesheet_entries').update({ deduct_amount: amount, deduct_comment: deductComments[empId]||'' }).eq('id', exD.id); if (r.queued) anyQueued = true; }
                    else { const r = await supabase.from('timesheet_entries').insert({ user_id: user.id, employee_id: empId, date: showDay, status: localStatuses[empId]||'present', deduct_amount: amount, deduct_comment: deductComments[empId]||'' }); if (r.queued) anyQueued = true; }
                  }
                  const dayEntriesD = entries.filter(e => e.date && e.date.startsWith(showDay));
                  for (const e of dayEntriesD) {
                    if ((Number(e.deduct_amount)||0) > 0 && !deductByEmp[e.employee_id]) {
                      const r = await supabase.from('timesheet_entries').update({ deduct_amount: 0, deduct_comment: '' }).eq('id', e.id); if (r.queued) anyQueued = true;
                    }
                  }
                  if (!anyQueued) await load();
                  setShowDay(null);
                } catch (err) { alert('Ошибка: ' + err.message); }
                setSaving(false);
              }} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
      </Modal>
    </div>
  );
}
