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
const Verify = lazy(() => import('./pages/Verify'));
const TechCards = lazy(() => import('./pages/stock/TechCards'));
const Semifinished = lazy(() => import('./pages/stock/Semifinished'));
const Ingredients = lazy(() => import('./pages/stock/Ingredients'));
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
const OrderForm = lazy(() => import('./pages/stock/OrderForm'));
const Subscription = lazy(() => import('./pages/Subscription'));
const AiAssistant = lazy(() => import('./pages/AiAssistant'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const MySite = lazy(() => import('./pages/shop/MySite'));
const PublicShop = lazy(() => import('./pages/shop/PublicShop'));
const TrashPage = lazy(() => import('./pages/Trash'));
const Clients = lazy(() => import('./pages/clients/Clients'));
const Loyalty = lazy(() => import('./pages/clients/Loyalty'));
const Employees = lazy(() => import('./pages/employees/Employees'));
const Timesheet = lazy(() => import('./pages/employees/Timesheet'));
const RegistersPage = lazy(() => import('./pages/Registers'));
const SalesReport = lazy(() => import('./pages/reports/SalesReport'));
const ProductReport = lazy(() => import('./pages/reports/TradeReport'));
const CategoryReport = lazy(() => import('./pages/reports/CategoryReport'));
const DailyReport = lazy(() => import('./pages/reports/DailyReport'));
const WeeklyReport = lazy(() => import('./pages/reports/WeeklyReport'));
const MonthlyReport = lazy(() => import('./pages/reports/MonthlyReport'));
const AnnualReport = lazy(() => import('./pages/reports/AnnualReport'));
const ReportsHome = lazy(() => import('./pages/reports/ReportsHome'));

function FullKassa() {
  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#f5f5f7',overflow:'hidden'}}>
      <div style={{flex:1,overflow:'hidden'}}>
        <RegistersPage fullscreen />
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Публичные страницы — без каркаса */}
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/s/:slug" element={<PublicShop />} />
      <Route path="/" element={<Landing />} />
      <Route path="/variant/1" element={<Variant1 />} />
      <Route path="/variant/2" element={<Variant2 />} />
      <Route path="/variant/3" element={<Variant3 />} />
      <Route path="/variant/4" element={<Variant4 />} />
      <Route path="/variant/5" element={<Variant5 />} />

      {/* Полноэкранная касса — без меню */}
      <Route path="/kassa" element={<ProtectedRoute><FullKassa /></ProtectedRoute>} />

      {/* Один каркас на все разделы: меню и шапка не пересоздаются при переходах */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ai-assistant" element={<AiAssistant />} />
        <Route path="/registers" element={<RegistersPage />} />

        {/* Финансы */}
        <Route path="/finance/pnl" element={<PnL />} />
        <Route path="/finance/transactions" element={<Transactions />} />
        <Route path="/finance/categories" element={<Categories />} />
        <Route path="/finance/shifts" element={<Shifts />} />
        <Route path="/finance/receipts" element={<Receipts />} />
        <Route path="/finance/salary" element={<Salary />} />
        <Route path="/finance/accounts" element={<Accounts />} />
        <Route path="/finance/plans" element={<Plans />} />

        {/* Клиенты */}
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/promos" element={<Promos />} />
        <Route path="/clients/loyalty" element={<Loyalty />} />
        <Route path="/clients/*" element={<div>Клиенты</div>} />

        {/* Склад и услуги */}
        <Route path="/stock/products" element={<Products />} />
        <Route path="/stock/techcards" element={<TechCards />} />
        <Route path="/stock/semifinished" element={<Semifinished />} />
        <Route path="/stock/ingredients" element={<Ingredients />} />
        <Route path="/stock/categories" element={<StockCategories />} />
        <Route path="/stock/ing-categories" element={<StockCategories />} />
        <Route path="/stock/stock" element={<Stock />} />
        <Route path="/stock/supplies" element={<Supplies />} />
        <Route path="/stock/supply/new" element={<SupplyNew />} />
        <Route path="/stock/suppliers" element={<Suppliers />} />
        <Route path="/stock/writeoffs" element={<Writeoffs />} />
        <Route path="/stock/inventory" element={<Inventory />} />
        <Route path="/stock/health" element={<Health />} />
        <Route path="/stock/order" element={<OrderForm />} />
        <Route path="/stock/turnover" element={<Health />} />
        <Route path="/stock/*" element={<div>Склад</div>} />

        {/* Команда */}
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/timesheet" element={<Timesheet />} />
        <Route path="/employees/*" element={<div>Команда</div>} />

        {/* Сайт и настройки */}
        <Route path="/my-site" element={<MySite />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/trash" element={<TrashPage />} />
        <Route path="/settings/*" element={<SettingsPage />} />

        {/* Отчёты */}
        <Route path="/reports" element={<ReportsHome />} />
        <Route path="/reports/sales" element={<SalesReport />} />
        <Route path="/reports/category" element={<CategoryReport />} />
        <Route path="/reports/daily" element={<DailyReport />} />
        <Route path="/reports/weekly" element={<WeeklyReport />} />
        <Route path="/reports/monthly" element={<MonthlyReport />} />
        <Route path="/reports/annual" element={<AnnualReport />} />
        <Route path="/reports/:kind" element={<ProductReport />} />
      </Route>

      {/* Подписка — каркас без проверки подписки */}
      <Route element={<ProtectedRoute skipSubscription><AppLayout /></ProtectedRoute>}>
        <Route path="/settings/subscription" element={<Subscription />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

const loaderStyle = {
  position:'fixed',inset:0,zIndex:9999,
  display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#fff',gap:'14px'
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
  // чтобы они работали во всех разделах еще до открытия настроек
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
