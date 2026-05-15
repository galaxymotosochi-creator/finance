import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/* точные SVG-иконки из старого макета */
const icons = {
  dashboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1" fill="#6366f1" opacity=".15" />
      <rect x="14" y="3" width="7" height="7" rx="1" fill="#6366f1" opacity=".15" />
      <rect x="3" y="14" width="7" height="7" rx="1" fill="#6366f1" opacity=".15" />
      <rect x="14" y="14" width="7" height="7" rx="1" fill="#6366f1" opacity=".15" />
    </svg>
  ),
  finance: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  ),
};

const financeItems = [
  { label: 'P&L', path: '/finance/pnl' },
  { label: 'Транзакции', path: '/finance/transactions' },
  { label: 'Справочник', path: '/finance/categories' },
  { label: 'Смены', path: '/finance/shifts' },
  { label: 'Зарплата', path: '/finance/salary' },
  { label: 'Счета', path: '/finance/accounts' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [financeOpen, setFinanceOpen] = React.useState(true);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const isFinanceActive = financeItems.some((c) => isActive(c.path));

  return (
    <aside className="sidebar" id="mainSidebar">
      <div className="sidebar-inner">
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-user-email">Finance</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* Панель управления */}
          <a
            className={`nav-parent${location.pathname === '/' ? ' active' : ''}`}
            onClick={() => navigate('/')}
          >
            <span className="ic">{icons.dashboard}</span>
            Панель управления
          </a>

          {/* Финансы */}
          <div className="nav-group">
            <a
              className={`nav-parent${financeOpen ? ' open' : ''}${isFinanceActive ? ' active' : ''}`}
              onClick={() => setFinanceOpen(!financeOpen)}
            >
              <span className="ic">{icons.finance}</span>
              Финансы
              <span className="arrow">&#9656;</span>
            </a>
            <div className={`nav-children${financeOpen ? ' open' : ''}`}>
              {financeItems.map((child) => (
                <a
                  key={child.path}
                  className={`nav-child${isActive(child.path) ? ' active' : ''}`}
                  onClick={() => navigate(child.path)}
                >
                  {child.label}
                </a>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}
