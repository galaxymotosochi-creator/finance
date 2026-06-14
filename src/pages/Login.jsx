import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

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

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('Введите email в поле выше');
      return;
    }
    setError('');
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/#/login',
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Ошибка отправки письма');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Финансы</h1>
        <p className="sub">Учет для бизнеса</p>

        {resetSent ? (
          <>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📧</div>
              <p style={{ fontSize: '.85rem', color: 'var(--body-color)', lineHeight: 1.4 }}>
                Письмо для сброса пароля отправлено на <strong>{email}</strong>
              </p>
              <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.5rem' }}>
                Проверьте почту и перейдите по ссылке в письме.
              </p>
            </div>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setResetSent(false)}>
              Назад ко входу
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '.75rem' }}>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '.78rem', color: 'var(--secondary)', fontFamily: 'var(--font)',
                  padding: '.3rem', textDecoration: 'underline',
                }}
              >
                {resetLoading ? 'Отправка...' : 'Забыли пароль?'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
