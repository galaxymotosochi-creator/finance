import { useState } from 'react';

const inp = { width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10,
  fontSize:'0.9rem', outline:'none', boxSizing:'border-box', background:'#fff' };
const lbl = { display:'block', fontSize:'0.78rem', fontWeight:600, color:'#6b7280', marginBottom:6 };

export default function MySiteSettings({ shop, slug, setShop, setSlug, onSave, saving }) {
  const [form, setForm] = useState(shop || {});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:16, padding:20 }}>
      <div style={{ fontSize:'1rem', fontWeight:700, marginBottom:16 }}>Настройки витрины</div>

      <div style={{ display:'grid', gap:14 }}>
        <div>
          <label style={lbl}>Адрес витрины</label>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:'0.85rem', color:'#9ca3af' }}>atlaspos.ru/s/</span>
            <input style={inp} value={slug} onChange={(e)=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="moy-magazin" />
          </div>
        </div>

        <div>
          <label style={lbl}>Название магазина</label>
          <input style={inp} value={form.name || ''} onChange={set('name')} placeholder="Кофейня на Ленина" />
        </div>

        <div>
          <label style={lbl}>Короткий слоган</label>
          <input style={inp} value={form.tagline || ''} onChange={set('tagline')} placeholder="Свежий кофе каждый день" />
        </div>

        <div>
          <label style={lbl}>О магазине</label>
          <textarea style={{ ...inp, minHeight:90, resize:'vertical' }} value={form.about || ''} onChange={set('about')} placeholder="Пара слов о вас" />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={lbl}>Телефон</label>
            <input style={inp} value={form.phone || ''} onChange={set('phone')} placeholder="+7 900 000-00-00" />
          </div>
          <div>
            <label style={lbl}>Часы работы</label>
            <input style={inp} value={form.work_hours || ''} onChange={set('work_hours')} placeholder="Пн–Вс 9:00–21:00" />
          </div>
        </div>

        <div>
          <label style={lbl}>Адрес</label>
          <input style={inp} value={form.address || ''} onChange={set('address')} placeholder="Сочи, ул. Ленина, 10" />
        </div>
      </div>

      <div style={{ marginTop:20, paddingTop:18, borderTop:'1px solid #f0f0f0' }}>
        <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#6b7280', marginBottom:10 }}>Режимы витрины</div>
        {[
          { k:'use_cart', t:'Использовать корзину', d:'Для товаров — клиент оформляет заказ', def:true },
          { k:'use_booking', t:'Использовать календарь записей', d:'Для услуг — клиент записывается на время', def:false },
        ].map(x => {
          const on = form[x.k] === undefined ? x.def : !!form[x.k];
          return (
            <div key={x.k} onClick={() => setForm({ ...form, [x.k]: !on })}
              style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 12px', borderRadius:11,
                cursor:'pointer', border:'1px solid ' + (on ? 'rgba(31,117,255,.35)' : '#eee'),
                background: on ? 'rgba(31,117,255,.04)' : '#fff', marginBottom:8 }}>
              <div style={{ width:18, height:18, borderRadius:5, flexShrink:0,
                border:'1.5px solid ' + (on ? '#1F75FF' : '#d1d5db'),
                background: on ? '#1F75FF' : '#fff', display:'flex', alignItems:'center',
                justifyContent:'center', color:'#fff', fontSize:'0.7rem', fontWeight:800 }}>
                {on ? '✓' : ''}
              </div>
              <div>
                <div style={{ fontSize:'0.87rem', fontWeight:600, color:'#111' }}>{x.t}</div>
                <div style={{ fontSize:'0.78rem', color:'#9ca3af', marginTop:2 }}>{x.d}</div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-dark" onClick={() => onSave({ ...form })} disabled={saving}
        style={{ marginTop:18, opacity: saving ? .6 : 1 }}>
        {saving ? 'Сохраняю…' : 'Сохранить'}
      </button>
    </div>
  );
}
