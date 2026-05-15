import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Finance</h1>
        <div style={styles.userArea}>
          <span style={styles.email}>{user?.email}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Выйти
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <h2 style={styles.greeting}>
          Добро пожаловать, {user?.email?.split('@')[0] || 'пользователь'}
        </h2>
        <p style={styles.hint}>
          Здесь будет панель управления. Раздел в разработке.
        </p>
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    background: '#f5f7fa',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    background: '#fff',
    borderBottom: '1px solid #eaeaea',
  },
  logo: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#111',
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  email: {
    fontSize: '.82rem',
    color: '#888',
  },
  logoutBtn: {
    padding: '.4rem .8rem',
    fontSize: '.8rem',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    background: '#fff',
    cursor: 'pointer',
    color: '#666',
    fontFamily: 'inherit',
  },
  main: {
    padding: '2rem',
    maxWidth: '800px',
  },
  greeting: {
    fontSize: '1.3rem',
    fontWeight: 600,
    color: '#222',
  },
  hint: {
    color: '#888',
    fontSize: '.9rem',
  },
};
