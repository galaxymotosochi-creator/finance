import { useMemo } from 'react';

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export default function ShopCalendar({ bookings, year, month, onPrev, onNext, selected, onSelect }) {
  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const shift = (first.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const arr = new Array(shift).fill(null);
    for (let d = 1; d <= total; d++) arr.push(d);
    return arr;
  }, [year, month]);

  const byDay = useMemo(() => {
    const m = {};
    bookings.forEach(b => {
      const d = String(b.booking_date).slice(0, 10);
      if (!m[d]) m[d] = [];
      m[d].push(b);
    });
    return m;
  }, [bookings]);

  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="promo-calendar-wrap" style={{ width:'100%', maxWidth:520, margin:'0 auto 12px' }}>
      <div className="promo-cal-header">
        <button className="promo-cal-nav" onClick={onPrev}>‹</button>
        <div className="promo-cal-month">{MONTHS[month]} {year}</div>
        <button className="promo-cal-nav" onClick={onNext}>›</button>
      </div>
      <div className="promo-cal-grid">
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w => <div key={w} className="wd">{w}</div>)}
        {days.map((d, i) => {
          if (!d) return <div key={'e'+i} className="day other">&nbsp;</div>;
          const ds = year + '-' + pad(month+1) + '-' + pad(d);
          const list = byDay[ds] || [];
          const isSel = selected === ds;
          return (
            <div key={d}
              className={'day' + (ds === todayStr ? ' today' : '') + (list.length ? ' has-entries' : '')}
              onClick={() => onSelect(ds)}
              style={isSel ? { background:'#111', color:'#fff', borderColor:'#111' } : undefined}>
              {d}
              <div style={{ display:'flex', gap:2, justifyContent:'center', marginTop:2 }}>
                {list.slice(0, 3).map((b, idx) => (
                  <span key={idx} style={{ display:'inline-block', width:6, height:6, borderRadius:'50%',
                    background: b.status === 'canceled' ? '#9ca3af' : (b.status === 'done' ? '#16a34a' : '#1F75FF') }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="promo-cal-legend" style={{ borderTop:'1px solid #f0f3f8', paddingTop:10, marginTop:10 }}>
        <span><span className="promo-dot" style={{ background:'#1F75FF' }}></span> Новая</span>
        <span><span className="promo-dot" style={{ background:'#16a34a' }}></span> Выполнена</span>
        <span><span className="promo-dot" style={{ background:'#9ca3af' }}></span> Отменена</span>
      </div>
    </div>
  );
}
