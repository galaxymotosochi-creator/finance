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
      
      {/* Stock */}
      <Route path="/stock/products" element={<ProtectedRoute><AppLayout><div>Товары и услуги</div></AppLayout></ProtectedRoute>} />
      <Route path="/stock/categories" element={<ProtectedRoute><AppLayout><div>Категории</div></AppLayout></ProtectedRoute>} />
      <Route path="/stock/turnover" element={<ProtectedRoute><AppLayout><div>Здоровье товаров</div></AppLayout></ProtectedRoute>} />
      <Route path="/stock/stock" element={<ProtectedRoute><AppLayout><div>Остатки</div></AppLayout></ProtectedRoute>} />
      <Route path="/stock/supplies" element={<ProtectedRoute><AppLayout><div>Поставки</div></AppLayout></ProtectedRoute>} />
      <Route path="/stock/inventory" element={<ProtectedRoute><AppLayout><div>Инвентаризация</div></AppLayout></ProtectedRoute>} />
      <Route path="/stock/writeoffs" element={<ProtectedRoute><AppLayout><div>Списания</div></AppLayout></ProtectedRoute>} />
      <Route path="/stock/suppliers" element={<ProtectedRoute><AppLayout><div>Поставщики</div></AppLayout></ProtectedRoute>} />
      
      {/* Clients */}
      <Route path="/clients" element={<ProtectedRoute><AppLayout><div>База клиентов</div></AppLayout></ProtectedRoute>} />
      <Route path="/clients/loyalty" element={<ProtectedRoute><AppLayout><div>Лояльность</div></AppLayout></ProtectedRoute>} />
      <Route path="/clients/promos" element={<ProtectedRoute><AppLayout><div>Акции</div></AppLayout></ProtectedRoute>} />
      
      {/* Team */}
      <Route path="/employees" element={<ProtectedRoute><AppLayout><div>Сотрудники</div></AppLayout></ProtectedRoute>} />
      <Route path="/employees/positions" element={<ProtectedRoute><AppLayout><div>Должности</div></AppLayout></ProtectedRoute>} />
      
      {/* Settings */}
      <Route path="/settings" element={<ProtectedRoute><AppLayout><div>Общие</div></AppLayout></ProtectedRoute>} />
      <Route path="/settings/venues" element={<ProtectedRoute><AppLayout><div>Заведения</div></AppLayout></ProtectedRoute>} />
      <Route path="/settings/registers" element={<ProtectedRoute><AppLayout><div>Касса</div></AppLayout></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'system-ui,sans-serif',color:'#666'}}>Загрузка...</div>;
  return <HashRouter><AppRoutes /></HashRouter>;
}
