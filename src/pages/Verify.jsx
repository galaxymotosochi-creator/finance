import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Подтверждение email по ссылке из письма: /verify?token=...
 */
export default function Verify() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState('loading'); // loading | ok | already | error
  const [message, setMessage] = useState('');
  const n = useNavigate();

  useEffect(() => {
    if (!token) { setState('error'); setMessage('В ссылке нет токена подтверждения'); return; }
    fetch('/api/auth/verify?token=' + encodeURIComponent(token))
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          setState(d.already ? 'already' : 'ok');
        } else {
          setState('error');
          setMessage(d.error || 'Не удалось подтвердить email');
        }
      })
      .catch(() => { setState('error'); setMessage('Ошибка сети'); });
  }, [token]);

  const card = {
    width: '100%', maxWidth: '440px', background: '#fff', borderRadius: '18px',
    boxShadow: '0 18px 50px rgba(15,25,45,.12)', overflow: 'hidden', fontFamily: 'var(--font)',
  };

  const head = (title, sub, bg) => (
    <div style={{ background: bg, padding: '22px 24px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.72)' }}>AtlasPos</div>
      <div style={{ marginTop: '5px', fontSize: '19px', fontWeight: 800, color: '#fff' }}>{title}</div>
      {sub && <div style={{ marginTop: '4px', fontSize: '12.5px', color: 'rgba(255,255,255,.85)' }}>{sub}</div>}
    </div>
  );

  const btn = (label, onClick) => (
    <button type="button" onClick={onClick} style={{
      width: 'auto', display: 'inline-block', border: 'none', borderRadius: '100px', padding: '11px 22px',
      fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
      background: 'linear-gradient(135deg,#1F75FF,#0d4ea8)', color: '#fff',
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9', padding: '28px 18px' }}>
      <div style={card}>
        {state === 'loading' && (
          <>
            {head('Подтверждаем email', 'Пара секунд…', 'linear-gradient(135deg,#1F75FF,#0d4ea8)')}
            <div style={{ padding: '26px 24px', fontSize: '13.5px', color: '#5b6472' }}>Проверяем ссылку…</div>
          </>
        )}

        {state === 'ok' && (
          <>
            {head('Email подтверждён', 'Аккаунт активен', 'linear-gradient(135deg,#1C9A5B,#0d6b3d)')}
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#42526b', lineHeight: 1.55 }}>
                Спасибо! Ваш адрес подтверждён. Теперь можно войти в кабинет.
              </p>
              {btn('Перейти ко входу', () => n('/login'))}
            </div>
          </>
        )}

        {state === 'already' && (
          <>
            {head('Уже подтверждён', '', 'linear-gradient(135deg,#1C9A5B,#0d6b3d)')}
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#42526b', lineHeight: 1.55 }}>
                Этот email уже был подтверждён ранее. Можно входить.
              </p>
              {btn('Войти', () => n('/login'))}
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            {head('Не удалось подтвердить', 'Ссылка недействительна', 'linear-gradient(135deg,#D64B4B,#a12f2f)')}
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#42526b', lineHeight: 1.55 }}>
                {message || 'Ссылка недействительна или истекла.'}
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '12.5px', color: '#8b95a5', lineHeight: 1.5 }}>
                Запросите новое письмо на странице входа.
              </p>
              {btn('Ко входу', () => n('/login'))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
