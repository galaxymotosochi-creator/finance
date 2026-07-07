import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const ACC_TYPES = [
  { type: 'cash', label: 'Наличные' },
  { type: 'card', label: 'Банковский счёт' },
  { type: 'transfer', label: 'Электронный кошелёк' },
  { type: 'reserve', label: 'Резерв' },
  { type: 'deposit', label: 'Депозит' },
  { type: 'checking', label: 'Расчётный счёт' },
  { type: 'other', label: 'Другое' },
];

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
  const [owner, setOwner] = useState({ lastName: '', firstName: '', patronymic: '' });
  const [notifications, setNotifications] = useState({ email: true, telegram: false, push: false, sales: true, stock: true, payment: true });
  const [userAccounts, setUserAccounts] = useState([]);
  const [acLoading, setAcLoading] = useState(false);
  const [acExpand, setAcExpand] = useState(false);
  const [showAcForm, setShowAcForm] = useState(false);
  const [acName, setAcName] = useState('');
  const [acType, setAcType] = useState('other');
  const [acDesc, setAcDesc] = useState('');
  const [acBalance, setAcBalance] = useState('0');
  const loadAccounts = async () => {
    setAcLoading(true);
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    setUserAccounts(data || []);
    setAcLoading(false);
  };
  
  // Load saved settings on mount
  useEffect(() => {
    if (!user) return;
    const savedCompany = localStorage.getItem('settings_company');
    if (savedCompany) setCompany(prev => ({...prev, ...JSON.parse(savedCompany)}));
    const savedCountry = localStorage.getItem('settings_country');
    if (savedCountry) setCountry(savedCountry);
    const savedLang = localStorage.getItem('settings_lang');
    if (savedLang) setLang(savedLang);
    const savedCurrency = localStorage.getItem('settings_currency');
    if (savedCurrency) setCurrency(savedCurrency);
    const savedTz = localStorage.getItem('settings_tz');
    if (savedTz) { setTz(savedTz); }
    const savedNotifs = localStorage.getItem('settings_notifications');
    if (savedNotifs) setNotifications(JSON.parse(savedNotifs));
    const savedOwner = localStorage.getItem('settings_owner');
    if (savedOwner) setOwner(JSON.parse(savedOwner));
    // Загружаем из Supabase
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('last_name, first_name, patronymic, settings')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          if (data.first_name || data.last_name) {
            setOwner({ lastName: data.last_name || '', firstName: data.first_name || '', patronymic: data.patronymic || '' });
          }
          if (data.settings) {
            const s = data.settings;
            if (s.company) setCompany(s.company);
            if (s.country) setCountry(s.country);
            if (s.lang) setLang(s.lang);
            if (s.currency) setCurrency(s.currency);
            if (s.timezone) setTz(s.timezone);
            if (s.notifications) setNotifications(s.notifications);
          }
        }
      } catch(e) { /* Таблица может отсутствовать */ }
    })();
  }, [user]);

  // Загружаем счета
  useEffect(() => { if (user && acExpand) loadAccounts(); }, [user, acExpand]);
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


  const countries = ['Россия', 'Казахстан', 'Беларусь', 'Армения', 'Узбекистан', 'Кыргызстан'];
  const regLabels = { 'Россия': 'ИНН', 'Казахстан': 'БИН', 'Беларусь': 'УНП', 'Армения': 'ИНН', 'Узбекистан': 'ИНН', 'Кыргызстан': 'ИНН' };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", color: '#111' }}>
      
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius: 'var(--radius-md)',padding:'1rem 1.5rem',fontSize:'.9rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>{toast}</div>
      )}
      <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4, letterSpacing: '-.02em' }}>Общие настройки</h1>
      <p style={{ fontSize: '.82rem', color: 'rgba(0,0,0,.54)', marginBottom: 24 }}>Компания, локализация, уведомления и данные</p>

      {/* 1. Владелец аккаунта */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>Владелец аккаунта</h2>
        <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f8f9fa', borderRadius: 'var(--radius-md)', fontSize: '.82rem', color: 'var(--muted)' }}>
          Электронная почта: <b style={{color:'#111'}}>{user?.email || '—'}</b>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 16px' }}>
          {[
            ['Фамилия', owner.lastName, v => setOwner({...owner, lastName: v})],
            ['Имя', owner.firstName, v => setOwner({...owner, firstName: v})],
            ['Отчество', owner.patronymic, v => setOwner({...owner, patronymic: v})],
          ].map(([label, val, setter], i) => (
            <div key={i}>
              <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>{label}</label>
              <input value={val} onChange={e => setter(e.target.value)} placeholder={label}
                style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Локализация */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>Локализация и стандарты</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>Страна</label>
            <select value={country} onChange={e => { setCountry(e.target.value); setCurrency({Россия:'RUB',Казахстан:'KZT',Беларусь:'BYN',Армения:'AMD',Узбекистан:'UZS',Кыргызстан:'KGS'}[e.target.value] || 'RUB'); }}
              style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
              {countries.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>Язык интерфейса</label>
            <select value={lang} onChange={e => setLang(e.target.value)}
              style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
              {['Русский', 'Казахский', 'Английский'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>Валюта по умолчанию</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
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
                style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              {tzDrop && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #eee',borderRadius: 'var(--radius-md)',boxShadow:'0 4px 12px rgba(0,0,0,.1)',zIndex:10,maxHeight:180,overflowY:'auto',marginTop:2}}>
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

      {/* 3. Профиль */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>Профиль компании</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          {[['Название компании', company.name, v => setCompany({...company, name: v})],
            ['Юридический адрес', company.address, v => setCompany({...company, address: v})],
            [`${regLabels[country] || 'Регистрационный номер'}`, company.regNumber, v => setCompany({...company, regNumber: v})],
            ['Телефон', company.phone, v => setCompany({...company, phone: v})],
          ].map(([label, val, setter], i) => (
            <div key={i}>
              <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>{label}</label>
              <input value={val} onChange={e => setter(e.target.value)} placeholder={label}
                style={{ width: '100%', padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 500, marginBottom: 4 }}>Email для счетов</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={company.email} onChange={e => setCompany({...company, email: e.target.value})} placeholder="email@company.ru"
              style={{ flex: 1, padding: '.5rem .65rem', fontSize: '.82rem', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>
      </div>

      {/* 4. Уведомления */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 12 }}>Уведомления и связь</h2>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 500, marginBottom: 8 }}>Канал уведомлений</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['email', 'Email'], ['telegram', 'Telegram'], ['push', 'Push']].map(([key, label]) => (
              <button key={key} onClick={() => setNotifications({...notifications, [key]: !notifications[key]})}
                style={{ padding: '.4rem .8rem', borderRadius: 'var(--radius-pill)', border: `1.5px solid ${notifications[key] ? '#000' : 'rgba(0,0,0,.12)'}`, background: notifications[key] ? '#000' : 'transparent', color: notifications[key] ? '#fff' : '#555', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
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

      {/* Финансовые счета */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div onClick={() => setAcExpand(!acExpand)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: '.65rem', color: '#999', transition: 'transform .2s', transform: acExpand ? 'rotate(90deg)' : 'none' }}>▶</span>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, flex: 1, marginBottom: 0 }}>Финансовые счета</h2>
          <span style={{ fontSize: '.72rem', color: '#999', background: '#f0f0f0', padding: '.1rem .5rem', borderRadius: 100 }}>{userAccounts?.length || 0}</span>
        </div>
        
        {acExpand && (
          <div style={{ marginTop: 16 }}>
            {/* Список счетов */}
            {(!userAccounts || userAccounts.length === 0) && !acLoading && (
              <div style={{ padding: '1rem 0', fontSize: '.82rem', color: '#999', textAlign: 'center' }}>Нет счетов. Добавьте первый счёт.</div>
            )}
            {acLoading && <div style={{ padding: '1rem 0', fontSize: '.82rem', color: '#999', textAlign: 'center' }}>Загрузка...</div>}
            {userAccounts && userAccounts.map(a => {
              const typeLabel = ACC_TYPES.find(t => t.type === a.type)?.label || a.type;
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '.5rem .65rem', borderRadius: 10, background: '#f8f8f8', marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 600, color: '#111' }}>{a.name}</div>
                    <div style={{ fontSize: '.7rem', color: '#999' }}>{a.description || typeLabel}</div>
                  </div>
                  <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#111', textAlign: 'right' }}>{(parseFloat(a.balance)||0).toLocaleString()} ₽</div>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                    <button onClick={async () => {
                      const newName = prompt('Новое название:', a.name);
                      if (newName && newName !== a.name) await supabase.from('accounts').update({name:newName}).eq('id',a.id);
                      loadAccounts();
                    }} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '.8rem', color: '#999' }}>✎</button>
                    <button onClick={async () => { if (confirm('Удалить счёт?')) { await supabase.from('accounts').delete().eq('id',a.id); loadAccounts(); } }}
                      style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '.8rem', color: '#999' }}
                      onMouseEnter={e => e.currentTarget.style.color='#dc2626'}
                      onMouseLeave={e => e.currentTarget.style.color='#999'}>✕</button>
                  </div>
                </div>
              );
            })}

            {/* Кнопка добавить */}
            {!showAcForm && (
              <button onClick={() => setShowAcForm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '.5rem .65rem', borderRadius: 10, border: '1.5px dashed rgba(0,0,0,.12)', background: 'transparent', cursor: 'pointer', fontSize: '.78rem', color: '#666', fontFamily: 'inherit', fontWeight: 500, marginTop: 4 }}>
                + Добавить счёт
              </button>
            )}

            {/* Форма */}
            {showAcForm && (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: '#f8f8f8' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input type="text" placeholder="Название счёта" value={acName} onChange={e => setAcName(e.target.value)}
                    style={{ flex: 2, padding: '.5rem .65rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,.1)', outline: 'none', fontSize: '.78rem', fontFamily: 'inherit' }} />
                  <select value={acType} onChange={e => setAcType(e.target.value)}
                    style={{ flex: 1, padding: '.5rem .65rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,.1)', outline: 'none', fontSize: '.78rem', fontFamily: 'inherit', background: '#fff' }}>
                    {ACC_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input type="text" placeholder="Описание" value={acDesc} onChange={e => setAcDesc(e.target.value)}
                    style={{ flex: 1, padding: '.5rem .65rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,.1)', outline: 'none', fontSize: '.78rem', fontFamily: 'inherit' }} />
                  <input type="number" placeholder="Начальный баланс" value={acBalance} onChange={e => setAcBalance(e.target.value)}
                    style={{ width: 140, padding: '.5rem .65rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,.1)', outline: 'none', fontSize: '.78rem', fontFamily: 'inherit' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowAcForm(false); setAcName(''); setAcType('other'); setAcDesc(''); setAcBalance('0'); }}
                    style={{ padding: '.4rem .85rem', borderRadius: 8, fontSize: '.75rem', fontWeight: 600, border: 'none', background: '#eee', color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
                  <button onClick={async () => {
                    if (!acName.trim()) return;
                    await supabase.from('accounts').insert({user_id:user.id,name:acName.trim(),type:acType,description:acDesc.trim(),balance:parseFloat(acBalance)||0});
                    setShowAcForm(false); setAcName(''); setAcType('other'); setAcDesc(''); setAcBalance('0');
                    loadAccounts();
                  }}
                    style={{ padding: '.4rem .85rem', borderRadius: 8, fontSize: '.75rem', fontWeight: 600, border: 'none', background: '#000', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Сохранить</button>
                </div>
              </div>
            )}


          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button style={{ padding: '.5rem 1.5rem', borderRadius: 'var(--radius-pill)', border: '1.5px solid rgba(0,0,0,.12)', background: 'transparent', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        <button onClick={async () => {
            localStorage.setItem('settings_company', JSON.stringify(company));
            localStorage.setItem('settings_country', country);
            localStorage.setItem('settings_lang', lang);
            localStorage.setItem('settings_currency', currency);
            localStorage.setItem('settings_tz', tz);
            localStorage.setItem('settings_notifications', JSON.stringify(notifications));
            localStorage.setItem('settings_owner', JSON.stringify(owner));
            try {
              var settingsData = { company, country, lang, currency, timezone: tz, notifications };
              const { data: existing } = await supabase.from('user_profiles').select('id').eq('user_id', user.id).maybeSingle();
              if (existing) {
                await supabase.from('user_profiles').update({ last_name: owner.lastName, first_name: owner.firstName, patronymic: owner.patronymic, settings: settingsData }).eq('user_id', user.id);
              } else {
                await supabase.from('user_profiles').insert({ user_id: user.id, last_name: owner.lastName, first_name: owner.firstName, patronymic: owner.patronymic, settings: settingsData });
              }
            } catch(e) {}
            setToast('Настройки сохранены');
          }} style={{ padding: '.5rem 1.5rem', borderRadius: 'var(--radius-pill)', border: 'none', background: '#ffdd2d', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#000' }}>Сохранить</button>
      </div>
    </div>
  );
}
