import Modal from '../../components/Modal';
import SectionHelp from '../../components/SectionHelp';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';


const LD = [
  {id:'loyal',icon:'⭐',name:'Постоянный клиент',discount:5,condition:50000,desc:'Скидка 5% при покупках от 50 000₽',type:'accumulative',color:'#f59e0b',bg:'#fffbeb'},
  {id:'bonus',icon:'🎯',name:'Бонусная система',discount:0,condition:0,desc:'1₽ = 1 балл. 100 баллов = 100₽ скидки',type:'bonus',color:'#6366f1',bg:'#eef2ff'},
  {id:'birthday',icon:'🎂',name:'День рождения',discount:15,condition:0,desc:'Скидка 15% за 3 дня до и 3 после ДР',type:'birthday',color:'#ec4899',bg:'#fdf2f8'}
];

const LOY_EMOJIS = ['🎯','🏆','💎','🥇','🚀','🎁','💝','✨','🔥','👑','🛡️','🍀'];
const TYPE_LABELS = {constant:'Постоянная',accumulative:'📈 Накопительная',bonus:'🎯 Бонусная',birthday:'🎂 ДР-скидка'};

const LD_IDS = new Set(LD.map(x => x.id));

export default function Loyalty() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [allProgs, setAllProgs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  // Панель фильтров (эталон — Поставки)
  const [loySearch, setLoySearch] = useState('');
  const [loySearchFocus, setLoySearchFocus] = useState(false);
  const [loyType, setLoyType] = useState(() => new Set());
  const [loyTypeOpen, setLoyTypeOpen] = useState(false);
  // Подсказка скролла таблицы (эталон — Поставки)
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

  // Закрытие меню «Тип» по клику вне — как в «Клиентах»
  useEffect(() => {
    const handler = (e) => { if (!e.target.closest('.loy-type-wrap')) setLoyTypeOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Проверка подсказок скролла
  useEffect(() => {
    const t = setTimeout(checkTbl, 120);
    window.addEventListener('resize', checkTbl);
    return () => { clearTimeout(t); window.removeEventListener('resize', checkTbl); };
  });
  const carRef = useRef(null);

  const [fIcon, setFIcon] = useState('🎯');
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState('accumulative');
  const [fDiscount, setFDiscount] = useState('');
  const [fCondition, setFCondition] = useState('');
  const [fDesc, setFDesc] = useState('');

  const load = async () => {
    setLoading(true);
    // База: LD + кастомные из Supabase
    let custom = [];
    if (user) {
      try {
        const { data } = await supabase.from('loyalty_programs').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
        if (data) custom = data;
      } catch (e) { /* таблица еще не создана */ }
    }
    // Склеиваем: LD, потом кастомные (кроме тех, что перекрывают LD)
    const merged = LD.map(ld => {
      const override = custom.find(x => x.id === ld.id);
      return override || ld;
    });
    custom.forEach(x => { if (!LD_IDS.has(x.id)) merged.push(x); });
    setAllProgs(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'loyalty_programs', setList: setAllProgs, onSynced: load });

  const selectCard = (i) => {
    setIdx(i);
    if (carRef.current) {
      const cards = carRef.current.querySelectorAll('.loy-card');
      if (cards[i]) cards[i].scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
    }
  };

  const scrollLoyalty = (d) => {
    let i = idx + d;
    if (i < 0) i = allProgs.length - 1;
    if (i >= allProgs.length) i = 0;
    selectCard(i);
  };

  const openAdd = () => {
    setEditId(null); setFIcon('🎯'); setFName(''); setFType('accumulative');
    setFDiscount(''); setFCondition(''); setFDesc('');
    setShow(true);
  };

  const openEdit = (p) => {
    setEditId(p.id); setFIcon(p.icon); setFName(p.name);
    setFType(p.type||'accumulative'); setFDiscount(String(p.discount||''));
    setFCondition(String(p.condition||'')); setFDesc(p.desc||'');
    setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название');
    if (!user) return alert('Ошибка: пользователь не авторизован');
    try {
      const obj = {
        user_id: user.id, name: fName.trim(), type: fType,
        discount: parseFloat(fDiscount)||0, condition: parseFloat(fCondition)||0,
        icon: fIcon,
        description: fDesc.trim() || ('Скидка '+(parseFloat(fDiscount)||'постоянная')+(parseFloat(fCondition)?' от '+ (parseFloat(fCondition)).toLocaleString()+' ₽':'')),
        color:'#1983dd', bg:'#eaf5ff'
      };
      let queued = false;
      if (editId) {
        const res = await supabase.from('loyalty_programs').update(obj).eq('id', editId);
        if (res.error) throw res.error;
        queued = res.queued;
      } else {
        const res = await supabase.from('loyalty_programs').insert(obj);
        if (res.error) throw res.error;
        queued = res.queued;
      }
      if (!queued) await load();
      if (allProgs.length > 0) selectCard(0);
      setShow(false);
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
  };

  const remove = async (id) => {
    if (LD_IDS.has(id)) { alert('Встроенную программу нельзя удалить'); return; }
    if (!confirm('Удалить программу "'+(allProgs.find(p=>p.id===id)?.name||'')+'"?')) return;
    try {
      const { error, queued } = await supabase.from('loyalty_programs').delete().eq('id', id);
      if (error) throw error;
      if (!queued) await load();
      setIdx(0);
    } catch (err) { alert('Ошибка удаления: ' + err.message); }
  };

  const current = allProgs[idx];
  const ap = allProgs;
  const loyFiltered = ap.filter(p => {
    if (loyType.size > 0 && !loyType.has(p.type)) return false;
    if (loySearch) {
      const q = loySearch.toLowerCase();
      const hay = [p.name, p.desc, p.description].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });


  if (loading) return <CenterSpinner />;

  return (
    <>
      <div className="sk-bar">
        <div className="grow">
          <div style={{display:'flex',alignItems:'center'}}>
            <h1>Программы лояльности</h1>
            <SectionHelp
              title="Раздел «Программы лояльности»"
              intro="Программы лояльности — это скидки и поощрения для клиентов. Чем больше клиент покупает, тем выгоднее ему с вами работать."
              faq={[
                { q: 'Как создать программу?', a: (
                  <div>Нажмите <b>«Добавить»</b> справа вверху. Укажите название, иконку, тип программы, размер скидки и порог суммы.</div>
                ) },
                { q: 'Какие типы программ есть?', a: (
                  <ul>
                    <li style={{marginBottom:'.4rem'}}><b>Накопительная</b> — скидка растёт от суммы покупок.</li>
                    <li style={{marginBottom:'.4rem'}}><b>Бонусная</b> — за покупки начисляются баллы, ими можно платить.</li>
                    <li><b>ДР-скидка</b> — автоматическая скидка в день рождения клиента.</li>
                  </ul>
                ) },
                { q: 'Что такое «Порог»?', a: (
                  <div>Минимальная сумма покупок, с которой начинает действовать скидка. <b>0</b> — без порога, скидка действует всегда.</div>
                ) },
                { q: 'Как программа применяется к клиенту?', a: (
                  <div>В карточке клиента в колонке <b>«Лояльность»</b> видно, какая программа ему назначена. Режим <b>«Авто»</b> подбирает лучшую программу по сумме покупок.</div>
                ) },
                { q: 'Как изменить или удалить программу?', a: (
                  <div>Нажмите <b>«⋯»</b> в строке — там <b>Редактировать</b> и <b>Удалить</b>.</div>
                ) },
              ]}
            />
          </div>
          <div className="sub" style={{maxWidth:'210px'}}>Системы скидок и поощрений для клиентов</div>
        </div>
        <div className="***">
          <div className="sk-dd-wrap" style={{marginLeft:'auto'}}>
            <button type="button" className="sk-dd-btn" onClick={openAdd}>Добавить</button>
          </div>
        </div>
      </div>

      {/* Панель фильтров — одна планка, эталон «Поставки» */}
      <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap',border:'1px solid '+(loySearchFocus?'#111':'#e2e2e6'),borderRadius:'999px',padding:'5px 6px 5px 14px',background:'#fff',boxShadow:loySearchFocus?'0 2px 10px rgba(0,0,0,.12)':'0 1px 3px rgba(0,0,0,.05)',transition:'border-color .15s, box-shadow .15s'}}>
        <span style={{display:'flex',color:loySearchFocus?'#111':'#999',transition:'color .15s'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </span>
        <input type="text" placeholder="Поиск…" value={loySearch} onChange={e => setLoySearch(e.target.value)}
          onFocus={()=>setLoySearchFocus(true)} onBlur={()=>setLoySearchFocus(false)}
          style={{border:'none',outline:'none',flex:'1 1 60px',minWidth:0,fontSize:'.78rem',fontFamily:'var(--font)',background:'none',padding:0}} />
        <span style={{width:'1px',height:'20px',background:'#eef1f6',flexShrink:0}}></span>
        <div className="loy-type-wrap" style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <button type="button" style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={e => { e.stopPropagation(); setLoyTypeOpen(function(v){ return !v; }); }}>
            {loyType.size > 0 ? 'Тип · ' + loyType.size : 'Тип'}
            <span className="car-tri">▾</span>
          </button>
          {loyTypeOpen && (
            <div onClick={e => e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'230px',padding:'.4rem',zIndex:100}}>
              {[{v:'accumulative',label:'Накопительная'},{v:'bonus',label:'Бонусная'},{v:'birthday',label:'ДР-скидка'},{v:'constant',label:'Постоянная'}].map(o => {
                const isActive = loyType.has(o.v);
                return (
                  <div key={o.v} onClick={() => setLoyType(prev => { const n = new Set(prev); if (n.has(o.v)) n.delete(o.v); else n.add(o.v); return n; })}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                    {o.label}
                  </div>
                );
              })}
              {loyType.size > 0 && (
                <div style={{borderTop:'1px solid rgba(29,120,252,.14)',marginTop:'.25rem',paddingTop:'.35rem'}}>
                  <div onClick={() => setLoyType(new Set())}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:'#dc2626',fontWeight:600}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#fecaca',flexShrink:0}}></span>
                    Очистить
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sk-tablewrap" style={{flex:'none',minHeight:'auto'}}>
        <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
        <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}}></div>
        <div className="sk-card" style={{position:'relative',overflowX:'auto',WebkitOverflowScrolling:'touch'}} ref={tblElRef} onScroll={onTblScroll}>
          <table className="sk-table loy-table">
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>Программа</th>
                <th style={{textAlign:'left'}}>Тип</th>
                <th style={{textAlign:'left'}}>Скидка</th>
                <th style={{textAlign:'left'}}>Условие</th>
                <th style={{textAlign:'left'}}>Клиентов</th>
                <th style={{textAlign:'left'}}>Выручка</th>
                <th style={{width:'70px'}}></th>
              </tr>
            </thead>
            <tbody>
              {loyFiltered.length === 0 ? (
                <tr><td colSpan="7"><div className="sk-empty"><p>Программ пока нет</p><p>Создайте первую программу лояльности для клиентов</p></div></td></tr>
              ) : loyFiltered.map(p => {
                const badge = TYPE_LABELS[p.type] || 'Постоянная';
                return (
                  <tr key={p.id}>
                    <td style={{textAlign:'left'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'.6rem'}}>
                        <span style={{fontSize:'1.15rem',flexShrink:0}}>{p.icon}</span>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:600,color:'#111'}}>{p.name}</div>
                          <div style={{fontSize:'.72rem',color:'#5b6472',marginTop:'1px'}}>{p.desc || p.description || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{textAlign:'left'}}>
                      <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.72rem',fontWeight:700,background:(p.bg||'#eef2ff'),color:(p.color||'#4f46e5'),whiteSpace:'nowrap'}}>{badge}</span>
                    </td>
                    <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}>{p.discount ? p.discount+'%' : '—'}</td>
                    <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}>{p.condition ? 'от '+p.condition.toLocaleString()+' '+cur : 'Без условий'}</td>
                    <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}>0</td>
                    <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}>0 {cur}</td>
                    <td style={{textAlign:'left',whiteSpace:'nowrap'}}>
                      <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                        <button className="sk-more" onClick={(e) => {
                          e.stopPropagation();
                          const dd = e.currentTarget.nextElementSibling;
                          document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                          dd.classList.toggle('open');var _r=dd.getBoundingClientRect();if(_r.bottom>window.innerHeight)dd.classList.add('up');else dd.classList.remove('up');
                        }}>⋯</button>
                        <div className="prod-dropdown">
                          <button onClick={() => openEdit(p)}>Редактировать</button>
                          <button onClick={() => remove(p.id)} style={{color:'#dc3545'}}>Удалить</button>
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

      {/* Модалка */}
      <Modal open={show} onClose={()=>setShow(false)} title={editId ? 'Редактировать программу' : 'Добавить программу'} subtitle="Создание и настройка условий лояльности" width="wide">
        <form onSubmit={save}>
          <div className="form-group">
            <label>Название</label>
            <input type="text" value={fName} onChange={e=>setFName(e.target.value)} placeholder="Например: Партнерская программа" required />
          </div>
          <div className="form-group">
            <label>Иконка (эмодзи)</label>
            <div style={{display:'flex',gap:'.35rem',flexWrap:'wrap'}}>
              {LOY_EMOJIS.map(e => (
                <span key={e} className={`loy-emoji${fIcon === e ? ' selected' : ''}`}
                  onClick={() => setFIcon(e)}>{e}</span>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Тип программы</label>
            <select value={fType} onChange={e=>setFType(e.target.value)}>
              <option value="accumulative">Накопительная — скидка растет от суммы</option>
              <option value="bonus">Бонусная — баллы за покупки</option>
              <option value="birthday">ДР-скидка — автоскидка в день рождения</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Скидка (%)</label>
              <input type="number" value={fDiscount} onChange={e=>setFDiscount(e.target.value)} placeholder="10" min="0" max="100" />
            </div>
            <div className="form-group">
              <label>Порог (₽)</label>
              <input type="number" value={fCondition} onChange={e=>setFCondition(e.target.value)} placeholder="0 — без порога" min="0" />
            </div>
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Например: Скидка 10% для постоянных партнеров" rows="2" />
          </div>
          <div className="loy-modal-preview" id="loyPreview">
            <div style={{fontSize:'.7rem',color:'var(--muted)',textTransform:'uppercase',fontWeight:600,marginBottom:'.35rem'}}>Предпросмотр карточки</div>
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',background:'#f8f9fa',borderRadius:'.75rem',padding:'.75rem'}}>
              <div id="loyPreviewIcon" style={{fontSize:'1.8rem'}}>{fIcon}</div>
              <div>
                <div id="loyPreviewName" style={{fontWeight:600,fontSize:'.85rem'}}>{fName || 'Новая программа'}</div>
                <div id="loyPreviewDesc" style={{fontSize:'.75rem',color:'var(--muted)'}}>{fDiscount ? 'Скидка '+fDiscount+'%' : 'Без скидки'}</div>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-dark">{editId?'Сохранить':'✨ Создать программу'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
