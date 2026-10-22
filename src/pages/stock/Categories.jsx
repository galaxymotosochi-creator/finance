import Modal from '../../components/Modal';
import SectionHelp from '../../components/SectionHelp';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import CenterSpinner from '../../components/CenterSpinner';
import { genId } from '../../lib/id';

export default function Categories() {
  const { user } = useAuth();
  const businessType = (function(){
    try { return localStorage.getItem('atlaspos_business_type') || user?.business_type || 'retail'; } catch(e){ return 'retail'; }
  })();
  const scope = (function(){
    try { return location.pathname.indexOf('ing-categories') >= 0 ? 'ingredient' : 'dish'; } catch(e){ return 'dish'; }
  })();
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
      if (data) setCats(businessType === 'food'
        ? data.filter(function(c){ return c.scope === 'food' && c.type === scope; })
        : data.filter(function(c){ return c.scope !== 'food' && (scope === 'ingredient' ? !c.type || c.type === 'ingredient' : (!c.type || c.type === 'product' || c.type === 'service')); }));
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
          scope: businessType === 'food' ? 'food' : 'retail',
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
    setFType(businessType === 'food' ? scope : (businessType === 'services' ? 'service' : 'product'));
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
      const res = await supabase.from('stock_categories').update({ name: fName.trim(), type: businessType === 'services' ? 'service' : fType, scope: businessType === 'food' ? 'food' : 'retail' }).eq('id', editId);
      if (res.error) return alert(res.error.message);
      queued = res.queued;
    } else {
      const res = await supabase.from('stock_categories').insert({
        id: genId(),
        user_id: user.id,
        name: fName.trim(),
        type: businessType === 'services' ? 'service' : fType,
        scope: businessType === 'food' ? 'food' : 'retail'
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
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',paddingLeft:'14px',borderLeft:'3px solid #1F75FF'}}>
        <div className="grow">
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'3px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
            <h1 className="cat-title">{businessType === 'food' ? (scope === 'ingredient' ? 'Категории ингредиентов' : 'Категории блюд и тех.карт') : 'Категории'}</h1>
            <SectionHelp
              title="Раздел «Категории»"
              intro="Категории — группы, по которым распределяются товары и услуги. По ним удобно фильтровать каталог, остатки и кассу."
              faq={[
                { q: 'Зачем нужны категории?', a: (
                  <div>{businessType === 'food' ? <>Категории <b>группируют блюда и ингредиенты</b> по смыслу: например «Супы», «Салаты», «Мясо», «Бакалея». Категории блюд выбираются при создании тех. карты.</> : <>Категории <b>группируют товары и услуги</b> по смыслу: например «Электроинструменты», «Расходники», «Услуги». По ним удобно фильтровать списки в <b>«Товарах и услугах»</b>, <b>«Остатках»</b> и в кассе.</>}</div>
                ) },
                { q: businessType === 'food' ? 'Чем отличаются виды «Блюдо / тех. карта» и «Ингредиент»?' : 'Чем отличаются типы «Товар» и «Услуга»?', a: (
                  <ul>
                    {businessType === 'food' ? <>
                      <li style={{marginBottom:'.4rem'}}><b>Блюдо / тех. карта</b> — для категорий меню: супы, салаты, напитки. Такие категории выбираются при создании тех. карты.</li>
                      <li><b>Ингредиент</b> — для категорий сырья: мясо, овощи, бакалея.</li>
                    </> : <>
                      <li style={{marginBottom:'.4rem'}}><b>Товар</b> — для физических позиций, которые лежат на складе и продаются штуками.</li>
                      <li><b>Услуга</b> — для работ и сервиса: монтаж, доставка, настройка.</li>
                    </>}
                  </ul>
                ) },
                { q: 'Как добавить категорию?', a: (
                  <div>Нажмите <b>«Добавить»</b> справа вверху. Укажите название и выберите вид — {businessType === 'food' ? <><b>«Блюдо / тех. карта»</b> или <b>«Ингредиент»</b></> : <><b>«Товар»</b> или <b>«Услуга»</b></>}. Готово: категория сразу появится в фильтрах.</div>
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
            <span className="cat-sub">Группы для каталога услуг</span>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginLeft:'auto'}}>
          <button type="button" onClick={openAdd} className="cat-add-btn">Добавить</button>
        </div>
      </div>

      

      <div className="sk-tablewrap" style={{flex:'none',minHeight:'auto'}}>
          <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
          <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}} data-arrow="top"></div>
        <div className="sk-card cat-table" style={{position:'relative',overflowX:'auto',WebkitOverflowScrolling:'touch'}} ref={tblElRef} onScroll={onTblScroll}>
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
                  <div style={{ padding:'28px 24px', textAlign:'center', color:'var(--muted)' }}>
                    <div style={{ maxWidth:'420px', margin:'0 auto', textAlign:'left', fontSize:'.8rem', color:'#555', lineHeight:1.6 }}>
                      {businessType === 'food' ? (
                        <>
                          <b>Как добавить категорию:</b><br />
                          • Нажмите «Добавить категорию»<br />
                          • Укажите название (например, «Овощи», «Напитки»)<br />
                          • Категории помогают группировать {scope === 'ingredient' ? 'ингредиенты' : 'блюда'} на складе
                        </>
                      ) : businessType === 'services' ? (
                        <>
                          <b>Как добавить категорию услуг:</b><br />
                          • Нажмите «Добавить категорию»<br />
                          • Укажите название (например, «Стрижки», «Маникюр», «Уборка»)<br />
                          • Категории помогают группировать услуги в каталоге и кассе
                        </>
                      ) : (
                        <>
                          <b>Как добавить категорию:</b><br />
                          • Нажмите «Добавить категорию»<br />
                          • Укажите название и выберите тип — товар или услуга<br />
                          • Категории помогают группировать позиции в каталоге
                        </>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : cats.map(c => (
              <tr key={c.id}>
                <td style={{textAlign:'left'}}><span style={{whiteSpace:'nowrap'}}>{c.name}{c.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</span></td>
                <td style={{textAlign:'left'}}>{businessType === 'food' ? (scope === 'ingredient' ? 'Ингредиент' : 'Блюдо / тех. карта') : (businessType === 'services' ? 'Услуга' : (c.type === 'service' ? 'Услуга' : 'Товар'))}</td>
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
          {businessType !== 'services' && (
          <div className="form-group">
            <label>Тип</label>
            <select value={fType} onChange={e => setFType(e.target.value)}>
              {businessType === 'food' ? (
                scope === 'ingredient'
                  ? <option value="ingredient">Ингредиент</option>
                  : <option value="dish">Блюдо / тех. карта</option>
              ) : (
                <>
                  <option value="product">Товар</option>
                  <option value="service">Услуга</option>
                </>
              )}
            </select>
          </div>)}
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
