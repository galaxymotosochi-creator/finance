import { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const inp = { width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10,
  fontSize:'.875rem', color:'#333', outline:'none', boxSizing:'border-box', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:'.8125rem', fontWeight:600, color:'#333', marginBottom:6 };

export default function SemifinishedForm({ open, initial, onClose, onSave }) {
  const { user } = useAuth();
  const [f, setF] = useState({ name:'', recipe:'', output_weight:'', output_unit:'г' });
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
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
        const base = qty > 0 ? sum / qty : 0;
        const u = String(x.unit || '').toLowerCase();
        const toGram = u === 'кг' || u === 'л' ? 0.001 : 1;
        return { ...x, price: base * toGram, loss: Number(x.loss_cleaning) || 0 };
      });
      setProducts(withPrice);

      if (initial?.id) {
        setF({
          name: initial.name || '',
          recipe: initial.recipe || '',
          output_weight: initial.output_weight ? String(Number(initial.output_weight)) : '',
          output_unit: initial.output_unit || 'г',
        });
        const it = await supabase.from('semifinished_items').select('*').eq('semifinished_id', initial.id).order('created_at');
        const fixed = (it.data || []).map(function(r){
          const ing = withPrice.find(function(x){ return String(x.id) === String(r.product_id); });
          return { ...r, price_per_unit: ing ? ing.price : (Number(r.price_per_unit) || 0),
                   waste_percent: ing ? ing.loss : (Number(r.waste_percent) || 0) };
        });
        setItems(fixed);
      } else {
        setF({ name:'', recipe:'', output_weight:'', output_unit:'г' });
        setItems([]);
      }
    })();
  }, [open, user?.id, initial?.id]);

  const updRow = (i, patch) => setItems(items.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setItems([...items, { name:'', product_id:'', netto:'', brutto:'', price_per_unit:'', unit:'г', waste_percent:'' }]);
  const delRow = (i) => setItems(items.filter((_, idx) => idx !== i));

  const pickProduct = (i, pid) => {
    const p = products.find(x => String(x.id) === String(pid));
    const row = items[i] || {};
    const waste = Number(p?.loss) || 0;
    const netto = Number(row.netto) || 0;
    const brutto = netto > 0 ? (netto / (1 - waste / 100)).toFixed(2) : '';
    updRow(i, { product_id: pid, name: p?.name || '', price_per_unit: p?.price || 0, waste_percent: waste, brutto });
  };

  const priceOf = (r) => {
    const ing = products.find(x => String(x.id) === String(r.product_id));
    return ing ? Number(ing.price) || 0 : Number(r.price_per_unit) || 0;
  };
  const costOf = (r) => (Number(r.brutto || r.netto) || 0) * priceOf(r);
  const totalCost = items.reduce((s, r) => s + costOf(r), 0);
  const totalNetto = items.reduce((s, r) => s + (Number(r.netto) || 0), 0);

  const [outManual, setOutManual] = useState(false);
  useEffect(() => {
    if (!outManual && items.length) {
      const sum = items.reduce((a, r) => a + (Number(r.netto) || 0), 0);
      if (sum > 0) setF(prev => ({ ...prev, output_weight: String(Math.round(sum)) }));
    }
  }, [items]);

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Редактировать полуфабрикат' : 'Добавить полуфабрикат'} width={680} className="tc-modal">
      <div style={{ display:'grid', gap:14 }}>
        <div>
          <label style={lbl}>Название *</label>
          <input style={inp} value={f.name} onChange={set('name')} placeholder="Например, Тесто" />
        </div>

        <div>
          <label style={lbl}>Рецепт приготовления</label>
          <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={f.recipe} onChange={set('recipe')}
            placeholder="Муку, яйца и дрожжи соединить и замесить тесто, дать подойти 40 минут" />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={lbl}>Выход</label>
            <input style={inp} value={f.output_weight} onChange={e => { setOutManual(true); set('output_weight')(e); }}
              placeholder="0" inputMode="decimal" />
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
      </div>

      <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid #f0f0f0' }}>
        <div style={{ fontSize:'.9rem', fontWeight:700, marginBottom:4 }}>Ингредиенты</div>
        <div style={{ fontSize:'.76rem', color:'#9ca3af', marginBottom:12 }}>Из чего состоит полуфабрикат</div>

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
                  <option value=""><span className="sel-ph">— выберите —</span></option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={r.brutto} onChange={e => {
                    const b = e.target.value;
                    const netto = b === '' ? '' : (Number(b) * (1 - (Number(r.waste_percent) || 0) / 100)).toFixed(2);
                    updRow(i, { brutto: b, netto });
                  }}
                  inputMode="decimal" placeholder="0" style={{ ...inp, padding:'8px 10px' }} />
                <input value={r.netto} onChange={e => {
                    const n = e.target.value;
                    const waste = Number(r.waste_percent) || 0;
                    const brutto = n === '' || waste >= 100 ? (n === '' ? '' : n) : (Number(n) / (1 - waste / 100)).toFixed(2);
                    updRow(i, { netto: n, brutto });
                  }}
                  inputMode="decimal" placeholder="0" style={{ ...inp, padding:'8px 10px' }} />
                <div style={{ fontSize:'.875rem', color:'#333', textAlign:'right', paddingRight:4 }}>
                  {Math.round(costOf(r)).toLocaleString('ru-RU')} ₽
                </div>
                <button onClick={() => delRow(i)} style={{ border:'none', background:'transparent', cursor:'pointer', color:'#dc2626', fontSize:'1rem' }}>×</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={addRow} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px',
          borderRadius:20, border:'1px dashed #d1d5db', background:'#fff', cursor:'pointer',
          fontSize:'.8rem', fontWeight:600, color:'#4b5563' }}>+ Добавить ингредиент</button>

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
