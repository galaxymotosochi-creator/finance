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
      <div style={{ display:'grid', gap:8, marginBottom:18 }}>
        {[
          { k:'product', t:'Товары', d:'Показывать товары в каталоге с корзиной' },
          { k:'service', t:'Услуги', d:'Показывать услуги — для записи на время' },
        ].map(x => {
          const on = types.length === 0 || types.includes(x.k);
          return (
            <div key={x.k} onClick={() => setForm({ ...form, show_types: toggle(types, x.k) })}
              style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 12px', borderRadius:11,
                cursor:'pointer', border:'1px solid ' + (on ? 'rgba(31,117,255,.35)' : '#eee'),
                background: on ? 'rgba(31,117,255,.04)' : '#fff' }}>
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
