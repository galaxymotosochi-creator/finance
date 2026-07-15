/**
 * Форматирование даты в формат ДД.ММ.ГГГГ
 * Принимает: ISO строку ("2026-07-06T...") или "2026-07-06" или Date
 * Возвращает: "06.07.2026"
 */
export function fmtDate(d) {
  if (!d) return '—';
  try {
    // Если строка с точками — уже отформатирована
    if (typeof d === 'string' && d.includes('.')) return d;
    
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch(e) {
    return String(d);
  }
}

/**
 * Форматирование суммы в рублях
 */
export function fmtMoney(n) {
  if (n === null || n === undefined) return '0 ₽';
  return Number(n).toLocaleString('ru-RU') + ' ₽';
}
