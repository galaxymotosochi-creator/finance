import { useState, useEffect } from 'react';

const getWriteoffs = () => JSON.parse(localStorage.getItem('writeoffs88') || '[]');
const setWriteoffs = (list) => localStorage.setItem('writeoffs88', JSON.stringify(list));
const getProducts = () => JSON.parse(localStorage.getItem('products88') || '[]');

const REASONS = ['Списание','Брак','Потеря','Порча','Окончание срока','Инвентаризация','Прочее'];

export default function Writeoffs() {
  const [list, setList] = useState([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fProd, setFProd] = useState('');
  const [fQty, setFQty] = useState('1');
  const [fReason, setFReason] = useState('Списание');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);

  const load = () => setList(getWriteoffs());
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null); setFProd(''); setFQty('1'); setFReason('Списание');
    setFDate(new Date().toISOString().split('T')[0]); setShow(true);
  };

  const save = (e) => {
    e.preventDefault();
    const prodId = parseInt(fProd);
    if (!prodId) return alert('Выберите товар');
    const qty = parseInt(fQty) || 1;
    if (qty <= 0) return alert('Введите количество');
    const prod = getProducts().find(p => p.id === prodId);
    const cost = prod ? (prod.price || 0) : 0;
    const all = getWriteoffs();
    const obj = { prodId, name: prod ? prod.name : 'Товар', qty, cost, reason: fReason, date: fDate };
    if (editId) {
      const idx = all.findIndex(x => x.id === editId);
      if (idx > -1) all[idx] = { ...all[idx], ...obj };
    } else { obj.id = Date.now(); all.unshift(obj); }
    setWriteoffs(all); load(); setShow(false);
  };

  const remove = (id) => {
    if (!confirm('Удалить списание?')) return;
    setWriteoffs(getWriteoffs().filter(x => x.id !== id)); load();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Списания</h1>
          <div className="sub">Списание товаров со склада (брак, потеря)</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAdd}>+ Списать товар</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table>
          <thead id="woColHeaders">
            <tr>
              <th>Товар</th>
              <th>Кол-во</th>
              <th>Сумма</th>
              <th>Причина</th>
              <th>Дата</th>
              <th style={{width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="writeoffTableBody">
            {list.length === 0 ? (
              <tr><td colSpan="6"><div className="empty-products"><div className="big-icon">📝</div><p>Списаний пока нет</p></div></td></tr>
            ) : list.map(w => (
              <tr key={w.id}>
                <td><div className="prod-name" style={{fontSize:'.85rem'}}>{w.name}</div></td>
                <td>{w.qty}</td>
                <td><span className="num">{(w.qty * (w.cost||0)).toLocaleString()}₽</span></td>
                <td><span className="prod-cat">{w.reason||'—'}</span></td>
                <td style={{fontSize:'.82rem',color:'var(--muted)'}}>{w.date||'—'}</td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <button className="act-btn prod-edit-btn" onClick={() => {
                    setEditId(w.id); setFProd(String(w.prodId)); setFQty(String(w.qty));
                    setFReason(w.reason||'Списание'); setFDate(w.date||new Date().toISOString().split('T')[0]);
                    setShow(true);
                  }}>Ред.</button>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={(e) => {
                      e.stopPropagation();
                      const dd = e.currentTarget.nextElementSibling;
                      document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                      dd.classList.toggle('open');
                    }}>⋯</button>
                    <div className="prod-dropdown">
                      <button onClick={() => remove(w.id)} style={{color:'#dc3545'}}>Удалить</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="modal-overlay active" onClick={(e)=>{if(e.target.className==='modal-overlay active')setShow(false)}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <h2>{editId?'Редактировать списание':'Списать товар'}</h2>
            <div className="sub">Выберите товар и укажите причину</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Товар *</label>
                <select value={fProd} onChange={e=>setFProd(e.target.value)} required>
                  <option value="">— выберите товар —</option>
                  {getProducts().map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Количество</label>
                  <input type="number" value={fQty} onChange={e=>setFQty(e.target.value)} min="1" required />
                </div>
                <div className="form-group">
                  <label>Дата</label>
                  <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Причина</label>
                <select value={fReason} onChange={e=>setFReason(e.target.value)}>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId?'Сохранить':'Списать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
