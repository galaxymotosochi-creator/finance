import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  // Если уже залогинен — сразу на Dashboard
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Неверный email или пароль'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Finance</h1>
        <p style={styles.subtitle}>Учёт для бизнеса</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f5f7fa',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    background: '#fff',
    padding: '2.5rem',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,.08)',
    width: '100%',
    maxWidth: '380px',
  },
  title: {
    margin: 0,
    fontSize: '1.6rem',
    fontWeight: 700,
    textAlign: 'center',
    color: '#111',
  },
  subtitle: {
    margin: '.3rem 0 1.5rem',
    fontSize: '.85rem',
    textAlign: 'center',
    color: '#888',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '.75rem',
  },
  input: {
    padding: '.7rem .9rem',
    fontSize: '.9rem',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  button: {
    padding: '.75rem',
    fontSize: '.95rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '10px',
    background: '#1d4ed8',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '.25rem',
  },
  error: {
    color: '#dc2626',
    fontSize: '.82rem',
    margin: 0,
    textAlign: 'center',
  },
};
