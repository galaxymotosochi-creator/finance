import { useEffect } from 'react';

/**
 * Тихий отладчик: ничего не рисует на экране (поэтому не может мигать),
 * складывает события в localStorage и window.__dbg.
 * Включается через ?debug=1
 * Лог читается на любой странице: localStorage.getItem('atlaspos_debug_log')
 */
export default function DebugWatch({ name }) {
  useEffect(() => {
    const key = 'atlaspos_debug_log';
    const started = Date.now();

    const push = (text) => {
      const t = new Date().toLocaleTimeString('ru-RU', { hour12: false });
      const line = t + ' [рендер ' + (window.__dbgRenders || 0) + '] ' + text;
      try {
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        arr.push(line);
        localStorage.setItem(key, JSON.stringify(arr.slice(-300)));
      } catch (e) {}
      (window.__dbg = window.__dbg || []).push(line);
    };

    window.__dbgRenders = 0;
    push('=== СТАРТ ' + name + ' ===');

    // Все запросы
    const origFetch = window.fetch;
    window.fetch = function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '?';
      const short = url.replace(/^https?:\/\/[^/]+/, '').slice(0, 60);
      const t0 = Date.now();
      push('ЗАПРОС ' + short);
      return origFetch.apply(this, args).then(res => {
        push('ОТВЕТ ' + res.status + ' ' + short + ' ' + (Date.now() - t0) + 'мс');
        return res;
      }).catch(err => { push('ОШИБКА ' + short + ': ' + err.message); throw err; });
    };

    const onMutated = (e) => push('СОБЫТИЕ mutated ' + JSON.stringify(e.detail || {}).slice(0, 50));
    const onSynced = (e) => push('СОБЫТИЕ synced ' + JSON.stringify(e.detail || {}).slice(0, 50));
    const onBiz = (e) => push('СОБЫТИЕ business-type ' + e.detail);
    window.addEventListener('atlaspos:mutated', onMutated);
    window.addEventListener('atlaspos:synced', onSynced);
    window.addEventListener('atlaspos-business-type', onBiz);

    let swHandler = null;
    if (navigator.serviceWorker) {
      swHandler = (e) => { if (e.data && e.data.type) push('СОБЫТИЕ sw ' + JSON.stringify(e.data).slice(0, 50)); };
      navigator.serviceWorker.addEventListener('message', swHandler);
    }

    const onErr = (e) => push('ОШИБКА JS ' + (e.message || e.reason || ''));
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onErr);

    // каждые 5 сек фиксируем число рендеров — видно, крутится ли цикл
    const tick = setInterval(() => {
      push('ТИК ' + Math.round((Date.now() - started) / 1000) + 'с');
    }, 5000);

    return () => {
      window.fetch = origFetch;
      window.removeEventListener('atlaspos:mutated', onMutated);
      window.removeEventListener('atlaspos:synced', onSynced);
      window.removeEventListener('atlaspos-business-type', onBiz);
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onErr);
      if (navigator.serviceWorker && swHandler) navigator.serviceWorker.removeEventListener('message', swHandler);
      clearInterval(tick);
    };
  }, [name]);

  return null; // ничего не рисуем — мигать нечему
}
