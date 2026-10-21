import { useState, useEffect } from 'react';

const inp = { width:'100%', padding:'11px 14px', border:'1px solid #e5e7eb', borderRadius:10,
  fontSize:'0.9rem', boxSizing:'border-box', outline:'none', marginBottom:10, fontFamily:'inherit' };

export default function BookingForm({ slug, services, preset, onClose, onDone }) {
  const [service, setService] = useState(preset || services[0] || null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setLoading(true); setSlot(null);
    fetch('/api/public/shop/' + slug + '/slots?date=' + date)
      .then(r => r.json())
      .then(j => setSlots(j.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [date, slug]);

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !phone.trim()) { setErr('Укажите имя и телефон'); return; }
    if (!slot) { setErr('Выберите время'); return; }
    setSending(true);
    const r = await fetch('/api/public/shop/' + slug + '/booking', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ name, phone, comment, date, start: slot.start, end: slot.end,
        service_id: service?.id, service_name: service?.name, price: service?.price })
    });
    const j = await r.json();
    setSending(false);
    if (!r.ok) { setErr(j.error || 'Не удалось записаться'); return; }
    onDone(j);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex',
      alignItems:'center', justifyContent:'center', padding:16, zIndex:100, overflowY:'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'#fff', borderRadius:18, padding:24, width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ fontSize:'1.1rem', fontWeight:800, marginBottom:4 }}>Запись на услугу</div>
        <div style={{ fontSize:'0.8rem', color:'#9ca3af', marginBottom:16 }}>Выберите услугу, дату и время</div>

        {services.length > 0 && (
          <>
            <div style={{ fontSize:'0.76rem', fontWeight:600, color:'#6b7280', marginBottom:6 }}>Услуга</div>
            <select value={service ? String(service.id) : ''} onChange={e => setService(services.find(s => String(s.id) === e.target.value))}
              style={inp}>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} — {Math.round(Number(s.price)||0)} ₽</option>)}
            </select>
          </>
        )}

        <div style={{ fontSize:'0.76rem', fontWeight:600, color:'#6b7280', marginBottom:6 }}>Дата</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />

        <div style={{ fontSize:'0.76rem', fontWeight:600, color:'#6b7280', marginBottom:6 }}>Время</div>
        {loading ? <div style={{ fontSize:'0.82rem', color:'#9ca3af', marginBottom:12 }}>Загружаю свободное время…</div> :
         !slots.length ? <div style={{ fontSize:'0.82rem', color:'#dc2626', marginBottom:12 }}>На этот день свободного времени нет</div> : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(72px,1fr))', gap:6, marginBottom:12 }}>
            {slots.map(s => (
              <button key={s.start} onClick={() => setSlot(s)}
                style={{ padding:'8px 4px', borderRadius:9, cursor:'pointer', fontSize:'0.82rem',
                  fontWeight: slot?.start === s.start ? 700 : 500,
                  background: slot?.start === s.start ? '#111' : '#fff',
                  color: slot?.start === s.start ? '#fff' : '#374151',
                  border: slot?.start === s.start ? '1px solid #111' : '1px solid #e5e7eb' }}>
                {s.start}
              </button>
            ))}
          </div>
        )}

        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" style={inp} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" inputMode="tel" style={inp} />
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Комментарий (необязательно)"
          style={{ ...inp, minHeight:64, resize:'vertical' }} />

        {err && <div style={{ color:'#dc2626', fontSize:'0.82rem', marginBottom:10 }}>{err}</div>}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:6 }}>
          <button className="btn btn-outline" onClick={onClose}>Отмена</button>
          <button className="btn btn-dark" onClick={submit} disabled={sending} style={{ opacity: sending ? .6 : 1 }}>
            {sending ? 'Отправляю…' : 'Записаться'}
          </button>
        </div>
      </div>
    </div>
  );
}
