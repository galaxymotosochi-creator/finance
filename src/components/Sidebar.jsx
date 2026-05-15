import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';

const menuItems = [
  { label: 'Панель управления', path: '/', icon: '📊' },
  {
    label: 'Финансы', icon: '💰', children: [
      { label: 'P&L', path: '/finance/pnl' },
      { label: 'Транзакции', path: '/finance/transactions' },
      { label: 'Справочник', path: '/finance/categories' },
      { label: 'Смены', path: '/finance/shifts' },
      { label: 'Зарплата', path: '/finance/salary' },
      { label: 'Счета', path: '/finance/accounts' },
    ],
  },
  { label: 'Склад', path: '/stock', icon: '📦' },
  { label: 'Продажи', path: '/sales', icon: '📋' },
  { label: 'Клиенты', path: '/clients', icon: '📄' },
  { label: 'Сотрудники', path: '/employees', icon: '👥' },
  { label: 'Настройки', path: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const location = useLocation();
  const [expanded, setExpanded] = useState('Финансы'); // open by default

  const toggleGroup = (label) => {
    setExpanded((prev) => (prev === label ? null : label));
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>Finance</div>
      <nav style={styles.nav}>
        {menuItems.map((item) => {
          if (item.children) {
            const open = expanded === item.label;
            const anyChildActive = item.children.some((c) => isActive(c.path));
            return (
              <div key={item.label}>
                <div
                  style={{
                    ...styles.navParent,
                    ...(anyChildActive ? styles.navParentActive : {}),
                  }}
                  onClick={() => toggleGroup(item.label)}
                >
                  <span style={styles.icon}>{item.icon}</span>
                  <span style={styles.navLabel}>{item.label}</span>
                  <span style={{
                    ...styles.arrow,
                    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}>▶</span>
                </div>
                <div style={{
                  ...styles.submenu,
                  maxHeight: open ? '300px' : '0',
                  opacity: open ? 1 : 0,
                }}>
                  {item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      style={({ isActive: ia }) => ({
                        ...styles.navChild,
                        ...(ia ? styles.navChildActive : {}),
                      })}
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive: ia }) => ({
                ...styles.navItem,
                ...(ia ? styles.navItemActive : {}),
              })}
            >
              <span style={styles.icon}>{item.icon}</span>
              <span style={styles.navLabel}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: '240px',
    minHeight: '100vh',
    background: '#fff',
    borderRight: '1px solid #eaeaea',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  logo: {
    padding: '1.2rem 1.25rem .8rem',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#111',
    borderBottom: '1px solid #f0f0f0',
  },
  nav: {
    padding: '.5rem 0',
    flex: 1,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '.6rem',
    padding: '.55rem 1.25rem',
    fontSize: '.85rem',
    color: '#444',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all .1s',
  },
  navItemActive: {
    background: '#f0f6ff',
    color: '#1d4ed8',
    fontWeight: 500,
  },
  navParent: {
    display: 'flex',
    alignItems: 'center',
    gap: '.6rem',
    padding: '.55rem 1.25rem',
    fontSize: '.85rem',
    color: '#444',
    cursor: 'pointer',
    transition: 'all .1s',
    userSelect: 'none',
  },
  navParentActive: {
    color: '#1d4ed8',
    fontWeight: 500,
  },
  navLabel: { flex: 1 },
  arrow: {
    fontSize: '.55rem',
    color: '#999',
    transition: 'transform .15s',
  },
  icon: { fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 },
  submenu: {
    overflow: 'hidden',
    transition: 'max-height .2s ease, opacity .15s ease',
  },
  navChild: {
    display: 'block',
    padding: '.35rem 1.25rem .35rem 3.2rem',
    fontSize: '.82rem',
    color: '#555',
    textDecoration: 'none',
    transition: 'all .1s',
  },
  navChildActive: {
    color: '#1d4ed8',
    fontWeight: 500,
  },
};
