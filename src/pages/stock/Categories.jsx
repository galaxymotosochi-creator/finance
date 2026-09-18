import Modal from '../../components/Modal';
import SectionHelp from '../../components/SectionHelp';
import { useState, useRef, useEffect } from 'react';
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
  // Подсказка скролла таблицы (как в «Счетах» и «Чекax»)
  // Подсказка скролла: показывается ТОЛЬКО когда реально есть что прокрутить
  const [tblPos, setTblPos] = useState({left:false, right:false});
  const tblElRef = useRef(null);
  const onTblScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left:false, right:false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const checkTbl = () => {
    const el = tblElRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left:false, right:false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  useEffect(() => {
    const t = setTimeout(checkTbl, 120);
    window.addEventListener('resize', checkTbl);
    return () => { clearTimeout(t); window.removeEventListener('resize', checkTbl); };
  });
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
      <div className="sk-bar">
        <div className="grow">
          <div style={{display:'flex',alignItems:'center'}}>
            <h1>Категории</h1>
            <SectionHelp
              title="Раздел «Категории»"
              intro="Категории — группы, по которым распределяются товары и услуги. По ним удобно фильтровать каталог, остатки и кассу."
              faq={[
                { q: 'Зачем нужны категории?', a: (
                  <div>Категории <b>группируют товары и услуги</b> по смыслу: например «Электроинструменты», «Расходники», «Услуги». По ним удобно фильтровать списки в <b>«Товарах и услугах»</b>, <b>«Остатках»</b> и в кассе.</div>
                ) },
                { q: 'Чем отличаются типы «Товар» и «Услуга»?', a: (
                  <ul>
                    <li style={{marginBottom:'.4rem'}}><b>Товар</b> — для физических позиций, которые лежат на складе и продаются штуками.</li>
                    <li><b>Услуга</b> — для работ и сервиса: монтаж, доставка, настройка.</li>
                  </ul>
                ) },
                { q: 'Как добавить категорию?', a: (
                  <div>Нажмите <b>«Добавить»</b> справа вверху. Укажите название и выберите тип — <b>Товар</b> или <b>Услуга</b>. Готово: категория сразу появится в фильтрах каталога и остатков.</div>
                ) },
                { q: 'Важно про тип!', a: (
                  <div>При создании позиции в каталоге <b>тип категории должен совпадать с типом позиции</b> — иначе позиции не появится в фильтре. Товар кладем в категорию типа «Товар», услугу — в «Услуга».</div>
                ) },
                { q: 'Что делает кнопка «⋯» у категории?', a: (
                  <ul>
                    <li style={{marginBottom:'.4rem'}}><b>«Редактировать»</b> — изменить название или тип.</li>
                    <li><b>«Удалить»</b> — убрать категорию. Товары из нее <b>останутся в каталоге</b>, просто станут без категории.</li>
                  </ul>
                ) },
              ]}
            />
          </div>
          <div className="sub">Настройка групп для товаров и услуг</div>
        </div>
        <div className="***">
          <button type="button" className="sk-dd-btn" onClick={openAdd}>Добавить</button>
        </div>
      </div>

      

      <div className="sk-tablewrap" style={{flex:'none',minHeight:'auto'}}>
          <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
          <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}} data-arrow="top"></div>
        <div className="sk-card" style={{position:'relative',overflowX:'auto',WebkitOverflowScrolling:'touch'}} ref={tblElRef} onScroll={onTblScroll}>
        <table className="sk-table stock-cat-table">
          <thead id="catColHeaders">
            <tr>
              <th style={{textAlign:'left'}}>Название</th>
              <th style={{textAlign:'left'}}>Тип</th>
              <th className="actions" style={{textAlign:'left',width:'58px'}}></th>
            </tr>
          </thead>
          <tbody id="catTableBody">
            {cats.length === 0 ? (
              <tr>
                <td colSpan="3">
                  <div className="sk-empty">
                    <p>Список категорий пуст</p>
                    <p>Создайте первую категорию, чтобы распределить товары и услуги</p>
                  </div>
                </td>
              </tr>
            ) : cats.map(c => (
              <tr key={c.id}>
                <td style={{textAlign:'left'}}><span style={{whiteSpace:'nowrap'}}>{c.name}{c.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</span></td>
                <td style={{textAlign:'left'}}>{c.type === 'service' ? 'Услуга' : 'Товар'}</td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="sk-more" onClick={(e) => {
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
            <button type="submit" className="sk-dd-btn">{editId ? 'Сохранить' : 'Добавить'}</button>
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
