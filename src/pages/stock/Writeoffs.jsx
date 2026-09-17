import Modal from '../../components/Modal';
import SectionHelp from '../../components/SectionHelp';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { fmtDate } from '../../lib/dates';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';


const REASONS = ['Списание','Брак','Потеря','Порча','Окончание срока','Инвентаризация','Прочее'];

export default function Writeoffs() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  // Открытие одного меню закрывает другое — как в «Чеках»
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.wo-dd-wrap')) setWoReasonOpen(false);
      if (!e.target.closest('.wo-period-wrap')) setWoPeriodOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Проверка подсказок скролла после отрисовки и при изменении размера окна
  useEffect(() => {
    const t = setTimeout(checkTbl, 120);
    window.addEventListener('resize', checkTbl);
    return () => { clearTimeout(t); window.removeEventListener('resize', checkTbl); };
  });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fProd, setFProd] = useState('');
  const [fQty, setFQty] = useState('1');
  const [fReason, setFReason] = useState('Списание');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  // Панель фильтров (эталон — Поставки)
  const [woSearch, setWoSearch] = useState('');
  const [woSearchFocus, setWoSearchFocus] = useState(false);
  const [woReasons, setWoReasons] = useState(() => new Set());
  const [woReasonOpen, setWoReasonOpen] = useState(false);
  const [woPeriodOpen, setWoPeriodOpen] = useState(false);
  const [woPeriod, setWoPeriod] = useState('all');
  const [woPeriodLabel, setWoPeriodLabel] = useState('Все время');
  const [woPeriodFrom, setWoPeriodFrom] = useState('');
  const [woPeriodTo, setWoPeriodTo] = useState('');
  // Подсказка скролла таблицы (эталон — Поставки/Категории)
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
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const load = async () => {
    setLoading(true);
    try {
      const [wRes, pRes] = await Promise.all([
        supabase.from('writeoffs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);
      if (wRes.error) throw wRes.error;
      if (wRes.data) setList(wRes.data);
      if (pRes.data) setProducts(pRes.data);
    } catch (e) {
      alert('Ошибка загрузки списаний: ' + (e.message || 'неизвестная ошибка'));
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'writeoffs', setList: setList, onSynced: load });

  useEffect(() => {
    if (!user || list.length > 0) return;
    const old = JSON.parse(localStorage.getItem('writeoffs88') || '[]');
    if (old.length > 0) {
      old.forEach(async (w) => {
        await supabase.from('writeoffs').insert({ id: w.id, user_id: user.id, product_id: w.prodId || 0, quantity: w.qty || 1, reason: w.reason || 'Списание', date: w.date || new Date().toISOString().split('T')[0] });
      });
      localStorage.removeItem('writeoffs88');
      load();
    }
  }, [user, list.length]);

  const openAdd = () => {
    setEditId(null); setFProd(''); setFQty('1'); setFReason('Списание');
    setFDate(new Date().toISOString().split('T')[0]); setShow(true);
  };

  const getStockData = async (prodId) => {
    const [supRes, woRes, initRes] = await Promise.all([
      supabase.from('supplies').select('items').eq('user_id', user.id),
      supabase.from('writeoffs').select('quantity,product_id').eq('user_id', user.id),
      supabase.from('initial_stocks').select('*').eq('user_id', user.id).single()
    ]);
    let inQty = 0, inCost = 0;
    (supRes.data || []).forEach(s => (s.items || []).forEach(it => {
      if (it.prodId == prodId) { inQty += it.qty || 0; inCost += (it.cost || 0) * (it.qty || 0); }
    }));
    // Начальные остатки тоже учитываем (иначе товар только из них — «на складе 0»)
    const initial = initRes.data;
    if (initial && initial.done && initial.items && initial.items[prodId]) {
      const q = parseInt(initial.items[prodId]) || 0;
      const c = (initial.costs && parseInt(initial.costs[prodId])) || 0;
      inQty += q; inCost += c * q;
    }
    let outQty = 0;
    // quantity из БД приходит строкой (numeric) — без Number будет конкатенация («3»+«2»=«32»)
    (woRes.data || []).forEach(w => { if (w.product_id == prodId) outQty += Number(w.quantity) || 0; });
    return { stock: inQty - outQty, avgCost: inQty > 0 ? Math.round(inCost / inQty) : 0 };
  };

  const save = async (e) => {
    e.preventDefault();
    const prodId = parseInt(fProd);
    if (!prodId) return alert('Выберите товар');
    const qty = parseInt(fQty) || 1;
    if (qty <= 0) return alert('Введите количество');
    const prod = products.find(p => p.id === prodId);

    // Проверяем остаток (с учётом текущего списания при редактировании)
    const data = await getStockData(prodId);
    const curQty = editId ? (Number(list.find(x => x.id === editId)?.quantity) || 0) : 0;
    const stock = data.stock + curQty;
    if (stock < qty) {
      setToast('На складе ' + Math.max(0, data.stock) + ' шт. Не удастся списать больше, чем есть на складе!');
      return;
    }

    // Себестоимость — средняя из поставок/начальных остатков (раньше бралась розничная цена!)
    const cost = data.avgCost || 0;

    let queued = false;
    if (editId) {
      const res = await supabase.from('writeoffs').update({ product_id: prodId, quantity: qty, cost, reason: fReason, date: fDate }).eq('id', editId);
      if (res.error) return alert('Ошибка: ' + res.error.message);
      queued = res.queued;
    } else {
      const res = await supabase.from('writeoffs').insert({ id: Date.now(), user_id: user.id, product_id: prodId, quantity: qty, cost, reason: fReason, date: fDate });
      if (res.error) return alert('Ошибка: ' + res.error.message);
      queued = res.queued;
    }
    if (!queued) await load(); setShow(false);
  };

  const remove = async (id) => {
    if (!confirm('Удалить списание?')) return;
    const { error, queued } = await supabase.from('writeoffs').delete().eq('id', id);
    if (error) return alert('Ошибка удаления: ' + error.message);
    if (!queued) await load();
  };

  if (loading) return <CenterSpinner />;

  return (
    <>
      <div className="sk-bar">
        <div className="grow">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1>Списания</h1>
            <SectionHelp
              title="Раздел «Списания»"
              intro="Списания — выбытие товаров со склада: брак, порча, потери. Здесь видно, что и сколько списали, по какой причине и на какую сумму."
              faq={[
                { q: 'Как списать товар?', a: (
                  <div>Нажмите <b>«Списать товар»</b> справа вверху. Выберите <b>товар</b>, укажите <b>количество</b>, <b>причину</b> и дату.</div>
                ) },
                { q: 'Какие причины списания есть?', a: (
                  <ul>
                    <li style={{marginBottom:'.4rem'}}><b>Списание</b> — обычное выбытие.</li>
                    <li style={{marginBottom:'.4rem'}}><b>Брак</b> — товар повреждён.</li>
                    <li style={{marginBottom:'.4rem'}}><b>Потеря</b> и <b>Порча</b> — недостача или порча.</li>
                    <li style={{marginBottom:'.4rem'}}><b>Окончание срока</b> — истёк срок годности.</li>
                    <li style={{marginBottom:'.4rem'}}><b>Инвентаризация</b> — расхождение по факту.</li>
                    <li><b>Прочее</b> — другая причина.</li>
                  </ul>
                ) },
                { q: 'Списывается ли себестоимость?', a: (
                  <div>Да. При списании <b>себестоимость уменьшается</b> вместе с количеством, поэтому оставшиеся товары не «дорожают».</div>
                ) },
                { q: 'Как найти нужное списание?', a: (
                  <div>Под шапкой — <b>поиск</b> по товару и <b>фильтры</b> по причине и периоду.</div>
                ) },
                { q: 'Как изменить или удалить списание?', a: (
                  <div>Нажмите <b>«⋯»</b> в строке — там <b>Редактировать</b> и <b>Удалить</b>.</div>
                ) },
              ]}
            />
          </div>
          <div className="sub">Учет брака, порчи и потерь товаров на складе</div>
        </div>
        <div className="***">
          <button type="button" className="sk-dd-btn" style={{animation:'skpulse 2s ease-in-out infinite'}} onClick={openAdd}>Списать товар</button>
        </div>
      </div>

      {/* Панель фильтров — одна планка, эталон «Поставки» */}
      <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap',border:'1px solid '+(woSearchFocus?'#111':'#e2e2e6'),borderRadius:'999px',padding:'5px 6px 5px 14px',background:'#fff',boxShadow:woSearchFocus?'0 2px 10px rgba(0,0,0,.12)':'0 1px 3px rgba(0,0,0,.05)',transition:'border-color .15s, box-shadow .15s'}}>
        <span style={{display:'flex',color:woSearchFocus?'#111':'#999',transition:'color .15s'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </span>
        <input type="text" placeholder="Поиск…" value={woSearch} onChange={e => setWoSearch(e.target.value)}
          onFocus={()=>setWoSearchFocus(true)} onBlur={()=>setWoSearchFocus(false)}
          style={{border:'none',outline:'none',flex:'1 1 60px',minWidth:0,fontSize:'.78rem',fontFamily:'var(--font)',background:'none',padding:0}} />
        <span style={{width:'1px',height:'20px',background:'#eef1f6',flexShrink:0}}></span>

        <div className="wo-dd-wrap" style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <button type="button" style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={e => { e.stopPropagation(); setWoPeriodOpen(false); setWoReasonOpen(function(v){ return !v; }); }}>
            {woReasons.size > 0 ? 'Причина · ' + woReasons.size : 'Причина'}
            <span className="car-tri">▾</span>
          </button>
          {woReasonOpen && (
            <div onClick={e => e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',left:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'210px',maxHeight:'280px',overflowY:'auto',padding:'.4rem',zIndex:100}}>
              {REASONS.map(nm => {
                const isActive = woReasons.has(nm);
                return (
                  <div key={nm} onClick={() => setWoReasons(prev => { const n = new Set(prev); if (n.has(nm)) n.delete(nm); else n.add(nm); return n; })}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                    {nm}
                  </div>
                );
              })}
              {woReasons.size > 0 && (
                <div style={{borderTop:'1px solid rgba(29,120,252,.14)',marginTop:'.25rem',paddingTop:'.35rem'}}>
                  <div onClick={() => setWoReasons(new Set())}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:'#dc2626',fontWeight:600}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#fecaca',flexShrink:0}}></span>
                    Очистить
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="wo-period-wrap" style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <button style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={e => { e.stopPropagation(); setWoReasonOpen(false); setWoPeriodOpen(function(v){ return !v; }); }}>
            {woPeriodLabel}
            <span className="car-tri">▾</span>
          </button>
          {woPeriodOpen && (
            <div onClick={e => e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'210px',padding:'.4rem',zIndex:100}}>
              {[{key:'all',label:'Все время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Эта неделя'},{key:'month',label:'Этот месяц'}].map(p2 => {
                const isActive = woPeriod === p2.key;
                return (
                  <div key={p2.key} onClick={() => { setWoPeriod(p2.key); setWoPeriodLabel(p2.label); setWoPeriodOpen(false); }}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                    {p2.label}
                  </div>
                );
              })}
              <div style={{borderTop:'1px solid rgba(29,120,252,.14)',paddingTop:'.4rem',marginTop:'.25rem'}}>
                <div style={{fontSize:'.72rem',color:'#5b6472',padding:'.2rem .55rem',marginBottom:'.3rem',fontWeight:600}}>Свой период</div>
                <div style={{display:'flex',gap:'.3rem',padding:'.2rem .55rem'}}>
                  <input type="date" value={woPeriodFrom} onChange={e => setWoPeriodFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                  <input type="date" value={woPeriodTo} onChange={e => setWoPeriodTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                </div>
                <div style={{padding:'.3rem .55rem 0',textAlign:'center'}}>
                  <button type="button" onClick={() => { setWoPeriod('custom'); setWoPeriodLabel('Свой период'); setWoPeriodOpen(false); }}
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
        <table className="sk-table wo-table">
          <thead id="woColHeaders">
            <tr>
              <th style={{textAlign:'left'}}>Товар</th>
              <th style={{textAlign:'left'}}>Кол-во</th>
              <th style={{textAlign:'left'}}>Сумма</th>
              <th style={{textAlign:'left'}}>Причина</th>
              <th style={{textAlign:'left'}}>Дата</th>
              <th style={{width:'130px',textAlign:'left'}}></th>
            </tr>
          </thead>
          <tbody id="writeoffTableBody">
            {list.length === 0 ? (
              <tr><td colSpan="6"><div className="empty-products"><div className="big-icon">📝</div><p>Список списаний пуст</p>
                    <p style={{color:'#555',margin:'.5rem 0 0'}}>Зафиксируйте первый факт брака, порчи или потери товаров</p></div></td></tr>
            ) : list.filter(w => {
              const nm = String(w.name || products.find(p=>p.id===w.product_id)?.name || '').toLowerCase();
              if (woSearch && !nm.includes(woSearch.toLowerCase())) return false;
              if (woReasons.size > 0 && !woReasons.has(w.reason || '')) return false;
              if (woPeriod !== 'all') {
                const d = new Date(w.date); const now = new Date();
                const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (woPeriod === 'today' && d < day) return false;
                if (woPeriod === 'yesterday') { const y = new Date(day); y.setDate(y.getDate()-1); if (d < y || d >= day) return false; }
                if (woPeriod === 'week') { const wk = new Date(day); wk.setDate(wk.getDate()-((wk.getDay()+6)%7)); if (d < wk) return false; }
                if (woPeriod === 'month') { const m = new Date(now.getFullYear(), now.getMonth(), 1); if (d < m) return false; }
                if (woPeriod === 'custom') {
                  if (woPeriodFrom && d < new Date(woPeriodFrom)) return false;
                  if (woPeriodTo) { const t = new Date(woPeriodTo); t.setHours(23,59,59,999); if (d > t) return false; }
                }
              }
              return true;
            }).map(w => (
              <tr key={w.id}>
                <td style={{whiteSpace:'nowrap'}}><div className="prod-name">{w.name || products.find(p=>p.id===w.product_id)?.name || '—'}{w.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</div></td>
                <td style={{whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}>{w.quantity}</td>
                <td style={{whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}><span className="num">{(w.quantity * (w.cost||0)).toLocaleString()} {cur}</span></td>
                <td style={{whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}><span className="prod-cat">{w.reason||'—'}</span></td>
                <td style={{color:'#222',fontSize:'.78rem'}}>{fmtDate(w.date)}</td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={(e) => {
                      e.stopPropagation();
                      const dd = e.currentTarget.nextElementSibling;
                      document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                      dd.classList.toggle('open');
                    }}>⋯</button>
                    <div className="prod-dropdown">
                      <button onClick={() => {
                        setEditId(w.id); setFProd(String(w.product_id)); setFQty(String(w.quantity));
                        setFReason(w.reason||'Списание'); setFDate(w.date||new Date().toISOString().split('T')[0]);
                        setShow(true);
                      }}>Редактировать</button>
                      <button onClick={() => remove(w.id)} style={{color:'#dc3545'}}>Удалить</button>
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
      <Modal open={show} onClose={()=>setShow(false)} title={editId?'Редактировать списание':'Списать товар'} subtitle="Оформление брака, порчи или утери" width="medium">
        <form onSubmit={save}>
          <div className="form-group">
            <label>Товар</label>
            <select value={fProd} onChange={e=>setFProd(e.target.value)} required>
              <option value="">— выберите товар —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Количество</label>
              <input type="number" value={fQty} onChange={e=>setFQty(e.target.value)} min="1" required />
            </div>
            <div className="form-group">
              <label>Дата</label>
              <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Причина</label>
            <select value={fReason} onChange={e=>setFReason(e.target.value)}>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-dark">{editId?'Сохранить':'Списать'}</button>
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
