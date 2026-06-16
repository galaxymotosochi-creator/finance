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

const BONUS_TYPES = [
  { value: 'none', label: 'Нет бонуса' },
  { value: 'percent', label: '% от продаж' },
  { value: 'fixed', label: 'Фиксированная сумма' },
  { value: 'category', label: 'Зависит от категории' },
];

export default function Positions() {
  const { user } = useAuth();
  const [positions, setPositionsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);

  const [fName, setFName] = useState('');
  const [fSalary, setFSalary] = useState('');
  const [fPayType, setFPayType] = useState('fixed');
  const [fBonusType, setFBonusType] = useState('none');
  const [fBonusValue, setFBonusValue] = useState('');
  const [fPermissions, setFPermissions] = useState(['clients', 'stock']);

  const [empCount, setEmpCount] = useState({});

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }
    try {
      const [posRes, empRes] = await Promise.all([
        supabase.from('position_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('employees').select('position_id').eq('user_id', user.id),
      ]);
      if (posRes.error) { alert('Ошибка загрузки: ' + posRes.error.message); return; }
      if (posRes.data) setPositionsState(posRes.data);
      // Считаем сотрудников по должностям
      const counts = {};
      if (empRes.data) {
        empRes.data.forEach(e => {
          if (e.position_id) counts[e.position_id] = (counts[e.position_id] || 0) + 1;
        });
      }
      setEmpCount(counts);
    } catch (e) { alert('Ошибка загрузки: ' + e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openAdd = () => {
    setEditId(null); setFName(''); setFSalary(''); setFPayType('fixed'); setFBonusType('none');
    setFBonusValue(''); setFPermissions(['clients', 'stock']);
    setShow(true);
  };

  const openEdit = (p) => {
    setEditId(p.id); setFName(p.name); setFPayType(p.pay_type||'fixed'); setFSalary(String(p.salary||''));
    setFBonusType(p.bonus_type||'none'); setFBonusValue(String(p.bonus_value||''));
    setFPermissions(p.permissions||['clients','stock']);
    setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название должности');
    if (!user) return alert('Ошибка: пользователь не авторизован');
    try {
      const obj = {
        user_id: user.id, name: fName.trim(),
        salary: fPayType === 'fixed' ? parseFloat(fSalary)||0 : 0,
        bonus_type: fBonusType,
        bonus_value: parseFloat(fBonusValue)||0,
        permissions: fPermissions,
      };
      if (editId) {
        try { await supabase.from('position_templates').update({...obj, pay_type: fPayType}).eq('id', editId); } catch(e) { await supabase.from('position_templates').update(obj).eq('id', editId); }
      } else {
        try { await supabase.from('position_templates').insert({...obj, pay_type: fPayType}); } catch(e) { await supabase.from('position_templates').insert(obj); }
      }
      await load();
      setShow(false);
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Удалить должность?')) return;
    try {
      await supabase.from('position_templates').delete().eq('id', id);
      await load();
    } catch (err) { alert('Ошибка удаления: ' + err.message); }
  };

  const togglePerm = (permId) => {
    setFPermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const formatBonus = (p) => {
    const bt = p.bonus_type;
    const bv = p.bonus_value;
    if (bt === 'none' || !bt) return null;
    if (bt === 'percent') return `${bv}% с продаж`;
    if (bt === 'fixed') return `${Number(bv).toLocaleString()}₽`;
    if (bt === 'category') return 'Зависит от категории';
    return null;
  };

  const getSectionMeta = (id) => ALL_SECTIONS.find(s => s.id === id);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Должности</h1>
          <div className="sub">Управление должностями и группами прав доступа</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={openAdd}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {loading ? (
        <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>
      ) : (
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        gap: '1.25rem', padding: '.75rem 0',
      }}>
        {positions.length === 0 ? (
          <div className="empty-products" style={{gridColumn:'1/-1'}}>
            <div className="big-icon">👤</div>
            <p>Список должностей пуст</p>
            <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Создайте первую должность, чтобы настроить шаблоны прав доступа</p>
          </div>
        ) : positions.map(p => {
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
                    В штате: <strong>{empCount[p.id] || 0} {empCount[p.id] === 1 ? 'человек' : 'человека'}</strong>
                  </span>
                </div>
                <div className="pos-row">
                  <span className="pos-icon">💰</span>
                  <span className="pos-label">
                    Оклад по умолчанию: <strong>{p.salary ? Number(p.salary).toLocaleString() + ' ₽' : '—'}</strong>
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
                <div className="pos-perms-label">Группы прав доступа:</div>
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
                    dd.classList.toggle('open');var _r=dd.getBoundingClientRect();if(_r.bottom>window.innerHeight)dd.classList.add('up');else dd.classList.remove('up');
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
      )}

      {/* Модалка */}
      {show && (
        <div className="modal-overlay active" onClick={(e)=>{if(e.target.className==='modal-overlay active')setShow(false)}}>
          <div className="modal-box">
            <button className="modal-close" onClick={()=>setShow(false)}>&times;</button>
            <h2>{editId ? 'Редактировать должность' : 'Новая должность'}</h2>
            <div className="sub">Параметры и права доступа новой должности</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название должности</label>
                <input type="text" value={fName} onChange={e=>setFName(e.target.value)} placeholder="Менеджер по продажам" required />
              </div>
              <div style={{display:'flex',gap:'10px'}}>
                <div style={{flex:1}}>
                  <div className="form-group">
                    <label>Тип оплаты</label>
                    <select value={fPayType} onChange={e => setFPayType(e.target.value)}>
                      <option value="fixed">Фиксир.</option>
                      <option value="piecework">Сдельная</option>
                      <option value="percent">Процентная</option>
                    </select>
                  </div>
                </div>
                <div style={{flex:1,display: fPayType === 'fixed' ? 'block' : 'none'}}>
                  <div className="form-group">
                    <label>Сумма (руб)</label>
                    <input type="number" value={fSalary} onChange={e=>setFSalary(e.target.value)} placeholder="50000" min="0" />
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div className="form-group">
                    <label>Тип бонуса</label>
                    <select value={fBonusType} onChange={e=>setFBonusType(e.target.value)}>
                      {BONUS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {fBonusType !== 'none' && (
                <div className="form-group">
                  <label>{fBonusType === 'percent' ? 'Процент от продаж' : fBonusType === 'fixed' ? 'Сумма бонуса (₽)' : 'Описание бонуса'}</label>
                  <input type="text" value={fBonusValue} onChange={e=>setFBonusValue(e.target.value)}
                    placeholder={fBonusType === 'percent' ? '5' : fBonusType === 'fixed' ? '10000' : 'Зависит от категории'} />
                </div>
              )}

              {/* Доступы */}
              <div className="form-group">
                <label>Группы прав доступа</label>
                <div className="pos-perms-grid">
                  {ALL_SECTIONS.map(s => (
                    <div key={s.id} className={`pos-perm-check${fPermissions.includes(s.id) ? ' checked' : ''}`}
                      onClick={() => togglePerm(s.id)} role="button" tabIndex={0}
                      onKeyDown={e => { if(e.key==='Enter'||e.key===' ') { e.preventDefault(); togglePerm(s.id); } }}>
                      <span className="pos-perm-check-icon">{s.icon}</span>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
