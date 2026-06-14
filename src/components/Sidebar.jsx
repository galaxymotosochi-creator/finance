import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const svgIcons = {
  dashboard: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1" fill="#6366f1" opacity=".15"/><rect x="14" y="3" width="7" height="7" rx="1" fill="#6366f1" opacity=".15"/><rect x="3" y="14" width="7" height="7" rx="1" fill="#6366f1" opacity=".15"/><rect x="14" y="14" width="7" height="7" rx="1" fill="#6366f1" opacity=".15"/></svg>',
  registers: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="21" r="1" fill="#f59e0b"/><circle cx="20" cy="21" r="1" fill="#f59e0b"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
  finance: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.8" stroke-linecap="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
  stock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.8" stroke-linecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polyline points="16 8 20 8 23 11 23 16 16 16 16 8"/></svg>',
  clients: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4" fill="#ec4899" opacity=".15"/></svg>',
  team: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
};

const menu = [
  { label: 'Панель управления', path: '/', icon: 'dashboard' },
  { label: 'Касса', path: '/registers', icon: 'registers' },
  {
    label: 'Финансы', icon: 'finance', children: [
      { label: 'Движение денег', path: '/finance/transactions' },
      { label: 'Финансовые счета', path: '/finance/accounts' },
      { label: 'Кассовые смены', path: '/finance/shifts' },
      { label: 'Учет зарплаты', path: '/finance/salary' },
      { label: 'P&L', path: '/finance/pnl' },
      { label: 'Финансовые категории', path: '/finance/categories' },
    ],
  },
  {
    label: 'Склад', icon: 'stock', children: [
      { label: 'Каталог позиций', path: '/stock/products' },
      { label: 'Категории позиций', path: '/stock/categories' },
      { label: 'Здоровье товаров', path: '/stock/turnover' },
      { label: 'Складские остатки', path: '/stock/stock' },
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
    label: 'Настройки', icon: 'settings', children: [
      { label: 'Общие', path: '/settings' },
      { label: 'Заведения', path: '/settings/venues' },
      { label: 'Касса', path: '/settings/registers' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState('Финансы');
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
    if (path === '/') return location.pathname === '/' || location.hash === '#/';
    return location.pathname.startsWith(path);
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
                <div className="sidebar-user-email">Finance</div>
              </div>
            )}
          </div>
          <nav className="sidebar-nav">
            {menu.map((item) => {
              if (item.children) {
                const open = expanded === item.label;
                const anyChildActive = item.children.some((c) => isActive(c.path));
                return (
                  <div className="nav-group" key={item.label}>
                    <a className={`nav-parent${open ? ' open' : ''}${anyChildActive ? ' active' : ''}`}
                      onClick={() => toggleGroup(item.label)}>
                      <span className="ic" dangerouslySetInnerHTML={{ __html: svgIcons[item.icon] }} />
                      {!collapsed && item.label}
                      {!collapsed && <span className="arrow">&#9656;</span>}
                    </a>
                    <div className={`nav-children${open ? ' open' : ''}`}>
                      {item.children.map((child) => (
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
                  onClick={() => navigate(item.path)}>
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
