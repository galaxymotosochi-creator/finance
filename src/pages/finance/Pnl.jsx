export default function Pnl() {
  return (
    <div>
      <h1 style={styles.title}>P&L</h1>
      <p style={styles.sub}>Прибыли и убытки</p>
      <div style={styles.sep} />
      <p style={styles.placeholder}>Графики и сводка доходов/расходов появятся здесь.</p>
    </div>
  );
}
const styles = {
  title: { fontSize: '1.2rem', fontWeight: 600, margin: 0 },
  sub: { fontSize: '.85rem', color: '#888', margin: '.15rem 0 0' },
  sep: { border: 'none', borderTop: '1px solid #eaeaea', margin: '.5rem 0' },
  placeholder: { color: '#aaa', fontSize: '.85rem', marginTop: '1rem' },
};
