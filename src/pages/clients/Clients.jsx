import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const getSales = async (userId) => { const { data } = await supabase.from('receipts').select('client_id, total_amount, status').eq('user_id', userId).eq('status', 'paid'); return data || []; };

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClientsState] = useState([]);
  const [sales, setSalesState] = useState([]);
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);
  const [accounts, setAccounts] = useState([]);

  const [fName, setFName] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fBirthday, setFBirthday] = useState('');
  const [fComment, setFComment] = useState('');
  const [fNote1, setFNote1] = useState('');
  const [fNote2, setFNote2] = useState('');
  const [debtPayAmt, setDebtPayAmt] = useState('');
  const [debtPayAc, setDebtPayAc] = useState('');

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) setClientsState(data);
    } catch (e) { /* таблица еще не создана */ }
    const salesData = await getSales(user?.id); setSalesState(salesData);
    try { const { data: a } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('name'); if (a) setAccounts(a); } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openAdd = () => {
    setEditId(null); setFName(''); setFPhone(''); setFEmail('');
    setFBirthday(''); setFComment(''); setFNote1(''); setFNote2(''); setShow(true);
  };

  const openEdit = (c) => {
    setEditId(c.id); setFName(c.name); setFPhone(c.phone||'');
    setFEmail(c.email||''); setFBirthday(c.birthday||''); setFComment(c.comment||'');
    try { const j = JSON.parse(c.comment||'{}'); setFNote1(j.n1||''); setFNote2(j.n2||''); } catch(e) { setFNote1(c.comment||''); setFNote2(''); }
    setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите имя');
    try {
      var saveComment = fNote1 || fNote2 ? JSON.stringify({n1:fNote1.trim(), n2:fNote2.trim()}) : (fComment.trim() || null);
      if (editId) {
        await supabase.from('clients').update({
          name: fName.trim(), phone: fPhone.trim(), email: fEmail.trim(),
          birthday: fBirthday || null, comment: saveComment
        }).eq('id', editId);
      } else {
        await supabase.from('clients').insert({
          user_id: user.id, name: fName.trim(), phone: fPhone.trim(), email: fEmail.trim(),
          birthday: fBirthday || null, comment: saveComment
        });
      }
      await load();
      setShow(false);
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Удалить клиента?')) return;
    try {
      await supabase.from('clients').delete().eq('id', id);
      await load();
    } catch (err) { alert('Ошибка удаления: ' + err.message); }
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
    const cid = s.client_id;
    if (!cid) return;
    if (!clientStats[cid]) clientStats[cid] = { checks: 0, total: 0 };
    clientStats[cid].total += parseFloat(s.total_amount) || 0;
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
      <div className="page-header">
        <div>
          <h1>Клиенты</h1>
          <div className="sub">История покупок, лояльность и статистика</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={openAdd}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {/* Быстрый поиск */}
      <div className="search-row">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input type="text" className="search-field" placeholder="Быстрый поиск"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Желтая плашка дня рождения */}
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

      {loading ? (
        <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка клиентов...</p></div>
      ) : (
      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table className="data-table">
          <thead id="clientColHeaders">
            <tr>
              <th>Клиент</th>
              <th style={{textAlign:'center'}}>Примечание 1</th>
              <th style={{textAlign:'center'}}>Примечание 2</th>
              <th>Телефон</th>
              <th>ДР</th>
              <th>Покупок</th>
              <th>Ср. чек</th>
              <th>Сумма</th>
              <th>Долг</th>
              <th style={{width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="clientTableBody">
            {filtered.length === 0 ? (
              <tr><td colSpan="10"><div className="empty-products"><div className="big-icon">👤</div><p>База клиентов пуста</p><p style={{fontSize:'.82rem',color:'#555',margin:'.5rem 0 0'}}>Добавьте первого клиента, чтобы отслеживать историю покупок</p></div></td></tr>
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
                    <div className="prod-sku">{c.email || ''}</div>
                  </td>
                  <td style={{color:'#555',textAlign:'center',fontSize:'.75rem'}}>{(()=>{try{const j=JSON.parse(c.comment||'{}');return j.n1||'—'}catch(e){return '—'}})()}</td>
                  <td style={{color:'#555',textAlign:'center',fontSize:'.75rem'}}>{(()=>{try{const j=JSON.parse(c.comment||'{}');return j.n2||'—'}catch(e){return '—'}})()}</td>
                  <td style={{color:'#555'}}>{c.phone || '—'}</td>
                  <td style={{color:'#555'}}>
                    {c.birthday ? (
                      <span>{fmtDate(c.birthday)}{isBday && ' 🎉'}</span>
                    ) : '—'}
                  </td>
                  <td style={{color:'#555'}}>{st.checks > 0 ? st.checks : '—'}</td>
                  <td style={{color:'#555'}}>{avg > 0 ? avg.toLocaleString()+' ₽' : '—'}</td>
                  <td style={{color:'#555'}}>{st.total > 0 ? st.total.toLocaleString()+' ₽' : '—'}</td>
                  <td style={{color:'#555'}}>{c.debt && c.debt < 0 ? c.debt.toLocaleString()+' ₽' : '—'}</td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={(e) => {
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
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* Модалка */}
      {show && (
        <div className="modal-overlay active" onClick={(e)=>{if(e.target.className==='modal-overlay active')setShow(false)}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <h2>{editId ? 'Редактировать клиента' : 'Добавить клиента'}</h2>
            <div className="sub">Создание карточки нового покупателя</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Имя</label>
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
              <div className="form-row">
                <div className="form-group">
                  <label>Примечание 1</label>
                  <input type="text" value={fNote1} onChange={e=>setFNote1(e.target.value)} placeholder="Марка скутера, год и т.д." />
                </div>
                <div className="form-group">
                  <label>Примечание 2</label>
                  <input type="text" value={fNote2} onChange={e=>setFNote2(e.target.value)} placeholder="Номер ПТС, Telegram и т.д." />
                </div>
              </div>
              {editId && (
                <div style={{marginBottom:'.5rem'}}>
                  <button type="button" className="btn btn-outline" onClick={() => remove(editId)} style={{color:'#dc3545',borderColor:'#dc3545',width:'100%'}}>Удалить клиента</button>
                </div>
              )}
{(()=>{var editClient = clients.find(function(x){return x.id === editId;}); if(!editClient || !editClient.debt || editClient.debt >= 0) return null; return (
                <div style={{marginBottom:'.5rem',borderTop:'1px solid #eee',paddingTop:'.5rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'.82rem',marginBottom:'.5rem'}}>
                    <span style={{color:'#dc2626',fontWeight:600}}>Текущий долг</span>
                    <span style={{color:'#dc2626',fontWeight:700}}>{Math.abs(editClient.debt).toLocaleString()} ₽</span>
                  </div>
                  <div style={{display:'flex',gap:'.35rem'}}>
                    <input type="number" min="0" step="0.01" placeholder="Сумма" value={debtPayAmt}
                      onChange={e => setDebtPayAmt(e.target.value)}
                      style={{flex:1,border:'1px solid #eee',borderRadius:'6px',padding:'8px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit'}} />
                    <select value={debtPayAc} onChange={e => setDebtPayAc(e.target.value)}
                      style={{flex:1,border:'1px solid #eee',borderRadius:'6px',padding:'8px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit',background:'#fff'}}>
                      <option value="">Счёт</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <button type="button" className="btn btn-primary" style={{fontSize:'12px',padding:'8px 12px',whiteSpace:'nowrap'}}
                      onClick={async () => {
                        const amt = parseFloat(debtPayAmt);
                        if (!amt || amt <= 0) return alert('Введите сумму');
                        if (!debtPayAc) return alert('Выберите счёт');
                        var ec = clients.find(function(x){return x.id === editId;});
                        const newDebt = Math.min(0, (parseFloat(ec?.debt) || 0) + amt);
                        await supabase.from('clients').update({debt: newDebt}).eq('id', editId);
                        await supabase.from('transactions').insert({
                          user_id: user.id, type: 'income', amount: amt,
                          description: 'Погашение долга от ' + (ec?.name || ''),
                          date: new Date().toISOString().split('T')[0],
                          account_id: debtPayAc, status: 'paid'
                        });
                        setDebtPayAmt(''); setDebtPayAc('');
                        await load();
                      }}>Погасить</button>
                  </div>
                </div>
              )()})}
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
