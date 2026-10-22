import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Меню действий «⋯» для строки таблицы.
 * Рисуется через портал в document.body — не обрезается контейнером таблицы.
 * Закрывается по клику в любом месте экрана и по Esc.
 *
 * Использование:
 *   <RowMenu items={[
 *     { label: 'Редактировать', onClick: () => openEdit(row) },
 *     { label: 'Удалить', onClick: () => remove(row.id), danger: true },
 *   ]} />
 */
export default function RowMenu({ items = [], buttonClassName = 'sk-more' }) {
  const [pos, setPos] = useState(null); // { left, top } | null
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // закрытие по клику вне и по Esc
  useEffect(() => {
    if (!pos) return;
    const onDocClick = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setPos(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setPos(null); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  // пересчёт позиции при скролле/ресайзе — просто закрываем
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const open = (e) => {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    const MENU_W = 170;
    const MENU_H = items.length * 34 + 10;
    let left = r.right - MENU_W;
    if (left < 8) left = 8;
    let top = r.bottom + 4;
    if (top + MENU_H > window.innerHeight - 8) top = Math.max(8, r.top - MENU_H - 4);
    setPos({ left, top });
  };

  return (
    <>
      <button ref={btnRef} type="button" className={buttonClassName} onClick={open}>⋯</button>
      {pos && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setPos(null)}
          />
          <div
            ref={menuRef}
            style={{
              position: 'fixed', left: pos.left, top: pos.top, zIndex: 9999,
              minWidth: 160, background: '#fff',
              border: '1px solid rgba(29,120,252,.16)', borderRadius: 11,
              boxShadow: '0 18px 40px -18px rgba(15,25,45,.45)',
              padding: '.25rem 0',
            }}
          >
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setPos(null); it.onClick && it.onClick(); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '.45rem .8rem', fontFamily: 'inherit', fontSize: '.78rem',
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: it.danger ? '#dc3545' : '#0b1220',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f8fd'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                {it.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
