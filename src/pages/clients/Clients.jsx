import { useState, useEffect } from 'react';

const getClients = () => JSON.parse(localStorage.getItem('clients88') || '[]');
const setClients = (list) => localStorage.setItem('clients88', JSON.stringify(list));
const getSales = () => JSON.parse(localStorage.getItem('sales88') || '[]');

export default function Clients() {
  const [clients, setClientsState] = useState([]);
  const [sales, setSalesState] = useState([]);
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fName, setFName] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fBirthday, setFBirthday] = useState('');
  const [fComment, setFComment] = useState('');

  const load = () => { setClientsState(getClients()); setSalesState(getSales()); };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null); setFName(''); setFPhone(''); setFEmail('');
    setFBirthday(''); setFComment(''); setShow(true);
  };

  const openEdit = (c) => {
    setEditId(c.id); setFName(c.name); setFPhone(c.phone||'');
    setFEmail(c.email||''); setFBirthday(c.birthday||''); setFComment(c.comment||''); setShow(true);
  };

  const save = (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите имя');
    const list = getClients();
    const obj = { name: fName.trim(), phone: fPhone.trim(), email: fEmail.trim(), birthday: fBirthday, comment: fComment.trim() };
    if (editId) {
      const idx = list.findIndex(x => x.id === editId);
      if (idx > -1) list[idx] = { ...list[idx], ...obj };
    } else { obj.id = Date.now(); obj.createdAt = new Date().toISOString(); list.unshift(obj); }
    setClients(list); load(); setShow(false);
  };

  const remove = (id) => {
    if (!confirm('Удалить клиента?')) return;
    setClients(getClients().filter(x => x.id !== id)); load();
  };

  const fmtDate = (d) => {
    if (!d) return null;
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    return parts[2] + '.' + parts[1];
  };

  // Статистика по каждому клиенту
  const clientStats = {};
  sales.forEach(s => {
    const cid = s.clientId;
    if (!cid) return;
    if (!clientStats[cid]) clientStats[cid] = { checks: 0, total: 0 };
    clientStats[cid].total += s.total || 0;
    clientStats[cid].checks += 1;
  });

  const todayMD = new Date().toISOString().slice(5, 10);

  // Именинники
  const birthdayClients = clients.filter(c => c.birthday && c.birthday.slice(5) === todayMD);

  // Поиск
  const q = search.toLowerCase().trim();
  let filtered = clients;
  if (q) filtered = filtered.filter(c =>
    c.name.toLowerCase().includes(q) || (c.phone||'').includes(q) || (c.email||'').toLowerCase().includes(q)
  );

  return (
    <>
      {/* Жёлтая плашка дня рождения */}
      {birthdayClients.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg,#fef3cd,#fde68a)',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '.5rem .75rem',
          marginBottom: '.5rem',
          fontSize: '.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '.5rem'
        }}>
          🎉 <b>День рождения</b> у {birthdayClients.map(c => c.name).join(', ')}! Предложите скидку или поздравьте!
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Клиенты</h1>
          <div className="sub">База клиентов и статистика покупок</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAdd}>+ Добавить клиента</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {/* Быстрый поиск — как в Товарах */}
      <div className="search-row">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input type="text" className="search-field" placeholder="Быстрый поиск"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table>
          <thead id="clientColHeaders">
            <tr>
              <th>Клиент</th>
              <th>Телефон</th>
              <th>ДР</th>
              <th className="tr">Покупок</th>
              <th className="tr">Ср. чек</th>
              <th className="tr">Сумма</th>
              <th style={{width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="clientTableBody">
            {filtered.length === 0 ? (
              <tr><td colSpan="7"><div className="empty-products"><div className="big-icon">👤</div><p>Клиентов пока нет. Нажмите «+ Добавить клиента»</p></div></td></tr>
            ) : filtered.map(c => {
              const st = clientStats[c.id] || { checks: 0, total: 0 };
              const avg = st.checks > 0 ? Math.round(st.total / st.checks) : 0;
              const isBday = c.birthday && c.birthday.slice(5) === todayMD;
              return (
                <tr key={c.id}>
                  <td>
                    <div className="prod-name">
                      {c.name}
                      {isBday && <span style={{color:'#ec4899',fontSize:'.65rem',marginLeft:'.35rem'}}>🎂</span>}
                    </div>
                    <div className="prod-sku">{c.email || ''}{c.comment ? ' • '+c.comment : ''}</div>
                  </td>
                  <td style={{fontSize:'.82rem'}}>{c.phone || '—'}</td>
                  <td style={{fontSize:'.82rem',color:'var(--muted)'}}>
                    {c.birthday ? (
                      <span style={{color:isBday?'#ec4899':'inherit',fontWeight:isBday?600:'inherit'}}>
                        {fmtDate(c.birthday)}{isBday && ' 🎉'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="tr">{st.checks > 0 ? st.checks : '—'}</td>
                  <td className="tr">{avg > 0 ? avg.toLocaleString()+'₽' : '—'}</td>
                  <td className="tr" style={{fontWeight:500}}>{st.total > 0 ? st.total.toLocaleString()+'₽' : '—'}</td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    <button className="act-btn prod-edit-btn" onClick={() => openEdit(c)}>Ред.</button>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={(e) => {
                        e.stopPropagation();
                        const dd = e.currentTarget.nextElementSibling;
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                        dd.classList.toggle('open');
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={() => remove(c.id)} style={{color:'#dc3545'}}>Удалить</button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Модалка */}
      {show && (
        <div className="modal-overlay active" onClick={(e)=>{if(e.target.className==='modal-overlay active')setShow(false)}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <h2>{editId ? 'Редактировать клиента' : 'Добавить клиента'}</h2>
            <div className="sub">Введите контактные данные</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Имя *</label>
                <input type="text" value={fName} onChange={e=>setFName(e.target.value)} placeholder="Иван Иванов" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Телефон</label>
                  <input type="text" value={fPhone} onChange={e=>setFPhone(e.target.value)} placeholder="+7 (999) 123-45-67" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={fEmail} onChange={e=>setFEmail(e.target.value)} placeholder="ivan@example.com" />
                </div>
              </div>
              <div className="form-group">
                <label>Дата рождения</label>
                <input type="date" value={fBirthday} onChange={e=>setFBirthday(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <textarea value={fComment} onChange={e=>setFComment(e.target.value)} placeholder="Заметки о клиенте..." rows="2" />
              </div>
              {editId && (
                <div style={{marginBottom:'.5rem'}}>
                  <button type="button" className="btn btn-outline" onClick={() => remove(editId)} style={{color:'#dc3545',borderColor:'#dc3545',width:'100%'}}>Удалить клиента</button>
                </div>
              )}
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
