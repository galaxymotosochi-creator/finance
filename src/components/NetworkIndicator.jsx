import { useEffect, useRef, useState } from 'react';

/**
 * Индикатор подключения: зелёный кружок — интернет есть, красный — нет.
 * При появлении сети отправляет Service Worker'у команду синхронизации очереди.
 */
export default function NetworkIndicator() {
  const [online, setOnline] = useState(navigator.onLine !== false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const toastTimer = useRef(null);

  // Проверка реальной связи с сервером (не только navigator.onLine)
  const check = async () => {
    // Браузер уже знает, что сети нет — не ждём fetch
    if (navigator.onLine === false) {
      setOnline(false);
      return;
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(t);
      setOnline(res.ok);
    } catch (e) {
      setOnline(false);
    }
  };

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      setSyncing(true);
      // Сообщаем SW — пусть синхронизирует офлайн-очередь
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('sync');
      }
      setToast('🟢 Интернет появился — синхронизирую…');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2500);
      // Через пару секунд подтвердим реальную связь
      setTimeout(check, 1500);
    };
    const onOffline = () => {
      setOnline(false);
      setToast('🔴 Нет интернета — изменения сохранятся и синхронизируются');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3500);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // При возврате на вкладку — сразу перепроверяем связь
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });

    // Ответ SW о завершении синхронизации
    const onMessage = (e) => {
      if (e.data && e.data.type === 'sync-done') {
        setSyncing(false);
        const msg = e.data.done > 0
          ? '✅ Синхронизировано записей: ' + e.data.done + (e.data.left > 0 ? ' (осталось: ' + e.data.left + ')' : '')
          : '✅ Всё синхронизировано';
        setToast(msg);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3000);
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);

    // Периодическая проверка связи (каждые 10 сек)
    check();
    timerRef.current = setInterval(check, 10000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', check);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      clearInterval(timerRef.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
          background: '#111', color: '#fff', borderRadius: '100px', padding: '.5rem 1.1rem',
          fontSize: '.8rem', fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,.25)', fontFamily: "'Golos Text',system-ui,sans-serif",
          display: 'flex', alignItems: 'center', gap: '.4rem', maxWidth: '90vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>{toast}</div>
      )}
      <div
        title={online ? 'Онлайн — подключение есть' : 'Офлайн — изменения сохраняются и синхронизируются'}
        style={{
          position: 'fixed', bottom: '14px', right: '14px', zIndex: 99998,
          width: '12px', height: '12px', borderRadius: '50%', cursor: 'pointer',
          background: online ? (syncing ? '#f59e0b' : '#16a34a') : '#dc2626',
          boxShadow: online ? '0 0 8px rgba(22,163,74,.6)' : '0 0 8px rgba(220,38,38,.6)',
          transition: 'background .2s'
        }}
      />
    </>
  );
}
