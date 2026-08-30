import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import { resetCurrencyCache } from './lib/currency';
import AppLayout from './layouts/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';

// Ленивая загрузка страниц — ускоряет первую загрузку (чанк ~1.4MB → по разделам)
const Login = lazy(() => import('./pages/Login'));
const Landing = lazy(() => import('./pages/Landing'));
const Register = lazy(() => import('./pages/Register'));
const Variant1 = lazy(() => import('./pages/Variant1'));
const Variant2 = lazy(() => import('./pages/Variant2'));
const Variant3 = lazy(() => import('./pages/Variant3'));
const Variant4 = lazy(() => import('./pages/Variant4'));
const Variant5 = lazy(() => import('./pages/Variant5'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PnL = lazy(() => import('./pages/finance/PnL'));
const Transactions = lazy(() => import('./pages/finance/Transactions'));
const Categories = lazy(() => import('./pages/finance/Categories'));
const Shifts = lazy(() => import('./pages/finance/Shifts'));
const Salary = lazy(() => import('./pages/finance/Salary'));
const Accounts = lazy(() => import('./pages/finance/Accounts'));
const Plans = lazy(() => import('./pages/finance/Plans'));
const Receipts = lazy(() => import('./pages/finance/Receipts'));
const Promos = lazy(() => import('./pages/finance/Promos'));
const Products = lazy(() => import('./pages/stock/Products'));
const StockCategories = lazy(() => import('./pages/stock/Categories'));
const Stock = lazy(() => import('./pages/stock/Stock'));
const Supplies = lazy(() => import('./pages/stock/Supplies'));
const SupplyNew = lazy(() => import('./pages/stock/SupplyNew'));
const Suppliers = lazy(() => import('./pages/stock/Suppliers'));
const Writeoffs = lazy(() => import('./pages/stock/Writeoffs'));
const Inventory = lazy(() => import('./pages/stock/Inventory'));
const Health = lazy(() => import('./pages/stock/Health'));
const Subscription = lazy(() => import('./pages/Subscription'));
const AiAssistant = lazy(() => import('./pages/AiAssistant'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Clients = lazy(() => import('./pages/clients/Clients'));
const Loyalty = lazy(() => import('./pages/clients/Loyalty'));
const Positions = lazy(() => import('./pages/employees/Positions'));
const Employees = lazy(() => import('./pages/employees/Employees'));
const Timesheet = lazy(() => import('./pages/employees/Timesheet'));
const RegistersPage = lazy(() => import('./pages/Registers'));

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

const loaderStyle = {
  display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#fff',gap:'14px'
};
const spinnerStyle = {
  width:'34px',height:'34px',border:'3px solid #eee',borderTopColor:'#111',borderRadius:'50%',animation:'spin 0.8s linear infinite'
};
const pageLoader = (
  <div style={loaderStyle}>
    <div style={spinnerStyle} />
    <div style={{fontWeight:700,fontSize:'1rem',letterSpacing:'-.02em',color:'#111'}}>AtlasPos</div>
  </div>
);

export default function App() {
  const { loading, user } = useAuth();
  // При старте подтягиваем настройки профиля (валюта и др.) в localStorage —
  // чтобы они работали во всех разделах ещё до открытия настроек
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase.from('user_profiles').select('settings').eq('user_id', user.id).maybeSingle();
        if (data && data.settings) {
          const s = data.settings;
          localStorage.setItem('settings_company', JSON.stringify(s.company || {}));
          localStorage.setItem('settings_country', s.country || 'Россия');
          localStorage.setItem('settings_lang', s.lang || 'Русский');
          localStorage.setItem('settings_currency', s.currency || 'RUB');
          localStorage.setItem('settings_tz', s.timezone || 'Europe/Moscow');
          localStorage.setItem('settings_notifications', JSON.stringify(s.notifications || {}));
          resetCurrencyCache();
        }
      } catch (e) {}
    })();
  }, [user]);
  if (loading) return <div style={loaderStyle}><div style={spinnerStyle} /></div>;
  return <ErrorBoundary><BrowserRouter><Suspense fallback={pageLoader}><AppRoutes /></Suspense></BrowserRouter></ErrorBoundary>;
}
