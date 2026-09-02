import Modal from '../../components/Modal';
import SectionHelp from '../../components/SectionHelp';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import CenterSpinner from '../../components/CenterSpinner';

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
    try {
      const { data, error } = await supabase.from('stock_categories').select('*').eq('user_id', user.id).order('created_at');
      if (error) throw error;
      if (data) setCats(data);
    } catch (e) {
      setToast('⚠️ Ошибка загрузки: ' + (e.message || 'неизвестная ошибка'));
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'stock_categories', setList: setCats, onSynced: load });

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
    let queued = false;
    if (editId) {
      const res = await supabase.from('stock_categories').update({ name: fName.trim(), type: fType }).eq('id', editId);
      if (res.error) return alert(res.error.message);
      queued = res.queued;
    } else {
      const res = await supabase.from('stock_categories').insert({
        id: Date.now(),
        user_id: user.id,
        name: fName.trim(),
        type: fType
      });
      if (res.error) return alert(res.error.message);
      queued = res.queued;
    }
    if (!queued) await load();
    setShowModal(false);
    if (!editId) setToast('Категория успешно добавлена!');
  };

  const remove = async (id) => {
    if (!confirm('Удалить категорию?')) return;
    const { error, queued } = await supabase.from('stock_categories').delete().eq('id', id);
    if (error) return alert(error.message);
    if (!queued) await load();
  };

  if (loading) return <CenterSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1>Категории</h1>
            <SectionHelp
              title="Раздел «Категории»"
              intro="Категории — это группы, по которым удобно распределять товары и услуги. По ним можно фильтровать каталог, остатки и кассу."
              blocks={[
                { title: 'Зачем нужны категории', items: [
                  <>Группируют товары и услуги по смыслу: например «Электроинструменты», «Расходники», «Услуги».</>,
                  <>По категориям удобно фильтровать список в «Товарах и услугах», «Остатках» и в кассе.</>,
                ]},
                { title: 'Кнопка «+ Добавить»', items: [
                  <>Создаёт новую категорию: название + вид (Товар или Услуга).</>,
                ]},
                { title: 'Столбцы таблицы', items: [
                  <><b>Название</b> — имя категории.</>,
                  <><b>Тип</b> — к чему относится категория: к товарам или к услугам.</>,
                ]},
                { title: 'Кнопка ⋯ у категории', items: [
                  <><b>Редактировать</b> — изменить название или тип.</>,
                  <><b>Удалить</b> — убрать категорию. Товары из неё останутся в каталоге, просто без категории.</>,
                ]},
                { title: 'Важно про тип', text: <>Категория «Товар» — для физических товаров, «Услуга» — для услуг. При создании позиции в каталоге тип категории должен совпадать с типом позиции, иначе она не появится в фильтре.</> },
              ]}
            />
          </div>
          <div className="sub">Настройка групп для товаров и услуг</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-dark" onClick={openAdd} style={{padding:'.5rem .9rem',fontWeight:600}}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table className="data-table" style={{minWidth:'500px'}}>
          <thead id="catColHeaders">
            <tr>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Название</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Тип</th>
              <th style={{width:'130px',textAlign:'left'}}></th>
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
                <td style={{textAlign:'left'}}><div className="prod-name">{c.name}{c.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</div></td>
                <td style={{textAlign:'left'}}><span className="prod-cat">{c.type === 'service' ? 'Услуга' : 'Товар'}</span></td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={(e) => {
                      e.stopPropagation();
                      const dd = e.currentTarget.nextElementSibling;
                      document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                      dd.classList.toggle('open');var _r=dd.getBoundingClientRect();if(_r.bottom>window.innerHeight)dd.classList.add('up');else dd.classList.remove('up');
                    }}>⋯</button>
                    <div className="prod-dropdown">
                      <button onClick={() => openEdit(c)}>Редактировать</button>
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
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Редактировать категорию' : 'Добавить категорию'} subtitle="Добавьте или измените категорию товаров/услуг" width="medium">
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
            <button type="submit" className="btn btn-dark">{editId ? 'Сохранить' : 'Добавить'}</button>
          </div>
        </form>
      </Modal>
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.65rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}
    </>
  );
}
