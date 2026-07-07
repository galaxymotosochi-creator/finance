import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const STEPS = [
  {
    id: 'kassa-menu',
    page: '*',
    // Подсветка первого пункта в меню (касса)
    highlightBox: { top: 218, left: 78, width: 176, height: 38 },
    arrow: { x: 260, y: 235, dir: 'right' },
    title: 'Начнём с кассы',
    text: 'Здесь вы продаёте товары и услуги. Нажмите <strong>«Далее»</strong>, чтобы открыть кассу.',
    action: 'navigate',
    navigateTo: '/kassa',
    popupX: 280,
    popupY: 210,
  },
  {
    id: 'kassa-receipt',
    page: '/kassa',
    // Левая панель — чек
    highlightBox: { top: 80, left: 20, width: 280, height: 100 },
    arrow: { x: 305, y: 125, dir: 'right' },
    title: 'Чек и смена',
    text: 'Слева — список товаров в чеке. Вверху — кассир и номер смены. Тут же итоговая сумма и кнопки оплаты.',
    popupX: 320,
    popupY: 100,
  },
  {
    id: 'kassa-products',
    page: '/kassa',
    // Центральная часть — товары
    highlightBox: { top: 80, left: 320, width: 400, height: 350 },
    arrow: { x: 305, y: 220, dir: 'left' },
    title: 'Товары',
    text: 'В центре — каталог товаров. Нажмите на любой товар, чтобы добавить в чек. Цена указана под названием.',
    popupX: 280,
    popupY: 320,
  },
  {
    id: 'kassa-total',
    page: '/kassa',
    // Нижняя часть левой панели — итог и оплата
    highlightBox: { top: 440, left: 20, width: 280, height: 160 },
    arrow: { x: 280, y: 530, dir: 'right' },
    title: 'Оплата',
    text: 'Внизу — <strong>сумма к оплате</strong> и кнопки <strong>«Наличные»</strong> и <strong>«Карта»</strong>. После оплаты товар списывается со склада.',
    popupX: 320,
    popupY: 460,
  },
  {
    id: 'kassa-filters',
    page: '/kassa',
    // Верх центра — категории/поиск
    highlightBox: { top: 80, left: 320, width: 400, height: 48 },
    arrow: { x: 725, y: 100, dir: 'top' },
    title: 'Поиск и фильтр',
    text: 'Здесь можно найти товар по названию или отфильтровать по категориям сверху.',
    popupX: 430,
    popupY: 145,
  },
  {
    id: 'kassa-done',
    page: '/kassa',
    highlightBox: null,
    arrow: null,
    title: '🎉 Обучение пройдено!',
    text: 'Вы узнали основные элементы кассы. Теперь попробуйте сами: добавьте товар в чек и проведите оплату.',
    popupX: null,
    popupY: null,
    isLast: true,
  },
];

export default function OnboardingTour({ active, onFinish }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) { setStepIndex(0); setVisible(true); }
    else setVisible(false);
  }, [active]);

  const step = STEPS[stepIndex] || STEPS[0];
  const total = STEPS.length;

  const goNext = async () => {
    const s = STEPS[stepIndex];
    if (s.action === 'navigate' && s.navigateTo) {
      navigate(s.navigateTo);
      await new Promise(r => setTimeout(r, 500));
    }
    if (s.isLast) {
      localStorage.setItem('onboarding_done', 'true');
      setVisible(false);
      onFinish?.();
      return;
    }
    setStepIndex(i => i + 1);
  };

  const skip = () => {
    localStorage.setItem('onboarding_done', 'true');
    setVisible(false);
    onFinish?.();
  };

  if (!visible) return null;

  const isOnKassa = location.pathname === '/kassa';
  const showBox = step.highlightBox;

  // Стрелка SVG
  const ArrowSvg = ({ x, y, dir }) => {
    if (!dir) return null;
    const rot = dir === 'right' ? 0 : dir === 'left' ? 180 : dir === 'top' ? -90 : 90;
    return (
      <div style={{
        position: 'fixed', left: x - 18, top: y - 18, zIndex: 2002,
        animation: 'obBounce 1.2s ease-in-out infinite',
        pointerEvents: 'none',
      }}>
        <svg width="36" height="36" viewBox="0 0 36 36" style={{transform: `rotate(${rot}deg)`, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.3))'}}>
          <path d="M8 6L28 18L8 30" stroke="#ffdd2d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <circle cx="8" cy="6" r="3" fill="#ffdd2d" opacity=".4"/>
        </svg>
      </div>
    );
  };

  return (
    <>
      {/* Затемнение */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,.5)',
        pointerEvents: 'none',
      }}>
        {showBox && (
          <div style={{
            position: 'absolute',
            left: showBox.left - 4, top: showBox.top - 4,
            width: showBox.width + 8, height: showBox.height + 8,
            borderRadius: '12px',
            boxShadow: '0 0 0 9999px rgba(0,0,0,.5)',
            transition: 'all .4s ease',
          }} />
        )}
      </div>

      {/* Стрелка */}
      {step.arrow && <ArrowSvg x={step.arrow.x} y={step.arrow.y} dir={step.arrow.dir} />}

      {/* Тултип */}
      <div style={{
        position: 'fixed', zIndex: 2001,
        width: '300px',
        background: '#fff', borderRadius: '16px',
        padding: '1.25rem 1.25rem 1rem',
        boxShadow: '0 10px 50px rgba(0,0,0,.25)',
        left: step.popupX ?? '50%',
        top: step.popupY ?? '50%',
        transform: step.popupX ? 'none' : 'translate(-50%,-50%)',
        transition: 'all .35s ease',
      }}>
        <div style={{ fontSize: '.88rem', fontWeight: 700, marginBottom: '.35rem' }}>
          {step.title}
        </div>
        <div style={{ fontSize: '.8rem', color: '#555', lineHeight: 1.5, marginBottom: '1rem' }}
          dangerouslySetInnerHTML={{ __html: step.text }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <div style={{ display: 'flex', gap: '4px', marginRight: 'auto' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{
                width: i === stepIndex ? '20px' : '7px',
                height: '7px', borderRadius: '100px',
                background: i === stepIndex ? '#000' : '#ddd',
                transition: 'all .2s',
              }} />
            ))}
          </div>
          <button onClick={skip}
            style={{
              padding: '.35rem .75rem', borderRadius: '100px',
              border: 'none', background: 'transparent',
              fontSize: '.72rem', color: '#999', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 500,
            }}>
            Пропустить
          </button>
          <button onClick={goNext}
            style={{
              padding: '.4rem 1rem', borderRadius: '100px',
              border: 'none', background: '#000', color: '#fff',
              fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
            {step.isLast ? 'Завершить' : 'Далее →'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes obBounce {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 1; }
          50% { transform: translateY(5px) translateX(2px); opacity: .7; }
        }
      `}</style>
    </>
  );
}
