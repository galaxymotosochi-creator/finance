import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const icons = {
  dashboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1" fill="#818cf8" opacity=".15" />
      <rect x="14" y="3" width="7" height="7" rx="1" fill="#818cf8" opacity=".15" />
      <rect x="3" y="14" width="7" height="7" rx="1" fill="#818cf8" opacity=".15" />
      <rect x="14" y="14" width="7" height="7" rx="1" fill="#818cf8" opacity=".15" />
    </svg>
  ),
  finance: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  ),
};

const financeChildren = [
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

  const isFinanceActive = financeChildren.some((c) => isActive(c.path));

  const activeBg = 'rgba(25,131,221,0.15)';
  const activeBorder = 'rgba(25,131,221,0.3)';
  const activeColor = '#60a5fa';

  return (
    <aside style={{
      display: 'flex', flexShrink: 0,
    }}>
      <div style={{
        width: '240px',
        padding: '.5rem .4rem',
        background: '#0f172a',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #1e293b',
        position: 'relative',
      }}>
        {/* USER */}
        <div style={{
          padding: '.75rem .65rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#94a3b8' }}>
            Finance
          </div>
        </div>

        {/* NAV */}
        <nav style={{
          flex: 1,
          overflowY: 'auto',
          padding: '.25rem 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '.15rem',
        }}>
          {/* Панель управления */}
          <a onClick={() => navigate('/')} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '.5rem',
            padding: '.4rem .6rem',
            marginBottom: '.2rem',
            fontSize: '.82rem',
            fontWeight: 600,
            color: location.pathname === '/' ? activeColor : '#e2e8f0',
            cursor: 'pointer',
            transition: 'all .15s',
            textDecoration: 'none',
            userSelect: 'none',
            background: location.pathname === '/' ? activeBg : 'transparent',
            border: `1px solid ${location.pathname === '/' ? activeBorder : 'transparent'}`,
            borderRadius: '.5rem',
          }}>
            <span style={{
              width: '1.6rem', textAlign: 'center', fontSize: '1.2rem',
              lineHeight: 1, flexShrink: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>{icons.dashboard}</span>
            Панель управления
          </a>

          {/* Финансы */}
          <div>
            <a onClick={() => setFinanceOpen(!financeOpen)} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '.5rem',
              padding: '.4rem .6rem',
              marginBottom: '.2rem',
              fontSize: '.82rem',
              fontWeight: 600,
              color: isFinanceActive ? activeColor : '#e2e8f0',
              cursor: 'pointer',
              transition: 'all .15s',
              textDecoration: 'none',
              userSelect: 'none',
              background: isFinanceActive ? activeBg : 'transparent',
              border: `1px solid ${isFinanceActive ? activeBorder : 'transparent'}`,
              borderRadius: '.5rem',
            }}>
              <span style={{
                width: '1.6rem', textAlign: 'center', fontSize: '1.2rem',
                lineHeight: 1, flexShrink: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>{icons.finance}</span>
              Финансы
              <span style={{
                marginLeft: 'auto',
                fontSize: '.55rem',
                color: '#64748b',
                transition: 'transform .2s',
                transform: financeOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              }}>▶</span>
            </a>

            <div style={{
              display: financeOpen ? 'flex' : 'none',
              flexDirection: 'column',
            }}>
              {financeChildren.map((child) => (
                <a key={child.path} onClick={() => navigate(child.path)} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '.5rem',
                  padding: '.3rem .65rem .3rem 2.7rem',
                  fontSize: '.8rem',
                  color: isActive(child.path) ? '#60a5fa' : '#93c5fd',
                  cursor: 'pointer',
                  transition: 'all .1s',
                  textDecoration: 'none',
                  fontWeight: isActive(child.path) ? 600 : 400,
                  background: isActive(child.path) ? 'rgba(25,131,221,0.08)' : 'transparent',
                  borderRadius: '.35rem',
                }}>
                  {child.label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        {/* FOOTER */}
        <div style={{ height: '1px', background: '#1e293b', margin: '.25rem .65rem', opacity: 0.4 }} />
      </div>
    </aside>
  );
}
