import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const getSupplies = () => JSON.parse(localStorage.getItem('supplies88') || '[]');

const CONTACT_ICONS = { telegram:'📱', whatsapp:'💬', max:'🧑‍💼' };
const CONTACT_LABELS = { telegram:'Telegram', whatsapp:'WhatsApp', max:'MAX' };

export default function Suppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliersState] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fName, setFName] = useState('');
  const [fContact, setFContact] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fMethod, setFMethod] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').eq('user_id', user.id).order('created_at');
    if (data) setSuppliersState(data);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

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
    if (editId) {
      const { error } = await supabase.from('suppliers').update(obj).eq('id', editId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from('suppliers').insert({ ...obj, id: Date.now(), user_id: user.id });
      if (error) return alert(error.message);
    }
    await load(); setShowModal(false);
  };

  const remove = async (id) => {
    if (!confirm('Удалить поставщика?')) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) return alert(error.message);
    await load();
  };

  const supplies = getSupplies();

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Поставщики</h1>
          <div className="sub">База контрагентов и история сотрудничества</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={openAdd}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table>
          <thead id="supColHeaders">
            <tr>
              <th>Название</th>
              <th>Контакт</th>
              <th>Телефон</th>
              <th>Способ связи</th>
              <th>Поставок</th>
              <th>Сумма</th>
              <th style={{width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="supplierTableBody">
            {suppliers.length === 0 ? (
              <tr><td colSpan="7"><div className="empty-products"><div className="big-icon">🏢</div><p>Список поставщиков пуст</p><p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Внесите первого контрагента, чтобы начать работу</p></div></td></tr>
            ) : suppliers.map(s => {
              const supSupplies = supplies.filter(sp => sp.supplierName === s.name);
              const supplyCount = supSupplies.length;
              const totalSum = supSupplies.reduce((sum, sp) => sum + ((sp.qty||0) * (sp.cost||0)), 0);
              const icon = CONTACT_ICONS[s.contact_method] || '📞';
              const label = CONTACT_LABELS[s.contact_method] || s.contact_method || '—';
              return (
                <tr key={s.id}>
                  <td style={{whiteSpace:'nowrap'}}><div className="prod-name">{s.name}</div></td>
                  <td style={{whiteSpace:'nowrap',color:'#555'}}>{s.contact||'—'}</td>
                  <td style={{color:'#555'}}>{s.phone||'—'}</td>
                  <td style={{color:'#555'}}><span className="prod-cat">{icon} {label}</span></td>
                  <td style={{color:'#555'}}>{supplyCount}</td>
                  <td style={{color:'#555'}}><span className="num">{totalSum.toLocaleString()} ₽</span></td>
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

      {/* Модалка */}
      {showModal && (
        <div className="modal-overlay active" onClick={(e)=>{if(e.target.className==='modal-overlay active')setShowModal(false)}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>setShowModal(false)}>&times;</button>
            <h2>{editId?'Редактировать поставщика':'Добавить поставщика'}</h2>
            <div className="sub">Создание карточки нового контрагента</div>
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
                <button type="submit" className="btn btn-account-select">{editId?'Сохранить':'Добавить'}</button>
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
