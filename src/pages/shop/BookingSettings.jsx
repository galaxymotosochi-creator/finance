const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const inp = { padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:9, fontSize:'0.82rem',
  outline:'none', boxSizing:'border-box', fontFamily:'inherit', width:96 };

export default function BookingSettings({ form, setForm, onSave, saving }) {
  const sched = form.booking_schedule || {};
  const setDay = (d, patch) => {
    const cur = sched[d] || { open:'09:00', close:'18:00', off:false };
    setForm({ ...form, booking_schedule: { ...sched, [d]: { ...cur, ...patch } } });
  };
  const day = (d) => sched[d] || { open: form.booking_open || '09:00', close: form.booking_close || '18:00', off:false };

  return (
    <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:16, padding:20, marginTop:14 }}>
      <div style={{ fontSize:'1rem', fontWeight:700, marginBottom:4 }}>Календарь записи</div>
      <div style={{ fontSize:'0.8rem', color:'#9ca3af', marginBottom:16 }}>График, шаг слотов и перерыв</div>

      <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#6b7280', marginBottom:8 }}>График по дням</div>
      <div style={{ display:'grid', gap:6, marginBottom:18 }}>
        {DAYS.map(d => {
          const v = day(d);
          const off = !!v.off;
          return (
            <div key={d} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
              borderRadius:11, border:'1px solid ' + (off ? '#eee' : 'rgba(31,117,255,.28)'),
              background: off ? '#fafafa' : 'rgba(31,117,255,.04)', flexWrap:'wrap' }}>
              <div onClick={() => setDay(d, { off: !off })}
                style={{ width:18, height:18, borderRadius:5, flexShrink:0, cursor:'pointer',
                  border:'1.5px solid ' + (off ? '#d1d5db' : '#1F75FF'),
                  background: off ? '#fff' : '#1F75FF', display:'flex', alignItems:'center',
                  justifyContent:'center', color:'#fff', fontSize:'0.7rem', fontWeight:800 }}>
                {off ? '' : '✓'}
              </div>
              <div style={{ width:30, fontSize:'0.82rem', fontWeight:700, color: off ? '#9ca3af' : '#111' }}>{d}</div>
              {off ? (
                <div style={{ fontSize:'0.8rem', color:'#9ca3af' }}>выходной</div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <input type="time" value={v.open} onChange={e => setDay(d, { open:e.target.value })} style={inp} />
                  <span style={{ color:'#9ca3af', fontSize:'0.8rem' }}>—</span>
                  <input type="time" value={v.close} onChange={e => setDay(d, { close:e.target.value })} style={inp} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#6b7280', marginBottom:8 }}>Шаг слотов</div>
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
        {[30,60,90,120].map(st => {
          const on = (Number(form.booking_step) || 60) === st;
          return (
            <button key={st} onClick={() => setForm({ ...form, booking_step: st })}
              style={{ padding:'8px 16px', borderRadius:22, cursor:'pointer', fontSize:'0.82rem',
                fontWeight: on ? 700 : 500, background: on ? '#111' : '#fff',
                color: on ? '#fff' : '#4b5563', border: on ? '1px solid #111' : '1px solid #e5e7eb' }}>
              {st} мин
            </button>
          );
        })}
      </div>

      <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#6b7280', marginBottom:8 }}>Перерыв</div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <input type="time" value={form.booking_break_start || ''} onChange={e => setForm({ ...form, booking_break_start: e.target.value })} style={inp} />
        <span style={{ color:'#9ca3af', fontSize:'0.8rem' }}>—</span>
        <input type="time" value={form.booking_break_end || ''} onChange={e => setForm({ ...form, booking_break_end: e.target.value })} style={inp} />
        <span style={{ fontSize:'0.76rem', color:'#9ca3af', marginLeft:6 }}>оставьте пустым, если перерыва нет</span>
      </div>

      <div className="modal-actions" style={{ marginTop:18 }}>
        <button type="button" className="sk-dd-btn" onClick={onSave} disabled={saving}
          style={{ opacity: saving ? .6 : 1 }}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
