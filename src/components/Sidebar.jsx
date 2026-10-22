import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState as useLocalState, useEffect as useLocalEffect } from 'react';

const svgIcons = {
  dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  ai: '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;font-size:14px;font-weight:800;letter-spacing:.02em;color:#999">AI</span>',
  registers: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="21" r="1" fill="#999"/><circle cx="20" cy="21" r="1" fill="#999"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
  finance: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  stock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="19.5" r="1.5"/><circle cx="18.5" cy="19.5" r="1.5"/></svg>',
  clients: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4" fill="#999" opacity=".15"/></svg>',
  team: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4" fill="#999" opacity=".15"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  menu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M6 13v8"/><path d="M16 3c-1.7 0-3 1.8-3 4v3a2 2 0 0 0 2 2h1v9"/></svg>',
  planet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7.2"/><path d="M4.6 15.8c-1.9.8-3.1 1.9-3.1 3.1 0 2.1 4.7 3.7 10.5 3.7s10.5-1.6 10.5-3.7c0-1.2-1.2-2.3-3.1-3.1"/><path d="M8.5 8.2a5 5 0 016.9 1.5"/></svg>',
  reports: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
};

const menu = [
  { label: 'Панель управления', path: '/dashboard', icon: 'dashboard' },
  { label: 'AI помощник', path: '/ai-assistant', icon: 'ai' },
  { label: 'Касса', path: '/kassa', icon: 'registers' },
  { label: 'Мой сайт', path: '/my-site', icon: 'planet' },
  {
    label: 'Финансы', icon: 'finance', children: [
      { label: 'Доходы и расходы', path: '/finance/transactions' },
      { label: 'Счета', path: '/finance/accounts' },
      { label: 'Смены', path: '/finance/shifts' },
      { label: 'Чеки', path: '/finance/receipts' },
      { label: 'Зарплата', path: '/finance/salary' },
      { label: 'Чистая прибыль', path: '/finance/pnl' },
      { label: 'Категории', path: '/finance/categories' },
      { label: 'Планирование', path: '/finance/plans' },
    ],
  },
  {
    label: 'Меню', icon: 'menu', onlyFood: true, children: [
      { label: 'Тех. карты', path: '/stock/techcards' },
      { label: 'Полуфабрикаты', path: '/stock/semifinished' },
      { label: 'Ингредиенты', path: '/stock/ingredients' },
      { label: 'Категории блюд и тех.карт', path: '/stock/categories' },
      { label: 'Категории ингредиентов', path: '/stock/ing-categories' },
      { label: 'Цеха', path: '/stock/workshops', soon: true },
    ],
  },
  {
    label: 'Услуги', icon: 'stock', onlyServices: true, children: [
      { label: 'Каталог услуг', path: '/stock/products' },
    ],
  },
  {
    label: 'Склад', icon: 'stock', hideForServices: true, children: [
      { label: 'Товары и услуги', path: '/stock/products', foodLabel: 'Товары', servicesLabel: 'Услуги' },
      { label: 'Аналитика товаров', path: '/stock/turnover', hideForServices: true },
      { label: 'Остатки', path: '/stock/stock', hideForServices: true },
      { label: 'Поставки', path: '/stock/supplies', hideForServices: true },
      { label: 'Переработки', path: '/stock/processing', onlyFood: true, soon: true },
      { label: 'Перемещения', path: '/stock/transfers', onlyFood: true, soon: true },
      { label: 'Списания', path: '/stock/writeoffs', hideForServices: true },
      { label: 'Отчёт по движению', path: '/stock/movement', onlyFood: true, soon: true },
      { label: 'Инвентаризация', path: '/stock/inventory', hideForServices: true },
      { label: 'Поставщики', path: '/stock/suppliers', hideForServices: true },
      { label: 'Склады', path: '/stock/warehouses', onlyFood: true, soon: true },
      { label: 'Фасовки', path: '/stock/packings', onlyFood: true, soon: true },
    ],
  },
  {
    label: 'Клиенты', icon: 'clients', children: [
      { label: 'База клиентов', path: '/clients' },
      { label: 'Лояльность', path: '/clients/loyalty' },
      { label: 'Акции', path: '/clients/promos' },
    ],
  },
  {
    label: 'Команда', icon: 'team', children: [
      { label: 'Сотрудники', path: '/employees' },
      { label: 'Табель', path: '/employees/timesheet' },
    ],
  },
  {
    label: 'Отчеты', icon: 'reports', path: '/reports',
  },
  {
    label: 'Настройки', icon: 'settings', children: [
      { label: 'Общие', path: '/settings' },
      { label: 'Корзина', path: '/settings/trash' },
      { label: 'Управление подпиской', path: '/settings/subscription' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { employeeData, hasPermission } = useAuth();
  const [expanded, setExpanded] = React.useState(() => {
    const path = location.pathname;
    const found = menu.find(m => m.children && m.children.some(c => path === c.path));
    return found ? found.label : null;
  });

  // Открыт ровно тот раздел, в котором мы находимся; ушли — раздел закрывается
  React.useEffect(() => {
    const path = location.pathname;
    const found = menu.find(m => m.children && m.children.some(c => path === c.path));
    setExpanded(found ? found.label : null);
  }, [location.pathname]);
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const h = () => { if (window.innerWidth > 768) setMobileOpen(false); };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const toggleGroup = (label) => {
    setExpanded((prev) => (prev === label ? null : label));
  };

  const closeMobile = () => { if (window.innerWidth <= 768) setMobileOpen(false); };

  const isActive = (path) => {
    var p = location.pathname;
    // Убираем trailing slash для сравнения
    if (p.endsWith('/')) p = p.slice(0, -1);
    var cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
    return p === cleanPath;
  };

  const [businessType, setBusinessTypeState] = useLocalState('retail');
  useLocalEffect(function(){
    try { var v = localStorage.getItem('atlaspos_business_type'); if (v) setBusinessTypeState(v); } catch(e){}
    fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + ((function(){ try { return JSON.parse(localStorage.getItem('atlaspos_session')||'{}').access_token || ''; } catch(e){ return ''; } })()) } })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if (d && d.user && d.user.business_type) { setBusinessTypeState(d.user.business_type); try { localStorage.setItem('atlaspos_business_type', d.user.business_type); } catch(e){} } })
      .catch(function(){});
  }, []);
  useLocalEffect(function(){
    var onType = function(e){ if (e && e.detail) setBusinessTypeState(e.detail); };
    window.addEventListener('atlaspos-business-type', onType);
    window.addEventListener('storage', onType);
    return function(){
      window.removeEventListener('atlaspos-business-type', onType);
      window.removeEventListener('storage', onType);
    };
  }, []);

  const setBusinessType = function(t){
    setBusinessTypeState(t);
    try { localStorage.setItem('atlaspos_business_type', t); } catch(e){}
    try { window.dispatchEvent(new CustomEvent('atlaspos-business-type', { detail: t })); } catch(e){}
    fetch('/api/business-type', { method:'PUT',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + ((function(){ try { return JSON.parse(localStorage.getItem('atlaspos_session')||'{}').access_token || ''; } catch(e){ return ''; } })()) },
      body: JSON.stringify({ business_type: t }) }).catch(function(){});
  };

  return (
    <>
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}`} id="mainSidebar">
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <div className="brand-mark">A</div>
            {!collapsed && (
              <div className="brand-text">
                <div className="brand-name">AtlasPos</div>
                <div className="brand-sub">Учёт для бизнеса</div>
              </div>
            )}
            <button type="button" className="sidebar-toggle"
              onClick={() => {
                if (window.innerWidth <= 768) { setMobileOpen(!mobileOpen); }
                else { setCollapsed(!collapsed); }
              }}>
              {collapsed || mobileOpen ? '☰' : '✕'}
            </button>
          </div>
          {!collapsed && <p className="nav-section-title">Разделы</p>}
          <nav className="sidebar-nav">
            {menu.filter(function(item){
              if (item.onlyFood && businessType !== 'food') return false;
              if (item.onlyServices && businessType !== 'services') return false;
              if (item.hideForServices && businessType === 'services') return false;
              if (!employeeData) return true;
              var perms = employeeData.permissions || [];
              if (!perms || perms.length === 0) return true;
              var permMap = { 'Панель управления':'dashboard', 'Касса':'registers', 'Финансы':'finance', 'Склад':'stock', 'Клиенты':'clients', 'Команда':'team', 'Отчеты':'reports', 'Настройки':'settings' };
              var p = permMap[item.label];
              if (!p) return true;
              // Если есть родительский доступ — показываем раздел
              if (hasPermission(p)) return true;
              // Если нет родительского, проверяем детей
              if (item.children) {
                return item.children.some(function(c){ return hasPermission(p + '.' + c.path.split('/').pop()); });
              }
              return false;
            }).map((item) => {
              if (item.children) {
                const open = expanded === item.label;
                const anyChildActive = item.children.some((c) => isActive(c.path));
                return (
                  <div className={`nav-group acc-item${open ? ' open' : ''}`} key={item.label}>
                    <button type="button" className={`nav-parent${open ? ' open' : ''}${open ? ' active-parent' : ''}`}
                      onClick={() => { if (item.path) { setExpanded(item.label); navigate(item.path); } else { toggleGroup(item.label); } }}>
                      <span className="ic" dangerouslySetInnerHTML={{ __html: svgIcons[item.icon] }} />
                      {!collapsed && item.label}
                      {!collapsed && <span className="arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>}
                    </button>
                    <div className={`nav-children-acc${open ? ' open' : ''}`}>
                      {item.children.filter(function(child){
                if (child.onlyFood && businessType !== 'food') return false;
                if (child.hideForServices && businessType === 'services') return false;
                if (child.hideForFood && businessType === 'food') return false;
                        if (!employeeData) return true;
                        var perms = employeeData.permissions || [];
                        if (!perms || perms.length === 0) return true;
                        var permMap = { 'Панель управления':'dashboard', 'Касса':'registers', 'Финансы':'finance', 'Склад':'stock', 'Клиенты':'clients', 'Команда':'team', 'Отчеты':'reports', 'Настройки':'settings' };
                        var parentPerm = permMap[item.label];
                        // Если родитель разрешен — все дети видны
                        if (parentPerm && perms.includes(parentPerm)) return true;
                        var childId = parentPerm + '.' + child.path.split('/').pop();
                        return perms.includes(childId);
                      }).map((child) => (
                        <a key={child.path}
                          className={`nav-child${isActive(child.path) ? ' active' : ''}`}
                          onClick={() => { navigate(child.path); closeMobile(); }}>
                          <span className="nav-child-dot" />{(businessType === 'food' && child.foodLabel) ? child.foodLabel
                            : (businessType === 'services' && child.servicesLabel) ? child.servicesLabel
                            : child.label}{child.soon && <span style={{ marginLeft:6, fontSize:'.58rem', color:'#c3cad6' }}>скоро</span>}</a>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <a key={item.path}
                  className={`nav-parent${isActive(item.path) ? ' active' : ''}`}
                  onClick={() => { if (item.path === '/kassa') window.open('/kassa', '_blank'); else { navigate(item.path); closeMobile(); } }}>
                  <span className="ic" dangerouslySetInnerHTML={{ __html: svgIcons[item.icon] }} />
                  {!collapsed && item.label}
                </a>
              );
            })}
          </nav>
          {!collapsed && (
            <div style={{ marginTop:'auto', padding:'10px 10px 4px' }}>
              <div style={{ fontSize:'.62rem', color:'#9ca3af', fontWeight:600,
                textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6, paddingLeft:2 }}>
                Тип бизнеса
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[['retail','Товарный бизнес'],['mixed','Товары и услуги'],['services','Услуги'],['food','Общепит']].map(function(o){
                  var on = businessType === o[0];
                  return (
                    <button key={o[0]} type="button"
                      onClick={function(){ setBusinessType(o[0]); }}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 9px',
                        borderRadius:9, cursor:'pointer', border:'1px solid ' + (on ? 'rgba(31,117,255,.35)' : 'transparent'),
                        background: on ? 'rgba(31,117,255,.07)' : 'transparent',
                        fontSize:'.76rem', fontWeight: on ? 700 : 500,
                        color: on ? '#1F75FF' : '#5b6472', fontFamily:'inherit', textAlign:'left' }}>
                      <span style={{ width:14, height:14, borderRadius:4, flexShrink:0,
                        border:'1.5px solid ' + (on ? '#1F75FF' : '#d1d5db'),
                        background: on ? '#1F75FF' : '#fff', display:'flex',
                        alignItems:'center', justifyContent:'center', color:'#fff',
                        fontSize:'.6rem', fontWeight:800 }}>{on ? '✓' : ''}</span>
                      {o[1]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 199 }} />
      )}
      {!mobileOpen && window.innerWidth <= 768 && (
        <div onClick={() => setMobileOpen(true)}
          className="mobile-hamburger">☰</div>
      )}
    </>
  );
}
