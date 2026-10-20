import { useState, useEffect } from 'react';

const chk = { display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:9,
  cursor:'pointer', fontSize:'0.85rem', userSelect:'none' };

export default function ShowcaseFilters({ form, setForm, products }) {
  const [q, setQ] = useState('');
  const types = form.show_types || [];
  const cats = form.show_cats || [];
  const hidden = form.hidden_products || [];

  const allCats = Array.from(new Set(products.map(p => (p.cat || '').trim() || 'Прочее')));
  const toggle = (arr, val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  const visible = products.filter(p =>
    (!q.trim() || String(p.name).toLowerCase().includes(q.trim().toLowerCase())) &&
    (cats.length === 0 || cats.includes((p.cat || '').trim() || 'Прочее'))
  );

  return (
    <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:16, padding:20, marginTop:14 }}>
      <div style={{ fontSize:'1rem', fontWeight:700, marginBottom:4 }}>Что показывать на витрине</div>
      <div style={{ fontSize:'0.8rem', color:'#9ca3af', marginBottom:16 }}>
        Ничего не отмечено = показывать всё
      </div>

      <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#6b7280', marginBottom:8 }}>1. Тип</div>
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
        {[{k:'product',t:'Товары'},{k:'service',t:'Услуги'}].map(x => {
          const on = types.length === 0 || types.includes(x.k);
          return (
            <button key={x.k} onClick={() => setForm({ ...form, show_types: toggle(types, x.k) })}
              style={{ padding:'8px 16px', borderRadius:22, cursor:'pointer', fontSize:'0.84rem',
                fontWeight: on ? 700 : 500,
                background: on ? '#111' : '#fff', color: on ? '#fff' : '#6b7280',
                border: on ? '1px solid #111' : '1px solid #e5e7eb' }}>
              {on ? '✓ ' : ''}{x.t}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#6b7280', marginBottom:8 }}>2. Категории</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:4, marginBottom:18 }}>
        {allCats.map(c => {
          const on = cats.length === 0 || cats.includes(c);
          return (
            <label key={c} style={chk} onClick={() => setForm({ ...form, show_cats: toggle(cats, c) })}>
              <span style={{ width:16, height:16, borderRadius:5, border:'1.5px solid ' + (on ? '#111' : '#d1d5db'),
                background: on ? '#111' : '#fff', display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontSize:'0.65rem', fontWeight:800, flexShrink:0 }}>{on ? '✓' : ''}</span>
              {c}
            </label>
          );
        })}
        {!allCats.length && <div style={{ fontSize:'0.82rem', color:'#9ca3af' }}>Категорий пока нет</div>}
      </div>

      <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#6b7280', marginBottom:8 }}>3. Конкретные позиции</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по названию"
        style={{ width:'100%', padding:'9px 14px', border:'1px solid #e5e7eb', borderRadius:10,
          fontSize:'0.85rem', outline:'none', boxSizing:'border-box', marginBottom:8 }} />
      <div style={{ maxHeight:240, overflowY:'auto', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:2 }}>
        {visible.slice(0, 300).map(p => {
          const on = !hidden.includes(String(p.id));
          return (
            <label key={p.id} style={chk} onClick={() => setForm({ ...form, hidden_products: toggle(hidden, String(p.id)) })}>
              <span style={{ width:16, height:16, borderRadius:5, border:'1.5px solid ' + (on ? '#111' : '#d1d5db'),
                background: on ? '#111' : '#fff', display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontSize:'0.65rem', fontWeight:800, flexShrink:0 }}>{on ? '✓' : ''}</span>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
