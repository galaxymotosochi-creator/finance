import { useState } from 'react';
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
  const [notVerified, setNotVerified] = useState('');
  const [resendInfo, setResendInfo] = useState('');
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotVerified('');
    setResendInfo('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setNotVerified(err.email || email);
      } else {
        setError(err.message === 'Invalid login credentials'
          ? 'Неверный email или пароль'
          : err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const resendVerify = async () => {
    setResendInfo('Отправляем…');
    try {
      const r = await fetch('/api/auth/resend-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: notVerified || email }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok !== false) setResendInfo('Письмо отправлено. Проверьте почту.');
      else setResendInfo('Не удалось отправить. Попробуйте позже.');
    } catch (e) {
      setResendInfo('Ошибка сети. Попробуйте позже.');
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
        <h1>AtlasPos</h1>
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
              Введите email — пришлем ссылку для сброса пароля
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

            {notVerified && (
              <div style={{background:'#EAF2FF',border:'1px solid rgba(31,117,255,.35)',borderRadius:'12px',padding:'12px 14px',marginBottom:12}}>
                <div style={{fontSize:'.8rem',fontWeight:700,color:'#0d4ea8',marginBottom:5}}>Подтвердите почту</div>
                <div style={{fontSize:'.76rem',color:'rgba(0,0,0,.62)',lineHeight:1.45,marginBottom:9}}>
                  Вход откроется после подтверждения адреса <strong>{notVerified}</strong>. Проверьте письмо и нажмите в нём «Подтвердить email».
                </div>
                <button type="button" onClick={resendVerify}
                  style={{width:'100%',border:'none',borderRadius:100,padding:'8px',fontFamily:'var(--font)',
                    fontSize:'.76rem',fontWeight:700,cursor:'pointer',background:'linear-gradient(135deg,#1F75FF,#0d4ea8)',color:'#fff'}}>
                  Отправить письмо ещё раз
                </button>
                {resendInfo && <div style={{fontSize:'.73rem',color:'#0d4ea8',marginTop:7}}>{resendInfo}</div>}
              </div>
            )}

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
          </form>
        )}
      </div>
    </div>
  );
}
