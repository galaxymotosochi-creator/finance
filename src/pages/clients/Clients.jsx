import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { getCurrencySymbol } from '../../lib/currency';
import Loader from '../../components/Loader';


const getSales = async (userId) => { const { data } = await supabase.from('receipts').select('client_id, total_amount, status').eq('user_id', userId); return data || []; };

export default function Clients() {
  const cur = getCurrencySymbol();
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
  const [fLoyalty, setFLoyalty] = useState('auto');
  const [loyaltyPrograms, setLoyaltyPrograms] = useState([]);

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) setClientsState(data);
    } catch (e) { /* таблица еще не создана */ }
    const salesData = await getSales(user?.id); setSalesState(salesData);
    try { const { data: a } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('name'); if (a) setAccounts(a); } catch(e) {}
    try { const { data: lp } = await supabase.from('loyalty_programs').select('*').eq('user_id', user.id).order('created_at'); if (lp) setLoyaltyPrograms(lp); } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'clients', setList: setClientsState, onSynced: load });

  const openAdd = () => {
    setEditId(null); setFName(''); setFPhone(''); setFEmail('');
    setFBirthday(''); setFComment(''); setFNote1(''); setFNote2(''); setFLoyalty('auto'); setShow(true);
  };

  const openEdit = (c) => {
    setEditId(c.id); setFName(c.name); setFPhone(c.phone||'');
    setFEmail(c.email||''); setFBirthday((c.birthday||'').slice(0,10)); setFComment(c.comment||'');
    setFLoyalty(c.loyalty_mode || 'auto');
    try { const j = JSON.parse(c.comment||'{}'); setFNote1(j.n1||''); setFNote2(j.n2||''); } catch(e) { setFNote1(c.comment||''); setFNote2(''); }
    setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите имя');
    try {
      var saveComment = fNote1 || fNote2 ? JSON.stringify({n1:fNote1.trim(), n2:fNote2.trim()}) : (fComment.trim() || null);
      if (editId) {
        const { error, queued } = await supabase.from('clients').update({
          name: fName.trim(), phone: fPhone.trim(), email: fEmail.trim(),
          birthday: fBirthday || null, comment: saveComment, loyalty_mode: fLoyalty
        }).eq('id', editId);
        if (error) throw error;
        if (!queued) await load();
      } else {
        const { error, queued } = await supabase.from('clients').insert({
          user_id: user.id, name: fName.trim(), phone: fPhone.trim(), email: fEmail.trim(),
          birthday: fBirthday || null, comment: saveComment, loyalty_mode: fLoyalty
        });
        if (error) throw error;
        if (!queued) await load();
      }
      setShow(false);
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Удалить клиента?')) return;
    try {
      const { error, queued } = await supabase.from('clients').delete().eq('id', id);
      if (error) return alert('' + error.message);
      if (!queued) await load();
    } catch (err) { alert('Ошибка удаления: ' + err.message); }
  };

  const fmtDate = (d) => {
    if (!d) return null;
    // birthday в БД — timestamptz (2026-08-30T00:00:00.000Z), берём только дату
    const ds = String(d).slice(0, 10);
    const parts = ds.split('-');
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

  // Локальная дата (не UTC!) — иначе после полуночи в Сочи показывались вчерашние именинники
  const nowD = new Date();
  const todayMD = String(nowD.getMonth() + 1).padStart(2, '0') + '-' + String(nowD.getDate()).padStart(2, '0');

  // Именинники
  const birthdayClients = clients.filter(c => c.birthday && String(c.birthday).slice(5, 10) === todayMD);

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
          <h1>База клиентов</h1>
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
        <Loader />
      ) : (
      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table className="data-table">
          <thead id="clientColHeaders">
            <tr>
              <th style={{textAlign:'left'}}>Клиент</th>
              <th style={{textAlign:'left'}}>Примечание 1</th>
              <th style={{textAlign:'left'}}>Примечание 2</th>
              <th style={{textAlign:'left'}}>Телефон</th>
              <th style={{textAlign:'left'}}>ДЕНЬ РОЖДЕНИЯ</th>
              <th style={{textAlign:'left'}}>Покупок</th>
              <th style={{textAlign:'left'}}>Ср. чек</th>
              <th style={{textAlign:'left'}}>Сумма</th>
              <th style={{textAlign:'left'}}>Долг</th>
              <th style={{textAlign:'left'}}>Лояльность</th>
              <th style={{width:'80px'}}></th>
            </tr>
          </thead>
          <tbody id="clientTableBody">
            {filtered.length === 0 ? (
              <tr><td colSpan="12"><div className="empty-products"><div className="big-icon">👤</div><p>База клиентов пуста</p><p style={{fontSize:'.82rem',color:'#555',margin:'.5rem 0 0'}}>Добавьте первого клиента, чтобы отслеживать историю покупок</p></div></td></tr>
            ) : filtered.map(c => {
              const st = clientStats[c.id] || { checks: 0, total: 0 };
              const avg = st.checks > 0 ? Math.round(st.total / st.checks) : 0;
              const isBday = c.birthday && String(c.birthday).slice(5, 10) === todayMD;
              return (
                <tr key={c.id}>
                  <td style={{textAlign:'left'}}>
                    <div className="prod-name">
                      {c.name}
                      {c.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}
                      {isBday && <span style={{color:'#ec4899',fontSize:'.65rem',marginLeft:'.35rem'}}>🎂</span>}
                    </div>
                    <div className="prod-sku">{c.email || ''}</div>
                  </td>
                  <td style={{color:'#555',textAlign:'left',fontSize:'.75rem'}}>{(()=>{try{const j=JSON.parse(c.comment||'{}');return j.n1||'—'}catch(e){return '—'}})()}</td>
                  <td style={{color:'#555',textAlign:'left',fontSize:'.75rem'}}>{(()=>{try{const j=JSON.parse(c.comment||'{}');return j.n2||'—'}catch(e){return '—'}})()}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{c.phone || '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>
                    {c.birthday ? (
                      <span>{fmtDate(c.birthday)}{isBday && ' 🎉'}</span>
                    ) : '—'}
                  </td>
                  <td style={{textAlign:'left',color:'#555'}}>{st.checks > 0 ? st.checks : '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{avg > 0 ? avg.toLocaleString()+' ₽' : '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{st.total > 0 ? st.total.toLocaleString()+' ₽' : '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{c.debt && c.debt < 0 ? c.debt.toLocaleString()+' ₽' : '—'}</td>
                  <td style={{textAlign:'left'}}>{(() => {
                    const mode = c.loyalty_mode || 'auto';
                    const points = Number(c.points) || 0;
                    const assignedProg = loyaltyPrograms.find(p => String(p.id) === String(mode));
                    const parts = [];
                    if (mode === 'none') parts.push(<span key="none" style={{background:'#f5f5f5',color:'#999',borderRadius:'100px',padding:'1px 8px',fontSize:'.68rem',fontWeight:600}}>без скидки</span>);
                    else if (assignedProg) parts.push(<span key="prog" style={{background:'#f3e8ff',color:'#7c3aed',borderRadius:'100px',padding:'1px 8px',fontSize:'.68rem',fontWeight:600}}>{assignedProg.discount > 0 ? 'скидка '+Number(assignedProg.discount).toLocaleString()+'%' : 'программа'}</span>);
                    if (points > 0) parts.push(<span key="pts" style={{color:'#7c3aed',fontSize:'.72rem',fontWeight:600}}>{points.toLocaleString()} баллов</span>);
                    if (parts.length === 0) return <span style={{color:'#ccc'}}>—</span>;
                    return <span style={{display:'flex',gap:'4px',alignItems:'center',flexWrap:'wrap'}}>{parts}</span>;
                  })()}</td>
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
      <Modal open={show} onClose={()=>setShow(false)} title={editId ? 'Редактировать клиента' : 'Добавить клиента'} subtitle="Создание карточки нового покупателя" width="medium">
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
              <div className="form-group">
                <label>Программа лояльности</label>
                <select value={fLoyalty} onChange={e=>setFLoyalty(e.target.value)}>
                  <option value="auto">Авто (по правилам программ)</option>
                  {loyaltyPrograms.map(p => <option key={p.id} value={String(p.id)}>{p.name}{p.discount > 0 ? ' — скидка ' + Number(p.discount).toLocaleString() + '%' : ''}</option>)}
                  <option value="none">Без скидки</option>
                </select>
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
                <div style={{marginBottom:'.5rem',borderTop:'1px solid #eee',paddingTop:'.5rem',display:'flex',justifyContent:'space-between',fontSize:'.82rem'}}>
                  <span style={{color:'#dc2626',fontWeight:600}}>Текущий долг</span>
                  <span style={{color:'#dc2626',fontWeight:700}}>{Math.abs(editClient.debt).toLocaleString()} {cur}</span>
                </div>
              )()})}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId ? 'Сохранить' : 'Добавить'}</button>
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
