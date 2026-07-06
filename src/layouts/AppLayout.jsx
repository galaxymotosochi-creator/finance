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

  <svg id="quick-icons" style="display:none"/>
  const actions = [
    { label: 'Продажа', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="21" r="1" fill="#999"/><circle cx="20" cy="21" r="1" fill="#999"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>', action: () => setShowSale(true) },
    { label: 'Поставка', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="15" height="10" rx="1.5"/><polyline points="16 7 19 7 21 9 21 12 16 12"/><circle cx="5" cy="16" r="3" fill="none" stroke="#999" stroke-width="1.5"/><circle cx="15" cy="16" r="3" fill="none" stroke="#999" stroke-width="1.5"/></svg>', action: () => n('/stock/supplies?add=supply') },
    { label: 'Доход', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><path d="M18 20V4"/><path d="M12 20V10"/><path d="M6 20v-6"/></svg>', action: () => n('/finance/transactions?add=income') },
    { label: 'Расход', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><path d="M18 4V20"/><path d="M12 4V14"/><path d="M6 4v10"/></svg>', action: () => n('/finance/transactions?add=expense') },
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
        <div className="content" style={{paddingBottom:'90px'}}>
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
              <span style={{display:'inline-flex',lineHeight:1}} dangerouslySetInnerHTML={{__html:a.icon}} />
              <span style={{fontSize:'11px',fontWeight:600,color:'#555',whiteSpace:'nowrap'}}>{a.label}</span>
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
