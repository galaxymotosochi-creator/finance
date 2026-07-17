import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const ALL_SECTIONS = [
  { id: 'dashboard', label: 'Панель управления' },
  { id: 'registers', label: 'Касса' },
  { id: 'finance', label: 'Финансы', children: [
    { id: 'finance.transactions', label: 'Транзакции' },
    { id: 'finance.accounts', label: 'Счета' },
    { id: 'finance.receipts', label: 'Чеки' },
    { id: 'finance.salary', label: 'Зарплата' },
    { id: 'finance.shifts', label: 'Смены' },
    { id: 'finance.pnl', label: 'Чистая прибыль' },
    { id: 'finance.categories', label: 'Категории' },
    { id: 'finance.plans', label: 'Планирование' },
  ]},
  { id: 'stock', label: 'Склад', children: [
    { id: 'stock.products', label: 'Товары и услуги' },
    { id: 'stock.categories', label: 'Категории' },
    { id: 'stock.turnover', label: 'Аналитика товаров' },
    { id: 'stock.stock', label: 'Остатки' },
    { id: 'stock.supplies', label: 'Поставки' },
    { id: 'stock.inventory', label: 'Инвентаризация' },
    { id: 'stock.writeoffs', label: 'Списания' },
    { id: 'stock.suppliers', label: 'Поставщики' },
  ]},
  { id: 'clients', label: 'Клиенты', children: [
    { id: 'clients.base', label: 'База клиентов' },
    { id: 'clients.loyalty', label: 'Лояльность' },
    { id: 'clients.promos', label: 'Акции' },
  ]},
  { id: 'team', label: 'Команда', children: [
    { id: 'team.employees', label: 'Сотрудники' },
    { id: 'team.positions', label: 'Должности' },
    { id: 'team.timesheet', label: 'Табель' },
  ]},
  { id: 'settings', label: 'Настройки', children: [
    { id: 'settings.general', label: 'Общие' },
    { id: 'settings.venues', label: 'Заведения' },
    { id: 'settings.subscription', label: 'Подписка' },
  ]},
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <span style={{position:'relative',display:'inline-block',width:'34px',height:'20px',flexShrink:0}}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{opacity:0,width:0,height:0,position:'absolute'}} />
      <span style={{
        position:'absolute',cursor:disabled?'default':'pointer',
        top:0,left:0,right:0,bottom:0,
        background:checked?'#111':'#ccc',
        borderRadius:'20px',transition:'background .15s',
        opacity:disabled?.4:1
      }}>
        <span style={{
          position:'absolute',content:'',height:'16px',width:'16px',
          left:'2px',bottom:'2px',
          background:'#fff',borderRadius:'50%',
          transition:'transform .15s',
          transform:checked?'translateX(14px)':'translateX(0)'
        }}></span>
      </span>
    </span>
  );
}

const BONUS_TYPES = [
  { value: 'none', label: 'Нет бонуса' },
  { value: 'percent', label: '% от продаж' },
  { value: 'fixed', label: 'Фиксированная сумма' },
  { value: 'category', label: 'Зависит от категории' },
];

const PAY_TYPE_LABELS = {
  fixed: 'Фиксированная',
  piecework: 'Сдельная',
  percent: '% с продаж',
  per_day: 'За смену',
  daily: 'За смену',
  hourly: 'Почасовая',
  monthly: 'Оклад',
};

