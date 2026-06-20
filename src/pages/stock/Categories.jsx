import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function Categories() {
  const { user } = useAuth();
  const [cats, setCats] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState('product');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('stock_categories').select('*').eq('user_id', user.id).order('created_at');
    if (data) setCats(data);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  // Миграция старых данных из localStorage
  useEffect(() => {
    if (!user || cats.length > 0) return;
    const oldList = JSON.parse(localStorage.getItem('allCats88') || '[]');
    if (oldList.length === 0) {
      const prodCats = JSON.parse(localStorage.getItem('prodCats88') || '[]');
      const svcCats = JSON.parse(localStorage.getItem('svcCats88') || '[]');
      prodCats.forEach(c => oldList.push({ id: c.id, name: c.name, type: 'product' }));
      svcCats.forEach(c => oldList.push({ id: c.id + 100000, name: c.name, type: 'service' }));
    }
    if (oldList.length > 0) {
      oldList.forEach(async (c) => {
        await supabase.from('stock_categories').upsert({
          id: c.id,
          user_id: user.id,
          name: c.name,
          type: c.type || 'product',
          created_at: new Date().toISOString()
        }).select();
      });
      localStorage.removeItem('allCats88');
      localStorage.removeItem('prodCats88');
      localStorage.removeItem('svcCats88');
      load();
    }
  }, [user, cats.length]);

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

  const save = async (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название');
    if (editId) {
      const { error } = await supabase.from('stock_categories').update({ name: fName.trim(), type: fType }).eq('id', editId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from('stock_categories').insert({
        id: Date.now(),
        user_id: user.id,
        name: fName.trim(),
        type: fType
      });
      if (error) return alert(error.message);
    }
    await load();
    setShowModal(false);
    if (!editId) setToast('Категория успешно добавлена!');
  };

  const remove = async (id) => {
    if (!confirm('Удалить категорию?')) return;
    const { error } = await supabase.from('stock_categories').delete().eq('id', id);
    if (error) return alert(error.message);
    await load();
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Категории позиций</h1>
          <div className="sub">Настройка групп для товаров и услуг</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={openAdd}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table style={{minWidth:'500px'}}>
          <thead id="catColHeaders">
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th style={{width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="catTableBody">
            {cats.length === 0 ? (
              <tr>
                <td colSpan="3">
                  <div className="empty-products">
                    <div className="big-icon">🏷️</div>
                    <p>Список категорий пуст</p>
                    <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Создайте первую категорию, чтобы распределить товары и услуги</p>
                  </div>
                </td>
              </tr>
            ) : cats.map(c => (
              <tr key={c.id}>
                <td><div className="prod-name">{c.name}</div></td>
                <td><span className="prod-cat">{c.type === 'service' ? 'Услуга' : 'Товар'}</span></td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <button className="act-btn prod-edit-btn" onClick={() => openEdit(c)}>Ред.</button>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={(e) => {
                      e.stopPropagation();
                      const dd = e.currentTarget.nextElementSibling;
                      document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                      dd.classList.toggle('open');var _r=dd.getBoundingClientRect();if(_r.bottom>window.innerHeight)dd.classList.add('up');else dd.classList.remove('up');
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
            <h2>{editId ? 'Редактировать категорию' : 'Добавьте категорию'}</h2>
            <div className="sub">Настройте новую группу для каталога</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название</label>
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
                <button type="submit" className="btn btn-account-select">{editId ? 'Сохранить' : 'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.65rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}
    </>
  );
}
