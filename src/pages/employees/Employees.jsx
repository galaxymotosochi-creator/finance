import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const ALL_SECTIONS = [
  { id: 'dashboard', label: 'Панель управления', icon: '📊' },
  { id: 'registers', label: 'Касса', icon: '🛒' },
  { id: 'finance', label: 'Финансы', icon: '💰' },
  { id: 'stock', label: 'Склад и Каталог', icon: '📦' },
  { id: 'clients', label: 'Клиенты (CRM)', icon: '👥' },
  { id: 'team', label: 'Команда', icon: '👤' },
  { id: 'settings', label: 'Настройки', icon: '⚙️' },
];

const getCats = () => JSON.parse(localStorage.getItem('allCats88') || '[]');
const getProducts = () => JSON.parse(localStorage.getItem('products88') || '[]');

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [allCats, setAllCats] = useState([]);
  const [allProds, setAllProds] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const [fName, setFName] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPositionId, setFPositionId] = useState('');
  const [fHireDate, setFHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [fBaseSalary, setFBaseSalary] = useState('');
  const [fBonusType, setFBonusType] = useState('none');
  const [fBonusValue, setFBonusValue] = useState('');
  const [fBonusRules, setFBonusRules] = useState([]);
  const [fPermissions, setFPermissions] = useState(['clients', 'stock']);
  const [fPin, setFPin] = useState('');
  const [fStatus, setFStatus] = useState('active');
  const [showAddRule, setShowAddRule] = useState(false);
  const [addRuleSearch, setAddRuleSearch] = useState('');

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }
    try {
      const [empRes, posRes] = await Promise.all([
        supabase.from('employees').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('position_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      if (empRes.error) { alert('Ошибка загрузки: ' + empRes.error.message); return; }
      if (empRes.data) setEmployees(empRes.data);
      if (posRes.data) setPositions(posRes.data);
    } catch (e) { alert('Ошибка загрузки: ' + e.message); }
    setAllCats(getCats());
    setAllProds(getProducts());
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const getPosition = (id) => positions.find(p => p.id === id);

  const onPositionChange = (posId) => {
    setFPositionId(posId);
    const pos = positions.find(p => p.id === posId);
    if (pos) {
      setFBaseSalary(String(pos.salary || ''));
      setFBonusType(pos.bonus_type || 'none');
      setFBonusValue(String(pos.bonus_value || ''));
      if (pos.permissions && pos.permissions.length > 0) setFPermissions(pos.permissions);
    }
  };

  const openAdd = () => {
    setEditId(null); setFName(''); setFPhone(''); setFEmail('');
    setFPositionId(''); setFHireDate(new Date().toISOString().split('T')[0]);
    setFBaseSalary(''); setFBonusType('none'); setFBonusValue('');
    setFBonusRules([]); setFPermissions([]);
    setFPin(''); setFStatus('active'); setShow(true);
  };

  const openEdit = (e) => {
    setEditId(e.id); setFName(e.name); setFPhone(e.phone||'');
    setFEmail(e.email||''); setFPositionId(e.position_id||'');
    setFHireDate(e.hire_date || new Date().toISOString().split('T')[0]);
    setFBaseSalary(String(e.base_salary||''));
    setFBonusType(e.bonus_type||'none');
    setFBonusValue(String(e.bonus_value||''));
    setFBonusRules(e.bonus_rules || []);
    setFPermissions(e.permissions||['clients','stock']);
    setFPin(e.pin||''); setFStatus(e.status||'active'); setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите имя сотрудника');
    if (!user) return alert('Ошибка: пользователь не авторизован');
    try {
      const obj = {
        user_id: user.id, name: fName.trim(), phone: fPhone.trim(),
        email: fEmail.trim(), position_id: fPositionId || null,
        hire_date: fHireDate, base_salary: parseFloat(fBaseSalary)||0,
        bonus_type: fBonusType, bonus_value: parseFloat(fBonusValue)||0,
        bonus_rules: fBonusRules, permissions: fPermissions,
        pin: fPin, status: fStatus,
      };
      if (editId) await supabase.from('employees').update(obj).eq('id', editId);
      else await supabase.from('employees').insert(obj);
      await load(); setShow(false);
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Удалить сотрудника?')) return;
    try { await supabase.from('employees').delete().eq('id', id); await load(); }
    catch (err) { alert('Ошибка удаления: ' + err.message); }
  };

  const togglePerm = (pid) => setFPermissions(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);
  const genPin = () => setFPin(String(1000 + Math.floor(Math.random() * 9000)));
  const addBonusRule = (scope, type, rate = 0) => setFBonusRules(prev => [...prev, { scope, type, rate, name: '', catId: '', catName: '', itemId: '', itemName: '' }]);
  const updRule = (idx, field, val) => setFBonusRules(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: val }; return n; });
  const rmRule = (idx) => setFBonusRules(prev => prev.filter((_, i) => i !== idx));

  const fmtDate = (d) => { if (!d) return '—'; const datePart = d.split('T')[0]; const p = datePart.split('-'); return p.length === 3 ? p[2]+'.'+p[1]+'.'+p[0].slice(2) : d; };

  const getRulesSummary = (emp) => {
    const rules = emp.bonus_rules || []; const parts = [];
    const allP = rules.find(r => r.scope === 'all' && r.type === 'product');
    const allS = rules.find(r => r.scope === 'all' && r.type === 'service');
    if (allP) parts.push('товар '+allP.rate+'%');
    if (allS) parts.push('услуги '+allS.rate+'%');
    rules.filter(r => r.scope === 'category').forEach(c => parts.push(c.catName+' '+c.rate+'%'));
    rules.filter(r => r.scope === 'item').forEach(i => parts.push(i.itemName+' '+i.rate+'%'));
    return parts.length ? parts.join(', ') : '—';
  };

  const q = search.toLowerCase().trim();
  let filtered = employees;
  if (q) filtered = filtered.filter(e => e.name.toLowerCase().includes(q) || (e.phone||'').includes(q) || (e.email||'').toLowerCase().includes(q));

  const prodCats = allCats.filter(c => c.type === 'product');
  const svcCats = allCats.filter(c => c.type === 'service');
  const products = allProds;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Сотрудники</h1>
          <div className="sub">Управление командой, должностями и правами</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={openAdd}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />
      <div className="search-row">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input type="text" className="search-field" placeholder="Быстрый поиск" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>
      ) : (
      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table className="data-table">
          <thead id="colHeaders"><tr>
            <th style={{textAlign:'left',whiteSpace:'nowrap'}}>Сотрудник</th><th style={{textAlign:'left',whiteSpace:'nowrap'}}>Должность</th><th style={{textAlign:'left',whiteSpace:'nowrap'}}>Телефон</th><th style={{textAlign:'left',whiteSpace:'nowrap'}}>E-mail</th>
            <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Принят</th><th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Оклад</th><th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>С продаж</th><th style={{width:'110px',textAlign:'left'}}></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="8"><div className="empty-products"><div className="big-icon">👤</div><p>Список сотрудников пуст</p>
                    <p style={{color:'var(--muted)',margin:'.5rem 0 0'}}>Добавьте первого участника команды и настройте его права доступа</p></div></td></tr>
            ) : filtered.map(emp => {
              const pos = getPosition(emp.position_id);
              return (
                <tr key={emp.id}>
                  <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#555'}}>
                    <div className="prod-name" style={{color:'#555'}}>{emp.name}</div>
                    {emp.status === 'inactive' && <span>Уволен</span>}
                  </td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap',color:'#555'}}>{pos ? pos.name : '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{emp.phone || '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{emp.email || '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{fmtDate(emp.hire_date)}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{emp.base_salary ? Number(emp.base_salary).toLocaleString()+' ₽' : '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{getRulesSummary(emp)}</td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={e => {
                        e.stopPropagation();
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => d.classList.remove('open'));
                        e.currentTarget.nextElementSibling.classList.toggle('open');
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={() => openEdit(emp)}>Редактировать</button>
                        <button onClick={() => remove(emp.id)} style={{color:'#dc3545'}}>Удалить</button>
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

      {/* ============ МОДАЛКА ============ */}
      <Modal open={show} onClose={()=>setShow(false)} title={editId ? 'Редактировать сотрудника' : 'Новый сотрудник'} subtitle="Создание карточки сотрудника" width="wide">
        <form onSubmit={save}>

              {/* БЛОК 1: БАЗА */}
              <div className="form-group">
                <label>ФИО</label>
                <input type="text" value={fName} onChange={e=>setFName(e.target.value)} placeholder="Иван Петров" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Телефон</label>
                  <input type="text" value={fPhone} onChange={e=>setFPhone(e.target.value)} placeholder="+7 (999) 123-45-67" />
                </div>
                <div className="form-group">
                  <label>E-mail</label>
                  <input type="email" value={fEmail} onChange={e=>setFEmail(e.target.value)} placeholder="ivan@example.com" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Должность</label>
                  <select value={fPositionId} onChange={e => onPositionChange(e.target.value)}>
                    <option value="">— Без должности —</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Дата приема</label>
                  <input type="date" value={fHireDate} onChange={e=>setFHireDate(e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Пин-код кассы</label>
                  <div style={{display:'flex',gap:'.5rem'}}>
                    <input type="text" value={fPin} onChange={e=>setFPin(e.target.value)} placeholder="1234" maxLength={4} />
                  </div>
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <button type="button" style={{width:'100%',padding:'.5rem .65rem',borderRadius:'var(--radius-md)',border:'none',background:'#ffdd2d',color:'#000',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'.4rem',fontFamily:'inherit',boxSizing:'border-box',height:'38px'}} onClick={async () => {
            if (!fEmail.trim()) return alert('Введите email сотрудника');
            if (!editId) return alert('Сначала сохраните сотрудника');
            try {
              var s = JSON.parse(localStorage.getItem('atlaspos_session') || '{}');
              var r = await fetch('/api/invite-user', {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':'Bearer ' + (s.access_token || '')},
                body:JSON.stringify({email:fEmail.trim(), employeeId:editId, employeeName:fName.trim()})
              });
              var j = await r.json();
              if (j.error) return alert('Ошибка: ' + j.error);
              alert('Приглашение отправлено на ' + fEmail);
            } catch(e) { alert('Ошибка: ' + e.message); }
          }}>
                    <span>✉️</span> Выдать доступ
                  </button>
                </div>
              </div>



              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId ? 'Сохранить' : 'Добавить сотрудника'}</button>
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
