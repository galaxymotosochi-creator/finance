import { useState } from 'react';
import Modal from '../../components/Modal';

const inp = { width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10,
  fontSize:'.88rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:'.76rem', fontWeight:600, color:'#6b7280', marginBottom:6 };

export default function TechCardForm({ open, initial, categories, onClose, onSave }) {
  const [f, setF] = useState(initial || {
    name:'', category:'', price:'', output_weight:'', output_unit:'г',
    photo_url:'', description:'', is_weight:false, price_per_kg:''
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Редактировать тех. карту' : 'Добавить тех. карту'} width="medium">
      <div style={{ display:'grid', gap:14 }}>
        <div>
          <label style={lbl}>Название *</label>
          <input style={inp} value={f.name} onChange={set('name')} placeholder="Например, Борщ украинский" />
        </div>

        <div>
          <label style={lbl}>Категория</label>
          <input style={inp} value={f.category} onChange={set('category')} placeholder="Супы, салаты, напитки" list="tc-cats" />
          <datalist id="tc-cats">
            {(categories || []).map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label style={lbl}>Цена продажи</label>
          <input style={inp} value={f.price} onChange={set('price')} placeholder="0" inputMode="decimal" />
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

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
          <div>
            <label style={lbl}>Выход порции</label>
            <input style={inp} value={f.output_weight} onChange={set('output_weight')} placeholder="300" inputMode="decimal" />
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

      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose}>Отмена</button>
        <button className="sk-dd-btn" onClick={() => onSave(f)}>Сохранить</button>
      </div>
    </Modal>
  );
}
