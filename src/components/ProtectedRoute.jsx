import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';

export default function ProtectedRoute({ children, skipSubscription }) {
  const { user, loading: authLoading } = useAuth();
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

  // Проверяем подписку только не на странице самой подписки
  if (!skipSubscription && isExpired) {
    return <Navigate to="/settings/subscription" replace />;
  }

  return children;
}
