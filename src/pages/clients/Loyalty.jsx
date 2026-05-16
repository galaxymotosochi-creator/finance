import { useState, useEffect, useRef } from 'react';

const LD = [
  {id:'loyal',icon:'⭐',name:'Постоянный клиент',discount:5,condition:50000,desc:'Скидка 5% при покупках от 50 000₽',type:'accumulative',color:'#f59e0b',bg:'#fffbeb'},
  {id:'bonus',icon:'🎯',name:'Бонусная система',discount:0,condition:0,desc:'1₽ = 1 балл. 100 баллов = 100₽ скидки',type:'bonus',color:'#6366f1',bg:'#eef2ff'},
  {id:'birthday',icon:'🎂',name:'День рождения',discount:15,condition:0,desc:'Скидка 15% за 3 дня до и 3 после ДР',type:'birthday',color:'#ec4899',bg:'#fdf2f8'}
];

const LOY_EMOJIS = ['🎯','🏆','💎','🥇','🚀','🎁','💝','✨','🔥','👑','🛡️','🍀'];
const TYPE_LABELS = {constant:'Постоянная',accumulative:'📈 Накопительная',bonus:'🎯 Бонусная',birthday:'🎂 ДР-скидка'};

const LD_IDS = new Set(LD.map(x => x.id));
const getProgs = () => {
  const custom = JSON.parse(localStorage.getItem('loyalty88') || '[]');
  // Сначала LD, потом кастомные (кроме тех, что перекрывают LD — они уже учтены)
  const merged = LD.map(ld => {
    const override = custom.find(x => x.id === ld.id);
    return override || ld;
  });
  // Добавляем уникальные кастомные (с новыми id)
  custom.forEach(x => { if (!LD_IDS.has(x.id)) merged.push(x); });
  return merged;
};
const setProgs = (list) => localStorage.setItem('loyalty88', JSON.stringify(list));

