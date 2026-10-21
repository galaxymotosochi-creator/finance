import { useState, useEffect } from 'react';
import Modal from '../../components/Modal';

const inp = { width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10,
  fontSize:'.875rem', color:'#333', outline:'none', boxSizing:'border-box', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:'.8125rem', fontWeight:600, color:'#333', marginBottom:6 };

export default function IngredientForm({ open, warehouses, categories, initial, onClose, onSave }) {
  const [f, setF] = useState({
    name:'', unit:'кг', barcode:'',
    loss_cleaning:'', loss_boil:'', loss_fry:'', loss_stew:'', loss_bake:'',
    qty:'', price:'', warehouse_id:''
  });
  const empty = {
    name:'', unit:'кг', barcode:'',
    loss_cleaning:'', loss_boil:'', loss_fry:'', loss_stew:'', loss_bake:'',
    qty:'', price:'', warehouse_id:'', is_water:false
  };
  useEffect(() => {
    if (!open) return;
    if (initial && initial.id) {
      setF({
        name: initial.name || '',
        category: initial.category || '',
        unit: initial.unit || 'кг',
        barcode: initial.barcode || '',
        loss_cleaning: initial.loss_cleaning != null ? String(Number(initial.loss_cleaning) || '') : '',
        loss_boil: initial.loss_boil != null ? String(Number(initial.loss_boil) || '') : '',
        loss_fry: initial.loss_fry != null ? String(Number(initial.loss_fry) || '') : '',
        loss_stew: initial.loss_stew != null ? String(Number(initial.loss_stew) || '') : '',
        loss_bake: initial.loss_bake != null ? String(Number(initial.loss_bake) || '') : '',
        qty: '', price: '', warehouse_id: '', is_water: !!initial.is_water
      });
    } else {
      setF(empty);
    }
  }, [open, initial?.id]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const losses = [
    ['loss_cleaning','% потерь при очистке'],
    ['loss_boil','% потерь при варке'],
    ['loss_fry','% потерь при жарке'],
    ['loss_stew','% потерь при тушении'],
    ['loss_bake','% потерь при запекании'],
  ];

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Редактировать ингредиент' : 'Добавить ингредиент'} width={680} className="tc-modal">
      <div style={{ display:'grid', gap:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={lbl}>Название</label>
            <input style={inp} value={f.name} onChange={set('name')} placeholder="Например, Картофель" />
          </div>
          <div>
            <label style={lbl}>Категория</label>
            <select style={inp} value={f.category} onChange={set('category')}>
              <option value="">— выберите —</option>
              {(categories || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={lbl}>Ед. измерения</label>
            <select style={inp} value={f.unit} onChange={set('unit')}>
              <option value="кг">кг</option>
              <option value="г">г</option>
              <option value="л">л</option>
              <option value="мл">мл</option>
              <option value="шт">шт</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Штрихкод</label>
            <input style={inp} value={f.barcode} onChange={set('barcode')} placeholder="Необязательно" />
          </div>
        </div>

        <div>
          <div style={{ fontSize:'.8125rem', fontWeight:600, color:'#333', marginBottom:8 }}>Потери при обработке</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {losses.map(([k, label]) => (
              <div key={k}>
                <label style={lbl}>{label}</label>
                <div style={{ position:'relative' }}>
                  <input style={{ ...inp, paddingRight:32 }} value={f[k]} onChange={set(k)} placeholder="0" inputMode="decimal" />
                  <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                    fontSize:'.82rem', color:'#9ca3af', pointerEvents:'none' }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ paddingTop:14, borderTop:'1px solid #f0f0f0' }}>
          <div style={{ fontSize:'.8125rem', fontWeight:600, color:'#333', marginBottom:4 }}>Складской учёт</div>
          <div style={{ fontSize:'.76rem', color:'#9ca3af', marginBottom:12 }}>
            Если продукт уже куплен — укажите количество и цену. Склад сразу пополнится, а себестоимость блюд посчитается сама.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Кол-во в наличии</label>
              <input style={inp} value={f.qty} onChange={set('qty')} placeholder="0" inputMode="decimal" />
            </div>
            <div>
              <label style={lbl}>Цена за ед.</label>
              <input style={inp} value={f.price} onChange={set('price')} placeholder="0" inputMode="decimal" />
            </div>
            <div>
              <label style={lbl}>Склад</label>
              <select style={inp} value={f.warehouse_id} onChange={set('warehouse_id')}>
                <option value="">— выберите —</option>
                {(warehouses || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose}>Отмена</button>
        <button className="sk-dd-btn" onClick={() => onSave(f)}>Сохранить</button>
      </div>
    </Modal>
  );
}
