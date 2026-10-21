import { useState, useMemo } from 'react';
import ShopCalendar from './ShopCalendar';

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));
const ST = {
  new:      { t:'Новая',     c:'#1F75FF' },
  confirmed:{ t:'Подтверждена', c:'#16a34a' },
  done:     { t:'Выполнена', c:'#6b7280' },
  canceled: { t:'Отменена',  c:'#dc2626' },
};

export default function ShopBookings({ bookings, loading, onStatus }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [sel, setSel] = useState(now.toISOString().slice(0, 10));

  const dayList = useMemo(() =>
    bookings.filter(b => String(b.booking_date).slice(0, 10) === sel)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))),
    [bookings, sel]);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div>
      <ShopCalendar bookings={bookings} year={year} month={month}
        onPrev={prev} onNext={next} selected={sel} onSelect={setSel} />

      <div style={{ fontSize:'0.84rem', fontWeight:700, margin:'18px 0 10px' }}>
        Записи на {sel.split('-').reverse().join('.')}
      </div>

      {loading ? (
        <div style={{ padding:30, textAlign:'center', color:'#9ca3af' }}>Загружаю…</div>
      ) : !dayList.length ? (
        <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:14, padding:30,
          textAlign:'center', color:'#9ca3af', fontSize:'0.86rem' }}>
          На этот день записей нет
        </div>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {dayList.map(b => {
            const st = ST[b.status] || ST.new;
            return (
              <div key={b.id} style={{ background:'#fff', border:'1px solid #eee', borderRadius:14, padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontWeight:800, fontSize:'0.95rem' }}>{b.start_time}–{b.end_time}</span>
                      <span style={{ fontSize:'0.7rem', fontWeight:700, color:st.c,
                        background:st.c + '1a', padding:'2px 8px', borderRadius:20 }}>{st.t}</span>
                    </div>
                    <div style={{ fontSize:'0.86rem', fontWeight:600 }}>{b.service_name || 'Услуга'}</div>
                    <div style={{ fontSize:'0.82rem', color:'#6b7280' }}>{b.customer_name} · {b.customer_phone}</div>
                    {b.comment && <div style={{ fontSize:'0.78rem', color:'#9ca3af', marginTop:3 }}>{b.comment}</div>}
                  </div>
                  <div style={{ fontSize:'1rem', fontWeight:800 }}>{fmt(b.price)} ₽</div>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:11, flexWrap:'wrap' }}>
                  {b.status === 'new' && (
                    <button className="btn btn-dark" style={{ fontSize:'0.75rem' }} onClick={() => onStatus(b, 'confirmed')}>Подтвердить</button>
                  )}
                  {b.status === 'confirmed' && (
                    <button className="btn btn-dark" style={{ fontSize:'0.75rem' }} onClick={() => onStatus(b, 'done')}>Выполнено</button>
                  )}
                  {(b.status === 'new' || b.status === 'confirmed') && (
                    <button className="btn btn-outline" style={{ fontSize:'0.75rem' }} onClick={() => onStatus(b, 'canceled')}>Отменить</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
