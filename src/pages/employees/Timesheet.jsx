import Modal from '../../components/Modal';
import RowMenu from '../../components/RowMenu';
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';
import SectionHelp from '../../components/SectionHelp';
import SmartSelect from '../../components/SmartSelect';


const STATUS_OPTS = [
  { value: 'present', label: 'Работал' },
  { value: 'sick', label: 'Больничный' },
  { value: 'vacation', label: 'Отпуск опл.' },
  { value: 'own_expense', label: 'За свой счёт' },
  { value: 'dayoff', label: 'Выходной' },
  { value: 'absent', label: 'Прогул' },
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
  const [dayStep, setDayStep] = useState(1);
  const [dayRates, setDayRates] = useState({});
  const [dayHours, setDayHours] = useState({});
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
    if (de.some(e => e.status === 'own_expense')) dots.push('#8b93a3');
    if (de.some(e => e.status === 'dayoff')) dots.push('#c3cad6');
    if (hasBonus) dots.push('#16a34a');
    if (hasDeduct) dots.push('#dc2626');
    return { hasBonus, hasDeduct, dots, hasEntries: de.length > 0 || de.some(e => (e.day_rate || 0) > 0 || (e.day_hours || 0) > 0) };
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
    setDayStep(1);
    const rt = {}, hs = {};
    employees.forEach(emp => {
      const entry = getEntry(emp.id, ds);
      if (entry) {
        if (entry.day_rate != null) rt[emp.id] = entry.day_rate;
        if (entry.day_hours != null) hs[emp.id] = entry.day_hours;
      }
    });
    setDayRates(rt);
    setDayHours(hs);

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
  // Прошлые дни месяца — как в Акциях (не подсвечиваются)
  const isPast = (d) => {
    const dt = new Date(year, month, d);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dt < t;
  };
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

  // Итог дня: ставки тех, кто работал или в оплачиваемом отпуске, плюс премии, минус штрафы
  const dayTotal = () => {
    let sum = 0;
    employees.forEach(emp => {
      const st = localStatuses[emp.id] || 'present';
      if (st === 'present' || st === 'vacation') sum += parseFloat(dayRates[emp.id]) || 0;
    });
    bonusRows.forEach(r => { if (r.empId && r.amount) sum += parseFloat(r.amount) || 0; });
    deductRows.forEach(r => { if (r.empId && r.amount) sum -= parseFloat(r.amount) || 0; });
    return Math.round(sum);
  };

  // Сохранение дня: статусы, ставка, часы, премии, штрафы
  const saveDay = async () => {
    setSaving(true);
    let anyQueued = false;
    try {
      for (const empId of Object.keys(localStatuses)) {
        const entry = entries.find(e => e.employee_id === empId && e.date && e.date.startsWith(showDay));
        const st = localStatuses[empId];
        const rate = dayRates[empId] != null && dayRates[empId] !== '' ? parseFloat(dayRates[empId]) : null;
        const hrs = dayHours[empId] != null && dayHours[empId] !== '' ? parseFloat(dayHours[empId]) : null;
        if (entry) {
          const payload = { status: st };
          if (rate != null) payload.day_rate = rate;
          if (hrs != null) payload.day_hours = hrs;
          const r = await supabase.from('timesheet_entries').update(payload).eq('id', entry.id); if (r.queued) anyQueued = true;
        } else if (st !== 'present' || rate != null || hrs != null) {
          const payload = { user_id: user.id, employee_id: empId, date: showDay, status: st, filled_by: user.email || '' };
          if (rate != null) payload.day_rate = rate;
          if (hrs != null) payload.day_hours = hrs;
          const r = await supabase.from('timesheet_entries').insert(payload); if (r.queued) anyQueued = true;
        }
      }
      // Бонусы
      const bonusByEmp = {}, bonusComments = {};
      bonusRows.forEach(r => { if (r.empId && r.amount) { bonusByEmp[r.empId] = (bonusByEmp[r.empId]||0) + parseFloat(r.amount); if (r.comment) bonusComments[r.empId] = (bonusComments[r.empId] ? bonusComments[r.empId]+'; ' : '') + r.comment; } });
      for (const [empId, amount] of Object.entries(bonusByEmp)) {
        const { data: exB } = await supabase.from('timesheet_entries').select('id').eq('user_id',user.id).eq('employee_id',empId).eq('date',showDay).maybeSingle();
        if (exB) { const r = await supabase.from('timesheet_entries').update({ bonus_amount: amount, bonus_comment: bonusComments[empId]||'' }).eq('id', exB.id); if (r.queued) anyQueued = true; }
        else { const r = await supabase.from('timesheet_entries').insert({ user_id: user.id, employee_id: empId, date: showDay, status: localStatuses[empId]||'present', bonus_amount: amount, bonus_comment: bonusComments[empId]||'', filled_by: user.email || '' }); if (r.queued) anyQueued = true; }
      }
      const dayEntriesB = entries.filter(e => e.date && e.date.startsWith(showDay));
      for (const e of dayEntriesB) {
        if ((Number(e.bonus_amount)||0) > 0 && !bonusByEmp[e.employee_id]) {
          const r = await supabase.from('timesheet_entries').update({ bonus_amount: 0, bonus_comment: '' }).eq('id', e.id); if (r.queued) anyQueued = true;
        }
      }
      // Штрафы
      const deductByEmp = {}, deductComments = {};
      deductRows.forEach(r => { if (r.empId && r.amount) { deductByEmp[r.empId] = (deductByEmp[r.empId]||0) + parseFloat(r.amount); if (r.comment) deductComments[r.empId] = (deductComments[r.empId] ? deductComments[r.empId]+'; ' : '') + r.comment; } });
      for (const [empId, amount] of Object.entries(deductByEmp)) {
        const { data: exD } = await supabase.from('timesheet_entries').select('id').eq('user_id',user.id).eq('employee_id',empId).eq('date',showDay).maybeSingle();
        if (exD) { const r = await supabase.from('timesheet_entries').update({ deduct_amount: amount, deduct_comment: deductComments[empId]||'' }).eq('id', exD.id); if (r.queued) anyQueued = true; }
        else { const r = await supabase.from('timesheet_entries').insert({ user_id: user.id, employee_id: empId, date: showDay, status: localStatuses[empId]||'present', deduct_amount: amount, deduct_comment: deductComments[empId]||'', filled_by: user.email || '' }); if (r.queued) anyQueued = true; }
      }
      const dayEntriesD = entries.filter(e => e.date && e.date.startsWith(showDay));
      for (const e of dayEntriesD) {
        if ((Number(e.deduct_amount)||0) > 0 && !deductByEmp[e.employee_id]) {
          const r = await supabase.from('timesheet_entries').update({ deduct_amount: 0, deduct_comment: '' }).eq('id', e.id); if (r.queued) anyQueued = true;
        }
      }
      await load();
      setShowDay(null);
    } catch (err) { alert('Ошибка: ' + err.message); }
    setSaving(false);
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
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',paddingLeft:'14px',borderLeft:'3px solid #1F75FF',flexWrap:'nowrap'}}>
        <div className="grow" style={{minWidth:0}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'3px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
            <h1 className="cat-title">Табель</h1>
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
          <span className="cat-sub">Учёт рабочего времени, бонусы и штрафы</span>
          </div>
        </div>
      </div>

      {loading ? (
        <CenterSpinner />
      ) : (
        <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
          {/* КАЛЕНДАРЬ */}
          <div className="promo-calendar-wrap" style={{width:'100%',maxWidth:'520px',margin:'0 auto 12px'}}>
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
                  <div key={d} className={'day' + (isToday(d) ? ' today' : '') + (stat.hasEntries && !isToday(d) ? ' has-entries' : '') + (isPast(d) && !stat.hasEntries && !isToday(d) ? ' other' : '')} onClick={() => openDay(d)}>
                    {d}
                  </div>
                );
              })}
            </div>
            <div className="promo-cal-legend" style={{borderTop:'1px solid #f0f3f8',paddingTop:'10px',marginTop:'10px'}}>
              <span><span className="promo-dot" style={{background:'#eff6ff',border:'1px solid rgba(31,117,255,.45)'}}></span> Табель заполнен</span>
            </div>
          </div>

          {/* ПЛАШКА: ПОИСК + ФИЛЬТРЫ (эталон «Поставки») */}
          <div className="sk-search" style={{display:'flex',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap',padding:'5px 6px 5px 14px'}}>
            <span style={{display:'flex',color:'#999'}}>
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
            <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}} data-arrow="top"></div>
            <div className="sk-card" style={{position:'relative',overflowX:'auto',WebkitOverflowScrolling:'touch'}} ref={tblElRef} onScroll={onTblScroll}>
            <table className="sk-table ts-table">
              <thead><tr>
                <th style={{textAlign:'left',whiteSpace:'nowrap',width:'92px',minWidth:'92px'}}>Дата</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Сотрудник</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Статус</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Бонус</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Комментарий к бонусу</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Штраф</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Комментарий к штрафу</th>
                <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Кто заполнил</th>
                <th style={{width:'70px',textAlign:'left'}}></th>
              </tr></thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div style={{ padding:'28px 24px', textAlign:'center', color:'var(--muted)' }}>
                      <div style={{ maxWidth:'420px', margin:'0 auto', textAlign:'left', fontSize:'.8rem', color:'#555', lineHeight:1.6 }}>
                        <b>Как заполнить табель:</b><br />
                        • Выберите месяц и нажмите на день в календаре выше<br />
                        • Отметьте статус каждого сотрудника: рабочий день, выходной, больничный, отпуск<br />
                        • При необходимости добавьте бонус или штраф<br />
                        • Нажмите «Сохранить» — запись появится в таблице
                      </div>
                    </div>
                  </td></tr>
                ) : (filteredEntries.map(e => (
                  <tr key={e.id}>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222',width:'92px',minWidth:'92px'}}>{(e.date||'').split('T')[0].split('-').reverse().join('.') || '—'}</td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}>
                      {getEmpName(e.employee_id)}{e.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}
                    </td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}>{STATUS_MAP[e.status] || e.status || '—'}</td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}>
                      {(e.bonus_amount||0)>0 ? '+'+Number(e.bonus_amount).toLocaleString()+' ₽' : '—'}
                    </td>
                    <td style={{textAlign:'left',color:'#222',maxWidth:'200px'}}>
                      {(e.bonus_amount||0)>0 ? (e.bonus_comment || '—') : '—'}
                    </td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}>
                      {(e.deduct_amount||0)>0 ? '-'+Number(e.deduct_amount).toLocaleString()+' ₽' : '—'}
                    </td>
                    <td style={{textAlign:'left',color:'#222',maxWidth:'200px'}}>
                      {(e.deduct_amount||0)>0 ? (e.deduct_comment || '—') : '—'}
                    </td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}>{e.filled_by || '—'}</td>
                    <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                      <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                        <RowMenu items={[
                          { label: 'Редактировать', onClick: () => openDayByDateStr(e.date) },
                          { label: 'Удалить', onClick: () => deleteEntry(e.id), danger: true },
                        ]} />
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
      <Modal open={!!showDay} onClose={() => setShowDay(null)} title={(showDay||'').split('T')[0].split('-').reverse().join('.') || '—'} subtitle="" width="wide" className="modal-v2 cat-modal">

            {/* Полоски шагов */}
            <div style={{display:'flex',gap:'5px',marginBottom:'14px'}}>
              <i style={{flex:1,height:'4px',borderRadius:'99px',background: dayStep>1 ? '#9dc0ff' : (dayStep===1 ? 'linear-gradient(90deg,#0d4ea8,#1F75FF)' : '#e7eefb')}}></i>
              <i style={{flex:1,height:'4px',borderRadius:'99px',background: dayStep>2 ? '#9dc0ff' : (dayStep===2 ? 'linear-gradient(90deg,#0d4ea8,#1F75FF)' : '#e7eefb')}}></i>
              <i style={{flex:1,height:'4px',borderRadius:'99px',background: dayStep===3 ? 'linear-gradient(90deg,#0d4ea8,#1F75FF)' : '#e7eefb'}}></i>
            </div>

            {/* ШАГ 1 — кто работал */}
            {dayStep === 1 && (
              <div>
                {employees.map(emp => (
                  <div key={emp.id} className="ts-pcard">
                    <div className="ts-pcard-top">
                      <span className="ts-av">{emp.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</span>
                      <span className="ts-pname">{emp.name}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <SmartSelect
                          value={localStatuses[emp.id] || ''}
                          onChange={v => setLocalStatuses({...localStatuses, [emp.id]: v})}
                          options={STATUS_OPTS.map(o => ({ value: o.value, label: o.label }))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ШАГ 2 — ставка и часы */}
            {dayStep === 2 && (
              <div>
                {employees.filter(emp => (localStatuses[emp.id]||'present') === 'present').map(emp => {
                  const h = dayHours[emp.id] != null ? dayHours[emp.id] : 12;
                  const rate = dayRates[emp.id] != null ? dayRates[emp.id] : '';
                  return (
                    <div key={emp.id} className="ts-pcard">
                      <div className="ts-pcard-top">
                        <span className="ts-av">{emp.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</span>
                        <span className="ts-pname">{emp.name}</span>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                        <div>
                          <span className="ts-cap">Ставка за день</span>
                          <input type="number" className="ts-input" value={rate}
                            onChange={e => setDayRates({...dayRates, [emp.id]: e.target.value})} placeholder="0" />
                        </div>
                        <div>
                          <span className="ts-cap">Часов</span>
                          <input type="number" className="ts-input" min="0" max="24" value={h}
                            onChange={e => setDayHours({...dayHours, [emp.id]: e.target.value})} />
                        </div>
                      </div>
                      <div style={{display:'flex',gap:'5px',marginTop:'7px'}}>
                        <button type="button" className={'ts-qb' + (Number(h)===12 ? ' on' : '')} onClick={() => setDayHours({...dayHours, [emp.id]: 12})}>Полная смена · 12 ч</button>
                        <button type="button" className={'ts-qb' + (Number(h)===6 ? ' on' : '')} onClick={() => setDayHours({...dayHours, [emp.id]: 6})}>Пол дня · 6 ч</button>
                      </div>
                    </div>
                  );
                })}
                {employees.filter(emp => (localStatuses[emp.id]||'present') === 'present').length === 0 && (
                  <div style={{fontSize:'.78rem',color:'var(--muted)',padding:'.6rem 0'}}>Никто не отмечен как работавший. Вернитесь на шаг 1.</div>
                )}
              </div>
            )}

            {/* ШАГ 3 — премии и штрафы */}
            {dayStep === 3 && (
              <div>
                <div className="ts-seclab">Премии</div>
                {bonusRows.map((row, idx) => (
                  <div key={'b'+idx} className="ts-pcard">
                    <div style={{display:'flex',gap:'7px',alignItems:'center',marginBottom:'7px'}}>
                      <select className="ts-sel" style={{flex:1,maxWidth:'none'}} value={row.empId} onChange={e => setBonusRows(bonusRows.map((r,i)=>i===idx?{...r,empId:e.target.value}:r))}>
                        <option value="">— сотрудник —</option>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                      <input type="number" className="ts-sel" style={{maxWidth:'90px',textAlign:'right'}} value={row.amount} placeholder="0"
                        onChange={e => setBonusRows(bonusRows.map((r,i)=>i===idx?{...r,amount:e.target.value}:r))} />
                      <span style={{fontSize:'.72rem',color:'var(--muted)'}}>{cur}</span>
                    </div>
                    <div style={{display:'flex',gap:'7px',alignItems:'center'}}>
                      <input className="ts-sel" style={{flex:1,maxWidth:'none',fontWeight:500}} value={row.comment} placeholder="За что"
                        onChange={e => setBonusRows(bonusRows.map((r,i)=>i===idx?{...r,comment:e.target.value}:r))} />
                      <span className="ts-del" onClick={() => setBonusRows(bonusRows.filter((r,i)=>i!==idx))}>✕</span>
                    </div>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'center'}}><button type="button" className="ts-add" onClick={() => setBonusRows(prev => [...prev, emptyRow()])}>+ Добавить премию</button></div>

                <div className="ts-seclab" style={{marginTop:'12px'}}>Штрафы</div>
                {deductRows.map((row, idx) => (
                  <div key={'d'+idx} className="ts-pcard">
                    <div style={{display:'flex',gap:'7px',alignItems:'center',marginBottom:'7px'}}>
                      <select className="ts-sel" style={{flex:1,maxWidth:'none'}} value={row.empId} onChange={e => setDeductRows(deductRows.map((r,i)=>i===idx?{...r,empId:e.target.value}:r))}>
                        <option value="">— сотрудник —</option>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                      <input type="number" className="ts-sel" style={{maxWidth:'90px',textAlign:'right'}} value={row.amount} placeholder="0"
                        onChange={e => setDeductRows(deductRows.map((r,i)=>i===idx?{...r,amount:e.target.value}:r))} />
                      <span style={{fontSize:'.72rem',color:'var(--muted)'}}>{cur}</span>
                    </div>
                    <div style={{display:'flex',gap:'7px',alignItems:'center'}}>
                      <input className="ts-sel" style={{flex:1,maxWidth:'none',fontWeight:500}} value={row.comment} placeholder="За что"
                        onChange={e => setDeductRows(deductRows.map((r,i)=>i===idx?{...r,comment:e.target.value}:r))} />
                      <span className="ts-del" onClick={() => setDeductRows(deductRows.filter((r,i)=>i!==idx))}>✕</span>
                    </div>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'center'}}><button type="button" className="ts-add" onClick={() => setDeductRows(prev => [...prev, emptyRow()])}>+ Добавить штраф</button></div>
              </div>
            )}

            {/* Итог дня — на шагах 2 и 3, на первом он не нужен */}
            {dayStep > 1 && (<div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',background:'#F6F9FF',border:'1px solid rgba(29,120,252,.16)',borderRadius:'11px',padding:'.6rem .75rem',margin:'12px 0 4px'}}>
              <span style={{fontSize:'.65rem',textTransform:'uppercase',letterSpacing:'.05em',color:'var(--muted)',fontWeight:800}}>За день</span>
              <span style={{fontSize:'1.05rem',fontWeight:800}}>{dayTotal().toLocaleString()} {cur}</span>
            </div>)}

            <div className="modal-actions">
              {dayStep > 1 && <button type="button" className="v2-ghost" onClick={() => setDayStep(dayStep - 1)}>← Назад</button>}
              {dayStep === 1 && <button type="button" className="v2-ghost" onClick={() => setShowDay(null)}>Отмена</button>}
              {dayStep < 3 && <button type="button" className="cat-add-btn" onClick={() => setDayStep(dayStep + 1)}>Дальше →</button>}
              {dayStep === 3 && (
                <button type="button" className="cat-add-btn" disabled={saving} onClick={saveDay}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
              )}
            </div>
      </Modal>
    </div>
  );
}
