import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const dirTypeLabels = {
  income: 'Доходы (Внекассовые)',
  expense: 'Расходы бизнеса (Операционные)',
  supply_expense: 'Расходы поставки (Себестоимость)',
};

export default function Categories() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dirName, setDirName] = useState('');
  const [dirType, setDirType] = useState('income');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 7000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    setList(data || []);
    setLoading(false);
  };

  useEffect(() => { if (user) fetch(); }, [user]);

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
    if (!dirName.trim()) { setToast('⚠️ Введите название'); return; }
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
    } catch (err) { setToast('⚠️ ' + err.message); }
  };

  const remove = (id) => {
    setPendingDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setShowConfirm(false);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', pendingDeleteId).eq('user_id', user.id);
      if (error) {
        if ((error.code === '23503') || (error.message && error.message.includes('foreign key'))) {
          setToast('⚠️ Эта категория используется в транзакциях. Сначала переназначьте транзакции на другую категорию');
        } else { setToast('⚠️ ' + error.message); }
        return;
      }
      await fetch();
    } catch (err) { setToast('⚠️ ' + err.message); }
    setPendingDeleteId(null);
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    const el = e.currentTarget.nextElementSibling;
    el.classList.add('open');
    var _r=el.getBoundingClientRect();if(_r.bottom>window.innerHeight)el.classList.add('up');else el.classList.remove('up');
    const h = function () { el.classList.remove('open'); document.removeEventListener('click', h); };
    setTimeout(function () { document.addEventListener('click', h); }, 10);
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;
  return (
    <>
      {toast && <div className="toast toast-warning"><span style={{display:'inline-flex',alignItems:'center',gap:'.35rem'}}>{toast}<button onClick={()=>setToast(null)} style={{background:'none',border:'none',color:'#fff',fontSize:'1.1rem',cursor:'pointer',padding:'0 0 0 .35rem',lineHeight:1}}>&times;</button></span></div>}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Финансовые категории</h1>
          <div className="sub">Структура доходов и расходов бизнеса</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={function () { openModal(null); }} style={{background:'var(--primary)',color:'var(--primary-text)',border:'none',borderRadius:'100px',padding:'.5rem .8rem',fontWeight:'600',fontFamily:'var(--font)',cursor:'pointer',fontSize:'.78rem'}}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%' }}></div>

      <div className="product-table" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '500px' }}>
          <thead id="dirColHeaders">
            <tr>
              <th>Название</th>
              <th>Тип категории</th>
              <th style={{ width: '130px' }}></th>
            </tr>
          </thead>
          <tbody id="dirTableBody">
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan="3">
                  <div className="empty-products">
                    <div className="big-icon">📂</div>
                    <p>Список категорий пуст</p>
                    <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Создайте первую статью доходов или расходов для финансового учета</p>
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
            <h2>{editingId ? 'Редактировать категорию' : 'Создать финансовую категорию'}</h2>
            <div className="sub">{editingId ? 'Измените название и тип' : 'Введите название и выберите тип'}</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название</label>
                <input type="text" placeholder={dirType === 'income' ? 'Например: проценты от банка, оплата за доп. услуги' : dirType === 'supply_expense' ? 'Например: ТК (доставка), упаковка товара' : 'Например: аренда офиса, рекламный бюджет, CRM'} value={dirName} onChange={function (e) { setDirName(e.target.value); }} required />
              </div>
              <div className="form-group">
                <label>Тип категории</label>
                <select value={dirType} onChange={function (e) { setDirType(e.target.value); }}>
                  <option value="income">Доходы (Внекассовые)</option>
                  <option value="expense">Расходы бизнеса (Операционные)</option>
                  <option value="supply_expense">Расходы поставки (Себестоимость)</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-account-select">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showConfirm && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setShowConfirm(false)}}}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <h2 style={{fontSize:'1rem'}}>Удалить категорию?</h2>
            <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.75rem 0',lineHeight:1.5}}>Это действие нельзя отменить. Категория будет удалена навсегда.</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={()=>{setShowConfirm(false);setPendingDeleteId(null)}}>Отмена</button>
              <button className="btn btn-primary" onClick={confirmDelete} style={{marginLeft:'.5rem'}}>Да, удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
