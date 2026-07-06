/**
 * Форматирование даты в формат ДД.ММ.ГГГГ
 * Принимает: ISO строку ("2026-07-06T...") или "2026-07-06" или Date
 * Возвращает: "06.07.2026"
 */
export function fmtDate(d) {
  if (!d) return '—';
  // Если уже отформатировано (содержит точки)
  if (typeof d === 'string' && d.includes('.')) return d;
  try {
    // Если передали Date объект
    if (d instanceof Date) {
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    // Если ISO строка с T
    if (d.includes('T')) {
      const parts = d.split('T')[0].split('-');
      if (parts.length === 3) return parts[2] + '.' + parts[1] + '.' + parts[0];
    }
    // Если просто YYYY-MM-DD
    const parts = d.split('-');
    if (parts.length === 3) return parts[2] + '.' + parts[1] + '.' + parts[0];
    return d;
  } catch(e) {
    return d;
  }
}

/**
 * Форматирование суммы в рублях
 */
export function fmtMoney(n) {
  if (n === null || n === undefined) return '0 ₽';
  return Number(n).toLocaleString('ru-RU') + ' ₽';
}
