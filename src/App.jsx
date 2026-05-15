import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import FullSite from './pages/FullSite';

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
      <Route path="/registers" element={<ProtectedRoute><FullSite /></ProtectedRoute>} />

      {/* Finance — рабочие разделы с Supabase */}
      <Route path="/finance/pnl" element={<ProtectedRoute><AppLayout><PnL /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/transactions" element={<ProtectedRoute><AppLayout><Transactions /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/categories" element={<ProtectedRoute><AppLayout><Categories /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/shifts" element={<ProtectedRoute><AppLayout><Shifts /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/salary" element={<ProtectedRoute><AppLayout><Salary /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/accounts" element={<ProtectedRoute><AppLayout><Accounts /></AppLayout></ProtectedRoute>} />

      {/* Остальные разделы — оригинальный сайт */}
      <Route path="/stock/*" element={<ProtectedRoute><FullSite /></ProtectedRoute>} />
      <Route path="/clients/*" element={<ProtectedRoute><FullSite /></ProtectedRoute>} />
      <Route path="/employees/*" element={<ProtectedRoute><FullSite /></ProtectedRoute>} />
      <Route path="/settings/*" element={<ProtectedRoute><FullSite /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'system-ui,sans-serif',color:'#666'}}>Загрузка...</div>;
  return <HashRouter><AppRoutes /></HashRouter>;
}
