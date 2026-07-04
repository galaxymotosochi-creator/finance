import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';

export default function ProtectedRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { loading: subLoading, isExpired } = useSubscription();

  if (authLoading || subLoading) {
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

  if (isExpired) {
    return <Navigate to="/settings/subscription" replace />;
  }

  return children;
}
