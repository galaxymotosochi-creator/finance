import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';

const PATH_TO_PERM = {
  '/dashboard': 'dashboard',
  '/ai-assistant': null,
  '/registers': 'registers',
  '/kassa': 'registers',
  '/finance/transactions': 'finance.transactions',
  '/finance/accounts': 'finance.accounts',
  '/finance/receipts': 'finance.receipts',
  '/finance/salary': 'finance.salary',
  '/finance/shifts': 'finance.shifts',
  '/finance/pnl': 'finance.pnl',
  '/finance/categories': 'finance.categories',
  '/finance/plans': 'finance.plans',
  '/stock/products': 'stock.products',
  '/stock/categories': 'stock.categories',
  '/stock/turnover': 'stock.turnover',
  '/stock/stock': 'stock.stock',
  '/stock/supplies': 'stock.supplies',
  '/stock/inventory': 'stock.inventory',
  '/stock/writeoffs': 'stock.writeoffs',
  '/stock/suppliers': 'stock.suppliers',
  '/clients': 'clients.base',
  '/clients/loyalty': 'clients.loyalty',
  '/clients/promos': 'clients.promos',
  '/employees': 'team.employees',
  '/employees/positions': 'team.positions',
  '/employees/timesheet': 'team.timesheet',
  '/settings': 'settings.general',
  '/settings/venues': 'settings.venues',
  '/settings/subscription': 'settings.subscription',
};

function getRequiredPerm(pathname) {
  // Убираем trailing slash
  const path = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return PATH_TO_PERM[path] || null;
}

export default function ProtectedRoute({ children, skipSubscription }) {
  const { user, loading: authLoading, employeeData, hasPermission } = useAuth();
  const { loading: subLoading, isExpired } = useSubscription();
  const location = useLocation();

  if (authLoading || (subLoading && !skipSubscription)) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        color: '#666',
      }}>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Проверка прав доступа к разделу
  const requiredPerm = getRequiredPerm(location.pathname);
  if (requiredPerm && employeeData && !hasPermission(requiredPerm)) {
    return <Navigate to="/" replace />;
  }

  // Проверяем подписку только не на странице самой подписки
  if (!skipSubscription && isExpired) {
    return <Navigate to="/settings/subscription" replace />;
  }

  return children;
}