export default function Positions() {
  const { user } = useAuth();
  const [positions, setPositionsState] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);

  const [fName, setFName] = useState('');
  const [fSalary, setFSalary] = useState('');
  const [fPayType, setFPayType] = useState('fixed');
  const [fBonusType, setFBonusType] = useState('none');
  const [fBonusValue, setFBonusValue] = useState('');
  const [fPermissions, setFPermissions] = useState([]);
  const [expanded, setExpanded] = useState({});

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
    setFBonusValue(''); setFPermissions([]); setExpanded({});
    setShow(true);
  };

  const openEdit = (p) => {
    setEditId(p.id); setFName(p.name); setFPayType(p.pay_type||'fixed'); setFSalary(String(p.salary||''));
    setFBonusType(p.bonus_type||'none'); setFBonusValue(String(p.bonus_value||''));
    setFPermissions(p.permissions||[]); setExpanded({});
    setShow(true);
  };

  const togglePerm = (pid, children) => {
    setFPermissions(prev => {
      const isOn = prev.includes(pid);
      if (children) {
        if (isOn) {
          return prev.filter(p => p !== pid && !children.some(c => c.id === p));
        } else {
          return [...prev.filter(p => !children.some(c => c.id === p)), pid];
        }
      } else {
        return isOn ? prev.filter(p => p !== pid) : [...prev, pid];
      }
    });
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

  const getSectionMeta = (id) => ALL_SECTIONS.find(s => s.id === id);

  const formatPayType = (p) => {
    const pt = p.pay_type || 'fixed';
    const label = PAY_TYPE_LABELS[pt] || pt;
    return label;
  };

  const formatSalary = (p) => {
    const pt = p.pay_type || 'fixed';
    if (pt === 'fixed' && p.salary) return Number(p.salary).toLocaleString() + ' ₽';
    if (pt === 'percent') return (p.salary || 0).toLocaleString() + ' ₽/смена';
    return '—';
  };

  const formatPermissions = (p) => {
    if (!p.permissions || p.permissions.length === 0) return 'Нет доступов';
    return p.permissions.map(permId => {
      const sec = getSectionMeta(permId);
      if (sec) return sec.label;
      const parentId = permId.split('.')[0];
      const parent = getSectionMeta(parentId);
      if (parent) {
        const child = parent.children?.find(c => c.id === permId);
        return (parent.label + ' → ' + (child ? child.label : permId.split('.')[1]));
      }
      return permId;
    }).join(', ');
  };

  const renderSectionToggle = (section) => {
    const isParentOn = fPermissions.includes(section.id);
    const hasChildren = section.children && section.children.length > 0;
    const isExpanded = expanded[section.id];
    const allChildOn = hasChildren && section.children.every(c => fPermissions.includes(c.id));
    return (
      <div key={section.id} style={{marginBottom:'.35rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'.25rem'}}>
          <label style={{display:'flex',alignItems:'center',gap:'.25rem',cursor:'pointer',fontSize:'.8rem',fontWeight:500,color:'rgba(0,0,0,.54)',fontFamily:'inherit',lineHeight:1.4,flex:1,minWidth:0}}>
            <Toggle checked={isParentOn || allChildOn} onChange={() => togglePerm(section.id, section.children)} />
            <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{section.label}</span>
          </label>
          {hasChildren && (
            <span onClick={() => setExpanded(prev => ({...prev, [section.id]: !prev[section.id]}))} style={{fontSize:'.65rem',color:'rgba(0,0,0,.34)',cursor:'pointer',padding:'.1rem .3rem',borderRadius:'4px',userSelect:'none',lineHeight:1,flexShrink:0}}>
              {isExpanded ? '▲' : '▼'}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div style={{paddingLeft:'1.25rem',marginTop:'.15rem',display:'flex',flexDirection:'column',gap:'.15rem'}}>
            {section.children.map(child => {
              const childOn = fPermissions.includes(child.id) || isParentOn;
              return (
                <label key={child.id} style={{display:'flex',alignItems:'center',gap:'.25rem',cursor:isParentOn?'default':'pointer',fontSize:'.75rem',fontWeight:400,color:isParentOn?'rgba(0,0,0,.34)':'rgba(0,0,0,.54)',fontFamily:'inherit',lineHeight:1.3}}>
                  <Toggle checked={childOn} onChange={() => { if (!isParentOn) togglePerm(child.id); }} disabled={isParentOn} />
                  <span>{child.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>
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
      ) : positions.length === 0 ? (
        <div className="empty-products">
          <div className="big-icon">👤</div>
          <p>Список должностей пуст</p>
          <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Создайте первую должность, чтобы настроить шаблоны прав доступа</p>
        </div>
      ) : (
        <div className="product-table" style={{overflowY:'auto',flex:1,minHeight:0}}>
          <table className="data-table">
            <thead id="colHeaders">
              <tr>
                <th style={{textAlign:'left',paddingLeft:0,width:'26%'}}>Название должности</th>
                <th style={{textAlign:'left',width:'16%'}}>Тип оплаты</th>
                <th style={{textAlign:'left',width:'14%'}}>Сумма</th>
                <th style={{textAlign:'left',width:'34%'}}>Группы прав доступа</th>
                <th style={{width:'10%',textAlign:'left'}}></th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => (
                <tr key={p.id}>
                  <td style={{textAlign:'left',paddingLeft:0,color:'#555'}}>
                    <span className="prod-name">{p.name}</span>
                  </td>
                  <td style={{textAlign:'left',color:'#555'}}>{formatPayType(p)}</td>
                  <td className="num" style={{textAlign:'left',color:'#555'}}>{formatSalary(p)}</td>
                  <td style={{textAlign:'left',color:'#555'}}>
                    {formatPermissions(p)}
                  </td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={(e) => {
                        e.stopPropagation();
                        const dd = e.currentTarget.nextElementSibling;
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                        dd.classList.toggle('open');var _r=dd.getBoundingClientRect();if(_r.bottom>window.innerHeight)dd.classList.add('up');else dd.classList.remove('up');
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={() => openEdit(p)}>Редактировать</button>
                        <button onClick={() => remove(p.id)} style={{color:'#dc3545'}}>Удалить</button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка */}
      <Modal open={show} onClose={()=>setShow(false)} title={editId ? 'Редактировать должность' : 'Новая должность'} subtitle="Параметры и права доступа новой должности" width="wide">
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
                      <option value="percent">За смену</option>
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

              {/* ПРАВА ДОСТУПА */}
              <div className="form-group" style={{marginTop:'.5rem'}}>
                <label>Доступ к разделам</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'.35rem .75rem',marginTop:'.4rem'}}>
                  {ALL_SECTIONS.map(renderSectionToggle)}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
      </Modal>
    </div>
  );
}
