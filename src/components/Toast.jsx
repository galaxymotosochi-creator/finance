import { useEffect, useState, useRef } from 'react';

/**
 * Единый тост сайта.
 * Успех — только зелёная галочка, авто-скрытие через 3.5с.
 * Ошибка — крестик + «Повторите попытку».
 *
 * <Toast message={toast} onDone={() => setToast(null)} />
 *
 * message: строка | { type:'success'|'error', text?:string }
 *   - строка без префикса → success
 *   - строка, начинающаяся с '⚠️' или содержащая 'Ошибка' → error
 */
export default function Toast({ message, onDone, duration = 3500 }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const raw = message == null ? null : (typeof message === 'object' ? message : { text: String(message) });
  const isError = raw
    ? (raw.type === 'error' || /^⚠️|Ошибка|ошибк|не найден|Не найден|недоступн|Недоступн/.test(raw.text || ''))
    : false;
  const text = raw ? String(raw.text || '').replace(/^[⚠️🔴✅\s]+/, '').trim() : '';

  useEffect(() => {
    if (!raw) { setVisible(false); setLeaving(false); return; }
    setVisible(true);
    setLeaving(false);
  }, [message]);

  useEffect(() => {
    if (!visible || paused) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLeaving(true);
      setVisible(false);
      setTimeout(() => { onDone && onDone(); }, 240);
    }, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, paused, duration, onDone, message]);

  if (!visible) return null;

  return (
    <div
      className={'toast-v2' + (leaving ? ' toast-v2-out' : '') + (isError ? ' toast-v2-err' : ' toast-v2-ok')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="status"
      aria-live="polite"
    >
      <span className="toast-v2-ic">
        {isError ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5.5 5.5L20 6.5" />
          </svg>
        )}
      </span>
      {isError ? (
        <div className="toast-v2-body">
          {text && <div className="toast-v2-title">{text}</div>}
          <div className="toast-v2-sub">Повторите попытку</div>
        </div>
      ) : (
        text ? <div className="toast-v2-body"><div className="toast-v2-title toast-v2-title-ok">{text}</div></div> : null
      )}
    </div>
  );
}
