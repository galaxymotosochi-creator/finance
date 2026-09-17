import Modal from '../../components/Modal';
import SectionHelp from '../../components/SectionHelp';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';


const CONTACT_ICONS = { telegram:'📱', whatsapp:'💬', max:'🧑‍💼' };
const CONTACT_LABELS = { telegram:'Telegram', whatsapp:'WhatsApp', max:'MAX' };

export default function Suppliers() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [suppliers, setSuppliersState] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fName, setFName] = useState('');
  const [fContact, setFContact] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fMethod, setFMethod] = useState('');
  // Панель фильтров (эталон — Поставки)
  const [supSearch, setSupSearch] = useState('');
  const [supSearchFocus, setSupSearchFocus] = useState(false);
  const [supNames, setSupNames] = useState(() => new Set());
  const [supNamesOpen, setSupNamesOpen] = useState(false);
  const [supPeriodOpen, setSupPeriodOpen] = useState(false);
  const [supPeriod, setSupPeriod] = useState('all');
  const [supPeriodLabel, setSupPeriodLabel] = useState('Все время');
  const [supPeriodFrom, setSupPeriodFrom] = useState('');
  const [supPeriodTo, setSupPeriodTo] = useState('');
  // Подсказка скролла таблицы
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
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  // Открытие одного меню закрывает другое — как в «Чеках»
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.supname-dd-wrap')) setSupNamesOpen(false);
      if (!e.target.closest('.supp-period-wrap')) setSupPeriodOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Проверка подсказок скролла
  useEffect(() => {
    const t = setTimeout(checkTbl, 120);
    window.addEventListener('resize', checkTbl);
    return () => { clearTimeout(t); window.removeEventListener('resize', checkTbl); };
  });
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').eq('user_id', user.id).order('created_at');
    if (data) setSuppliersState(data);
    // Поставки — из БД (раньше читались из localStorage и всегда были пустыми)
    const { data: supData } = await supabase.from('supplies').select('*').eq('user_id', user.id);
    if (supData) setSupplies(supData);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'suppliers', setList: setSuppliersState, onSynced: load });

  useEffect(() => {
    if (!user || suppliers.length > 0) return;
    const old = JSON.parse(localStorage.getItem('suppliers88') || '[]');
    if (old.length > 0) {
      old.forEach(async (s) => {
        await supabase.from('suppliers').insert({
          id: s.id, user_id: user.id, name: s.name, contact: s.contact || '',
          phone: s.phone || '', inn: '', address: '', comment: s.comment || '',
          created_at: new Date().toISOString()
        });
      });
      localStorage.removeItem('suppliers88');
      load();
    }
  }, [user, suppliers.length]);

  const openAdd = () => {
    setEditId(null);
    setFName(''); setFContact(''); setFPhone(''); setFMethod('');
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditId(s.id); setFName(s.name); setFContact(s.contact||'');
    setFPhone(s.phone||''); setFMethod(s.contact_method||'');
    setShowModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название');
    const obj = { name: fName.trim(), contact: fContact.trim(), phone: fPhone.trim(), contact_method: fMethod };
    let queued = false;
    if (editId) {
      const res = await supabase.from('suppliers').update(obj).eq('id', editId);
      if (res.error) return alert(res.error.message);
      queued = res.queued;
    } else {
      const res = await supabase.from('suppliers').insert({ ...obj, id: Date.now(), user_id: user.id });
      if (res.error) return alert(res.error.message);
      queued = res.queued;
    }
    if (!queued) await load(); setShowModal(false);
  };

  const remove = async (id) => {
    if (!confirm('Удалить поставщика?')) return;
    const { error, queued } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) return alert(error.message);
    if (!queued) await load();
  };

  if (loading) return <CenterSpinner />;

  return (
    <>
      <div className="sk-bar">
        <div className="grow">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1>Поставщики</h1>
            <SectionHelp
              title="Раздел «Поставщики»"
              intro="Поставщики — база контрагентов, у которых вы закупаете товары. Здесь видно контакт, способ связи, количество поставок и общую сумму закупок."
              faq={[
                { q: 'Как добавить поставщика?', a: (
                  <div>Нажмите <b>«Добавить поставщика»</b> справа вверху. Укажите <b>название</b> — оно обязательно. Контакт, телефон и способ связи можно заполнить позже.</div>
                ) },
                { q: 'Что показывает колонка «Поставок»?', a: (
                  <div>Сколько <b>поставок</b> оформлено у этого поставщика. Считается по совпадению названия в разделе «Поставки».</div>
                ) },
                { q: 'Что показывает колонка «Сумма»?', a: (
                  <div>Общая <b>сумма закупок</b> у этого поставщика по всем поставкам.</div>
                ) },
                { q: 'Какие способы связи есть?', a: (
                  <div>Телефон, WhatsApp, Telegram, e-mail и другие — выбираются при добавлении поставщика.</div>
                ) },
                { q: 'Как изменить или удалить поставщика?', a: (
                  <div>Нажмите <b>«⋯»</b> в строке — там <b>Редактировать</b> и <b>Удалить</b>.</div>
                ) },
                { q: 'Как искать поставщиков?', a: (
                  <div>Под шапкой — <b>поиск</b> по названию, контакту и телефону.</div>
                ) },
              ]}
            />
          </div>
          <div className="sub">База контрагентов и история сотрудничества</div>
        </div>
        <div className="***">
          <button type="button" className="sk-dd-btn" style={{animation:'skpulse 2s ease-in-out infinite'}} onClick={openAdd}>Добавить поставщика</button>
        </div>
      </div>

      {/* Панель фильтров — одна планка, эталон «Поставки» */}
      <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap',border:'1px solid '+(supSearchFocus?'#111':'#e2e2e6'),borderRadius:'999px',padding:'5px 6px 5px 14px',background:'#fff',boxShadow:supSearchFocus?'0 2px 10px rgba(0,0,0,.12)':'0 1px 3px rgba(0,0,0,.05)',transition:'border-color .15s, box-shadow .15s'}}>
        <span style={{display:'flex',color:supSearchFocus?'#111':'#999',transition:'color .15s'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </span>
        <input type="text" placeholder="Поиск…" value={supSearch} onChange={e => setSupSearch(e.target.value)}
          onFocus={()=>setSupSearchFocus(true)} onBlur={()=>setSupSearchFocus(false)}
          style={{border:'none',outline:'none',flex:'1 1 60px',minWidth:0,fontSize:'.78rem',fontFamily:'var(--font)',background:'none',padding:0}} />
        <span style={{width:'1px',height:'20px',background:'#eef1f6',flexShrink:0}}></span>

        <div className="supname-dd-wrap" style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <button type="button" style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={e => { e.stopPropagation(); setSupPeriodOpen(false); setSupNamesOpen(function(v){ return !v; }); }}>
            {supNames.size > 0 ? 'Поставщик · ' + supNames.size : 'Поставщик'}
            <span className="car-tri">▾</span>
          </button>
          {supNamesOpen && (
            <div onClick={e => e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',left:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'220px',maxHeight:'280px',overflowY:'auto',padding:'.4rem',zIndex:100}}>
              {suppliers.map(x => x.name).filter(Boolean).sort().map(nm => {
                const isActive = supNames.has(nm);
                return (
                  <div key={nm} onClick={() => setSupNames(prev => { const n = new Set(prev); if (n.has(nm)) n.delete(nm); else n.add(nm); return n; })}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                    {nm}
                  </div>
                );
              })}
              {suppliers.length === 0 && <div style={{padding:'.5rem .55rem',fontSize:'.78rem',color:'#8a93a3'}}>Поставщиков пока нет — добавьте первого</div>}
              {supNames.size > 0 && (
                <div style={{borderTop:'1px solid rgba(29,120,252,.14)',marginTop:'.25rem',paddingTop:'.35rem'}}>
                  <div onClick={() => setSupNames(new Set())}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:'#dc2626',fontWeight:600}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#fecaca',flexShrink:0}}></span>
                    Очистить
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="supp-period-wrap" style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <button style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={e => { e.stopPropagation(); setSupNamesOpen(false); setSupPeriodOpen(function(v){ return !v; }); }}>
            {supPeriodLabel}
            <span className="car-tri">▾</span>
          </button>
          {supPeriodOpen && (
            <div onClick={e => e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'210px',padding:'.4rem',zIndex:100}}>
              {[{key:'all',label:'Все время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Эта неделя'},{key:'month',label:'Этот месяц'}].map(p2 => {
                const isActive = supPeriod === p2.key;
                return (
                  <div key={p2.key} onClick={() => { setSupPeriod(p2.key); setSupPeriodLabel(p2.label); setSupPeriodOpen(false); }}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                    {p2.label}
                  </div>
                );
              })}
              <div style={{borderTop:'1px solid rgba(29,120,252,.14)',paddingTop:'.4rem',marginTop:'.25rem'}}>
                <div style={{fontSize:'.72rem',color:'#5b6472',padding:'.2rem .55rem',marginBottom:'.3rem',fontWeight:600}}>Свой период</div>
                <div style={{display:'flex',gap:'.3rem',padding:'.2rem .55rem'}}>
                  <input type="date" value={supPeriodFrom} onChange={e => setSupPeriodFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                  <input type="date" value={supPeriodTo} onChange={e => setSupPeriodTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                </div>
                <div style={{padding:'.3rem .55rem 0',textAlign:'center'}}>
                  <button type="button" onClick={() => { setSupPeriod('custom'); setSupPeriodLabel('Свой период'); setSupPeriodOpen(false); }}
                    className="sk-dd-btn" style={{padding:'.5rem 1.1rem',animation:'none'}}>Применить</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="***" style={{flex:'none',minHeight:'auto'}}>
        <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
        <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}}></div>
        <div className="sk-card" style={{position:'relative',overflowX:'auto',WebkitOverflowScrolling:'touch'}} ref={tblElRef} onScroll={onTblScroll}>
        <table className="sk-table sup-table">
          <thead id="supColHeaders">
            <tr>
              <th style={{textAlign:'left'}}>Название</th>
              <th style={{textAlign:'left'}}>Контакт</th>
              <th style={{textAlign:'left'}}>Телефон</th>
              <th style={{textAlign:'left'}}>Способ связи</th>
              <th style={{textAlign:'left'}}>Поставок</th>
              <th style={{textAlign:'left'}}>Сумма</th>
              <th style={{width:'130px',textAlign:'left'}}></th>
            </tr>
          </thead>
          <tbody id="supplierTableBody">
            {suppliers.length === 0 ? (
              <tr><td colSpan="7"><div className="sk-empty"><p>Список поставщиков пуст</p><p>Внесите первого контрагента, чтобы начать работу</p></div></td></tr>
            ) : suppliers.filter(s => {
              if (supNames.size > 0 && !supNames.has(s.name || '')) return false;
              if (supSearch) {
                const q = supSearch.toLowerCase();
                const hay = [s.name, s.contact, s.phone, s.contact_method].filter(Boolean).join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
              }
              if (supPeriod !== 'all') {
                const d = new Date(s.created_at || Date.now()); const now = new Date();
                const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (supPeriod === 'today' && d < day) return false;
                if (supPeriod === 'yesterday') { const y = new Date(day); y.setDate(y.getDate()-1); if (d < y || d >= day) return false; }
                if (supPeriod === 'week') { const wk = new Date(day); wk.setDate(wk.getDate()-((wk.getDay()+6)%7)); if (d < wk) return false; }
                if (supPeriod === 'month') { const m = new Date(now.getFullYear(), now.getMonth(), 1); if (d < m) return false; }
                if (supPeriod === 'custom') {
                  if (supPeriodFrom && d < new Date(supPeriodFrom)) return false;
                  if (supPeriodTo) { const t = new Date(supPeriodTo); t.setHours(23,59,59,999); if (d > t) return false; }
                }
              }
              return true;
            }).map(s => {
              const supSupplies = supplies.filter(sp => (sp.supplier_name || sp.supplierName) === s.name);
              const supplyCount = supSupplies.length;
              const totalSum = supSupplies.reduce((sum, sp) => sum + (Number(sp.total) || 0), 0);
              const icon = CONTACT_ICONS[s.contact_method] || '📞';
              const label = CONTACT_LABELS[s.contact_method] || s.contact_method || '—';
              return (
                <tr key={s.id}>
                  <td style={{textAlign:'left',whiteSpace:'nowrap'}}><div className="prod-name">{s.name}{s.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</div></td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#222'}}>{s.contact||'—'}</td>
                  <td style={{textAlign:'left',color:'#222'}}>{s.phone||'—'}</td>
                  <td style={{textAlign:'left',color:'#222'}}><span className="prod-cat">{label}</span></td>
                  <td style={{textAlign:'left',color:'#222'}}>{supplyCount}</td>
                  <td style={{textAlign:'left',color:'#222'}}><span className="num">{totalSum.toLocaleString()} {cur}</span></td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={(e) => {
                        e.stopPropagation();
                        const dd = e.currentTarget.nextElementSibling;
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                        dd.classList.toggle('open');var _r=dd.getBoundingClientRect();if(_r.bottom>window.innerHeight)dd.classList.add('up');else dd.classList.remove('up');
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={() => openEdit(s)}>Редактировать</button>
                        <button onClick={() => remove(s.id)} style={{color:'#dc3545'}}>Удалить</button>
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
      <Modal open={showModal} onClose={()=>setShowModal(false)} title={editId?'Редактировать поставщика':'Добавить поставщика'} subtitle="Создание карточки нового контрагента" width="medium">
        <form onSubmit={save}>
          <div className="form-group">
            <label>Название</label>
            <input type="text" value={fName} onChange={e=>setFName(e.target.value)} placeholder="Например, ООО СтройМаркет" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Контактное лицо</label>
              <input type="text" value={fContact} onChange={e=>setFContact(e.target.value)} placeholder="Иван Иванов" />
            </div>
            <div className="form-group">
              <label>Телефон</label>
              <input type="text" value={fPhone} onChange={e=>setFPhone(e.target.value)} placeholder="+7 (999) 123-45-67" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Способ связи</label>
              <select value={fMethod} onChange={e=>setFMethod(e.target.value)}>
                <option value="">— нет —</option>
                <option value="telegram">📱 Telegram</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="max">🧑‍💼 MAX</option>
              </select>
            </div>
            <div className="form-group"></div>
          </div>
          <div className="modal-actions">
            {editId && <button type="button" className="btn btn-outline" onClick={() => { const id = editId; setShowModal(false); remove(id); }}>Удалить</button>}
            <button type="submit" className="sk-dd-btn" style={{animation:'none'}}>{editId?'Сохранить':'Добавить'}</button>
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
