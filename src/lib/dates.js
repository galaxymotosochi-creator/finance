/**
 * Форматирование даты в формат ДД.ММ.ГГГГ
 * Принимает: ISO строку ("2026-07-06T...") или "2026-07-06" или Date
 * Возвращает: "06.07.2026"
 */
export function fmtDate(d) {
  if (!d) return '—';
  try {
    // Если уже отформатирована как ДД.ММ.ГГГГ — не трогаем
    if (typeof d === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(d)) return d;
    
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
 * Часовой пояс программы — из настроек (localStorage 'settings_tz'), по умолчанию Europe/Moscow
 */
export function getSettingsTz() {
  try { return localStorage.getItem('settings_tz') || 'Europe/Moscow'; } catch (e) { return 'Europe/Moscow'; }
}

// Дата YYYY-MM-DD в часовом поясе настроек программы
function tzDateStr(dt) {
  try { return dt.toLocaleDateString('en-CA', { timeZone: getSettingsTz() }); }
  catch (e) { return dt.toISOString().split('T')[0]; }
}

/** Сегодня в часовом поясе программы: "2026-09-02" */
export function tzToday() { return tzDateStr(new Date()); }

/** Дата со сдвигом на N дней назад (в поясе программы): "2026-08-26" */
export function tzOffsetDate(days) { return tzDateStr(new Date(Date.now() - days * 86400000)); }

/**
 * Форматирование суммы в рублях
 */
export function fmtMoney(n) {
  if (n === null || n === undefined) return '0 ₽';
  return Number(n).toLocaleString('ru-RU') + ' ₽';
}
