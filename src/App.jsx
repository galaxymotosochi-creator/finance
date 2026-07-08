import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Variant1 from './pages/Variant1';
import Variant2 from './pages/Variant2';
import Variant3 from './pages/Variant3';
import Variant4 from './pages/Variant4';
import Variant5 from './pages/Variant5';
import Dashboard from './pages/Dashboard';
import AppLayout from './layouts/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';

import PnL from './pages/finance/PnL';
import Transactions from './pages/finance/Transactions';
import Categories from './pages/finance/Categories';
import Shifts from './pages/finance/Shifts';
import Salary from './pages/finance/Salary';
import Accounts from './pages/finance/Accounts';
import Plans from './pages/finance/Plans';
import Receipts from './pages/finance/Receipts';
import Promos from './pages/finance/Promos';
import Products from './pages/stock/Products';
import StockCategories from './pages/stock/Categories';
import Stock from './pages/stock/Stock';
import Supplies from './pages/stock/Supplies';
import SupplyNew from './pages/stock/SupplyNew';
import Suppliers from './pages/stock/Suppliers';
import Writeoffs from './pages/stock/Writeoffs';
import Inventory from './pages/stock/Inventory';
import Health from './pages/stock/Health';
import Subscription from './pages/Subscription';
import AiAssistant from './pages/AiAssistant';
import SettingsPage from './pages/Settings';
import Clients from './pages/clients/Clients';
import Loyalty from './pages/clients/Loyalty';
import Positions from './pages/employees/Positions';
import Employees from './pages/employees/Employees';
import Timesheet from './pages/employees/Timesheet';
import RegistersPage from './pages/Registers';

function FullKassa() {
  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#f5f5f7'}}>
      <div style={{flex:1,overflow:'hidden'}}>
        <RegistersPage fullscreen />
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/ai-assistant" element={<ProtectedRoute><AppLayout><AiAssistant /></AppLayout></ProtectedRoute>} />
      <Route path="/variant/1" element={<Variant1 />} />
      <Route path="/variant/2" element={<Variant2 />} />
      <Route path="/variant/3" element={<Variant3 />} />
      <Route path="/variant/4" element={<Variant4 />} />
      <Route path="/variant/5" element={<Variant5 />} />
      <Route path="/registers" element={<ProtectedRoute><AppLayout><RegistersPage /></AppLayout></ProtectedRoute>} />
      <Route path="/kassa" element={<ProtectedRoute><FullKassa /></ProtectedRoute>} />

      {/* Finance */}
      <Route path="/finance/pnl" element={<ProtectedRoute><AppLayout><PnL /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/transactions" element={<ProtectedRoute><AppLayout><Transactions /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/categories" element={<ProtectedRoute><AppLayout><Categories /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/shifts" element={<ProtectedRoute><AppLayout><Shifts /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/receipts" element={<ProtectedRoute><AppLayout><Receipts /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/salary" element={<ProtectedRoute><AppLayout><Salary /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/accounts" element={<ProtectedRoute><AppLayout><Accounts /></AppLayout></ProtectedRoute>} />
      <Route path="/finance/plans" element={<ProtectedRoute><AppLayout><Plans /></AppLayout></ProtectedRoute>} />

      {/* Clients */}
      <Route path="/clients/promos" element={<ProtectedRoute><AppLayout><Promos /></AppLayout></ProtectedRoute>} />
      <Route path="/clients/loyalty" element={<ProtectedRoute><AppLayout><Loyalty /></AppLayout></ProtectedRoute>} />

      <Route path="/stock/products" element={<ProtectedRoute><AppLayout><Products /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/categories" element={<ProtectedRoute><AppLayout><StockCategories /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/stock" element={<ProtectedRoute><AppLayout><Stock /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/supplies" element={<ProtectedRoute><AppLayout><Supplies /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/supply/new" element={<ProtectedRoute><AppLayout><SupplyNew /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/suppliers" element={<ProtectedRoute><AppLayout><Suppliers /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/writeoffs" element={<ProtectedRoute><AppLayout><Writeoffs /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/inventory" element={<ProtectedRoute><AppLayout><Inventory /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/health" element={<ProtectedRoute><AppLayout><Health /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/turnover" element={<ProtectedRoute><AppLayout><Health /></AppLayout></ProtectedRoute>} />
      <Route path="/stock/*" element={<ProtectedRoute><AppLayout><div>Склад</div></AppLayout></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><AppLayout><Clients /></AppLayout></ProtectedRoute>} />
      <Route path="/clients/*" element={<ProtectedRoute><AppLayout><div>Клиенты</div></AppLayout></ProtectedRoute>} />
      <Route path="/employees/positions" element={<ProtectedRoute><AppLayout><Positions /></AppLayout></ProtectedRoute>} />
      <Route path="/employees/timesheet" element={<ProtectedRoute><AppLayout><Timesheet /></AppLayout></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><AppLayout><Employees /></AppLayout></ProtectedRoute>} />
      <Route path="/employees/*" element={<ProtectedRoute><AppLayout><div>Команда</div></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/settings/*" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/settings/subscription" element={<ProtectedRoute skipSubscription><AppLayout><Subscription /></AppLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'system-ui,sans-serif',color:'#666'}}></div>;
  return <ErrorBoundary><BrowserRouter><AppRoutes /></BrowserRouter></ErrorBoundary>;
}
