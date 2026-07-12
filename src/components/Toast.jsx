import { useState, useEffect, useCallback } from 'react';

const STYLES = {
  error:   { bar: '#dc2626', bg: '#fff' },
  success: { bar: '#16a34a', bg: '#fff' },
  warning: { bar: '#d97706', bg: '#fff' },
};

let toastId = 0;
let globalSetToasts = null;

export function showToast(msg, type = 'success') {
  if (globalSetToasts) {
    const id = ++toastId;
    globalSetToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      globalSetToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => { globalSetToasts = setToasts; return () => { globalSetToasts = null; }; }, []);

  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 380, fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {toasts.map(t => {
        const s = STYLES[t.type] || STYLES.success;
        return (
          <div key={t.id} style={{
            display: 'flex', borderRadius: 10, overflow: 'hidden',
            background: s.bg, border: '1px solid #e5e7eb',
            boxShadow: '0 4px 16px rgba(0,0,0,.08)',
            animation: 'toastSlideIn .25s ease-out',
            fontSize: '.85rem', lineHeight: 1.4,
          }}>
            <div style={{ width: 4, background: s.bar, flexShrink: 0 }} />
            <div style={{ padding: '10px 14px', color: '#333', fontWeight: 500 }}>
              {t.msg}
            </div>
          </div>
        );
      })}
    </div>
  );
}
