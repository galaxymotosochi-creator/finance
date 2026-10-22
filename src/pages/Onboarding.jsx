import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Онбординг: выбор типа бизнеса при первом входе.
 * Тип фиксируется навсегда — после сохранения экран больше не показывается.
 */
const OPTIONS = [
  {
    key: 'retail',
    title: 'Товары',
    desc: 'Магазин, склад, штрихкоды, поставки',
    icon: '🛒',
  },
  {
    key: 'services',
    title: 'Услуги',
    desc: 'Салон, клининг, мастера, комбо',
    icon: '✂️',
  },
  {
    key: 'food',
    title: 'Общепит',
    desc: 'Кафе, ресторан, тех. карты, ингредиенты',
    icon: '🍽️',
  },
  {
    key: 'mixed',
    title: 'Товары и услуги',
    desc: 'Магазин плюс услуги в одном аккаунте',
    icon: '🏪',
  },
];

function token() {
  try { return JSON.parse(localStorage.getItem('atlaspos_session') || '{}').access_token || ''; } catch (e) { return ''; }
}

export default function Onboarding({ onDone }) {
  const [picked, setPicked] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const n = useNavigate();

  const submit = async () => {
    if (!picked) { setError('Выберите тип бизнеса'); return; }
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/business-type', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify({ business_type: picked }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Не удалось сохранить');
      try { localStorage.setItem('atlaspos_business_type', picked); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('atlaspos-business-type', { detail: picked })); } catch (e) {}
      if (onDone) onDone(picked);
      else n('/dashboard', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f4f6f9', padding: '32px 18px', fontFamily: 'var(--font)',
    }}>
      <div style={{
        width: '100%', maxWidth: '760px', background: '#fff', borderRadius: '20px',
        boxShadow: '0 18px 50px rgba(15,25,45,.10)', overflow: 'hidden',
      }}>
        <div style={{ background: 'linear-gradient(135deg,#1F75FF,#0d4ea8)', padding: '26px 28px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>
            AtlasPos
          </div>
          <h1 style={{ margin: '6px 0 4px', fontSize: '22px', fontWeight: 800, color: '#fff' }}>
            Чем занимается ваш бизнес?
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,.82)' }}>
            От этого зависит набор разделов. Выбор делается один раз — потом не меняется.
          </p>
        </div>

        <div style={{ padding: '22px 28px 26px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px' }}>
            {OPTIONS.map(o => {
              const on = picked === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setPicked(o.key)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    border: '1.5px solid ' + (on ? '#1F75FF' : 'rgba(0,16,36,.12)'),
                    background: on ? '#EAF2FF' : '#f8f9fb',
                    borderRadius: '14px', padding: '14px 14px 16px',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>{o.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111', marginBottom: '3px' }}>{o.title}</div>
                  <div style={{ fontSize: '11.5px', color: '#6b7688', lineHeight: 1.45 }}>{o.desc}</div>
                </button>
              );
            })}
          </div>

          {error && (
            <div style={{ marginTop: '14px', fontSize: '12.5px', color: '#c02626' }}>{error}</div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={saving || !picked}
            style={{
              marginTop: '20px', width: '100%', border: 'none', borderRadius: '100px',
              padding: '13px', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700,
              cursor: picked ? 'pointer' : 'not-allowed',
              background: picked ? 'linear-gradient(135deg,#1F75FF,#0d4ea8)' : '#dde3ec',
              color: picked ? '#fff' : '#8b95a5',
            }}
          >
            {saving ? 'Сохраняем…' : 'Продолжить'}
          </button>
        </div>
      </div>
    </div>
  );
}
