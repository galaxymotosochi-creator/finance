import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth();

  return (
    <div style={styles.wrapper}>
      <Sidebar />
      <div style={styles.mainArea}>
        <header style={styles.header}>
          <div />
          <div style={styles.userArea}>
            <span style={styles.email}>{user?.email}</span>
            <button onClick={signOut} style={styles.logoutBtn}>Выйти</button>
          </div>
        </header>
        <main style={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f5f7fa',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '.65rem 1.5rem',
    background: '#fff',
    borderBottom: '1px solid #eaeaea',
    flexShrink: 0,
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '.75rem',
  },
  email: {
    fontSize: '.8rem',
    color: '#888',
  },
  logoutBtn: {
    padding: '.35rem .75rem',
    fontSize: '.78rem',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    background: '#fff',
    cursor: 'pointer',
    color: '#666',
    fontFamily: 'inherit',
  },
  content: {
    flex: 1,
    padding: '1.5rem',
    overflowY: 'auto',
  },
};
