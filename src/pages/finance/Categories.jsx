import Modal from '../../components/Modal';
import RowMenu from '../../components/RowMenu';
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import CenterSpinner from '../../components/CenterSpinner';
import SectionHelp from '../../components/SectionHelp';

const dirTypeLabels = {
  income: 'Доход',
  expense: 'Расход',
  supply_expense: 'Расход',
};

export default function Categories() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dirName, setDirName] = useState('');
  const [dirType, setDirType] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
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
      setDirType('');
    }
    setShowModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!dirName.trim()) { setToast('⚠️ Введите название'); return; }
    if (!dirType) { setToast('⚠️ Выберите тип категории'); return; }
    const editingCat = editingId ? (list || []).find(c => String(c.id) === String(editingId)) : null;
    if (editingCat && editingCat.is_system) { setToast('⚠️ Системную категорию изменить нельзя'); setShowModal(false); setEditingId(null); return; }
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
      setDirType('');
      if (!res.queued) await fetch();
    } catch (err) { setToast('⚠️ ' + err.message); }
  };

  const remove = (id) => {
    setPendingDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const delCat = (list || []).find(c => String(c.id) === String(pendingDeleteId));
    if (delCat && delCat.is_system) { setShowConfirm(false); setPendingDeleteId(null); setToast('⚠️ Системную категорию удалить нельзя'); return; }
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
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',paddingLeft:'14px',borderLeft:'3px solid #1F75FF'}}>
        <div className="grow">
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'3px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
            <h1 className="cat-title">Финансовые категории</h1>
            <SectionHelp
              title="Раздел «Финансовые категории»"
              intro="Справочник статей доходов и расходов бизнеса. Категории выбираются при вводе расходов, доходов и поставок."
              faq={[
                { q: 'Что это за раздел и зачем он нужен?', a: (
                  <div>Это <b>справочник статей</b>, по которым вы учитываете деньги. Один раз заводите категории — потом выбираете их при вводе расходов, доходов и в поставках. Благодаря этому видно, <i>куда</i> уходят деньги и <i>откуда</i> приходят.</div>
                ) },
                { q: 'Какие бывают типы категорий?', a: (
                  <ul>
                    <li style={{marginBottom:'.4rem'}}><b>Доход</b> — поступления: выручка от продаж, проценты банка, доп. услуги и прочее.</li>
                    <li><b>Расход</b> — траты бизнеса: аренда, зарплата, реклама, интернет, расходники.</li>
                  </ul>
                ) },
                { q: 'Как добавить категорию?', a: (
                  <div>Нажмите <b>«Добавить»</b> справа вверху. Укажите название и выберите тип. Готово — категория сразу появится в выпадающих списках при вводе расходов и доходов.</div>
                ) },
                { q: 'Почему категорию нельзя удалить?', a: (
                  <div>Если категория уже использована в операциях, система предупредит — сначала нужно разобраться с этими операциями. Так сумма не потеряется из учета.</div>
                ) },
                { q: 'Можно ли переименовать категорию?', a: (
                  <div>Да. Нажмите <b>⋯</b> в строке категории → <b>«Редактировать»</b>. Название изменится везде, где категория использовалась.</div>
                ) },
              ]}
            />
          </div>
          </div>
          <span className="cat-sub">Структура доходов и расходов бизнеса</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginLeft:'auto'}}>
          <button type="button" className="cat-add-btn" onClick={function () { openModal(null); }}>Добавить</button>
        </div>
      </div>

      <div className="sk-tablewrap">
          <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
          <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}} data-arrow="top"></div>
        <div className="sk-card" style={{position:'relative',flex:1,overflowX:'auto',overflowY:'auto',WebkitOverflowScrolling:'touch',minHeight:0}} ref={tblElRef} onScroll={onTblScroll}>
        <table className="sk-table cat-table">
          <thead id="dirColHeaders">
            <tr>
              <th style={{textAlign:'left'}}>Название</th>
              <th style={{textAlign:'left'}}>Тип категории</th>
              <th className="actions" style={{textAlign:'left',width:'58px'}}></th>
            </tr>
          </thead>
          <tbody id="dirTableBody">
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan="3">
                  <div style={{ padding:'28px 24px', textAlign:'center', color:'var(--muted)' }}>
                    <div style={{ maxWidth:'420px', margin:'0 auto', textAlign:'left', fontSize:'.8rem', color:'#555', lineHeight:1.6 }}>
                      <b>Как добавить категорию:</b><br />
                      • Нажмите «Добавить» справа вверху<br />
                      • Укажите название категории<br />
                      • Выберите тип — доход или расход<br />
                      Категории нужны для группировки операций в «Доходах и расходах».
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {list.map(function (c) {
              return (
                <tr key={c.id}>
                  <td style={{textAlign:'left'}}><span style={{whiteSpace:'nowrap'}}>{c.name}{c.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</span></td>
                  <td style={{textAlign:'left'}}>{dirTypeLabels[c.type] || c.type}</td>
                  <td style={{textAlign:'left',width:'58px'}}>
                    {c.is_system ? (
                      <span title="Системная категория — изменить нельзя" style={{color:'#b8c0cc',fontSize:'.9rem',cursor:'default'}}>—</span>
                    ) : (
                      <div className="prod-more-wrap" style={{display:'inline-block',position:'relative'}}>
                        <RowMenu items={[
                          { label: 'Редактировать', onClick: () => openModal(c) },
                          { label: 'Удалить', onClick: () => remove(c.id), danger: true },
                        ]} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* МОДАЛКА */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditingId(null); }} title={editingId ? 'Редактировать категорию' : 'Создать финансовую категорию'} subtitle="" width="medium" className="modal-v2 cat-modal">
        <form onSubmit={save}>
          <div className="v2-card">
            <div className="form-group">
              <label>Название</label>
              <input type="text" placeholder={dirType === 'income' ? 'Например: проценты от банка' : 'Например: аренда офиса, реклама'} value={dirName} onChange={function (e) { setDirName(e.target.value); }} required autoFocus />
            </div>
            <div className="form-group">
              <label>Тип категории</label>
              <div className="v2-seg">
                {!dirType && <span className="sel-ph" style={{fontSize:'12.5px',fontWeight:600,padding:'7px',flex:'0 0 auto'}}>— выберите —</span>}
                <button type="button" className={dirType === 'income' ? 'on' : ''} onClick={function () { setDirType('income'); }}>Доход</button>
                <button type="button" className={dirType === 'expense' ? 'on' : ''} onClick={function () { setDirType('expense'); }}>Расход</button>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="v2-ghost" onClick={() => { setShowModal(false); setEditingId(null); }}>Отмена</button>
            <button type="submit" className="cat-add-btn">Сохранить</button>
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
