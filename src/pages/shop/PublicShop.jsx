import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import BookingForm from './BookingForm';

const CART_KEY = (slug) => 'atlaspos_cart_' + slug;
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));

export default function PublicShop() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', comment:'' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const [formErr, setFormErr] = useState(null);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [bookOpen, setBookOpen] = useState(false);
  const [bookDone, setBookDone] = useState(null);

  useEffect(() => {
    fetch('/api/public/shop/' + slug)
      .then(r => r.ok ? r.json() : Promise.reject('notfound'))
      .then(setData)
      .catch(() => setError('Витрина не найдена'));
  }, [slug]);

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem(CART_KEY(slug)) || '{}')); } catch(e) {}
  }, [slug]);

  useEffect(() => { localStorage.setItem(CART_KEY(slug), JSON.stringify(cart)); }, [cart, slug]);

  const add = (p) => setCart(c => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }));
  const dec = (p) => setCart(c => { const n = { ...c }; if (!n[p.id]) return n; n[p.id]--; if (n[p.id] <= 0) delete n[p.id]; return n; });

  const submit = async () => {
    setFormErr(null);
    if (!form.name.trim() || !form.phone.trim()) { setFormErr('Укажите имя и телефон'); return; }
    setSending(true);
    try {
      const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
      const r = await fetch('/api/public/shop/' + slug + '/order', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ...form, items })
      });
      const j = await r.json();
      if (!r.ok) { setFormErr(j.error || 'Не удалось отправить'); setSending(false); return; }
      setSent(j); setCart({}); setOpen(false);
    } catch(e) { setFormErr('Ошибка сети'); }
    setSending(false);
  };

  if (sent) return (
    <div style={{ fontFamily:'Inter,sans-serif', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ textAlign:'center', maxWidth:420 }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#111"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ marginBottom:16 }}>
          <path d="M4 12.5l5.5 5.5L20 7.5" />
        </svg>
        <div style={{ fontSize:'1.3rem', fontWeight:800, marginBottom:8 }}>Заявка №{sent.order_number} принята</div>
        <div style={{ color:'#6b7280', fontSize:'0.9rem', lineHeight:1.6 }}>
          Магазин свяжется с вами по указанному телефону. Сумма заказа: <b>{fmt(sent.total)} ₽</b>
        </div>
        <button onClick={() => { setSent(null); }} style={{ marginTop:20, padding:'10px 22px', borderRadius:20, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontWeight:600 }}>Вернуться в магазин</button>
      </div>
    </div>
  );

  if (error) return <div style={{ padding:60, textAlign:'center', fontFamily:'Inter,sans-serif', color:'#6b7280' }}>{error}</div>;
  if (!data) return <div style={{ padding:60, textAlign:'center', fontFamily:'Inter,sans-serif', color:'#9ca3af' }}>Загружаю…</div>;

  const { shop, products } = data;
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = Object.entries(cart).reduce((s, [id, q]) => {
    const p = products.find(x => String(x.id) === String(id));
    return s + (p ? Number(p.price || 0) * q : 0);
  }, 0);

  const CAT_EMPTY = 'Прочее';
  // Фильтры из настроек витрины
  const services = products.filter(p => p.type === 'service');
  const hiddenIds = (shop.hidden_products || []).map(String);
  const showCats = shop.show_cats || [];
  const showTypes = shop.show_types || [];

  const visibleProducts = products.filter(p => {
    if (hiddenIds.includes(String(p.id))) return false;
    const pcat = (p.cat || '').trim() || CAT_EMPTY;
    if (showCats.length > 0 && !showCats.includes(pcat)) return false;
    if (showTypes.length > 0) {
      const t = p.type === 'service' ? 'service' : 'product';
      if (!showTypes.includes(t)) return false;
    } else if (p.type === 'service') {
      return false; // по умолчанию на витрине только товары
    }
    return true;
  });

  const allCats = Array.from(new Set(visibleProducts.map(p => (p.cat || '').trim() || CAT_EMPTY)));
  const cats = ['all', ...allCats];
  const filtered = visibleProducts.filter(p => {
    const pcat = (p.cat || '').trim() || CAT_EMPTY;
    if (cat !== 'all' && pcat !== cat) return false;
    if (q.trim() && !String(p.name).toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#111', minHeight:'100vh', background:'#fff',
      flex:'1 1 auto', width:'100%', minWidth:0, alignSelf:'stretch' }}>
      <header style={{ borderBottom:'1px solid #f0f0f0', padding:'18px 20px' }}>
        <div style={{ width:'100%', maxWidth:'100%', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:'1.25rem', fontWeight:800, letterSpacing:'-.02em' }}>{shop.name || 'Магазин'}</div>
            {shop.tagline && <div style={{ fontSize:'0.84rem', color:'#9ca3af', marginTop:2 }}>{shop.tagline}</div>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14, fontSize:'0.82rem', color:'#6b7280', flexWrap:'wrap' }}>
            {shop.phone && <span>{shop.phone}</span>}
            {shop.work_hours && <span>{shop.work_hours}</span>}
            {shop.use_booking && (
              <button onClick={() => setBookOpen(true)}
                style={{ padding:'9px 18px', borderRadius:20, border:'none', background:'#111',
                  color:'#fff', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}>
                Записаться
              </button>
            )}
          </div>
        </div>
      </header>

      {shop.about && (
        <div style={{ width:'100%', maxWidth:'100%', margin:'0 auto', padding:'20px 20px 0', color:'#6b7280', fontSize:'0.9rem', lineHeight:1.6 }}>
          {shop.about}
        </div>
      )}

      <main style={{ width:'100%', maxWidth:'100%', margin:'0 auto', padding:'20px' }}>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по названию"
            style={{ flex:'1 1 220px', padding:'10px 16px', border:'1px solid #e5e7eb', borderRadius:22,
              fontSize:'0.88rem', outline:'none', minWidth:180 }} />
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{ padding:'8px 16px', borderRadius:22, cursor:'pointer', fontSize:'0.84rem',
                fontWeight: cat === c ? 700 : 500,
                background: cat === c ? '#111' : '#fff',
                color: cat === c ? '#fff' : '#4b5563',
                border: cat === c ? '1px solid #111' : '1px solid #e5e7eb',
                transition:'.2s' }}>
              {c === 'all' ? 'Все' : c}
            </button>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:14 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ border:'1px solid #eee', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <div style={{ height:150, background:'#f7f7f8', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                {p.photo_url ? <img src={p.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:'2rem', opacity:.25 }}>🖼️</span>}
              </div>
              <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontWeight:600, fontSize:'0.9rem', lineHeight:1.35 }}>{p.name}</div>
                {p.description && <div style={{ fontSize:'0.78rem', color:'#9ca3af', lineHeight:1.4 }}>{p.description.slice(0, 80)}</div>}
                <div style={{ marginTop:'auto', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div style={{ fontWeight:800, fontSize:'1rem' }}>{fmt(p.price)} ₽</div>
                  {cart[p.id] ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button onClick={() => dec(p)} style={{ width:26, height:26, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:'0.9rem' }}>−</button>
                      <span style={{ fontSize:'0.85rem', fontWeight:700 }}>{cart[p.id]}</span>
                      <button onClick={() => add(p)} style={{ width:26, height:26, borderRadius:8, border:'none', background:'#111', color:'#fff', cursor:'pointer', fontSize:'0.9rem' }}>+</button>
                    </div>
                  ) : (
                    <button onClick={() => add(p)} style={{ padding:'7px 14px', borderRadius:20, border:'none', background:'#111', color:'#fff', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>В корзину</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {!products.length && <div style={{ textAlign:'center', color:'#9ca3af', padding:40 }}>Товаров пока нет</div>}
      </main>

      {count > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#111', color:'#fff', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ fontSize:'0.9rem' }}>В корзине: <b>{count}</b></div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontWeight:800 }}>{fmt(total)} ₽</div>
            <button onClick={() => setOpen(true)} style={{ padding:'9px 20px', borderRadius:20, border:'none', background:'#fff', color:'#111', fontWeight:700, fontSize:'0.84rem', cursor:'pointer' }}>Оформить заказ</button>
          </div>
        </div>
      )}

      {bookOpen && (
        <BookingForm slug={slug} services={services} onClose={() => setBookOpen(false)}
          onDone={(j) => { setBookOpen(false); setBookDone(j); }} />
      )}

      {bookDone && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, zIndex:110 }}>
          <div style={{ background:'#fff', borderRadius:18, padding:28, width:'100%', maxWidth:400, textAlign:'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:14 }}>
              <path d="M4 12.5l5.5 5.5L20 7.5" />
            </svg>
            <div style={{ fontSize:'1.15rem', fontWeight:800, marginBottom:8 }}>Вы записаны</div>
            <div style={{ color:'#6b7280', fontSize:'0.88rem', lineHeight:1.6 }}>
              {String(bookDone.date).split('-').reverse().join('.')} в {bookDone.start}<br />
              Магазин свяжется с вами для подтверждения
            </div>
            <button className="btn btn-dark" style={{ marginTop:18 }} onClick={() => setBookDone(null)}>Хорошо</button>
          </div>
        </div>
      )}

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, zIndex:100 }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{ background:'#fff', borderRadius:18, padding:24, width:'100%', maxWidth:420 }}>
            <div style={{ fontSize:'1.1rem', fontWeight:800, marginBottom:4 }}>Оформление заказа</div>
            <div style={{ fontSize:'0.82rem', color:'#9ca3af', marginBottom:16 }}>Оставьте контакты — магазин свяжется с вами</div>
            <input value={form.name} onChange={e => setForm({ ...form, name:e.target.value })} placeholder="Ваше имя"
              style={{ width:'100%', padding:'11px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:'0.9rem', marginBottom:10, boxSizing:'border-box', outline:'none' }} />
            <input value={form.phone} onChange={e => setForm({ ...form, phone:e.target.value })} placeholder="Телефон" inputMode="tel"
              style={{ width:'100%', padding:'11px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:'0.9rem', marginBottom:10, boxSizing:'border-box', outline:'none' }} />
            <textarea value={form.comment} onChange={e => setForm({ ...form, comment:e.target.value })} placeholder="Комментарий (необязательно)"
              style={{ width:'100%', padding:'11px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:'0.9rem', minHeight:70, resize:'vertical', marginBottom:10, boxSizing:'border-box', outline:'none' }} />
            {formErr && <div style={{ color:'#dc2626', fontSize:'0.82rem', marginBottom:10 }}>{formErr}</div>}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
              <div style={{ fontWeight:800 }}>{fmt(total)} ₽</div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-outline" onClick={() => setOpen(false)}>Отмена</button>
                <button className="btn btn-dark" onClick={submit} disabled={sending} style={{ opacity: sending ? .6 : 1 }}>
                  {sending ? 'Отправляю…' : 'Отправить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
