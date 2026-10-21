import { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const inp = { width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10,
  fontSize:'.875rem', color:'#333', outline:'none', boxSizing:'border-box', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:'.8125rem', fontWeight:600, color:'#333', marginBottom:6 };

export default function TechCardForm({ open, initial, categories, onClose, onSave }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [f, setF] = useState(initial || {
    name:'', category:'', price:'', output_weight:'', output_unit:'г',
    photo_url:'', description:'', is_weight:false, price_per_kg:''
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const pr = await supabase.from('ingredients').select('*').eq('user_id', user.id).limit(1000);
      const st = await supabase.from('ingredient_stock').select('*');
      const withPrice = (pr.data || []).map(function(x){
        const rows = (st.data || []).filter(function(r){ return String(r.ingredient_id) === String(x.id); });
        const qty = rows.reduce(function(a,r){ return a + (Number(r.qty)||0); }, 0);
        const sum = rows.reduce(function(a,r){ return a + (Number(r.total_sum)||0); }, 0);
        const basePrice = qty > 0 ? sum / qty : 0;
        const u = String(x.unit || '').toLowerCase();
        // цена за единицу ингредиента → цена за грамм/мл (тех. карта ведёт нетто в г/мл)
        const toGram = u === 'кг' ? 0.001 : u === 'л' ? 0.001 : 1;
        return { ...x, price: x.is_water ? 0 : basePrice * toGram, loss: Number(x.loss_cleaning) || 0 };
      });
      const sf = await supabase.from('semifinished').select('*').eq('user_id', user.id);
      const sfList = (sf.data || []).map(function(x){
        return { ...x, id: 'sf_' + x.id, sf_id: x.id, is_sf: true,
                 price: Number(x.price_per_unit) || 0, loss: 0 };
      });
      setProducts(withPrice.concat(sfList));
      const ct = await supabase.from('stock_categories').select('*').eq('user_id', user.id);
      setCats((ct.data || []).filter(function(c){ return c.type === 'dish'; }));
      if (initial?.id) {
        const it = await supabase.from('tech_card_items').select('*').eq('tech_card_id', initial.id);
        // цену берём актуальную из ингредиента, а не сохранённую (старые записи с нулём)
        const fixed = (it.data || []).map(function(r){
          const ing = withPrice.find(function(x){ return String(x.id) === String(r.product_id); });
          return { ...r, price_per_unit: ing ? ing.price : (Number(r.price_per_unit) || 0),
                   waste_percent: ing ? ing.loss : (Number(r.waste_percent) || 0) };
        });
        setItems(fixed);
      } else setItems([]);
    })();
  }, [open, user?.id, initial?.id]);

  const addRow = () => setItems([...items, { name:'', product_id:'', netto:'', price_per_unit:'', unit:'г', waste_percent:'' }]);
  const updRow = (i, patch) => setItems(items.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const delRow = (i) => setItems(items.filter((_, idx) => idx !== i));
  const pickProduct = (i, pid) => {
    const p = products.find(x => String(x.id) === String(pid));
    const row = items[i] || {};
    if (p && p.is_sf) {
      const netto = Number(row.netto) || 0;
      updRow(i, { product_id: p.sf_id, name: p.name, price_per_unit: p.price,
        waste_percent: 0, brutto: netto > 0 ? String(netto) : '', is_sf: true });
      return;
    }
    const waste = Number(p?.loss) || 0;
    const netto = Number(row.netto) || 0;
    const brutto = netto > 0 ? (netto / (1 - waste / 100)).toFixed(2) : '';
    updRow(i, { product_id: pid, name: p?.name || '', price_per_unit: p?.price || 0,
      waste_percent: waste, brutto, is_sf: false });
  };
  const priceOf = (r) => {
    const ing = products.find(x => String(x.id) === String(r.product_id) || String(x.sf_id) === String(r.product_id));
    return ing ? (Number(ing.price) || 0) : (Number(r.price_per_unit) || 0);
  };
  const costOf = (r) => (Number(r.brutto || r.netto) || 0) * priceOf(r);
  const totalCost = items.reduce((s, r) => s + costOf(r), 0);
  const totalNetto = items.reduce((s, r) => s + (Number(r.netto) || 0), 0);
  const [outManual, setOutManual] = useState(false);
  useEffect(() => {
    if (!outManual && items.length) {
      const sum = items.reduce((a, r) => a + (Number(r.netto) || 0), 0);
      if (sum > 0) setF(function(prev){ return { ...prev, output_weight: String(Math.round(sum)) }; });
    }
  }, [items]);

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Редактировать тех. карту' : 'Добавить тех. карту'} width={680} className="tc-modal">
      <div style={{ display:'grid', gap:14 }}>
        <div>
          <label style={lbl}>Название *</label>
          <input style={inp} value={f.name} onChange={set('name')} placeholder="Например, Борщ украинский" />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={lbl}>Категория</label>
            <select style={inp} value={f.category} onChange={set('category')}>
              <option value="">— выберите —</option>
              {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Цена продажи</label>
            <input style={inp} value={f.price} onChange={set('price')} placeholder="0" inputMode="decimal" />
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 12px',
          borderRadius:11, border:'1px solid ' + (f.is_weight ? 'rgba(31,117,255,.35)' : '#eee'),
          background: f.is_weight ? 'rgba(31,117,255,.04)' : '#fff', cursor:'pointer' }}
          onClick={() => setF({ ...f, is_weight: !f.is_weight })}>
          <div style={{ width:18, height:18, borderRadius:5, flexShrink:0,
            border:'1.5px solid ' + (f.is_weight ? '#1F75FF' : '#d1d5db'),
            background: f.is_weight ? '#1F75FF' : '#fff', display:'flex', alignItems:'center',
            justifyContent:'center', color:'#fff', fontSize:'.7rem', fontWeight:800 }}>
            {f.is_weight ? '✓' : ''}
          </div>
          <div>
            <div style={{ fontSize:'.82rem', fontWeight:600 }}>Весовая тех. карта</div>
            <div style={{ fontSize:'.74rem', color:'#9ca3af', marginTop:2 }}>Продаётся на вес — кассир вводит количество</div>
          </div>
        </div>

        {f.is_weight && (
          <div>
            <label style={lbl}>Цена за кг</label>
            <input style={inp} value={f.price_per_kg} onChange={set('price_per_kg')} placeholder="0" inputMode="decimal" />
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={lbl}>Выход порции</label>
            <input style={inp} value={f.output_weight} onChange={e => { setOutManual(true); set('output_weight')(e); }} placeholder="300" inputMode="decimal" />
            <div style={{ fontSize:'.7rem', color:'#9ca3af', marginTop:4 }}>
              {outManual ? 'Введено вручную' : 'Считается из состава'}
            </div>
          </div>
          <div>
            <label style={lbl}>Ед.</label>
            <select style={inp} value={f.output_unit} onChange={set('output_unit')}>
              <option value="г">г</option>
              <option value="мл">мл</option>
              <option value="шт">шт</option>
            </select>
          </div>
        </div>

        <div>
          <label style={lbl}>Обложка (ссылка на фото)</label>
          <input style={inp} value={f.photo_url} onChange={set('photo_url')} placeholder="/uploads/..." />
        </div>

        <div>
          <label style={lbl}>Описание</label>
          <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={f.description} onChange={set('description')} />
        </div>
      </div>

      <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid #f0f0f0' }}>
        <div style={{ fontSize:'.9rem', fontWeight:700, marginBottom:4 }}>Состав</div>
        <div style={{ fontSize:'.76rem', color:'#9ca3af', marginBottom:12 }}>
          Ингредиенты и полуфабрикаты, из которых состоит тех. карта
        </div>

        {items.length > 0 && (
          <div style={{ display:'grid', gap:6, marginBottom:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 110px 30px', gap:8,
              fontSize:'.8125rem', color:'#333', fontWeight:600, padding:'0 2px' }}>
              <div>Ингредиент</div><div>Брутто</div><div>Нетто</div><div>Себестоимость</div><div></div>
            </div>
            {items.map((r, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 110px 30px', gap:8, alignItems:'center' }}>
                <select value={r.product_id || ''} onChange={e => pickProduct(i, e.target.value)}
                  style={{ ...inp, padding:'8px 10px' }}>
                  <option value="">— выберите —</option>
                  {products.filter(p => !p.is_sf).length > 0 && (
                    <optgroup label="Ингредиенты">
                      {products.filter(p => !p.is_sf).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  )}
                  {products.filter(p => p.is_sf).length > 0 && (
                    <optgroup label="Полуфабрикаты">
                      {products.filter(p => p.is_sf).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  )}
                </select>
                <input value={r.brutto} onChange={e => {
                    const b = e.target.value;
                    const waste = Number(r.waste_percent) || 0;
                    const netto = b === '' ? '' : (Number(b) * (1 - (Number(r.waste_percent)||0) / 100)).toFixed(2);
                    updRow(i, { brutto: b, netto });
                  }}
                  inputMode="decimal" placeholder="0"
                  style={{ ...inp, padding:'8px 10px' }} />
                <input value={r.netto} onChange={e => {
                    const n = e.target.value;
                    const waste = Number(r.waste_percent) || 0;
                    const brutto = n === '' || waste >= 100 ? (n === '' ? '' : n) : (Number(n) / (1 - waste / 100)).toFixed(2);
                    updRow(i, { netto: n, brutto });
                  }}
                  inputMode="decimal" placeholder="0"
                  style={{ ...inp, padding:'8px 10px' }} />
                <div style={{ fontSize:'.875rem', color:'#333', textAlign:'right', paddingRight:4 }}>
                  {Math.round(costOf(r)).toLocaleString('ru-RU')} ₽
                </div>
                <button onClick={() => delRow(i)}
                  style={{ border:'none', background:'transparent', cursor:'pointer', color:'#dc2626', fontSize:'1rem' }}>×</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={addRow}
          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px',
            borderRadius:20, border:'1px dashed #d1d5db', background:'#fff', cursor:'pointer',
            fontSize:'.8rem', fontWeight:600, color:'#4b5563' }}>
          + Добавить ингредиент
        </button>

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, paddingTop:10,
          borderTop:'1px solid #f5f5f5', fontSize:'.82rem' }}>
          <span style={{ color:'#6b7280' }}>Выход: <b style={{ color:'#111' }}>{Math.round(totalNetto)} г</b></span>
          <span style={{ color:'#6b7280' }}>Итого: <b style={{ color:'#111' }}>{Math.round(totalCost).toLocaleString('ru-RU')} ₽</b></span>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose}>Отмена</button>
        <button className="sk-dd-btn" onClick={() => onSave(f, items)}>Сохранить</button>
      </div>
    </Modal>
  );
}
