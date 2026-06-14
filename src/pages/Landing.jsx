import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      color: '#111', background: '#fff', minHeight: '100vh',
    }}>
      {/* ===== ХЕДЕР ===== */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', maxWidth: 1104, margin: '0 auto', width: '100%',
      }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-.03em' }}>FINANCE</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/login')} style={{
            padding: '8px 20px', borderRadius: 100, border: '1.5px solid rgba(0,16,36,.12)',
            background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', color: '#111', transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#000'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,16,36,.12)'; }}
          >Войти</button>
          <button onClick={() => navigate('/login')} style={{
            padding: '8px 20px', borderRadius: 100, border: 'none',
            background: '#ffdd2d', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', color: '#000', transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f5d100'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffdd2d'; }}
          >Регистрация</button>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section style={{ maxWidth: 1104, margin: '40px auto 0', padding: '0 24px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 12px', borderRadius: 100, background: '#fff8d6',
          fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 16,
        }}>
          <span style={{ fontSize: 14 }}>✨</span> Полный учёт для вашего бизнеса
        </div>
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800,
          letterSpacing: '-.03em', lineHeight: 1.15, marginBottom: 16,
        }}>
          Управляйте финансами,<br />складом и командой
        </h1>
        <p style={{
          fontSize: 17, color: 'rgba(0,0,0,.54)', lineHeight: 1.5,
          maxWidth: 560, margin: '0 auto 32px',
        }}>
          Единая система для учёта доходов и расходов, складских остатков,
          зарплаты сотрудников и клиентской базы. Всё в одном окне.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/login')} style={{
            padding: '12px 28px', borderRadius: 100, border: 'none',
            background: '#ffdd2d', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', color: '#000', transition: 'all .15s',
            boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f5d100'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffdd2d'; }}
          >Начать бесплатно</button>
          <button onClick={() => navigate('/login')} style={{
            padding: '12px 28px', borderRadius: 100, border: '1.5px solid rgba(0,16,36,.12)',
            background: 'transparent', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', color: '#111',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#000'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,16,36,.12)'; }}
          >Войти в систему</button>
        </div>
      </section>

      {/* ===== ВОЗМОЖНОСТИ ===== */}
      <section style={{ maxWidth: 1104, margin: '80px auto', padding: '0 24px' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: 'center', marginBottom: 8, letterSpacing: '-.02em' }}>
          Все возможности
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(0,0,0,.54)', textAlign: 'center', marginBottom: 36 }}>
          Всё, что нужно для управления бизнесом
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {[
            { emoji: '💰', title: 'Доходы и расходы', desc: 'Учитывайте каждую операцию, смотрите P&L и движение денег в реальном времени.' },
            { emoji: '📦', title: 'Склад и товары', desc: 'Остатки, поставки, списания, инвентаризация и наценки — всё в одном месте.' },
            { emoji: '👥', title: 'Клиентская база', desc: 'Ведите клиентов, программы лояльности, акции и историю покупок.' },
            { emoji: '👷', title: 'Сотрудники и зарплата', desc: 'Должности, табель, бонусы, штрафы и автоматический расчёт зарплаты.' },
            { emoji: '📊', title: 'Отчёты и аналитика', desc: 'Прибыльность, обороты, P&L — понятные отчёты для принятия решений.' },
            { emoji: '🔐', title: 'Безопасность', desc: 'Все данные защищены, авторизация через Supabase, доступ только по приглашению.' },
          ].map((f, i) => (
            <div key={i} style={{
              border: '1px solid rgba(0,16,36,.12)', borderRadius: 16, padding: 24,
              transition: 'all .15s', cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ffdd2d'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,16,36,.12)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.emoji}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,.54)', lineHeight: 1.45 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ТАРИФЫ ===== */}
      <section style={{ maxWidth: 1104, margin: '80px auto', padding: '0 24px' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: 'center', marginBottom: 8, letterSpacing: '-.02em' }}>
          Тарифы
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(0,0,0,.54)', textAlign: 'center', marginBottom: 36 }}>
          Выберите подходящий план
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16, maxWidth: 900, margin: '0 auto',
        }}>
          {[
            {
              name: 'Старт', price: 'Бесплатно', period: '', desc: 'Для небольших команд',
              features: ['До 50 операций в месяц', 'База клиентов', 'Базовые отчёты', '1 пользователь'],
              highlight: false,
            },
            {
              name: 'Бизнес', price: '2 900 ₽', period: '/мес', desc: 'Для растущего бизнеса',
              features: ['Безлимитные операции', 'Полный складской учёт', 'Зарплата и табель', 'До 5 пользователей', 'Приоритетная поддержка'],
              highlight: true,
            },
            {
              name: 'Профи', price: '6 900 ₽', period: '/мес', desc: 'Для крупных компаний',
              features: ['Всё из Бизнес', 'Неограниченно пользователей', 'API доступ', 'Персональный менеджер', 'SLA 99.9%'],
              highlight: false,
            },
          ].map((t, i) => (
            <div key={i} style={{
              border: `1.5px solid ${t.highlight ? '#ffdd2d' : 'rgba(0,16,36,.12)'}`,
              borderRadius: 20, padding: 28,
              background: t.highlight ? '#fff' : '#fff',
              position: 'relative',
              boxShadow: t.highlight ? '0 8px 24px rgba(0,0,0,.08)' : 'none',
            }}>
              {t.highlight && <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                padding: '3px 14px', borderRadius: 100, background: '#ffdd2d',
                fontSize: 11, fontWeight: 700, color: '#000',
              }}>Популярный</div>}
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,.54)', marginBottom: 12 }}>{t.desc}</div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 28, fontWeight: 800 }}>{t.price}</span>
                <span style={{ fontSize: 13, color: 'rgba(0,0,0,.54)' }}>{t.period}</span>
              </div>
              <div style={{ marginBottom: 20 }}>
                {t.features.map((f, j) => (
                  <div key={j} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 0', fontSize: 13, color: '#333',
                  }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/login')} style={{
                width: '100%', padding: '10px', borderRadius: 100,
                border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
                background: t.highlight ? '#ffdd2d' : 'rgba(0,16,36,.06)',
                color: t.highlight ? '#000' : '#111',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { if (t.highlight) e.currentTarget.style.background = '#f5d100'; }}
              onMouseLeave={e => { if (t.highlight) e.currentTarget.style.background = '#ffdd2d'; }}
              >{t.price === 'Бесплатно' ? 'Начать бесплатно' : 'Подключить'}</button>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ФУТЕР ===== */}
      <footer style={{
        borderTop: '1px solid rgba(0,16,36,.12)', padding: '20px 24px',
        maxWidth: 1104, margin: '40px auto 0', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'rgba(0,0,0,.34)',
      }}>
        <span>© 2026 Finance. Все права защищены.</span>
        <span>galaxymotosochi-creator</span>
      </footer>
    </div>
  );
}
