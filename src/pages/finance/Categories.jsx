import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const dirTypeLabels = {
  income: 'Категории доходов',
  expense: 'Категории расходов бизнеса',
  supply_expense: 'Категории расходов поставки',
};

export default function Categories() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dirName, setDirName] = useState('');
  const [dirType, setDirType] = useState('income');

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    setList(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openModal = (cat) => {
    if (cat) {
      setEditingId(cat.id);
      setDirName(cat.name);
      setDirType(cat.type);
    } else {
      setEditingId(null);
      setDirName('');
      setDirType('income');
    }
    setShowModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!dirName.trim()) { alert('Введите название'); return; }
    try {
      if (editingId) {
        await supabase.from('categories').update({ name: dirName.trim(), type: dirType }).eq('id', editingId);
      } else {
        await supabase.from('categories').insert({ user_id: user.id, name: dirName.trim(), type: dirType });
      }
      setShowModal(false);
      setEditingId(null);
      setDirName('');
      setDirType('income');
      await fetch();
    } catch (err) { alert(err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Удалить категорию?')) return;
    await supabase.from('categories').delete().eq('id', id);
    await fetch();
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    const el = e.currentTarget.nextElementSibling;
    el.classList.add('open');
    const h = function () { el.classList.remove('open'); document.removeEventListener('click', h); };
    setTimeout(function () { document.addEventListener('click', h); }, 10);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Категории расходов и доходов</h1>
          <div className="sub">Управляйте категориями</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={function () { openModal(null); }}>+ Добавить категорию</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%' }}></div>

      <div className="product-table" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '500px' }}>
          <thead id="dirColHeaders">
            <tr>
              <th>Название</th>
              <th>Вид категории</th>
              <th style={{ width: '130px' }}></th>
            </tr>
          </thead>
          <tbody id="dirTableBody">
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan="3">
                  <div className="empty-products">
                    <div className="big-icon">📂</div>
                    <p>Категорий пока нет. Нажмите «+ Добавить категорию»</p>
                  </div>
                </td>
              </tr>
            )}
            {list.map(function (c) {
              return (
                <tr key={c.id}>
                  <td><div className="prod-name" style={{ fontSize: '.85rem' }}>{c.name}</div></td>
                  <td><span className="prod-cat">{dirTypeLabels[c.type] || c.type}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="act-btn prod-edit-btn" onClick={function () { openModal(c); }}>Ред.</button>
                    <div className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={toggleMenu}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={function () { remove(c.id); }} style={{ color: '#dc3545' }}>Удалить</button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* МОДАЛКА */}
      {showModal && (
        <div className="modal-overlay active" onClick={function (e) { if (e.target.className === 'modal-overlay active') { setShowModal(false); setEditingId(null); } }}>
          <div className="modal-box">
            <button className="modal-close" onClick={function () { setShowModal(false); setEditingId(null); }}>&times;</button>
            <h2>{editingId ? 'Редактировать категорию' : 'Добавить категорию'}</h2>
            <div className="sub">{editingId ? 'Измените название и вид' : 'Введите название и выберите вид'}</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например, Доставка" value={dirName} onChange={function (e) { setDirName(e.target.value); }} required />
              </div>
              <div className="form-group">
                <label>Вид</label>
                <select value={dirType} onChange={function (e) { setDirType(e.target.value); }}>
                  <option value="income">Категории доходов</option>
                  <option value="expense">Категории расходов бизнеса</option>
                  <option value="supply_expense">Категории расходов поставки</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={function () { setShowModal(false); setEditingId(null); }}>Отмена</button>
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
