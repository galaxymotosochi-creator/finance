import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth();

  return (
    <>
      <Sidebar />
      <div className="main">
        <header className="app-header">
          <span className="user-email">{user?.email}</span>
          <button className="logout-btn" onClick={signOut}>Выйти</button>
        </header>
        <div className="content">
          {children}
        </div>
      </div>
    </>
  );
}
