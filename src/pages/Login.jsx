import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [mailruLoading, setMailruLoading] = useState(false);

  // Обработка code от Mail.ru
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setMailruLoading(true);
      setError('');
      window.history.replaceState({}, '', '/login');

      fetch('https://api.atlaspos.ru/api/auth/yandex/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.token) {
            const session = {
              access_token: data.token, token_type: 'bearer',
              user: { id: data.user.id, email: data.user.email, user_metadata: {} },
            };
            localStorage.setItem('atlaspos_session', JSON.stringify(session));
            window.location.href = '/';
          } else {
            setError('Ошибка входа через Mail.ru');
            setMailruLoading(false);
          }
        })
        .catch(() => { setError('Ошибка соединения'); setMailruLoading(false); });
    }
  }, []);

  if (user) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Неверный email или пароль'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Введите ваш email');
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
                Письмо отправлено на <strong>{email}</strong>
              </p>
              <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.5rem' }}>
                Перейдите по ссылке в письме, чтобы задать новый пароль.
              </p>
            </div>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => { setResetSent(false); setResetMode(false); }}>
              Назад ко входу
            </button>
          </>
        ) : resetMode ? (
          <form onSubmit={handleResetPassword}>
            <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: '1rem', textAlign: 'center' }}>
              Введите email — пришлём ссылку для сброса пароля
            </p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={resetLoading}>
              {resetLoading ? 'Отправка...' : 'Отправить письмо'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '.75rem' }}>
              <button
                type="button"
                onClick={() => { setResetMode(false); setError(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '.78rem', color: 'var(--muted)', fontFamily: 'var(--font)',
                  padding: '.3rem', textDecoration: 'underline',
                }}
              >
                ← Назад
              </button>
            </div>
          </form>
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
                onClick={() => { setResetMode(true); setError(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '.78rem', color: 'var(--secondary)', fontFamily: 'var(--font)',
                  padding: '.3rem', textDecoration: 'underline',
                }}
              >
                Забыли пароль?
              </button>
            </div>

            <div style={{textAlign:'center',marginTop:'.5rem',color:'var(--muted)',fontSize:'.75rem',lineHeight:1}}>или</div>

            <button
              type="button"
              onClick={() => { window.location.href = 'https://oauth.yandex.ru/authorize?response_type=code&client_id=a61e2a767f724e368cbcab159c66a941&redirect_uri=https://atlaspos.ru/receiver.html'; }}
              style={{
                width:'100%',padding:'.7rem',borderRadius:'8px',border:'1px solid #005FF9',
                background:'#fff',cursor:'pointer',fontSize:'.85rem',fontWeight:600,
                color:'#005FF9',fontFamily:'inherit',display:'flex',alignItems:'center',
                justifyContent:'center',gap:'6px',marginTop:'.5rem'
              }}
            >
              <span style={{fontSize:'1.1rem'}}>Я</span> Войти через Яндекс
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
