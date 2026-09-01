import { useEffect, useRef } from 'react';

/**
 * Оптимистичная синхронизация для всех разделов:
 * - Когда мутация (добавление/изменение/удаление) уходит в офлайн-очередь (queued),
 *   запись СРАЗУ появляется/обновляется/исчезает в списке с пометкой pending («ждёт синхронизации»).
 * - Записи, ожидающие синхронизации, хранятся в localStorage — они подхватываются даже после
 *   перехода между разделами (событие могло «упуститься»).
 * - Когда офлайн-очередь синхронизировалась (atlaspos:synced), вызывается onSynced (перезагрузка списка),
 *   pending-пометки исчезают, записи получают настоящие id.
 *
 * Использование:
 *   useOptimisticSync({ table: 'clients', setList: setClientsState, onSynced: load });
 */
const pendingKey = (table) => 'atlaspos_pending_' + table;

function readPending(table) {
  try { return JSON.parse(localStorage.getItem(pendingKey(table)) || '[]'); } catch (e) { return []; }
}
function writePending(table, list) {
  try { localStorage.setItem(pendingKey(table), JSON.stringify(list)); } catch (e) {}
}
function clearPending(table) {
  try { localStorage.removeItem(pendingKey(table)); } catch (e) {}
}

export default function useOptimisticSync({ table, setList, onSynced }) {
  const setListRef = useRef(setList);
  setListRef.current = setList;
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  // При монтировании — применяем накопленные офлайн-записи (если страница открыта после их создания)
  useEffect(() => {
    const pending = readPending(table);
    if (!pending.length) return;
    const set = setListRef.current;
    if (!set) return;
    set(prev => {
      let next = prev || [];
      pending.forEach(p => {
        if (p.kind === 'insert') {
          const exists = next.some(x => String(x._tempId || x.id) === String(p.tempId));
          if (!exists) next = [{ ...p.body, id: p.tempId, _tempId: p.tempId, pending: true }, ...next];
        } else if (p.kind === 'update') {
          next = next.map(x => String(x.id) === String(p.id) ? { ...x, ...p.patch, pending: true } : x);
        } else if (p.kind === 'delete') {
          next = next.filter(x => String(x.id) !== String(p.id));
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  useEffect(() => {
    const onMutated = (e) => {
      const d = e.detail || {};
      if (!d.queued || d.table !== table) return;
      const set = setListRef.current;

      if (d.method === 'POST') {
        const body = Array.isArray(d.body) ? d.body[0] : d.body;
        if (!body) return;
        // Временный id — настоящий появится после синхронизации
        const tempId = Date.now();
        writePending(table, [...readPending(table), { kind: 'insert', body, tempId }]);
        if (set) set(prev => [{ ...body, id: tempId, _tempId: tempId, pending: true }, ...(prev || [])]);
      } else if (d.method === 'PATCH' && d.id != null) {
        const patch = Array.isArray(d.body) ? d.body[0] : d.body;
        writePending(table, [...readPending(table), { kind: 'update', id: String(d.id), patch: patch || {} }]);
        if (set) set(prev => (prev || []).map(x =>
          String(x.id) === String(d.id) ? { ...x, ...(patch || {}), pending: true } : x
        ));
      } else if (d.method === 'DELETE' && d.id != null) {
        writePending(table, [...readPending(table), { kind: 'delete', id: String(d.id) }]);
        if (set) set(prev => (prev || []).filter(x => String(x.id) !== String(d.id)));
      }
    };

    const onSync = () => {
      // Очередь синхронизирована — офлайн-записи теперь на сервере, чистим локальный реестр
      clearPending(table);
      if (onSyncedRef.current) onSyncedRef.current();
    };

    window.addEventListener('atlaspos:mutated', onMutated);
    window.addEventListener('atlaspos:synced', onSync);
    return () => {
      window.removeEventListener('atlaspos:mutated', onMutated);
      window.removeEventListener('atlaspos:synced', onSync);
    };
  }, [table]);
}
