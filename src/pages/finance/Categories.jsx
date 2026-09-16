import Modal from '../../components/Modal';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import CenterSpinner from '../../components/CenterSpinner';
import SectionHelp from '../../components/SectionHelp';

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
  // Подсказка скролла таблицы (как в «Счетах» и «Чекax»)
  const [tblPos, setTblPos] = useState({left:true, right:true});
  const onTblScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 7000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      setList(data || []);
    } catch (e) {
      setToast('⚠️ Ошибка загрузки: ' + (e.message || 'неизвестная ошибка'));
    }
    setLoading(false);
  };

  useEffect(() => { if (user) fetch(); }, [user]);

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'categories', setList: setList, onSynced: fetch });

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
      let res;
      if (editingId) {
        res = await supabase.from('categories').update({ name: dirName.trim(), type: dirType }).eq('id', editingId);
      } else {
        res = await supabase.from('categories').insert({ user_id: user.id, name: dirName.trim(), type: dirType });
      }
      if (res.error) throw res.error;
      setShowModal(false);
      setEditingId(null);
      setDirName('');
      setDirType('income');
      if (!res.queued) await fetch();
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
      // Проверяем, используется ли категория в операциях.
      // Внимание: кастомный клиент не поддерживает count/head — считаем длину списка.
      const { data: usedTx } = await supabase.from('transactions').select('id').eq('category_id', pendingDeleteId);
      if (usedTx && usedTx.length > 0) {
        setToast('⚠️ Эта категория используется в ' + usedTx.length + ' операциях. Сначала переназначьте операции на другую категорию');
        setPendingDeleteId(null);
        return;
      }
      const { error, queued } = await supabase.from('categories').delete().eq('id', pendingDeleteId).eq('user_id', user.id);
      if (error) {
        if ((error.code === '23503') || (error.message && error.message.includes('foreign key'))) {
          setToast('⚠️ Эта категория используется в транзакциях. Сначала переназначьте транзакции на другую категорию');
        } else { setToast('⚠️ ' + error.message); }
        return;
      }
      if (!queued) await fetch();
    } catch (err) { setToast('⚠️ ' + err.message); }
    setPendingDeleteId(null);
  };

  if (loading) return <CenterSpinner />;
  return (
    <>
      {toast && <div className="toast toast-warning"><span style={{display:'inline-flex',alignItems:'center',gap:'.35rem'}}>{toast}<button onClick={()=>setToast(null)} style={{background:'none',border:'none',color:'#fff',fontSize:'1.1rem',cursor:'pointer',padding:'0 0 0 .35rem',lineHeight:1}}>&times;</button></span></div>}
      <div className="sk-bar">
        <div className="grow">
          <div style={{display:'flex',alignItems:'center'}}>
            <h1>Финансовые категории</h1>
            <SectionHelp
              title="Раздел «Финансовые категории»"
              intro="Справочник статей доходов и расходов бизнеса. Категории выбираются при вводе расходов, доходов и поставок."
              faq={[
                { q: 'Что это за раздел и зачем он нужен?', a: (
                  <div>Это <b>справочник статей</b>, по которым вы учитываете деньги. Один раз заводите категории — потом выбираете их при вводе расходов, доходов и в поставках. Благодаря этому видно, <i>куда</i> уходят деньги и <i>откуда</i> приходят.</div>
                ) },
                { q: 'Чем отличаются три типа категорий?', a: (
                  <ul>
                    <li style={{marginBottom:'.4rem'}}><b>Доходы (внекассовые)</b> — деньги не от продаж: проценты банка, доп. услуги, прочие поступления.</li>
                    <li style={{marginBottom:'.4rem'}}><b>Расходы бизнеса (операционные)</b> — жизнь компании: аренда, зарплата, реклама, интернет. В себестоимость товара не входят.</li>
                    <li><b>Расходы поставки (себестоимость)</b> — довески к товару: доставка ТК, сборка, упаковка, пошлина. Увеличивают себестоимость товара.</li>
                  </ul>
                ) },
                { q: 'Как добавить категорию?', a: (
                  <div>Нажмите <b>«Добавить категорию»</b> справа вверху. Укажите название и выберите тип. Готово — категория сразу появится в выпадающих списках при вводе расходов и доходов.</div>
                ) },
                { q: 'Почему категорию нельзя удалить?', a: (
                  <div>Если категория уже использована в операциях, система предупредит — сначала нужно разобраться с этими операциями. Так сумма не потеряется из учёта.</div>
                ) },
                { q: 'Можно ли переименовать категорию?', a: (
                  <div>Да. Нажмите <b>⋯</b> в строке категории → <b>«Редактировать»</b>. Название изменится везде, где категория использовалась.</div>
                ) },
              ]}
            />
          </div>
          <div className="sub">Структура доходов и расходов бизнеса</div>
        </div>
        <div className="sk-bar-acts">
          <button type="button" className="sk-dd-btn" style={{animation:'skpulse 2s ease-in-out infinite'}} onClick={function () { openModal(null); }}>Добавить категорию</button>
        </div>
      </div>

      <div className="***">
        <div className="***">
          <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
          <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}}></div>
        <div className="sk-card" style={{flex:1,overflowY:'auto',overflowX:'auto',WebkitOverflowScrolling:'touch',minHeight:0}} onScroll={onTblScroll}>
        <table className="sk-table cat-table">
          <thead id="dirColHeaders">
            <tr>
              <th style={{textAlign:'left'}}>Название</th>
              <th style={{textAlign:'left'}}>Тип категории</th>
              <th style={{textAlign:'center',width:'60px'}}></th>
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
                  <td style={{textAlign:'left'}}><span style={{whiteSpace:'nowrap'}}>{c.name}{c.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</span></td>
                  <td style={{textAlign:'left'}}>{dirTypeLabels[c.type] || c.type}</td>
                  <td style={{textAlign:'center',width:'30px'}}>
                    <div className="prod-more-wrap" style={{display:'inline-block',position:'relative'}}>
                      <button className="act-btn prod-more-btn" onClick={function(e){e.stopPropagation();var el=e.currentTarget.nextElementSibling;if(el){el.classList.toggle('open');var _r=el.getBoundingClientRect();if(_r.bottom>window.innerHeight)el.classList.add('up');else el.classList.remove('up');var h=function(){el.classList.remove('open');document.removeEventListener('click',h)};setTimeout(function(){document.addEventListener('click',h)},10)}}}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={function(e){e.stopPropagation();openModal(c)}}>Редактировать</button>
                        <button onClick={function(e){e.stopPropagation();remove(c.id)}} style={{color:'#dc3545'}}>Удалить</button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        </div>
      </div>

      {/* МОДАЛКА */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditingId(null); }} title={editingId ? 'Редактировать категорию' : 'Создать финансовую категорию'} subtitle="Добавьте или измените категорию доходов/расходов" width="medium">
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
            {editingId && <button type="button" className="btn btn-ghost" onClick={()=>{setShowModal(false);remove(editingId)}}>Удалить</button>}
            <button type="submit" className="btn btn-dark">Сохранить</button>
          </div>
        </form>
      </Modal>
      <Modal open={showConfirm} onClose={() => { setShowConfirm(false); setPendingDeleteId(null); }} title="Удалить категорию?" subtitle="Это действие нельзя отменить. Категория будет удалена навсегда." width="narrow"
        actions={<>
          <button type="button" className="btn btn-outline" onClick={()=>{setShowConfirm(false);setPendingDeleteId(null)}}>Отмена</button>
          <button className="btn btn-primary" style={{background:'#dc2626',color:'#fff'}} onClick={confirmDelete}>Да, удалить</button>
        </>}>
      </Modal>
    </>
  );
}
