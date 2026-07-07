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

const REVENUE_OPTIONS = [
  { id: 'less_100k', label: 'менее 100 000 ₽' },
  { id: '100k_1m', label: '100 000 ₽ — 1 000 000 ₽' },
  { id: '1m_2m', label: '1 000 000 ₽ — 2 000 000 ₽' },
  { id: '2m_5m', label: '2 000 000 ₽ — 5 000 000 ₽' },
  { id: 'more_5m', label: 'более 5 000 000 ₽' },
];

const PRODUCT_VOLUME = [
  { id: 'less_50', label: 'Менее 50' },
  { id: '50_200', label: '50 — 200' },
  { id: '200_1000', label: '200 — 1 000' },
  { id: 'more_1000', label: 'Более 1 000' },
];

const CURRENCIES = [
  { id: 'rub', label: '🇷🇺 Российский рубль (₽)', symbol: '₽' },
  { id: 'kzt', label: '🇰🇿 Казахский тенге (₸)', symbol: '₸' },
  { id: 'uzs', label: '🇺🇿 Узбекский сум (so\'m)', symbol: "so'm" },
  { id: 'amd', label: '🇦🇲 Армянский драм (֏)', symbol: '֏' },
  { id: 'kgs', label: '🇰🇬 Киргизский сом (с)', symbol: 'с' },
  { id: 'gel', label: '🇬🇪 Грузинский лари (₾)', symbol: '₾' },
  { id: 'byn', label: '🇧🇾 Белорусский рубль (Br)', symbol: 'Br' },
  { id: 'azn', label: '🇦🇿 Азербайджанский манат (₼)', symbol: '₼' },
  { id: 'tjs', label: '🇹🇯 Таджикский сомони (SM)', symbol: 'SM' },
  { id: 'mdl', label: '🇲🇩 Молдавский лей (L)', symbol: 'L' },
];

const BRANCH_OPTIONS = [
  { id: 'yes', label: 'Да' },
  { id: 'no', label: 'Нет' },
];

const CLIENT_TYPES = [
  { id: 'b2c', label: 'Только физические лица (b2c)' },
  { id: 'b2b', label: 'Только компании (b2b)' },
  { id: 'mixed_more_b2b', label: 'И физические лица и компании, но больше компании' },
  { id: 'mixed_more_b2c', label: 'И физические лица и компании, но больше физические лица' },
  { id: 'mixed', label: 'И физические лица и компании' },
];

