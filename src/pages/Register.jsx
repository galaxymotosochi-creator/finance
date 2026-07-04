import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { signUp, user } = useAuth();
  const n = useNavigate();

  if (user) { n('/dashboard', { replace: true }); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Пароли не совпадают'); return; }
    if (password.length < 6) { setError('Пароль должен быть минимум 6 символов'); return; }
    setLoading(true);
    try {
      const { error } = await signUp(email, password);
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError(err.message === 'User already registered'
        ? 'Этот email уже зарегистрирован'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="login-wrapper">
        <div className="login-card" style={{textAlign:'center'}}>
          <div style={{fontSize:'2.5rem',marginBottom:'.75rem'}}>📧</div>
          <h1 style={{fontSize:'1.2rem',fontWeight:700,marginBottom:8,letterSpacing:'-.03em'}}>Письмо отправлено</h1>
          <p style={{fontSize:'.85rem',color:'rgba(0,0,0,.54)',lineHeight:1.4,marginBottom:8}}>
            Проверьте почту <strong>{email}</strong> и перейдите по ссылке в письме, чтобы подтвердить аккаунт.
          </p>
          <p style={{fontSize:.78,color:'rgba(0,0,0,.34)',marginBottom:20}}>
            Если письмо не пришло — проверьте папку «Спам».
          </p>
          <button className="btn btn-ghost" style={{width:'100%'}} onClick={() => n('/login')}>
            Перейти ко входу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div style={{fontSize:'.78rem',color:'rgba(0,0,0,.34)',marginBottom:4,textAlign:'center'}}>AltasPos</div>
        <h1 style={{fontSize:'1.2rem',fontWeight:700,textAlign:'center',marginBottom:4,letterSpacing:'-.03em'}}>Создать аккаунт</h1>
        <p style={{fontSize:.8,color:'rgba(0,0,0,.54)',textAlign:'center',marginBottom:20}}>Бесплатно, без привязки карты</p>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus />
          <input type="password" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
          <input type="password" placeholder="Подтвердите пароль" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
          <div style={{textAlign:'center',marginTop:12,fontSize:'.78rem',color:'rgba(0,0,0,.54)'}}>
            Уже есть аккаунт?{' '}
            <span onClick={()=>n('/login')} style={{color:'var(--secondary)',textDecoration:'underline',cursor:'pointer'}}>Войти</span>
          </div>
        </form>
      </div>
    </div>
  );
}
