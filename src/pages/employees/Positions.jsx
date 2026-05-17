import { useState, useEffect } from 'react';

const ALL_SECTIONS = [
  { id: 'dashboard', label: 'Панель управления', icon: '📊' },
  { id: 'registers', label: 'Касса', icon: '🛒' },
  { id: 'finance', label: 'Финансы', icon: '💰' },
  { id: 'stock', label: 'Склад и Каталог', icon: '📦' },
  { id: 'clients', label: 'Клиенты (CRM)', icon: '👥' },
  { id: 'team', label: 'Команда', icon: '👤' },
  { id: 'settings', label: 'Настройки', icon: '⚙️' },
];

const BONUS_TYPES = [
  { value: 'none', label: 'Нет бонуса' },
  { value: 'percent', label: '% от продаж' },
  { value: 'fixed', label: 'Фиксированная сумма' },
  { value: 'category', label: 'Зависит от категории' },
];

const getPositions = () => JSON.parse(localStorage.getItem('positions88') || '[]');
const setPositions = (list) => localStorage.setItem('positions88', JSON.stringify(list));

export default function Positions() {
  const [positions, setPositionsState] = useState([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);

  const [fName, setFName] = useState('');
  const [fSalary, setFSalary] = useState('');
  const [fBonusType, setFBonusType] = useState('none');
  const [fBonusValue, setFBonusValue] = useState('');
  const [fEmployees, setFEmployees] = useState('');
  const [fPermissions, setFPermissions] = useState(['clients', 'stock']);

  const load = () => setPositionsState(getPositions());
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null); setFName(''); setFSalary(''); setFBonusType('none');
    setFBonusValue(''); setFEmployees(''); setFPermissions(['clients', 'stock']);
    setShow(true);
  };

  const openEdit = (p) => {
    setEditId(p.id); setFName(p.name); setFSalary(String(p.salary||''));
    setFBonusType(p.bonusType||'none'); setFBonusValue(String(p.bonusValue||''));
    setFEmployees(p.employees||''); setFPermissions(p.permissions||['clients','stock']);
    setShow(true);
  };

  const save = (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название должности');
    const list = getPositions();
    const obj = {
      name: fName.trim(), salary: parseFloat(fSalary)||0,
      bonusType: fBonusType, bonusValue: parseFloat(fBonusValue)||0,
      employees: fEmployees.trim(), permissions: fPermissions,
    };
    if (editId) {
      const idx = list.findIndex(x => x.id === editId);
      if (idx > -1) list[idx] = { ...list[idx], ...obj };
    } else {
      obj.id = Date.now(); obj.createdAt = new Date().toISOString();
      list.unshift(obj);
    }
    setPositions(list); load(); setShow(false);
  };

  const remove = (id) => {
    if (!confirm('Удалить должность?')) return;
    setPositions(getPositions().filter(x => x.id !== id));
    load();
  };

  const togglePerm = (permId) => {
    setFPermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const formatBonus = (p) => {
    if (p.bonusType === 'none' || !p.bonusType) return null;
    if (p.bonusType === 'percent') return `${p.bonusValue}% с продаж`;
    if (p.bonusType === 'fixed') return `${p.bonusValue.toLocaleString()}₽`;
    if (p.bonusType === 'category') return 'Зависит от категории';
    return null;
  };

  const getEmployeeNames = (empStr) => {
    if (!empStr) return [];
    return empStr.split(',').map(s => s.trim()).filter(Boolean);
  };

  const getSectionMeta = (id) => ALL_SECTIONS.find(s => s.id === id);

  const countEmployees = (empStr) => {
    if (!empStr) return 0;
    return empStr.split(',').map(s => s.trim()).filter(Boolean).length;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Должности</h1>
          <div className="sub">Шаблоны ролей для сотрудников</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAdd}>+ Добавить должность</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        gap: '1.25rem', padding: '.75rem 0',
      }}>
        {positions.length === 0 ? (
          <div className="empty-products" style={{gridColumn:'1/-1'}}>
            <div className="big-icon">👤</div>
            <p>Должностей пока нет. Нажмите «+ Добавить должность»</p>
          </div>
        ) : positions.map(p => {
          const names = getEmployeeNames(p.employees);
          const count = names.length;
          const bonus = formatBonus(p);
          return (
            <div key={p.id} className="pos-card">
              {/* Шапка */}
              <div className="pos-card-header">
                <div className="pos-card-title">{p.name}</div>
                <span className="pos-badge">Шаблон</span>
              </div>

              {/* Финансы */}
              <div className="pos-card-section">
                <div className="pos-row">
                  <span className="pos-icon">👥</span>
                  <span className="pos-label">
                    В штате: <strong>{count} {count === 1 ? 'человек' : 'человека'}</strong>
                    {names.length > 0 && (
                      <span className="pos-names"> ({names.join(', ')})</span>
                    )}
                  </span>
                </div>
                <div className="pos-row">
                  <span className="pos-icon">💰</span>
                  <span className="pos-label">
                    Оклад по умолчанию: <strong>{p.salary ? p.salary.toLocaleString() + ' ₽' : '—'}</strong>
                  </span>
                </div>
                {bonus && (
                  <div className="pos-row">
                    <span className="pos-icon">🎯</span>
                    <span className="pos-label">
                      Бонус за продажи: <strong>{bonus}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Разделитель */}
              <div className="pos-divider" />

              {/* Доступы */}
              <div className="pos-card-section">
                <div className="pos-perms-label">Разрешенные разделы меню:</div>
                <div className="pos-perms-tags">
                  {p.permissions && p.permissions.length > 0 ? (
                    p.permissions.map(permId => {
                      const sec = getSectionMeta(permId);
                      return sec ? (
                        <span key={permId} className="pos-tag">{sec.icon} {sec.label}</span>
                      ) : null;
                    })
                  ) : (
                    <span style={{fontSize:'.82rem',color:'var(--muted)'}}>Нет доступов</span>
                  )}
                </div>
              </div>

              {/* Подвал */}
              <div className="pos-card-footer">
                <button className="act-btn prod-edit-btn" onClick={() => openEdit(p)}>Ред.</button>
                <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                  <button className="act-btn prod-more-btn" onClick={(e) => {
                    e.stopPropagation();
                    const dd = e.currentTarget.nextElementSibling;
                    document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                    dd.classList.toggle('open');
                  }}>⋯</button>
                  <div className="prod-dropdown">
                    <button onClick={() => remove(p.id)} style={{color:'#dc3545'}}>Удалить</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Модалка */}
      {show && (
        <div className="modal-overlay active" onClick={(e)=>{if(e.target.className==='modal-overlay active')setShow(false)}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <h2>{editId ? 'Редактировать должность' : 'Новая должность'}</h2>
            <div className="sub">Настройте шаблон роли</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название должности *</label>
                <input type="text" value={fName} onChange={e=>setFName(e.target.value)} placeholder="Менеджер по продажам" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Оклад (₽)</label>
                  <input type="number" value={fSalary} onChange={e=>setFSalary(e.target.value)} placeholder="50000" min="0" />
                </div>
                <div className="form-group">
                  <label>Тип бонуса</label>
                  <select value={fBonusType} onChange={e=>setFBonusType(e.target.value)}>
                    {BONUS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              {fBonusType !== 'none' && (
                <div className="form-group">
                  <label>{fBonusType === 'percent' ? 'Процент от продаж' : fBonusType === 'fixed' ? 'Сумма бонуса (₽)' : 'Описание бонуса'}</label>
                  <input type="text" value={fBonusValue} onChange={e=>setFBonusValue(e.target.value)}
                    placeholder={fBonusType === 'percent' ? '5' : fBonusType === 'fixed' ? '10000' : 'Зависит от категории'} />
                </div>
              )}
              <div className="form-group">
                <label>Сотрудники (имена через запятую)</label>
                <input type="text" value={fEmployees} onChange={e=>setFEmployees(e.target.value)} placeholder="Павел, Иван, Ангелина" />
              </div>

              {/* Доступы */}
              <div className="form-group">
                <label>Разрешенные разделы меню</label>
                <div className="pos-perms-grid">
                  {ALL_SECTIONS.map(s => (
                    <label key={s.id} className={`pos-perm-check${fPermissions.includes(s.id) ? ' checked' : ''}`}
                      onClick={() => togglePerm(s.id)}>
                      <input type="checkbox" checked={fPermissions.includes(s.id)}
                        onChange={() => {}} style={{display:'none'}} />
                      <span className="pos-perm-check-icon">{s.icon}</span>
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editId ? 'Сохранить' : 'Создать должность'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
