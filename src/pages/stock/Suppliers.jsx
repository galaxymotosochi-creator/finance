import { useState, useEffect } from 'react';

const getSuppliers = () => JSON.parse(localStorage.getItem('suppliers88') || '[]');
const setSuppliers = (list) => localStorage.setItem('suppliers88', JSON.stringify(list));
const getSupplies = () => JSON.parse(localStorage.getItem('supplies88') || '[]');

const CONTACT_ICONS = { telegram:'📱', whatsapp:'💬', max:'🧑‍💼' };
const CONTACT_LABELS = { telegram:'Telegram', whatsapp:'WhatsApp', max:'MAX' };

export default function Suppliers() {
  const [suppliers, setSuppliersState] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fName, setFName] = useState('');
  const [fContact, setFContact] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fMethod, setFMethod] = useState('telegram');

  const load = () => setSuppliersState(getSuppliers());
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setFName(''); setFContact(''); setFPhone(''); setFMethod('telegram');
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditId(s.id); setFName(s.name); setFContact(s.contact||'');
    setFPhone(s.phone||''); setFMethod(s.contactMethod||'telegram');
    setShowModal(true);
  };

  const save = (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название');
    const list = getSuppliers();
    const obj = { name: fName.trim(), contact: fContact.trim(), phone: fPhone.trim(), contactMethod: fMethod };
    if (editId) {
      const idx = list.findIndex(x => x.id === editId);
      if (idx > -1) list[idx] = { ...list[idx], ...obj };
    } else { obj.id = Date.now(); list.unshift(obj); }
    setSuppliers(list); load(); setShowModal(false);
  };

  const remove = (id) => {
    if (!confirm('Удалить поставщика?')) return;
    setSuppliers(getSuppliers().filter(x => x.id !== id)); load();
  };

  const supplies = getSupplies();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Поставщики</h1>
          <div className="sub">Управляйте списком поставщиков</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAdd}>+ Добавить поставщика</button>
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
              <tr><td colSpan="7"><div className="empty-products"><div className="big-icon">🏢</div><p>Поставщиков пока нет. Нажмите «+ Добавить поставщика»</p></div></td></tr>
            ) : suppliers.map(s => {
              const supSupplies = supplies.filter(sp => sp.supplierName === s.name);
              const supplyCount = supSupplies.length;
              const totalSum = supSupplies.reduce((sum, sp) => sum + ((sp.qty||0) * (sp.cost||0)), 0);
              const icon = CONTACT_ICONS[s.contactMethod] || '📞';
              const label = CONTACT_LABELS[s.contactMethod] || s.contactMethod || '—';
              return (
                <tr key={s.id}>
                  <td><div className="prod-name" style={{fontSize:'.85rem'}}>{s.name}</div></td>
                  <td style={{fontSize:'.82rem',color:'var(--muted)'}}>{s.contact||'—'}</td>
                  <td style={{fontSize:'.82rem'}}>{s.phone||'—'}</td>
                  <td><span className="prod-cat">{icon} {label}</span></td>
                  <td>{supplyCount}</td>
                  <td><span className="num">{totalSum.toLocaleString()}₽</span></td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    <button className="act-btn prod-edit-btn" onClick={() => openEdit(s)}>Ред.</button>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={(e) => {
                        e.stopPropagation();
                        const dd = e.currentTarget.nextElementSibling;
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                        dd.classList.toggle('open');
                      }}>⋯</button>
                      <div className="prod-dropdown">
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
            <div className="sub">Введите данные поставщика</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название *</label>
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
                    <option value="telegram">📱 Telegram</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="max">🧑‍💼 MAX</option>
                  </select>
                </div>
                <div className="form-group"></div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId?'Сохранить':'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
