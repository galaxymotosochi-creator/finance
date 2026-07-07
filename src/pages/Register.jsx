import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const BUSINESS_TYPES = [
  { id: 'retail', label: 'Магазины / бутики / торговые точки' },
  { id: 'food', label: 'Кафе / рестораны / кофейни / на вынос' },
  { id: 'ecommerce', label: 'Интернет-торговля' },
  { id: 'manufacturing', label: 'Производство / мастерские' },
  { id: 'distribution', label: 'Дистрибьюторы / поставщики' },
  { id: 'services', label: 'Услуги' },
  { id: 'construction', label: 'Строительство' },
  { id: 'other', label: 'Другое' },
];

export default function Register() {
  const [businessType, setBusinessType] = useState('');
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
        <div style={{fontSize:'.78rem',color:'rgba(0,0,0,.34)',marginBottom:4,textAlign:'center'}}>AtlasPos</div>
        <h1 style={{fontSize:'1.2rem',fontWeight:700,textAlign:'center',marginBottom:4,letterSpacing:'-.03em'}}>Создать аккаунт</h1>
        <p style={{fontSize:.8,color:'rgba(0,0,0,.54)',textAlign:'center',marginBottom:20}}>Бесплатно, без привязки карты</p>
        <form onSubmit={handleSubmit}>
          
          {/* Выбор типа бизнеса */}
          <div style={{marginBottom:'.6rem'}}>
            <label style={{fontSize:'.7rem',fontWeight:600,color:'rgba(0,0,0,.5)',textTransform:'uppercase',letterSpacing:'.02em',display:'block',marginBottom:'.4rem'}}>
              Какой у вас бизнес?
            </label>
            <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
              {BUSINESS_TYPES.map(bt => (
                <label key={bt.id} onClick={() => setBusinessType(bt.id)}
                  style={{
                    display:'flex',alignItems:'center',gap:'.45rem',
                    padding:'.45rem .65rem',borderRadius:'.5rem',
                    cursor:'pointer',fontSize:'.78rem',color:'#555',
                    transition:'all .12s',fontFamily:'inherit',
                    background: businessType === bt.id ? '#ffdd2d' : '#f8f8f8',
                    border: businessType === bt.id ? '1px solid #ffdd2d' : '1px solid transparent',
                    fontWeight: businessType === bt.id ? 600 : 400,
                  }}>
                  <span style={{
                    width:'16px',height:'16px',borderRadius:'50%',
                    border: businessType === bt.id ? '5px solid #000' : '2px solid #ccc',
                    transition:'all .15s',flexShrink:0,
                  }} />
                  {bt.label}
                </label>
              ))}
            </div>
          </div>

          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus />
          <input type="password" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
          <input type="password" placeholder="Подтвердите пароль" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
          <div style={{textAlign:'center',marginTop:'.5rem',color:'var(--muted)',fontSize:'.75rem',lineHeight:1}}>или</div>

          <button
            type="button"
            onClick={() => { window.location.href = 'https://oauth.yandex.ru/authorize?response_type=code&client_id=a61e2a767f724e368cbcab159c66a941&redirect_uri=https://atlaspos.ru/receiver.html'; }}
            style={{
              width:'100%',padding:'.7rem',borderRadius:'8px',border:'1px solid #000',
              background:'#000',cursor:'pointer',fontSize:'.85rem',fontWeight:500,
              color:'#fff',fontFamily:'inherit',display:'flex',alignItems:'center',
              justifyContent:'center',gap:'6px',marginTop:'.5rem'
            }}
          >
            <span style={{display:'inline-flex',width:'22px',height:'22px',borderRadius:'50%',background:'#fc3f1d',color:'#fff',alignItems:'center',justifyContent:'center',fontSize:'.9rem',fontWeight:700}}>Я</span> Войти с Яндекс ID
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
