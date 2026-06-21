import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const daysShort = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export default function Promos() {
  const { user } = useAuth();
  const [promos, setPromos] = useState([]);
  const [cal, setCal] = useState(new Date());
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [discount, setDiscount] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [desc, setDesc] = useState('');
  const [detail, setDetail] = useState(null);
  const [targetType, setTargetType] = useState('all');
  const [targetCat, setTargetCat] = useState('');
  const [targetProducts, setTargetProducts] = useState([]);
  const [targetSearch, setTargetSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const load = async () => {
    if (!user) return;
    try { const { data: pData } = await supabase.from('promos').select('*').eq('user_id', user.id).order('start_date'); if (pData) setPromos(pData); } catch(e) {}
    try { const { data: cData } = await supabase.from('stock_categories').select('*').eq('user_id', user.id); if (cData) setCategories(cData); } catch(e) {}
    try { const { data: prData } = await supabase.from('products').select('*').eq('user_id', user.id).order('name'); if (prData) setProducts(prData); } catch(e) {}
  };
  useEffect(() => { if (user) load(); }, [user]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.prod-more-wrap')) {
        document.querySelectorAll('.prod-dropdown.open').forEach(d => d.classList.remove('open'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const y = cal.getFullYear(), m = cal.getMonth();
  const firstD = new Date(y, m, 1).getDay();
  const daysInM = new Date(y, m + 1, 0).getDate();
  const off = firstD === 0 ? 6 : firstD - 1;

  const today = new Date().toISOString().split('T')[0];

  const promoDays = (d) => {
    const ds = y + '-' + String(m + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    return promos.filter(p => ds >= p.start_date && ds <= p.end_date);
  };

  const status = (p) => {
    if (p.start_date > today) return 'planned';
    if (p.end_date < today) return 'ended';
    return 'active';
  };

  const isPast = (d) => {
    const ds = y + '-' + String(m + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    return ds < today;
  };

  const isToday = (d) => {
    return y + '-' + String(m + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0') === today;
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const parts = d.split('-');
    return parts.length === 3 ? parts[2] + '.' + parts[1] + '.' + parts[0] : d;
  };

  const openAdd = () => {
    setEditId(null); setName(''); setDiscount(''); setStart(today); setEnd(''); setDesc('');
    setTargetType('all'); setTargetCat(''); setTargetProducts([]); setTargetSearch('');
    setShow(true);
  };

  const openEdit = (p) => {
    setEditId(p.id); setName(p.name); setDiscount(String(p.discount||'')); setStart(p.start_date);
    setEnd(p.end_date); setDesc(p.description||'');
    if (p.conditions && p.conditions.type) {
      setTargetType(p.conditions.type);
      setTargetCat(p.conditions.catId || '');
      setTargetProducts(p.conditions.productIds || []);
    } else {
      setTargetType('all'); setTargetCat(''); setTargetProducts([]);
    }
    setTargetSearch('');
    setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Введите название акции');
    if (!start) return alert('Укажите дату начала');
    if (!end) return alert('Укажите дату окончания');
    let conditions = { type: targetType };
    if (targetType === 'category_products' || targetType === 'category_services') {
      if (!targetCat) return alert('Выберите категорию');
      conditions.catId = targetCat;
      conditions.catName = categories.find(c => c.id === parseInt(targetCat))?.name || '';
    }
    if (targetType === 'specific_products' || targetType === 'specific_services') {
      if (!targetProducts.length) return alert('Выберите товары');
      conditions.productIds = targetProducts;
    }
    const data = {
      user_id: user.id, name: name.trim(), discount: parseFloat(discount)||0,
      start_date: start, end_date: end, description: desc.trim() || ('Скидка '+(parseFloat(discount)||0)+'%'),
      status: 'active', conditions
    };
    try {
      if (editId) {
        const { error } = await supabase.from('promos').update(data).eq('id', editId);
        if (error) return alert(error.message);
      } else {
        const { error } = await supabase.from('promos').insert(data);
        if (error) return alert(error.message);
      }
      setEditId(null);
      setShow(false);
      load();
      setToast(editId ? 'Акция успешно сохранена!' : 'Акция успешно добавлена!');
    } catch (err) { alert(err.message); }
  };

  const del = async (id) => {
    if (!confirm('Удалить акцию?')) return;
    await supabase.from('promos').delete().eq('id', id); load();
  };

  const loadStats = async (promo) => {
    const { data: items } = await supabase.from('receipt_items')
      .select('discount_amount')
      .eq('promo_id', promo.id);
    const totalDiscount = (items || []).reduce((s, i) => s + (parseFloat(i.discount_amount) || 0), 0);
    const usageCount = (items || []).length;
    setStats({ totalDiscount, usageCount });
  };

  const targetLabel = (p) => {
    if (!p.conditions || !p.conditions.type) return 'Все товары';
    const t = p.conditions.type;
    if (t === 'all') return 'Все товары';
    if (t === 'category_products') return 'Категория: ' + (p.conditions.catName || p.conditions.catId);
    if (t === 'specific_products') return (p.conditions.productIds?.length || 0) + ' товаров';
    if (t === 'category_services') return 'Категория услуг: ' + (p.conditions.catName || p.conditions.catId);
    if (t === 'specific_services') return (p.conditions.productIds?.length || 0) + ' услуг';
    return 'Все позиции';
  };

  const cells = [];
  for (let i = 0; i < off; i++) cells.push(null);
  for (let d = 1; d <= daysInM; d++) {
    const pd = promoDays(d);
    cells.push({ day: d, promos: pd, date: y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0') });
  }
  const rem = (7 - (off + daysInM) % 7) % 7;
  for (let i = 0; i < rem; i++) cells.push(null);

  return (
    <>
      <div className="page-header">
        <div><h1 style={{fontSize:'1.2rem',fontWeight:600,margin:0}}>Акции</h1><div className="sub">Управление специальными предложениями и скидками</div></div>
        <div className="page-actions"><button className="btn-mint" onClick={openAdd}>+ Добавить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="promo-calendar-wrap">
        <div className="promo-cal-header">
          <button className="promo-cal-nav" onClick={()=>{var d=new Date(cal);d.setMonth(d.getMonth()-1);setCal(d)}}>‹</button>
          <div className="promo-cal-month">{months[m]} {y}</div>
          <button className="promo-cal-nav" onClick={()=>{var d=new Date(cal);d.setMonth(d.getMonth()+1);setCal(d)}}>›</button>
        </div>
        <div className="promo-cal-grid">
          {daysShort.map(n => <div className="wd" key={n}>{n}</div>)}
          {cells.map((c,i) => {
            if (!c) return <div key={i} className="day other">&nbsp;</div>;
            const pd = c.promos && c.promos.length ? status(c.promos[0]) : null;
            const past = isPast(c.day);
            const td = isToday(c.day);
            let cls = 'day';
            if (pd) cls += ' has-promo ' + pd;
            if (past && !pd) cls += ' other';
            if (td) cls += ' today';
            return <div key={i} className={cls} onClick={() => c.promos.length && setDetail(c.promos[0].id)}>{c.day}</div>;
          })}
        </div>
        <div className="promo-cal-legend">
          <span><span className="promo-dot active"></span> Активна</span>
          <span><span className="promo-dot planned"></span> Планируется</span>
          <span><span className="promo-dot ended"></span> Завершена</span>
        </div>
      </div>

      <div style={{fontSize:'.7rem',color:'var(--muted)',textTransform:'uppercase',fontWeight:600,marginBottom:'.5rem'}}>Все акции</div>

      {promos.length === 0 && <div className="empty-products"><div className="big-icon">🎉</div><p>У вас пока нет акций</p></div>}

      {promos.map(p => {
        const s = status(p);
        const sc = s === 'active' ? '#16a34a' : s === 'planned' ? '#92400e' : '#9ca3af';
        const sb = s === 'active' ? '#dcfce7' : s === 'planned' ? '#fef3c7' : '#f1f3f5';
        return (
          <div key={p.id} onClick={() => { setDetail(detail === p.id ? null : p.id); if (detail !== p.id) { setStats(null); loadStats(p); } }} style={{display:'flex',alignItems:'center',padding:'.65rem .75rem',border:'1px solid var(--border)',borderRadius:'.75rem',marginBottom:'.5rem',cursor:'pointer',gap:'.75rem'}}>
            <div style={{fontSize:'2rem'}}>🔥</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:'.85rem'}}>{p.name}</div>
              <div style={{fontSize:'.75rem',color:'var(--muted)'}}>{fmtDate(p.start_date)} — {fmtDate(p.end_date)}</div>
              <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:'.15rem'}}>{targetLabel(p)}</div>
            </div>
            <span style={{fontSize:'.7rem',fontWeight:600,color:sc,background:sb,padding:'.2rem .5rem',borderRadius:'20px'}}>{s === 'active' ? 'Активна' : s === 'planned' ? 'Планируется' : 'Завершена'}</span>
            <div className="prod-more-wrap">
              <button className="act-btn prod-more-btn" onClick={function(e){e.stopPropagation();var el=e.currentTarget.nextElementSibling;el.classList.toggle('open');var _r=el.getBoundingClientRect();if(_r.bottom>window.innerHeight)el.classList.add('up');else el.classList.remove('up')}}>⋯</button>
              <div className="prod-dropdown">
                <button onClick={function(e){e.stopPropagation();openEdit(p)}}>Редактировать</button>
                <button onClick={function(e){e.stopPropagation();del(p.id)}} style={{color:'#dc3545'}}>Удалить</button>
              </div>
            </div>
          </div>
        );
      })}

      {detail && (() => {
        const p = promos.find(x => x.id === detail);
        if (!p) return null;
        const s = status(p);
        const cond = p.conditions || {};
        let matchedProducts = [];
        if (cond.type === 'all' || !cond.type) matchedProducts = products;
        else if (cond.type === 'category_products') matchedProducts = products.filter(x => x.type !== 'service' && x.cat === categories.find(c => c.id === parseInt(cond.catId))?.name);
        else if (cond.type === 'specific_products') matchedProducts = products.filter(x => cond.productIds && cond.productIds.includes(x.id));
        else if (cond.type === 'specific_services') matchedProducts = products.filter(x => cond.productIds && cond.productIds.includes(x.id));
        else if (cond.type === 'category_services') matchedProducts = products.filter(x => x.type === 'service' && x.cat === categories.find(c => c.id === parseInt(cond.catId))?.name);
        const sc = s === 'active' ? '#16a34a' : s === 'planned' ? '#92400e' : '#9ca3af';
        const sb = s === 'active' ? '#dcfce7' : s === 'planned' ? '#fef3c7' : '#f1f3f5';
        return (
          <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setDetail(null);setStats(null)}}}>
            <div className="modal-box" style={{maxWidth:'520px'}}>
              <button className="modal-close" onClick={function(){setDetail(null);setStats(null)}}>&times;</button>
              <h2>{p.name}</h2>
              <div className="sub" style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                <span style={{fontSize:'.7rem',fontWeight:600,color:sc,background:sb,padding:'.2rem .5rem',borderRadius:'20px'}}>{s === 'active' ? 'Активна' : s === 'planned' ? 'Планируется' : 'Завершена'}</span>
                <span>💰 {p.discount}%</span>
                <span>📅 {fmtDate(p.start_date)} — {fmtDate(p.end_date)}</span>
                <span>🎯 {targetLabel(p)}</span>
              </div>
              {p.description && <div style={{fontSize:'.82rem',color:'var(--muted)',margin:'0 0 .75rem'}}>{p.description}</div>}

              {stats && (
                <div style={{display:'flex',gap:'.5rem',marginBottom:'.75rem'}}>
                  <div style={{flex:1,background:'#f0fdf4',borderRadius:'.5rem',padding:'.5rem .65rem',fontSize:'.78rem'}}>
                    <div style={{color:'var(--muted)'}}>Применений</div>
                    <div style={{fontWeight:700,fontSize:'1.1rem'}}>{stats.usageCount}</div>
                  </div>
                  <div style={{flex:1,background:'#fef2f2',borderRadius:'.5rem',padding:'.5rem .65rem',fontSize:'.78rem'}}>
                    <div style={{color:'var(--muted)'}}>Скидка</div>
                    <div style={{fontWeight:700,fontSize:'1.1rem',color:'#dc2626'}}>-{stats.totalDiscount.toLocaleString()} ₽</div>
                  </div>
                </div>
              )}

              <div style={{fontSize:'.82rem',fontWeight:600,marginBottom:'.35rem'}}>Товары под акцией ({matchedProducts.length})</div>
              <div style={{maxHeight:'200px',overflowY:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'.25rem'}}>
                {matchedProducts.length === 0 ? (
                  <div style={{padding:'.5rem',textAlign:'center',color:'var(--muted)',fontSize:'.78rem'}}>Нет товаров</div>
                ) : matchedProducts.slice(0,50).map(x => (
                  <div key={x.id} style={{display:'flex',justifyContent:'space-between',padding:'.3rem .5rem',borderBottom:'1px solid #f0f0f0',fontSize:'.78rem'}}>
                    <span>{x.name}</span>
                    <span style={{color:'var(--muted)'}}>{x.price ? x.price.toLocaleString()+' ₽' : '—'}</span>
                  </div>
                ))}
                {matchedProducts.length > 50 && <div style={{padding:'.3rem .5rem',textAlign:'center',color:'var(--muted)',fontSize:'.72rem'}}>... и ещё {matchedProducts.length - 50}</div>}
              </div>

              <div className="prod-more-wrap" style={{position:'absolute',top:'.75rem',right:'3rem'}}>
                <button className="act-btn prod-more-btn" onClick={function(e){e.stopPropagation();var el=e.currentTarget.nextElementSibling;el.classList.toggle('open');var _r=el.getBoundingClientRect();if(_r.bottom>window.innerHeight)el.classList.add('up');else el.classList.remove('up')}}>⋯</button>
                <div className="prod-dropdown">
                  <button onClick={function(){setDetail(null);setStats(null);openEdit(p)}}>Редактировать</button>
                  <button onClick={function(){setDetail(null);setStats(null);del(p.id)}} style={{color:'#dc3545'}}>Удалить</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {show && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setShow(false);setEditId(null)}}}>
          <div className="modal-box">
            <button className="modal-close" onClick={function(){setShow(false);setEditId(null)}}>&times;</button>
            <h2>{editId ? 'Редактировать акцию' : 'Добавить акцию'}</h2>
            <div className="sub">Настройка условий и сроков действия акции</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название</label>
                <input type="text" placeholder="Например: Новогодняя распродажа" value={name} onChange={e=>setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Скидка (%)</label>
                <input type="number" placeholder="10" min="0" max="100" value={discount} onChange={e=>setDiscount(e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Начало</label>
                  <input type="date" value={start} onChange={e=>setStart(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Окончание</label>
                  <input type="date" value={end} onChange={e=>setEnd(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea placeholder="Условия акции, детали, примечания..." rows="2" value={desc} onChange={e=>setDesc(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Действует на</label>
                <select value={targetType} onChange={e => setTargetType(e.target.value)}>
                  <option value="all">На все позиции</option>
                  <option value="category_products">На категорию товаров</option>
                  <option value="category_services">На категорию услуг</option>
                  <option value="specific_products">На конкретные товары</option>
                  <option value="specific_services">На конкретные услуги</option>
                </select>
              </div>
              {(targetType === 'category_products' || targetType === 'category_services') && (
                <div className="form-group">
                  <label>Выберите категорию</label>
                  <select value={targetCat} onChange={e => setTargetCat(e.target.value)}>
                    <option value="">— выберите —</option>
                    {categories.filter(c => c.type === (targetType === 'category_products' ? 'product' : 'service')).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {(targetType === 'specific_products' || targetType === 'specific_services') && (
                <div className="form-group">
                  <label>{targetType === 'specific_services' ? 'Поиск услуг' : 'Поиск товаров'}</label>
                  <input type="text" placeholder="Поиск..." value={targetSearch} onChange={e => setTargetSearch(e.target.value)} />
                  {targetSearch && (
                    <div style={{maxHeight:'120px',overflowY:'auto',marginTop:'.25rem',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'.25rem'}}>
                      {products.filter(p => p.name.toLowerCase().includes(targetSearch.toLowerCase()) && p.type === (targetType === 'specific_products' ? 'product' : 'service')).map(p => {
                        const checked = targetProducts.includes(p.id);
                        return (
                          <div key={p.id} onClick={() => setTargetProducts(prev => checked ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                            style={{display:'flex',alignItems:'center',gap:'.35rem',padding:'.25rem .35rem',cursor:'pointer',borderRadius:'4px',fontSize:'.78rem'}}
                            onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
                            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                            <input type="checkbox" checked={checked} onChange={()=>{}} style={{cursor:'pointer',margin:0,flexShrink:0}} />
                            <span>{p.name}</span>
                          </div>
                        );
                      })}
                      {products.filter(p => p.name.toLowerCase().includes(targetSearch.toLowerCase()) && p.type === (targetType === 'specific_products' ? 'product' : 'service')).length === 0 && (
                        <div style={{padding:'.5rem',color:'var(--muted)',fontSize:'.75rem',textAlign:'center'}}>Ничего не найдено</div>
                      )}
                    </div>
                  )}
                  {targetProducts.length > 0 && <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:'.15rem'}}>Выбрано: {targetProducts.length}</div>}
                </div>
              )}
              <div style={{marginBottom:'.75rem'}}>
                <div style={{fontSize:'.7rem',color:'var(--muted)',textTransform:'uppercase',fontWeight:600,marginBottom:'.35rem'}}>Предпросмотр карточки</div>
                <div style={{display:'flex',alignItems:'center',gap:'.75rem',background:'#f8f9fa',borderRadius:'.75rem',padding:'.75rem'}}>
                  <div style={{fontSize:'2rem'}}>🔥</div>
                  <div>
                    <div style={{fontWeight:600,fontSize:'.85rem'}}>{name || 'Новая акция'}</div>
                    <div style={{fontSize:'.75rem',color:'var(--muted)'}}>Скидка {discount || 0}%</div>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId ? 'Сохранить' : 'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.65rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}
    </>
  );
}
