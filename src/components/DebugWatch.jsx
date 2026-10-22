import { useEffect, useRef, useState } from 'react';

/**
 * Отладочная панель для поиска моргания.
 * Показывает прямо на экране: сколько раз страница перерисовалась,
 * какие запросы ушли, какие события синхронизации пришли.
 * Включается только если в адресе есть ?debug=1
 */
export default function DebugWatch({ name }) {
  const [open, setOpen] = useState(true);
  const [lines, setLines] = useState([]);
  const renders = useRef(0);
  renders.current += 1;

  const push = (text) => {
    setLines(prev => {
      const t = new Date().toLocaleTimeString('ru-RU', { hour12: false });
      const next = [...prev, t + '  ' + text];
      return next.slice(-40);
    });
  };

  // Счётчик рендеров
  useEffect(() => {
    push('рендер #' + renders.current);
  });

  useEffect(() => {
    const t0 = Date.now();
    push('=== СТАРТ ' + name + ' ===');

    // Все запросы к API
    const origFetch = window.fetch;
    window.fetch = function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '?';
      const short = url.replace(/^https?:\/\/[^/]+/, '').slice(0, 70);
      const started = Date.now();
      push('→ ' + short);
      return origFetch.apply(this, args).then(res => {
        push('← ' + res.status + ' ' + short + ' (' + (Date.now() - started) + 'мс)');
        return res;
      }).catch(err => {
        push('✖ ' + short + ' ОШИБКА: ' + err.message);
        throw err;
      });
    };

    // События синхронизации
    const onMutated = (e) => push('★ mutated: ' + JSON.stringify(e.detail || {}).slice(0, 60));
    const onSynced = (e) => push('★ synced: ' + JSON.stringify(e.detail || {}).slice(0, 60));
    const onBizType = (e) => push('★ business-type: ' + e.detail);
    window.addEventListener('atlaspos:mutated', onMutated);
    window.addEventListener('atlaspos:synced', onSynced);
    window.addEventListener('atlaspos-business-type', onBizType);

    // Ответы service worker
    let swHandler = null;
    if (navigator.serviceWorker) {
      swHandler = (e) => { if (e.data && e.data.type) push('☎ SW: ' + JSON.stringify(e.data).slice(0, 60)); };
      navigator.serviceWorker.addEventListener('message', swHandler);
    }

    // Ошибки
    const onErr = (e) => push('✖ JS: ' + (e.message || e.reason || ''));
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onErr);

    const tick = setInterval(() => {
      push('… прошло ' + Math.round((Date.now() - t0) / 1000) + 'с, рендеров: ' + renders.current);
    }, 5000);

    return () => {
      window.fetch = origFetch;
      window.removeEventListener('atlaspos:mutated', onMutated);
      window.removeEventListener('atlaspos:synced', onSynced);
      window.removeEventListener('atlaspos-business-type', onBizType);
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onErr);
      if (navigator.serviceWorker && swHandler) navigator.serviceWorker.removeEventListener('message', swHandler);
      clearInterval(tick);
    };
  }, [name]);

  const copy = () => {
    const text = lines.join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => alert('Скопировано! Вставьте в чат.'));
    else alert(text);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ position: 'fixed', right: 10, top: 10, zIndex: 999999, background: '#111', color: '#fff', border: 'none', borderRadius: 100, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        отладка
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', right: 8, top: 8, width: 380, maxWidth: '94vw', zIndex: 999999, background: 'rgba(10,14,20,.94)', color: '#d8e2ef', borderRadius: 10, fontFamily: 'monospace', fontSize: 10.5, boxShadow: '0 10px 40px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
        <b style={{ fontSize: 11, color: '#7fd1ff' }}>{name}</b>
        <span style={{ opacity: .7 }}>рендеров: {renders.current}</span>
        <div style={{ flex: 1 }} />
        <button onClick={copy} style={{ background: '#1F75FF', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>копировать</button>
        <button onClick={() => setLines([])} style={{ background: 'rgba(255,255,255,.14)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>очистить</button>
        <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,.14)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ overflowY: 'auto', padding: '6px 9px', lineHeight: 1.5 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.includes('✖') ? '#ff8080' : l.includes('★') ? '#ffd479' : l.includes('☎') ? '#9fb3ff' : undefined }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
