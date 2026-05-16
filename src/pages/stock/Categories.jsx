import { useState, useEffect } from 'react';

const getCats = () => {
  let list = JSON.parse(localStorage.getItem('allCats88') || '[]');
  // Миграция старых данных
  if (!list.length) {
    const prodCats = JSON.parse(localStorage.getItem('prodCats88') || '[]');
    const svcCats = JSON.parse(localStorage.getItem('svcCats88') || '[]');
    prodCats.forEach(c => list.push({ id: c.id, name: c.name, type: 'product' }));
    svcCats.forEach(c => list.push({ id: c.id + 100000, name: c.name, type: 'service' }));
    localStorage.setItem('allCats88', JSON.stringify(list));
  }
  return list;
};
const setCats = (list) => localStorage.setItem('allCats88', JSON.stringify(list));

export default function Categories() {
  const [cats, setCatsState] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState('product');
  const [filter, setFilter] = useState('all');

  const load = () => setCatsState(getCats());
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setFName('');
    setFType('product');
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditId(c.id);
    setFName(c.name);
    setFType(c.type || 'product');
    setShowModal(true);
  };

  const save = (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название');
    let list = getCats();
    if (editId) {
      const idx = list.findIndex(c => c.id === editId);
      if (idx >= 0) { list[idx].name = fName.trim(); list[idx].type = fType; }
    } else {
      list.push({ id: Date.now(), name: fName.trim(), type: fType });
    }
    setCats(list);
    load();
    setShowModal(false);
  };

  const remove = (id) => {
    if (!confirm('Удалить категорию?')) return;
    let list = getCats().filter(c => c.id !== id);
    setCats(list);
    load();
  };

  let filtered = cats;
  if (filter === 'product') filtered = cats.filter(c => c.type === 'product');
  else if (filter === 'service') filtered = cats.filter(c => c.type === 'service');

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Категории товаров и услуг</h1>
          <div className="sub">Управляйте категориями</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAdd}>+ Добавить категорию</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="search-row">
        <div className="actions-group" style={{marginLeft:0}}>
          <button className={`text-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}>Все</button>
          <button className={`text-btn${filter === 'product' ? ' active' : ''}`}
            onClick={() => setFilter('product')}>Товары</button>
          <button className={`text-btn${filter === 'service' ? ' active' : ''}`}
            onClick={() => setFilter('service')}>Услуги</button>
        </div>
      </div>

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table style={{minWidth:'500px'}}>
          <thead id="catColHeaders">
            <tr>
              <th>Название</th>
              <th>Вид</th>
              <th style={{width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="catTableBody">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="3">
                  <div className="empty-products">
                    <div className="big-icon">🏷️</div>
                    <p>Категорий пока нет. Нажмите «+ Добавить категорию»</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td><div className="prod-name" style={{fontSize:'.85rem'}}>{c.name}</div></td>
                <td><span className="prod-cat">{c.type === 'service' ? 'Услуга' : 'Товар'}</span></td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <button className="act-btn prod-edit-btn" onClick={() => openEdit(c)}>Ред.</button>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={(e) => {
                      e.stopPropagation();
                      const dd = e.currentTarget.nextElementSibling;
                      document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                      dd.classList.toggle('open');
                    }}>⋯</button>
                    <div className="prod-dropdown">
                      <button onClick={() => remove(c.id)} style={{color:'#dc3545'}}>Удалить</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модалка */}
      {showModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.className === 'modal-overlay active') setShowModal(false); }}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            <h2>{editId ? 'Редактировать категорию' : 'Добавить категорию'}</h2>
            <div className="sub">Введите название и выберите вид</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" value={fName} onChange={e => setFName(e.target.value)}
                  placeholder="Например, Электроинструменты" required />
              </div>
              <div className="form-group">
                <label>Вид</label>
                <select value={fType} onChange={e => setFType(e.target.value)}>
                  <option value="product">Товар</option>
                  <option value="service">Услуга</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">{editId ? 'Сохранить' : 'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
