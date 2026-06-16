import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const n = useNavigate();
  const { user } = useAuth();
  const [toast, setToast] = useState(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);
  const [company, setCompany] = useState({ name: '', address: '', regNumber: '', phone: '', email: '' });
  const [country, setCountry] = useState('Россия');
  const [lang, setLang] = useState('Русский');
  const [currency, setCurrency] = useState('RUB');
  const [tz, setTz] = useState('Europe/Moscow');
  const [tzSearch, setTzSearch] = useState('Москва');
  const [tzDrop, setTzDrop] = useState(false);
  const cityTz = {
    'Москва':'Europe/Moscow','Санкт-Петербург':'Europe/Moscow','Новосибирск':'Asia/Novosibirsk',
    'Екатеринбург':'Asia/Yekaterinburg','Казань':'Europe/Moscow','Красноярск':'Asia/Krasnoyarsk',
    'Нижний Новгород':'Europe/Moscow','Челябинск':'Asia/Yekaterinburg','Уфа':'Asia/Yekaterinburg',
    'Самара':'Europe/Samara','Ростов-на-Дону':'Europe/Moscow','Омск':'Asia/Omsk',
    'Владивосток':'Asia/Vladivostok','Иркутск':'Asia/Irkutsk','Хабаровск':'Asia/Vladivostok',
    'Алматы':'Asia/Almaty','Астана':'Asia/Almaty','Нур-Султан':'Asia/Almaty','Шымкент':'Asia/Almaty',
    'Минск':'Europe/Minsk','Гомель':'Europe/Minsk','Ереван':'Asia/Yerevan','Ташкент':'Asia/Tashkent',
    'Самарканд':'Asia/Samarkand','Бишкек':'Asia/Bishkek','Ош':'Asia/Bishkek',
  };
  const tzLabels = {'Europe/Moscow':'МСК','Europe/Minsk':'+3','Europe/Samara':'+4',
    'Asia/Yekaterinburg':'+5','Asia/Almaty':'+5','Asia/Novosibirsk':'+7',
    'Asia/Krasnoyarsk':'+7','Asia/Irkutsk':'+8','Asia/Vladivostok':'+10',
    'Asia/Omsk':'+6','Asia/Tashkent':'+5','Asia/Samarkand':'+5','Asia/Bishkek':'+6',
    'Asia/Yerevan':'+4'};
  const [notifications, setNotifications] = useState({ email: true, telegram: false, push: false, sales: true, stock: true, payment: true });

  const countries = ['Россия', 'Казахстан', 'Беларусь', 'Армения', 'Узбекистан', 'Кыргызстан'];
  const regLabels = { 'Россия': 'ИНН', 'Казахстан': 'БИН', 'Беларусь': 'УНП', 'Армения': 'ИНН', 'Узбекистан': 'ИНН', 'Кыргызстан': 'ИНН' };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", color: '#111' }}>
      <style>{`
        .sett-input:focus, .sett-select:focus { outline: none; box-shadow: 0 0 0 3px rgba(11,197,234,.25); border-color: #0bc5ea; }
        .sett-input, .sett-select { transition: box-shadow .15s, border-color .15s; }
      `}</style>
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'1rem 1.5rem',fontSize:'.9rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>{toast}</div>
      )}
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4, letterSpacing: '-.02em' }}>Общие настройки</h1>
      <p style={{ fontSize: '.82rem', color: 'rgba(0,0,0,.54)', marginBottom: 24 }}>Компания, локализация, уведомления и данные</p>

      {/* 1. Локализация */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Локализация и стандарты</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>Страна</label>
            <select value={country} onChange={e => { setCountry(e.target.value); setCurrency({Россия:'RUB',Казахстан:'KZT',Беларусь:'BYN',Армения:'AMD',Узбекистан:'UZS',Кыргызстан:'KGS'}[e.target.value] || 'RUB'); }}
              className='sett-select' style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
              {countries.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>Язык интерфейса</label>
            <select value={lang} onChange={e => setLang(e.target.value)}
              className='sett-select' style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
              {['Русский', 'Казахский', 'Английский'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>Валюта по умолчанию</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className='sett-select' style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
              {['RUB', 'KZT', 'BYN', 'AMD', 'UZS', 'KGS'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>Часовой пояс</label>
            <div style={{position:'relative'}}>
              <input type="text" placeholder="Введите город или страну..." value={tzSearch}
                onChange={e => { setTzSearch(e.target.value); setTzDrop(true); }}
                onFocus={() => setTzDrop(true)}
                onBlur={() => setTimeout(() => setTzDrop(false), 200)}
                className='sett-input' className='sett-input' style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              {tzDrop && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #eee',borderRadius:10,boxShadow:'0 4px 12px rgba(0,0,0,.1)',zIndex:10,maxHeight:180,overflowY:'auto',marginTop:2}}>
                  {Object.entries(cityTz).filter(([city]) => !tzSearch || city.toLowerCase().includes(tzSearch.toLowerCase())).map(([city, zone]) => (
                    <div key={city} onMouseDown={() => { setTz(zone); setTzSearch(city); setTzDrop(false); }}
                      style={{padding:'7px 10px',cursor:'pointer',fontSize:'13px',borderBottom:'1px solid #f5f5f5'}}
                      onMouseEnter={e => e.currentTarget.style.background='#f9f9f9'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}>{city} <span style={{color:'#999',fontSize:'11px'}}>({tzLabels[zone] || zone})</span></div>
                  ))}
                  {Object.entries(cityTz).filter(([city]) => !tzSearch || city.toLowerCase().includes(tzSearch.toLowerCase())).length === 0 && (
                    <div style={{padding:10,fontSize:12,color:'#999',textAlign:'center'}}>Город не найден</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Профиль */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Профиль компании</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          {[['Название компании', company.name, v => setCompany({...company, name: v})],
            ['Юридический адрес', company.address, v => setCompany({...company, address: v})],
            [`${regLabels[country] || 'Регистрационный номер'}`, company.regNumber, v => setCompany({...company, regNumber: v})],
            ['Телефон', company.phone, v => setCompany({...company, phone: v})],
          ].map(([label, val, setter], i) => (
            <div key={i}>
              <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>{label}</label>
              <input value={val} onChange={e => setter(e.target.value)} placeholder={label}
                className='sett-input' className='sett-input' style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>Email для счетов</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={company.email} onChange={e => setCompany({...company, email: e.target.value})} placeholder="email@company.ru"
              className='sett-input' style={{ flex: 1, padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit' }} />
            <button style={{ padding: '.5rem 1rem', borderRadius: 100, border: '1.5px solid rgba(0,0,0,.12)', background: 'transparent', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Загрузить логотип</button>
          </div>
        </div>
      </div>

      {/* 3. Уведомления */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Уведомления и связь</h2>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 500, marginBottom: 8 }}>Канал уведомлений</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['email', 'Email'], ['telegram', 'Telegram'], ['push', 'Push']].map(([key, label]) => (
              <button key={key} onClick={() => setNotifications({...notifications, [key]: !notifications[key]})}
                style={{ padding: '.4rem .8rem', borderRadius: 100, border: `1.5px solid ${notifications[key] ? '#000' : 'rgba(0,0,0,.12)'}`, background: notifications[key] ? '#000' : 'transparent', color: notifications[key] ? '#fff' : '#555', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '.75rem', fontWeight: 500, marginBottom: 8 }}>Типы уведомлений</div>
          {[['sales', 'Отчёты о продажах'], ['stock', 'Критические остатки'], ['payment', 'Оплата тарифа']].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: '.82rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={notifications[key]} onChange={() => setNotifications({...notifications, [key]: !notifications[key]})}
                style={{ width: 16, height: 16, accentColor: '#000', cursor: 'pointer' }} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* 4. Безопасность */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Безопасность</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setToast('Функция будет доступна в следующем обновлении')}
            style={{ padding: '.5rem 1rem', borderRadius: 100, border: '1.5px solid rgba(0,0,0,.12)', background: 'transparent', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>История входов</button>
          <button onClick={async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', { redirectTo: window.location.origin });
            if (error) return setToast('Ошибка: ' + error.message);
            setToast('✅ Письмо для сброса пароля отправлено на почту');
          }}
            style={{ padding: '.5rem 1rem', borderRadius: 100, border: '1.5px solid rgba(0,0,0,.12)', background: 'transparent', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Сменить пароль</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button style={{ padding: '.5rem 1.5rem', borderRadius: 100, border: '1.5px solid rgba(0,0,0,.12)', background: 'transparent', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        <button style={{ padding: '.5rem 1.5rem', borderRadius: 100, border: 'none', background: '#ffdd2d', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#000' }}>Сохранить</button>
      </div>
    </div>
  );
}
