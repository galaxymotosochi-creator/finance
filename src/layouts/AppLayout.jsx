import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import AiChat from '../components/AiChat';
import { useNavigate } from 'react-router-dom';

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth();
  const n = useNavigate();

  const actions = [
    { label: 'Продажа', icon: '💳', path: '/kassa' },
    { label: 'Поставка', icon: '📦', path: '/stock/products' },
    { label: 'Доход', icon: '📈', path: '/finance/transactions' },
    { label: 'Расход', icon: '📤', path: '/finance/transactions' },
  ];

  return (
    <>
      <Sidebar />
      <div className="main">
        <header className="app-header">
          <span className="user-email">{user?.email}</span>
          <button className="logout-btn" onClick={signOut}>Выйти</button>
        </header>
        <div className="content">
          {children}
        </div>
        <AiChat />
      </div>

      {/* Плавающие кнопки */}
      <div style={{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',zIndex:100,display:'flex',justifyContent:'center',width:'100%',pointerEvents:'none'}}>
        <div style={{display:'inline-flex',gap:'6px',background:'#fff',borderRadius:'20px',padding:'6px 8px',boxShadow:'0 4px 20px rgba(0,0,0,.1)',pointerEvents:'auto'}}>
          {actions.map((a, i) => (
            <button key={i} onClick={() => n(a.path)}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',padding:'8px 14px',borderRadius:'14px',border:'none',background:'transparent',cursor:'pointer',fontFamily:'inherit',transition:'background .12s',minWidth:'56px'}}
              onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <span style={{fontSize:'16px',lineHeight:1}}>{a.icon}</span>
              <span style={{fontSize:'9px',fontWeight:600,color:'#555',whiteSpace:'nowrap'}}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