export default function Register() {
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState('');
  const [revenue, setRevenue] = useState('');
  const [productVolume, setProductVolume] = useState('');
  const [currency, setCurrency] = useState('');
  const [hasBranches, setHasBranches] = useState('');
  const [clientType, setClientType] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { signUp, user } = useAuth();
  const n = useNavigate();
  const [fade, setFade] = useState('in');

  if (user) { n('/dashboard', { replace: true }); return null; }

  const nextStep = () => {
    if (step === 1 && !businessType) { setError('Выберите тип бизнеса'); return; }
    if (step === 2 && !revenue) { setError('Укажите объём продаж'); return; }
    if (step === 3 && !productVolume) { setError('Укажите количество товаров/услуг'); return; }
    if (step === 4 && !currency) { setError('Выберите валюту'); return; }
    if (step === 5 && !hasBranches) { setError('Ответьте на вопрос'); return; }
    if (step === 6 && !clientType) { setError('Выберите тип клиентов'); return; }
    setError('');
    setFade('out');
    setTimeout(() => { setStep(s => s + 1); setFade('in'); }, 150);
  };

  const prevStep = () => {
    setError('');
    setFade('out');
    setTimeout(() => { setStep(s => s - 1); setFade('in'); }, 150);
  };

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

  const container = {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#fff', zIndex: 50,
    fontFamily: 'var(--font)',
  };

  const card = {
    background: '#fff', padding: '2rem', borderRadius: 'var(--radius-lg)',
    width: '100%', maxWidth: '380px', margin: '0 auto',
  };

  const fadeStyle = {
    transition: 'opacity .15s, transform .15s',
    opacity: fade === 'in' ? 1 : 0,
    transform: fade === 'in' ? 'translateY(0)' : 'translateY(8px)',
  };

  // Прогресс-бар
  const Progress = ({ current, total }) => (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '1.25rem', justifyContent: 'center' }}>
      {Array.from({length: total}, (_, i) => (
        <div key={i} style={{
          height: '4px', flex: 1, maxWidth: '60px',
          borderRadius: '100px',
          background: i < current ? '#ffdd2d' : i === current ? '#ffdd2d' : '#eee',
          opacity: i === current ? .5 : 1,
          transition: 'all .3s',
        }} />
      ))}
    </div>
  );

  // Кнопка "Далее"
  const NextBtn = ({ disabled }) => (
    <button onClick={nextStep} disabled={disabled}
      style={{
        width: '100%', padding: '.7rem', fontSize: '.82rem', fontWeight: 600,
        border: 'none', borderRadius: 'var(--radius-pill)', cursor: disabled ? 'default' : 'pointer',
        background: disabled ? '#eee' : '#000', color: disabled ? '#bbb' : '#fff',
        fontFamily: 'inherit', transition: 'all .15s', marginTop: '.5rem',
      }}>
      Далее
    </button>
  );

  if (done) {
    return (
      <div style={container}>
        <div className="login-card" style={{textAlign:'center', ...card}}>
          <div style={{fontSize:'2.5rem',marginBottom:'.75rem'}}>📧</div>
          <h1 style={{fontSize:'1.2rem',fontWeight:700,marginBottom:8,letterSpacing:'-.03em'}}>Письмо отправлено</h1>
          <p style={{fontSize:'.85rem',color:'rgba(0,0,0,.54)',lineHeight:1.4,marginBottom:8}}>
            Проверьте почту <strong>{email}</strong> и перейдите по ссылке в письме, чтобы подтвердить аккаунт.
          </p>
          <p style={{fontSize:'.78rem',color:'rgba(0,0,0,.34)',marginBottom:20}}>
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
    <div style={container}>
      <div style={card}>

        {/* Логотип */}
        <div style={{fontSize:'.78rem',color:'rgba(0,0,0,.34)',marginBottom:'.5rem',textAlign:'center'}}>
          AtlasPos
        </div>
        <h1 style={{fontSize:'1.15rem',fontWeight:700,textAlign:'center',marginBottom:2,letterSpacing:'-.03em'}}>
          {step === 1 ? 'Создать аккаунт' : step === 2 ? 'Объём продаж' : step === 3 ? 'Товары и услуги' : step === 4 ? 'Валюта' : step === 5 ? 'Филиалы' : step === 6 ? 'Ваши клиенты' : 'Регистрация'}
        </h1>
        <p style={{fontSize:'.8rem',color:'rgba(0,0,0,.54)',textAlign:'center',marginBottom:'1rem'}}>
          {step === 1 ? 'Расскажите о своём бизнесе' : step === 2 ? 'Сколько продаёте в месяц?' : step === 3 ? 'Сколько товаров/услуг?' : step === 4 ? 'В какой валюте работаете?' : step === 5 ? 'У вас есть филиалы?' : step === 6 ? 'Кто ваши клиенты?' : 'Данные для входа'}
        </p>

        <Progress current={step - 1} total={7} />

        {/* Шаг 1: Тип бизнеса */}
        {step === 1 && (
          <div style={fadeStyle}>
            <label style={{
              fontSize:'.72rem',fontWeight:600,color:'rgba(0,0,0,.5)',
              textTransform:'uppercase',letterSpacing:'.02em',display:'block',marginBottom:'.4rem',
            }}>
              Какой у вас бизнес?
            </label>
            <div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'.5rem'}}>
              {BUSINESS_TYPES.map(bt => (
                <label key={bt.id} onClick={() => { setBusinessType(bt.id); setError(''); }}
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
            {error && <p className="error" style={{marginBottom:0}}>{error}</p>}
            <NextBtn disabled={!businessType} />
          </div>
        )}

        {/* Шаг 2: Объём продаж */}
        {step === 2 && (
          <div style={fadeStyle}>
            <label style={{
              fontSize:'.72rem',fontWeight:600,color:'rgba(0,0,0,.5)',
              textTransform:'uppercase',letterSpacing:'.02em',display:'block',marginBottom:'.4rem',
            }}>
              Объём продаж в месяц
            </label>
            <div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'.5rem'}}>
              {REVENUE_OPTIONS.map(rv => (
                <label key={rv.id} onClick={() => { setRevenue(rv.id); setError(''); }}
                  style={{
                    display:'flex',alignItems:'center',gap:'.45rem',
                    padding:'.45rem .65rem',borderRadius:'.5rem',
                    cursor:'pointer',fontSize:'.78rem',color:'#555',
                    transition:'all .12s',fontFamily:'inherit',
                    background: revenue === rv.id ? '#ffdd2d' : '#f8f8f8',
                    border: revenue === rv.id ? '1px solid #ffdd2d' : '1px solid transparent',
                    fontWeight: revenue === rv.id ? 600 : 400,
                  }}>
                  <span style={{
                    width:'16px',height:'16px',borderRadius:'50%',
                    border: revenue === rv.id ? '5px solid #000' : '2px solid #ccc',
                    transition:'all .15s',flexShrink:0,
                  }} />
                  {rv.label}
                </label>
              ))}
            </div>
            {error && <p className="error" style={{marginBottom:0}}>{error}</p>}
            <div style={{display:'flex',gap:'.5rem',marginTop:'.5rem'}}>
              <button onClick={prevStep}
                style={{
                  flex:1, padding:'.7rem', fontSize:'.82rem', fontWeight:600,
                  border:'1px solid rgba(0,0,0,.12)', borderRadius:'var(--radius-pill)',
                  cursor:'pointer', background:'transparent', color:'#555',
                  fontFamily:'inherit', transition:'all .15s',
                }}>
                Назад
              </button>
              <div style={{flex:'2'}}><NextBtn disabled={!revenue} /></div>
            </div>
          </div>
        )}

        {/* Шаг 3: Количество товаров/услуг */}
        {step === 3 && (
          <div style={fadeStyle}>
            <label style={{
              fontSize:'.72rem',fontWeight:600,color:'rgba(0,0,0,.5)',
              textTransform:'uppercase',letterSpacing:'.02em',display:'block',marginBottom:'.4rem',
            }}>
              Сколько различных товаров/услуг вы предлагаете?
            </label>
            <div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'.5rem'}}>
              {PRODUCT_VOLUME.map(pv => (
                <label key={pv.id} onClick={() => { setProductVolume(pv.id); setError(''); }}
                  style={{
                    display:'flex',alignItems:'center',gap:'.45rem',
                    padding:'.45rem .65rem',borderRadius:'.5rem',
                    cursor:'pointer',fontSize:'.78rem',color:'#555',
                    transition:'all .12s',fontFamily:'inherit',
                    background: productVolume === pv.id ? '#ffdd2d' : '#f8f8f8',
                    border: productVolume === pv.id ? '1px solid #ffdd2d' : '1px solid transparent',
                    fontWeight: productVolume === pv.id ? 600 : 400,
                  }}>
                  <span style={{
                    width:'16px',height:'16px',borderRadius:'50%',
                    border: productVolume === pv.id ? '5px solid #000' : '2px solid #ccc',
                    transition:'all .15s',flexShrink:0,
                  }} />
                  {pv.label}
                </label>
              ))}
            </div>
            {error && <p className="error" style={{marginBottom:0}}>{error}</p>}
            <div style={{display:'flex',gap:'.5rem',marginTop:'.5rem'}}>
              <button onClick={prevStep}
                style={{
                  flex:1, padding:'.7rem', fontSize:'.82rem', fontWeight:600,
                  border:'1px solid rgba(0,0,0,.12)', borderRadius:'var(--radius-pill)',
                  cursor:'pointer', background:'transparent', color:'#555',
                  fontFamily:'inherit', transition:'all .15s',
                }}>
                Назад
              </button>
              <div style={{flex:'2'}}><NextBtn disabled={!productVolume} /></div>
            </div>
          </div>
        )}

        {/* Шаг 4: Валюта */}
        {step === 4 && (
          <div style={fadeStyle}>
            <label style={{
              fontSize:'.72rem',fontWeight:600,color:'rgba(0,0,0,.5)',
              textTransform:'uppercase',letterSpacing:'.02em',display:'block',marginBottom:'.4rem',
            }}>
              Какую валюту вы используете?
            </label>
            <div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'.5rem'}}>
              {CURRENCIES.map(c => (
                <label key={c.id} onClick={() => { setCurrency(c.id); setError(''); }}
                  style={{
                    display:'flex',alignItems:'center',gap:'.45rem',
                    padding:'.45rem .65rem',borderRadius:'.5rem',
                    cursor:'pointer',fontSize:'.78rem',color:'#555',
                    transition:'all .12s',fontFamily:'inherit',
                    background: currency === c.id ? '#ffdd2d' : '#f8f8f8',
                    border: currency === c.id ? '1px solid #ffdd2d' : '1px solid transparent',
                    fontWeight: currency === c.id ? 600 : 400,
                  }}>
                  <span style={{
                    width:'16px',height:'16px',borderRadius:'50%',
                    border: currency === c.id ? '5px solid #000' : '2px solid #ccc',
                    transition:'all .15s',flexShrink:0,
                  }} />
                  {c.label}
                </label>
              ))}
            </div>
            {error && <p className="error" style={{marginBottom:0}}>{error}</p>}
            <div style={{display:'flex',gap:'.5rem',marginTop:'.5rem'}}>
              <button onClick={prevStep}
                style={{
                  flex:1, padding:'.7rem', fontSize:'.82rem', fontWeight:600,
                  border:'1px solid rgba(0,0,0,.12)', borderRadius:'var(--radius-pill)',
                  cursor:'pointer', background:'transparent', color:'#555',
                  fontFamily:'inherit', transition:'all .15s',
                }}>
                Назад
              </button>
              <div style={{flex:'2'}}><NextBtn disabled={!currency} /></div>
            </div>
          </div>
        )}

        {/* Шаг 5: Филиалы */}
        {step === 5 && (
          <div style={fadeStyle}>
            <label style={{
              fontSize:'.72rem',fontWeight:600,color:'rgba(0,0,0,.5)',
              textTransform:'uppercase',letterSpacing:'.02em',display:'block',marginBottom:'.4rem',
            }}>
              У вас есть филиалы?
            </label>
            <div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'.5rem'}}>
              {BRANCH_OPTIONS.map(b => (
                <label key={b.id} onClick={() => { setHasBranches(b.id); setError(''); }}
                  style={{
                    display:'flex',alignItems:'center',gap:'.45rem',
                    padding:'.45rem .65rem',borderRadius:'.5rem',
                    cursor:'pointer',fontSize:'.78rem',color:'#555',
                    transition:'all .12s',fontFamily:'inherit',
                    background: hasBranches === b.id ? '#ffdd2d' : '#f8f8f8',
                    border: hasBranches === b.id ? '1px solid #ffdd2d' : '1px solid transparent',
                    fontWeight: hasBranches === b.id ? 600 : 400,
                  }}>
                  <span style={{
                    width:'16px',height:'16px',borderRadius:'50%',
                    border: hasBranches === b.id ? '5px solid #000' : '2px solid #ccc',
                    transition:'all .15s',flexShrink:0,
                  }} />
                  {b.label}
                </label>
              ))}
            </div>
            {error && <p className="error" style={{marginBottom:0}}>{error}</p>}
            <div style={{display:'flex',gap:'.5rem',marginTop:'.5rem'}}>
              <button onClick={prevStep}
                style={{
                  flex:1, padding:'.7rem', fontSize:'.82rem', fontWeight:600,
                  border:'1px solid rgba(0,0,0,.12)', borderRadius:'var(--radius-pill)',
                  cursor:'pointer', background:'transparent', color:'#555',
                  fontFamily:'inherit', transition:'all .15s',
                }}>
                Назад
              </button>
              <div style={{flex:'2'}}><NextBtn disabled={!hasBranches} /></div>
            </div>
          </div>
        )}

        {/* Шаг 6: Тип клиентов */}
        {step === 6 && (
          <div style={fadeStyle}>
            <label style={{
              fontSize:'.72rem',fontWeight:600,color:'rgba(0,0,0,.5)',
              textTransform:'uppercase',letterSpacing:'.02em',display:'block',marginBottom:'.4rem',
            }}>
              Какой у вас тип клиентов?
            </label>
            <div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'.5rem'}}>
              {CLIENT_TYPES.map(ct => (
                <label key={ct.id} onClick={() => { setClientType(ct.id); setError(''); }}
                  style={{
                    display:'flex',alignItems:'center',gap:'.45rem',
                    padding:'.45rem .65rem',borderRadius:'.5rem',
                    cursor:'pointer',fontSize:'.78rem',color:'#555',
                    transition:'all .12s',fontFamily:'inherit',
                    background: clientType === ct.id ? '#ffdd2d' : '#f8f8f8',
                    border: clientType === ct.id ? '1px solid #ffdd2d' : '1px solid transparent',
                    fontWeight: clientType === ct.id ? 600 : 400,
                  }}>
                  <span style={{
                    width:'16px',height:'16px',borderRadius:'50%',
                    border: clientType === ct.id ? '5px solid #000' : '2px solid #ccc',
                    transition:'all .15s',flexShrink:0,
                  }} />
                  {ct.label}
                </label>
              ))}
            </div>
            {error && <p className="error" style={{marginBottom:0}}>{error}</p>}
            <div style={{display:'flex',gap:'.5rem',marginTop:'.5rem'}}>
              <button onClick={prevStep}
                style={{
                  flex:1, padding:'.7rem', fontSize:'.82rem', fontWeight:600,
                  border: '1px solid rgba(0,0,0,.12)', borderRadius:'var(--radius-pill)',
                  cursor:'pointer', background:'transparent', color:'#555',
                  fontFamily:'inherit', transition:'all .15s',
                }}>
                Назад
              </button>
              <div style={{flex:'2'}}><NextBtn disabled={!clientType} /></div>
            </div>
          </div>
        )}

        {/* Шаг 7: Email + пароль */}
        {step === 7 && (
          <form onSubmit={handleSubmit} style={fadeStyle}>
            <input type="email" placeholder="Email" value={email}
              onChange={e=>setEmail(e.target.value)} required autoFocus
              style={{
                width:'100%', padding:'.7rem .9rem', fontSize:'.82rem',
                border:'1.5px solid var(--border)', borderRadius:'var(--radius-md)',
                outline:'none', fontFamily:'var(--font)', marginBottom:'.6rem',
                transition:'border-color var(--transition), box-shadow var(--transition)',
                color:'var(--body-color)', boxSizing:'border-box',
              }} />
            <input type="password" placeholder="Пароль" value={password}
              onChange={e=>setPassword(e.target.value)} required minLength={6}
              style={{
                width:'100%', padding:'.7rem .9rem', fontSize:'.82rem',
                border:'1.5px solid var(--border)', borderRadius:'var(--radius-md)',
                outline:'none', fontFamily:'var(--font)', marginBottom:'.6rem',
                transition:'border-color var(--transition), box-shadow var(--transition)',
                color:'var(--body-color)', boxSizing:'border-box',
              }} />
            <input type="password" placeholder="Подтвердите пароль" value={confirm}
              onChange={e=>setConfirm(e.target.value)} required
              style={{
                width:'100%', padding:'.7rem .9rem', fontSize:'.82rem',
                border:'1.5px solid var(--border)', borderRadius:'var(--radius-md)',
                outline:'none', fontFamily:'var(--font)', marginBottom:'.6rem',
                transition:'border-color var(--transition), box-shadow var(--transition)',
                color:'var(--body-color)', boxSizing:'border-box',
              }} />
            {error && <p className="error" style={{marginBottom:0}}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{
                width:'100%', padding:'.7rem', fontSize:'.82rem', fontWeight:600,
                border:'none', borderRadius:'var(--radius-pill)',
                cursor: loading ? 'default' : 'pointer',
                background: loading ? '#eee' : '#000',
                color: loading ? '#bbb' : '#fff',
                fontFamily:'inherit', transition:'all .15s', marginTop:'.35rem',
              }}>
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
            <div style={{textAlign:'center',marginTop:'.5rem',color:'var(--muted)',fontSize:'.75rem',lineHeight:1}}>или</div>
            <button type="button"
              onClick={() => { window.location.href = 'https://oauth.yandex.ru/authorize?response_type=code&client_id=a61e2a767f724e368cbcab159c66a941&redirect_uri=https://atlaspos.ru/receiver.html'; }}
              style={{
                width:'100%',padding:'.7rem',borderRadius:'8px',border:'1px solid #000',
                background:'#000',cursor:'pointer',fontSize:'.82rem',fontWeight:500,
                color:'#fff',fontFamily:'inherit',display:'flex',alignItems:'center',
                justifyContent:'center',gap:'6px',marginTop:'.5rem',
              }}>
              <span style={{display:'inline-flex',width:'22px',height:'22px',borderRadius:'50%',background:'#fc3f1d',color:'#fff',alignItems:'center',justifyContent:'center',fontSize:'.9rem',fontWeight:700}}>Я</span> Войти с Яндекс ID
            </button>
            <div style={{display:'flex',gap:'.5rem',marginTop:'.5rem'}}>
              <button onClick={prevStep} type="button"
                style={{
                  flex:1, padding:'.7rem', fontSize:'.82rem', fontWeight:600,
                  border:'1px solid rgba(0,0,0,.12)', borderRadius:'var(--radius-pill)',
                  cursor:'pointer', background:'transparent', color:'#555', fontFamily:'inherit',
                }}>
                Назад
              </button>
            </div>
            <div style={{textAlign:'center',marginTop:12,fontSize:'.78rem',color:'rgba(0,0,0,.54)'}}>
              Уже есть аккаунт?{' '}
              <span onClick={()=>n('/login')} style={{color:'var(--secondary)',textDecoration:'underline',cursor:'pointer'}}>Войти</span>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}