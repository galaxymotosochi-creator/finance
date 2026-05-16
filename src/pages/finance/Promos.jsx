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

  const load = () => supabase.from('promos').select('*').order('start_date').then(r => r.data && setPromos(r.data));
  useEffect(() => { load(); }, []);

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

  const openAdd = () => {
    setEditId(null); setName(''); setDiscount(''); setStart(today); setEnd(''); setDesc(''); setShow(true);
  };

  const openEdit = (p) => {
    setEditId(p.id); setName(p.name); setDiscount(String(p.discount||'')); setStart(p.start_date); setEnd(p.end_date); setDesc(p.description||''); setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Введите название акции');
    if (!start) return alert('Укажите дату начала');
    if (!end) return alert('Укажите дату окончания');
    const data = { user_id: user.id, name: name.trim(), discount: parseFloat(discount)||0, start_date: start, end_date: end, description: desc.trim()||('Скидка '+(parseFloat(discount)||0)+'%'), status: 'active' };
    try {
      if (editId) await supabase.from('promos').update(data).eq('id', editId);
      else await supabase.from('promos').insert(data);
      setShow(false); setEditId(null); load();
    } catch (err) { alert(err.message); }
  };

  const del = async (id) => {
    if (!confirm('Удалить акцию?')) return;
    await supabase.from('promos').delete().eq('id', id); load();
  };

  const cells = [];
  for (let i = 0; i < off; i++) cells.push(null);
  for (let d = 1; d <= daysInM; d++) {
    const pd = promoDays(d);
    cells.push({ day: d, promos: pd, date: y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0') });
  }

  return (
    <>
      <div className="page-header">
        <div><h1 style={{fontSize:'1.2rem',fontWeight:600,margin:0}}>Акции</h1><div className="sub">Текущие и планируемые акции</div></div>
        <div className="page-actions"><button className="btn-green" onClick={openAdd}>+ Добавить</button></div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="promo-calendar-wrap">
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'1rem',marginBottom:'.75rem'}}>
        <button onClick={()=>{var d=new Date(cal);d.setMonth(d.getMonth()-1);setCal(d)}} style={{background:'none',border:'1px solid var(--border)',borderRadius:'50%',width:'32px',height:'32px',fontSize:'1.1rem',cursor:'pointer',color:'var(--muted)'}}>‹</button>
        <div style={{fontSize:'.95rem',fontWeight:600}}>{months[m]} {y}</div>
        <button onClick={()=>{var d=new Date(cal);d.setMonth(d.getMonth()+1);setCal(d)}} style={{background:'none',border:'1px solid var(--border)',borderRadius:'50%',width:'32px',height:'32px',fontSize:'1.1rem',cursor:'pointer',color:'var(--muted)'}}>›</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px',marginBottom:'.5rem'}}>
        {daysShort.map(n => <div key={n} style={{fontSize:'.7rem',color:'var(--muted)',textAlign:'center',padding:'.25rem 0',fontWeight:600}}>{n}</div>)}
        {cells.map((c,i) => {
          if (!c) return <div key={i} />;
          const s = c.promos.length ? status(c.promos[0]) : null;
          const bg = s === 'active' ? '#22c55e' : s === 'planned' ? '#3b82f6' : s === 'ended' ? '#e5e7eb' : 'transparent';
          return <div key={i} onClick={() => c.promos.length && setDetail(c.promos[0].id)} style={{fontSize:'.78rem',textAlign:'center',padding:'.35rem 0',borderRadius:'6px',cursor:c.promos.length?'pointer':'default',background:bg,color:s?'#fff':'var(--body-color)'}}>{c.day}</div>;
        })}
      </div>

      <div style={{display:'flex',gap:'1rem',fontSize:'.72rem',color:'var(--muted)',marginBottom:'1rem'}}>
        <span><span style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'50%',background:'#22c55e',marginRight:'.25rem'}} /> Активна</span>
        <span><span style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'50%',background:'#3b82f6',marginRight:'.25rem'}} /> Планируется</span>
        <span><span style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'50%',background:'#e5e7eb',marginRight:'.25rem'}} /> Завершена</span>
        </div>
      </div>

      <div style={{fontSize:'.7rem',color:'var(--muted)',textTransform:'uppercase',fontWeight:600,marginBottom:'.5rem'}}>Все акции</div>

      {promos.length === 0 && <div className="empty-products"><div className="big-icon">🎉</div><p>У вас пока нет акций</p></div>}

      {promos.map(p => {
        const s = status(p);
        const sc = s === 'active' ? '#16a34a' : s === 'planned' ? '#2563eb' : '#9ca3af';
        const sb = s === 'active' ? '#f0fdf4' : s === 'planned' ? '#eff6ff' : '#f9fafb';
        return (
          <div key={p.id} onClick={() => setDetail(detail === p.id ? null : p.id)} style={{display:'flex',alignItems:'center',padding:'.65rem .75rem',border:'1px solid var(--border)',borderRadius:'.75rem',marginBottom:'.5rem',cursor:'pointer',gap:'.75rem'}}>
            <div style={{fontSize:'2rem'}}>🔥</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:'.85rem'}}>{p.name}</div>
              <div style={{fontSize:'.75rem',color:'var(--muted)'}}>{p.start_date} — {p.end_date}</div>
            </div>
            <span style={{fontSize:'.7rem',fontWeight:600,color:sc,background:sb,padding:'.2rem .5rem',borderRadius:'20px'}}>{s === 'active' ? 'Активна' : s === 'planned' ? 'Планируется' : 'Завершена'}</span>
            <div className="prod-more-wrap">
              <button className="act-btn prod-more-btn" onClick={function(e){e.stopPropagation();var el=e.currentTarget.nextElementSibling;el.classList.toggle('open')}}>⋯</button>
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
        return (
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:'.75rem',padding:'1rem',marginTop:'.5rem'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:'.75rem'}}>
              <div style={{fontSize:'2.5rem'}}>🔥</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'1.1rem',fontWeight:600}}>{p.name}</div>
                <div style={{fontSize:'.8rem',color:'var(--muted)'}}>{s === 'active' ? 'Активна' : s === 'planned' ? 'Планируется' : 'Завершена'}</div>
              </div>
              <div className="prod-more-wrap">
                <button className="act-btn prod-more-btn" onClick={function(e){e.stopPropagation();var el=e.currentTarget.nextElementSibling;el.classList.toggle('open')}}>⋯</button>
                <div className="prod-dropdown">
                  <button onClick={function(){openEdit(p)}}>Редактировать</button>
                  <button onClick={function(){del(p.id)}} style={{color:'#dc3545'}}>Удалить</button>
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:'1.5rem',marginTop:'.75rem',fontSize:'.82rem'}}>
              <span>💰 Скидка: <strong>{p.discount}%</strong></span>
              <span>📅 {p.start_date} — {p.end_date}</span>
            </div>
            {p.description && <div style={{fontSize:'.82rem',color:'var(--muted)',marginTop:'.5rem'}}>{p.description}</div>}
          </div>
        );
      })()}

      {show && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setShow(false);setEditId(null)}}}>
          <div className="modal-box">
            <button className="modal-close" onClick={function(){setShow(false);setEditId(null)}}>&times;</button>
            <h2>{editId ? 'Редактировать акцию' : 'Добавить акцию'}</h2>
            <div className="sub">Настройте новую акцию</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" placeholder="Например: Новогодняя распродажа" value={name} onChange={e=>setName(e.target.value)} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Скидка (%)</label>
                  <input type="number" placeholder="10" min="0" max="100" value={discount} onChange={e=>setDiscount(e.target.value)} />
                </div>
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
    </>
  );
}
