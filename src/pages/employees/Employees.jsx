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
  const [loading, setLoading] = useState(true);
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
    setFBonusRules([]); setFPermissions(['clients', 'stock']);
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

  const fmtDate = (d) => { if (!d) return '—'; const p = d.split('-'); return p.length === 3 ? p[2]+'.'+p[1]+'.'+p[0].slice(2) : d; };

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
          <div className="sub">Управление персоналом</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAdd}>+ Добавить сотрудника</button>
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
        <table>
          <thead><tr>
            <th>Сотрудник</th><th>Должность</th><th>Телефон</th><th>E-mail</th>
            <th>Принят</th><th>Оклад</th><th>С продаж</th><th style={{width:'110px'}}></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="8"><div className="empty-products"><div className="big-icon">👤</div><p>Сотрудников пока нет</p></div></td></tr>
            ) : filtered.map(emp => {
              const pos = getPosition(emp.position_id);
              return (
                <tr key={emp.id}>
                  <td>
                    <div className="prod-name">{emp.name}</div>
                    {emp.status === 'inactive' && <span style={{fontSize:'.7rem',color:'#dc3545'}}>Уволен</span>}
                  </td>
                  <td style={{fontSize:'.82rem'}}>{pos ? pos.name : '—'}</td>
                  <td style={{fontSize:'.82rem'}}>{emp.phone || '—'}</td>
                  <td style={{fontSize:'.82rem',color:'var(--muted)'}}>{emp.email || '—'}</td>
                  <td style={{fontSize:'.82rem'}}>{fmtDate(emp.hire_date)}</td>
                  <td>{emp.base_salary ? Number(emp.base_salary).toLocaleString()+'₽' : '—'}</td>
                  <td style={{fontSize:'.8rem'}}>{getRulesSummary(emp)}</td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    <button className="act-btn prod-edit-btn" onClick={() => openEdit(emp)}>Ред.</button>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={e => {
                        e.stopPropagation();
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => d.classList.remove('open'));
                        e.currentTarget.nextElementSibling.classList.toggle('open');
                      }}>⋯</button>
                      <div className="prod-dropdown">
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
      {show && (
        <div className="modal-overlay active" onClick={e => { if(e.target.className==='modal-overlay active') setShow(false); }}>
          <div className="modal-box" style={{maxWidth:'560px'}}>
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <h2>{editId ? 'Редактировать' : 'Новый сотрудник'}</h2>
            <div className="sub">Заполните данные</div>
            <form onSubmit={save}>

              {/* БЛОК 1: БАЗА */}
              <div className="form-group">
                <label>ФИО *</label>
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
                  <label>Дата приёма</label>
                  <input type="date" value={fHireDate} onChange={e=>setFHireDate(e.target.value)} />
                </div>
              </div>

              {/* БЛОК 2: ЗАРПЛАТА */}
              <div className="form-row">
                <div className="form-group">
                  <label>Оклад (₽)</label>
                  <input type="number" value={fBaseSalary} onChange={e=>setFBaseSalary(e.target.value)} placeholder="50000" min="0" />
                  {fPositionId && <div className="emp-hint">Из должности: {(positions.find(p=>p.id===fPositionId)?.salary||0).toLocaleString()}₽</div>}
                </div>
                <div className="form-group">
                  <label>Тип бонуса</label>
                  <select value={fBonusType} onChange={e=>setFBonusType(e.target.value)}>
                    <option value="none">Нет бонуса</option>
                    <option value="percent">% от продаж</option>
                    <option value="fixed">Фиксированная сумма</option>
                  </select>
                </div>
              </div>
              {fBonusType === 'fixed' && (
                <div className="form-group">
                  <label>Сумма бонуса (₽)</label>
                  <input type="text" value={fBonusValue} onChange={e=>setFBonusValue(e.target.value)} placeholder="10000" />
                </div>
              )}

              {fBonusType === 'percent' && (<>
              <div className="emp-section-label">Процент с продаж</div>

              {/* ── Общие ── */}
              <div className="form-row">
                <div className="form-group">
                  <label>Все товары (%)</label>
                  <input type="number" value={(()=>{const r=fBonusRules.find(r=>r.scope==='all'&&r.type==='product');return r?r.rate:''})()}
                    onChange={e=>{const v=parseFloat(e.target.value)||0;const existing=fBonusRules.findIndex(r=>r.scope==='all'&&r.type==='product');if(existing>-1)updRule(existing,'rate',v);else addBonusRule('all','product',v)}}
                    placeholder="%" min="0" max="100" />
                </div>
                <div className="form-group">
                  <label>Все услуги (%)</label>
                  <input type="number" value={(()=>{const r=fBonusRules.find(r=>r.scope==='all'&&r.type==='service');return r?r.rate:''})()}
                    onChange={e=>{const v=parseFloat(e.target.value)||0;const existing=fBonusRules.findIndex(r=>r.scope==='all'&&r.type==='service');if(existing>-1)updRule(existing,'rate',v);else addBonusRule('all','service',v)}}
                    placeholder="%" min="0" max="100" />
                </div>
              </div>

              {/* ── Правила: категории и товары ── */}
              <div style={{marginTop:'.5rem',display:'flex',flexDirection:'column',gap:'.3rem'}}>
                {fBonusRules.filter(r => r.scope !== 'all').map(rule => {
                  const realIdx = fBonusRules.indexOf(rule);
                  const isCat = rule.scope === 'category-item' || rule.scope === 'category';
                  const badgeClass = 'emp-rule-badge ' + (isCat ? 'cat' : 'item');
                  const badgeText = isCat ? (rule.type === 'product' ? '📦' : '🔧') : (rule.type === 'product' ? '📦' : '🔧');
                  const displayName = rule.catName || rule.itemName || rule.name || '—';
                  return (
                    <div key={realIdx} className="emp-rule-line">
                      <span className={badgeClass}>{badgeText}</span>
                      <span className="emp-rule-name">{displayName}</span>
                      <input type="number" className="emp-rule-pct" value={rule.rate}
                        onChange={e => updRule(realIdx,'rate',parseFloat(e.target.value)||0)} placeholder="%" min="0" max="100" />
                      <span className="emp-rule-pct-label">%</span>
                      <button type="button" className="emp-row-rm" onClick={() => rmRule(realIdx)}>✕</button>
                    </div>
                  );
                })}
              </div>

              <div style={{position:'relative',marginTop:'.08rem'}}>
                <button type="button" className="emp-rule-add" onClick={() => setShowAddRule(!showAddRule)}>
                  {showAddRule ? '✕ Отмена' : '+ Добавить правило'}
                </button>

                {showAddRule && (
                  <div className="emp-add-rule-dd">
                    <input type="text" className="emp-add-rule-search" placeholder="🔍 Поиск категории или товара..."
                      value={addRuleSearch} onChange={e => setAddRuleSearch(e.target.value)} autoFocus />
                    <div className="emp-add-rule-list">
                      {(() => {
                        const allItems = [
                          ...prodCats.map(c => ({ id: c.id||c.name, name: c.name, type: 'Категория товаров', kind: 'cat', catType: 'product' })),
                          ...svcCats.map(c => ({ id: c.id||c.name, name: c.name, type: 'Категория услуг', kind: 'cat', catType: 'service' })),
                          ...products.filter(p=>p.type==='product').map(p => ({ id: p.id||p.name, name: p.name, type: 'Товар', kind: 'item', catType: 'product' })),
                          ...products.filter(p=>p.type==='service').map(p => ({ id: p.id||p.name, name: p.name, type: 'Услуга', kind: 'item', catType: 'service' })),
                        ];
                        const sq = addRuleSearch.toLowerCase().trim();
                        const filtered = sq ? allItems.filter(i => i.name.toLowerCase().includes(sq) || i.type.toLowerCase().includes(sq)) : allItems;
                        const existing = fBonusRules.filter(r => r.scope!=='all').map(r => r.catName||r.itemName||r.name);
                        return filtered.filter(i => !existing.includes(i.name)).map((i, idx) => (
                          <div key={i.id+idx} className="emp-add-rule-item" onClick={() => {
                            if (i.kind === 'cat') {
                              addBonusRule('category-item', i.catType, 0);
                              setTimeout(() => {
                                const li = fBonusRules.length;
                                updRule(li,'catId',i.id);
                                updRule(li,'catName',i.name);
                                setAddRuleSearch('');
                              }, 0);
                            } else {
                              addBonusRule('item-item', i.catType, 0);
                              setTimeout(() => {
                                const li = fBonusRules.length;
                                updRule(li,'itemId',i.id);
                                updRule(li,'itemName',i.name);
                                setAddRuleSearch('');
                              }, 0);
                            }
                          }}>
                            <span className="emp-rule-badge cat">{i.kind === 'cat' ? '📦' : '📦'}</span>
                            <span className="emp-add-rule-name">{i.name}</span>
                            <span className="emp-add-rule-type">{i.type}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
              </>)}

              {/* БЛОК 4: ДОСТУПЫ + КАССА */}
              <div className="emp-section-label">Доступы</div>
              <div className="pos-perms-grid" style={{marginBottom:'.75rem'}}>
                {ALL_SECTIONS.map(s => (
                  <div key={s.id} className={`pos-perm-check${fPermissions.includes(s.id) ? ' checked' : ''}`}
                    onClick={() => togglePerm(s.id)} role="button" tabIndex={0}
                    onKeyDown={e => { if(e.key==='Enter'||e.key===' ') { e.preventDefault(); togglePerm(s.id); } }}>
                    <span className="pos-perm-check-icon">{s.icon}</span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>

              {fPermissions.includes('registers') && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Пин-код кассы</label>
                    <div style={{display:'flex',gap:'.5rem',alignItems:'center'}}>
                      <input type="text" value={fPin} onChange={e=>setFPin(e.target.value)} placeholder="1234" maxLength={4} style={{width:'100px'}} />
                      <button type="button" className="btn btn-outline" onClick={genPin} style={{fontSize:'.78rem',padding:'.3rem .6rem'}}>🎲 Сгенерировать</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="emp-section-label" style={{marginTop:'.75rem'}}>Выдать доступ</div>
              <p className="sub" style={{fontSize:'.78rem',marginBottom:'.5rem'}}>Сотруднику на e-mail придёт ссылка-приглашение для входа в систему.</p>
              <button type="button" className="btn-green" onClick={() => alert('Функция будет доступна позже')}>
                ✉️ Выдать доступ
              </button>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId ? 'Сохранить' : 'Добавить сотрудника'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
