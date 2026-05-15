import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';

import PnL from './pages/finance/PnL';
import Transactions from './pages/finance/Transactions';
import Categories from './pages/finance/Categories';
import Shifts from './pages/finance/Shifts';
import Salary from './pages/finance/Salary';
import Accounts from './pages/finance/Accounts';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/registers" element={<ProtectedRoute><AppLayout><div>Касса</div></AppLayout></ProtectedRoute>} />

      {/* Finance */}
      <Route path="/finance/pnl" element={<ProtectedRoute><AppLayout><PnL /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/transactions" element={<ProtectedRoute><AppLayout><Transactions /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/categories" element={<ProtectedRoute><AppLayout><Categories /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/shifts" element={<ProtectedRoute><AppLayout><Shifts /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/salary" element={<ProtectedRoute><AppLayout><Salary /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/accounts" element={<ProtectedRoute><AppLayout><Accounts /></AppLayout></ProtectedRoute>} />

      {/* Stock, Clients, Team, Settings — в разработке */}
      <Route path="/stock/*" element={<ProtectedRoute><AppLayout><h1 style={{fontSize:'1.2rem',fontWeight:600,margin:0}}>Склад</h1><div className="sub" style={{fontSize:'.85rem',color:'var(--muted)',margin:0}}>Раздел в разработке</div><div className="nav-sep" style={{margin:'.25rem 0',width:'100%',border:'none',borderTop:'1px solid var(--border)'}} /></AppLayout></ProtectedRoute>} />
      <Route path="/clients/*" element={<ProtectedRoute><AppLayout><h1 style={{fontSize:'1.2rem',fontWeight:600,margin:0}}>Клиенты</h1><div className="sub" style={{fontSize:'.85rem',color:'var(--muted)',margin:0}}>Раздел в разработке</div><div className="nav-sep" style={{margin:'.25rem 0',width:'100%',border:'none',borderTop:'1px solid var(--border)'}} /></AppLayout></ProtectedRoute>} />
      <Route path="/employees/*" element={<ProtectedRoute><AppLayout><h1 style={{fontSize:'1.2rem',fontWeight:600,margin:0}}>Команда</h1><div className="sub" style={{fontSize:'.85rem',color:'var(--muted)',margin:0}}>Раздел в разработке</div><div className="nav-sep" style={{margin:'.25rem 0',width:'100%',border:'none',borderTop:'1px solid var(--border)'}} /></AppLayout></ProtectedRoute>} />
      <Route path="/settings/*" element={<ProtectedRoute><AppLayout><h1 style={{fontSize:'1.2rem',fontWeight:600,margin:0}}>Настройки</h1><div className="sub" style={{fontSize:'.85rem',color:'var(--muted)',margin:0}}>Раздел в разработке</div><div className="nav-sep" style={{margin:'.25rem 0',width:'100%',border:'none',borderTop:'1px solid var(--border)'}} /></AppLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'system-ui,sans-serif',color:'#666'}}>Загрузка...</div>;
  return <HashRouter><AppRoutes /></HashRouter>;
}
