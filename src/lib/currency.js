// Валюта по настройкам пользователя (Settings → Локализация)
const SYMBOLS = { RUB: '₽', KZT: '₸', BYN: 'Br', AMD: '֏', UZS: 'сум', KGS: 'с' };
let cached = null;

export function getCurrencySymbol() {
  if (cached) return cached;
  try {
    const cur = localStorage.getItem('settings_currency') || 'RUB';
    cached = SYMBOLS[cur] || '₽';
  } catch (e) { cached = '₽'; }
  return cached;
}

export function resetCurrencyCache() {
  cached = null;
}
