import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import Sidebar from '../components/Sidebar';
import AiChat from '../components/AiChat';
import QuickSale from '../components/QuickSale';
import QuickSupply from '../components/QuickSupply';
import QuickIncome from '../components/QuickIncome';
import QuickExpense from '../components/QuickExpense';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth();
  const n = useNavigate();
  const [showSale, setShowSale] = useState(false);
  const [showSupply, setShowSupply] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  const actions = [
    { label: 'Продажа', icon: '💳', action: () => setShowSale(true) },
    { label: 'Поставка', icon: '📦', action: () => n('/stock/supplies?add=supply') },
    { label: 'Доход', icon: '📈', action: () => n('/finance/transactions?add=income') },
    { label: 'Расход', icon: '📤', action: () => n('/finance/transactions?add=expense') },
  ];

  const { daysLeft, isExpired, loading: subLoading } = useSubscription();

  return (
    <>
      <Sidebar />
      <div className="main">
        {/* Полоска триала */}
        {!subLoading && !isExpired && daysLeft !== null && daysLeft <= 14 && (
          <div style={{
            height:36,
            background:'#fff',
            borderBottom:'1px solid #eee',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            gap:8,
            fontSize:12,
            fontWeight:500,
            color:'#666',
            flexShrink:0,
            position:'sticky',
            top:0,
            zIndex:200,
          }}>
            <span>🎁 Бесплатный период — осталось <strong>{daysLeft}</strong> {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}</span>
            <button onClick={() => n('/settings/subscription')} style={{
              padding:'3px 12px',
              borderRadius:100,
              border:'1px solid #ddd',
              background:'transparent',
              fontSize:11,
              fontWeight:500,
              cursor:'pointer',
              fontFamily:'inherit',
              color:'#555',
              whiteSpace:'nowrap',
            }}>Выбрать тариф →</button>
          </div>
        )}
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
            <button key={i} onClick={() => a.action ? a.action() : n(a.path)}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',padding:'8px 14px',borderRadius:'14px',border:'none',background:'transparent',cursor:'pointer',fontFamily:'inherit',transition:'background .12s',minWidth:'56px'}}
              onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <span style={{fontSize:'16px',lineHeight:1}}>{a.icon}</span>
              <span style={{fontSize:'9px',fontWeight:600,color:'#555',whiteSpace:'nowrap'}}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {showSale && <QuickSale onClose={() => setShowSale(false)} />}
      {showSupply && <QuickSupply onClose={() => setShowSupply(false)} />}
      {showIncome && <QuickIncome onClose={() => setShowIncome(false)} />}
      {showExpense && <QuickExpense onClose={() => setShowExpense(false)} />}
    </>
  );
}
