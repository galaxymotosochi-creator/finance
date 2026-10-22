// Индикатор загрузки раздела.
// Не стирает содержимое страницы: показывается маленьким кружком поверх,
// чтобы при переходах между разделами не было белого «моргания».
export default function CenterSpinner() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      background: 'transparent',
    }}>
      <div style={{
        width: '26px', height: '26px',
        border: '3px solid #eee', borderTopColor: '#111', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}
