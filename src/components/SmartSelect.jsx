import { useEffect, useRef, useState } from 'react';

// Фирменный выпадающий список: кнопка-триггер + панель с точками.
// Заменяет браузерный <select> там, где нужна заглушка «— выберите —».
// options: [{ value, label }] или массив строк.
export default function SmartSelect({ options, value, onChange, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const list = (options || []).map(function (o) {
    return typeof o === 'string' ? { value: o, label: o } : o;
  });
  const sel = list.find(function (o) { return String(o.value) === String(value); });

  useEffect(function () {
    if (!open) return;
    const h = function (e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return function () { document.removeEventListener('mousedown', h); };
  }, [open]);

  return (
    <div className="cat-sel-wrap" ref={wrapRef} style={{ position: 'relative', opacity: disabled ? .55 : 1 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={function (e) { e.stopPropagation(); if (!disabled) setOpen(function (o) { return !o; }); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem',
          width: '100%', padding: '.5rem .65rem',
          border: '1.5px solid ' + (open ? '#111' : 'rgba(0,0,0,.26)'),
          borderRadius: 'var(--radius-md)', background: 'var(--body-bg)',
          fontFamily: 'var(--font)', fontSize: '.875rem', fontWeight: 500,
          color: sel ? '#222' : 'rgba(0,0,0,.38)',
          cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
          boxSizing: 'border-box', minHeight: '38px', outline: 'none',
          boxShadow: open ? '0 0 0 3px rgba(17,17,17,.07)' : 'none',
          transition: 'border-color .15s, box-shadow .15s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: sel ? '#222' : 'rgba(0,0,0,.38)', fontWeight: 500 }}>
          {sel ? sel.label : (placeholder || '— выберите —')}
        </span>
        <span className="car-tri" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '1px solid rgba(29,120,252,.18)', borderRadius: '.85rem',
          boxShadow: '0 16px 40px -14px rgba(11,18,32,.3)', padding: '.35rem',
          zIndex: 80, maxHeight: '220px', overflowY: 'auto',
        }}>
          {list.length === 0 && <div style={{ padding: '.4rem .55rem', fontSize: '.78rem', color: '#8a93a2' }}>Нет вариантов</div>}
          {list.map(function (o) {
            const on = String(o.value) === String(value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={function () { onChange(o.value); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '.5rem', width: '100%',
                  padding: '.45rem .55rem', borderRadius: '.5rem', border: 'none',
                  background: on ? '#E6F0FF' : 'none', fontFamily: 'inherit',
                  fontSize: '.875rem', fontWeight: 500, color: '#222',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: on ? '#1F75FF' : '#dfe6f2', flexShrink: 0 }}></span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