export default function Loyalty() {
  const [allProgs, setAllProgs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const carRef = useRef(null);

  const [fIcon, setFIcon] = useState('🎯');
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState('constant');
  const [fDiscount, setFDiscount] = useState('');
  const [fCondition, setFCondition] = useState('');
  const [fDesc, setFDesc] = useState('');

  const load = () => setAllProgs(getProgs());
  useEffect(() => { load(); }, []);

  const selectCard = (i) => {
    setIdx(i);
    setAllProgs(getProgs());
    if (carRef.current) {
      const cards = carRef.current.querySelectorAll('.loy-card');
      if (cards[i]) cards[i].scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
    }
  };

  const scrollLoyalty = (d) => {
    const ap = getProgs();
    let i = idx + d;
    if (i < 0) i = ap.length - 1;
    if (i >= ap.length) i = 0;
    selectCard(i);
  };

  const openAdd = () => {
    setEditId(null); setFIcon('🎯'); setFName(''); setFType('constant');
    setFDiscount(''); setFCondition(''); setFDesc('');
    setShow(true);
  };

  const openEdit = (p) => {
    setEditId(p.id); setFIcon(p.icon); setFName(p.name);
    setFType(p.type||'constant'); setFDiscount(String(p.discount||''));
    setFCondition(String(p.condition||'')); setFDesc(p.desc||'');
    setShow(true);
  };

  const save = (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название');
    const list = JSON.parse(localStorage.getItem('loyalty88') || '[]');
    const obj = {
      id: editId || Date.now(), icon: fIcon, name: fName.trim(), type: fType,
      discount: parseFloat(fDiscount)||0, condition: parseFloat(fCondition)||0,
      desc: fDesc.trim() || ('Скидка '+(parseFloat(fDiscount)||'постоянная')+(parseFloat(fCondition)?' от '+ (parseFloat(fCondition)).toLocaleString()+'₽':'')),
      color:'#1983dd', bg:'#eaf5ff'
    };
    if (editId) {
      const idx = list.findIndex(x => x.id === editId);
      if (idx > -1) list[idx] = obj;
    } else {
      list.push(obj);
      setProgs(list);
    }
    setProgs(list);
    const newAll = getProgs();
    setAllProgs(newAll);
    if (newAll.length > 0) selectCard(0);
    setShow(false);
  };

  const remove = (id) => {
    const p = JSON.parse(localStorage.getItem('loyalty88') || '[]').find(x => x.id === id);
    if (!p || !confirm('Удалить программу "'+p.name+'"?')) return;
    setProgs(JSON.parse(localStorage.getItem('loyalty88') || '[]').filter(x => x.id !== id));
    setAllProgs(getProgs());
    setIdx(0);
  };

  const current = allProgs[idx];
  const ap = allProgs;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Программы лояльности</h1>
          <div className="sub">Системы скидок и поощрений для клиентов</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAdd}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {/* Карусель */}
      <div className="loy-carousel-wrap">
        <button className="loy-arrow loy-arrow-left" onClick={() => scrollLoyalty(-1)}>‹</button>
        <div className="loy-carousel" id="loyCarousel" ref={carRef}>
          {ap.map((p, i) => {
            const tl = {accumulative:'📈 Накопительная', bonus:'🎯 Бонусная', birthday:'🎂 ДР-скидка'};
            const badge = tl[p.type] || 'Постоянная';
            return (
              <div key={p.id || i} className={`loy-card${i === idx ? ' active' : ''}`} onClick={() => selectCard(i)}>
                <div className="loy-card-icon">{p.icon}</div>
                <div className="loy-card-title">{p.name}</div>
                <div className="loy-card-desc">{p.desc}</div>
                <span className="loy-card-badge" style={{background:p.bg,color:p.color}}>{badge}</span>
                <div className="loy-card-stat">
                  <span>💰 {p.discount ? p.discount+'%' : '—'}</span>
                  {p.condition ? <span>📋 от {p.condition.toLocaleString()}₽</span> : null}
                </div>
              </div>
            );
          })}
        </div>
        <button className="loy-arrow loy-arrow-right" onClick={() => scrollLoyalty(1)}>›</button>
      </div>

      {/* Точки */}
      <div className="loy-dots" id="loyDots">
        {ap.map((p, i) => (
          <div key={i} className={`loy-dot${i === idx ? ' active' : ''}`} onClick={() => selectCard(i)} />
        ))}
      </div>

      {/* Детали */}
      {current ? (
        <div className="loy-detail">
          <div id="loyDetailContent" style={{display:'block'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:'.75rem',marginBottom:'1rem'}}>
              <div style={{fontSize:'2.5rem'}}>{current.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'1.1rem',fontWeight:600}}>{current.name}</div>
                <div style={{fontSize:'.8rem',color:'var(--muted)'}}>{TYPE_LABELS[current.type] || 'Постоянная'}</div>
              </div>
              <div style={{position:'relative',flexShrink:0}}>
                <span style={{fontSize:'1.1rem',cursor:'pointer',color:'var(--muted)',padding:'4px',borderRadius:'4px'}}
                  onClick={(e) => {
                    e.stopPropagation();
                    const dd = e.currentTarget.nextElementSibling;
                    document.querySelectorAll('.promo-menu-dropdown').forEach(d => { if (d !== dd) d.style.display = 'none'; });
                    dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
                    if (dd.style.display === 'block') {
                      document.addEventListener('click', function handler(ev) {
                        if (!ev.target.closest('.promo-menu-dropdown') && ev.target !== e.currentTarget) {
                          dd.style.display = 'none';
                          document.removeEventListener('click', handler);
                        }
                      });
                    }
                  }}>⋮</span>
                <div className="promo-menu-dropdown" style={{display:'none'}}>
                  <div className="promo-menu-item" onClick={() => { openEdit(current); }}>Редактировать</div>
                  <div className="promo-menu-item" onClick={() => { remove(current.id); }} style={{color:'#dc2626'}}>Удалить</div>
                </div>
              </div>
            </div>
            <div className="loy-detail-grid">
              <div className="loy-detail-item"><div className="lbl">Скидка</div><div className="val">{current.discount ? current.discount+'%' : '—'}</div></div>
              <div className="loy-detail-item"><div className="lbl">Условие</div><div className="val">{current.condition ? 'от '+current.condition.toLocaleString()+'₽' : 'Без условий'}</div></div>
              <div className="loy-detail-item"><div className="lbl">Клиентов</div><div className="val">0</div></div>
              <div className="loy-detail-item"><div className="lbl">Выручка</div><div className="val">0₽</div></div>
            </div>
            <div style={{fontSize:'.82rem',color:'var(--body-color)',marginBottom:'.5rem'}}>{current.desc}</div>
          </div>
        </div>
      ) : (
        <div className="loy-detail">
          <div className="empty-products" style={{display:'block'}}>
            <div className="big-icon">⭐</div>
            <p>Выберите программу лояльности</p>
          </div>
        </div>
      )}

      {/* Модалка */}
      {show && (
        <div className="modal-overlay active" onClick={(e)=>{if(e.target.className==='modal-overlay active')setShow(false)}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <h2>{editId ? 'Редактировать программу' : 'Добавить программу'}</h2>
            <div className="sub">Настройте новую программу лояльности</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" value={fName} onChange={e=>setFName(e.target.value)} placeholder="Например: Партнёрская программа" required />
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
                  <option value="constant">📋 Постоянная — фиксированная скидка</option>
                  <option value="accumulative">📈 Накопительная — скидка растёт от суммы</option>
                  <option value="bonus">🎯 Бонусная — баллы за покупки</option>
                  <option value="birthday">🎂 ДР-скидка — автоскидка в день рождения</option>
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
                <textarea value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Например: Скидка 10% для постоянных партнёров" rows="2" />
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
                <button type="submit" className="btn btn-primary">{editId?'Сохранить':'✨ Создать программу'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
