import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const svgIcons = {
  dashboard: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  ai: '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;font-size:14px;font-weight:800;letter-spacing:.02em;color:#999">AI</span>',
  registers: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="21" r="1" fill="#999"/><circle cx="20" cy="21" r="1" fill="#999"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
  finance: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  stock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="19.5" r="1.5"/><circle cx="18.5" cy="19.5" r="1.5"/></svg>',
  clients: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4" fill="#999" opacity=".15"/></svg>',
  team: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4" fill="#999" opacity=".15"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  reports: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
};

const menu = [
  { label: 'Панель управления', path: '/dashboard', icon: 'dashboard' },
  { label: 'AI помощник', path: '/ai-assistant', icon: 'ai' },
  { label: 'Касса', path: '/kassa', icon: 'registers' },
  {
    label: 'Финансы', icon: 'finance', children: [
      { label: 'Транзакции', path: '/finance/transactions' },
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
    label: 'Склад', icon: 'stock', children: [
      { label: 'Товары и услуги', path: '/stock/products' },
      { label: 'Категории', path: '/stock/categories' },
      { label: 'Аналитика товаров', path: '/stock/turnover' },
      { label: 'Остатки', path: '/stock/stock' },
      { label: 'Поставки', path: '/stock/supplies' },
      { label: 'Инвентаризация', path: '/stock/inventory' },
      { label: 'Списания', path: '/stock/writeoffs' },
      { label: 'Поставщики', path: '/stock/suppliers' },
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
      { label: 'Должности', path: '/employees/positions' },
      { label: 'Табель', path: '/employees/timesheet' },
    ],
  },
  {
    label: 'Отчёты', icon: 'reports', children: [
      { label: 'Продажи по сотрудникам', path: '/reports/sales' },
    ],
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
    return found ? found.label : 'Финансы';
  });

  // Синхронизация expanded с текущим путём при переходах
  React.useEffect(() => {
    const path = location.pathname;
    const found = menu.find(m => m.children && m.children.some(c => path === c.path));
    if (found && found.label !== expanded) {
      setExpanded(found.label);
    }
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

  const isActive = (path) => {
    var p = location.pathname;
    // Убираем trailing slash для сравнения
    if (p.endsWith('/')) p = p.slice(0, -1);
    var cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
    return p === cleanPath;
  };

  return (
    <>
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}`} id="mainSidebar">
        <div className="sidebar-inner">
          <div className="sidebar-user">
<div className="sidebar-toggle"
              onClick={() => {
                if (window.innerWidth <= 768) { setMobileOpen(!mobileOpen); }
                else { setCollapsed(!collapsed); }
              }}
            >
              {collapsed || mobileOpen ? '☰' : '✕'}
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <div className="sidebar-user-email">AtlasPos</div>
              </div>
            )}
          </div>
          <nav className="sidebar-nav">
            {menu.filter(function(item){
              if (!employeeData) return true;
              var perms = employeeData.permissions || [];
              if (!perms || perms.length === 0) return true;
              var permMap = { 'Панель управления':'dashboard', 'Касса':'registers', 'Финансы':'finance', 'Склад':'stock', 'Клиенты':'clients', 'Команда':'team', 'Отчёты':'reports', 'Настройки':'settings' };
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
                  <div className="nav-group" key={item.label}>
                    <a className={`nav-parent${open ? ' open' : ''}${anyChildActive || open ? ' active' : ''}`}
                      onClick={() => toggleGroup(item.label)}>
                      <span className="ic" dangerouslySetInnerHTML={{ __html: svgIcons[item.icon] }} />
                      {!collapsed && item.label}
                      {!collapsed && <span className="arrow">&#9656;</span>}
                    </a>
                    <div className={`nav-children${open ? ' open' : ''}`}>
                      {item.children.filter(function(child){
                        if (!employeeData) return true;
                        var perms = employeeData.permissions || [];
                        if (!perms || perms.length === 0) return true;
                        var permMap = { 'Панель управления':'dashboard', 'Касса':'registers', 'Финансы':'finance', 'Склад':'stock', 'Клиенты':'clients', 'Команда':'team', 'Отчёты':'reports', 'Настройки':'settings' };
                        var parentPerm = permMap[item.label];
                        // Если родитель разрешён — все дети видны
                        if (parentPerm && perms.includes(parentPerm)) return true;
                        var childId = parentPerm + '.' + child.path.split('/').pop();
                        return perms.includes(childId);
                      }).map((child) => (
                        <a key={child.path}
                          className={`nav-child${isActive(child.path) ? ' active' : ''}`}
                          onClick={() => navigate(child.path)}>{child.label}</a>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <a key={item.path}
                  className={`nav-parent${isActive(item.path) ? ' active' : ''}`}
                  onClick={() => item.path === '/kassa' ? window.open('/kassa', '_blank') : navigate(item.path)}>
                  <span className="ic" dangerouslySetInnerHTML={{ __html: svgIcons[item.icon] }} />
                  {!collapsed && item.label}
                </a>
              );
            })}
          </nav>
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
