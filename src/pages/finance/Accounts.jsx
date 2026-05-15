export default function Accounts() {
  return (
    <div>
      <h1 style={styles.title}>Счета</h1>
      <p style={styles.sub}>Расчётные счета и кассы</p>
      <div style={styles.sep} />
      <p style={styles.placeholder}>Управление счетами появится здесь.</p>
    </div>
  );
}
const styles = {
  title: { fontSize: '1.2rem', fontWeight: 600, margin: 0 },
  sub: { fontSize: '.85rem', color: '#888', margin: '.15rem 0 0' },
  sep: { border: 'none', borderTop: '1px solid #eaeaea', margin: '.5rem 0' },
  placeholder: { color: '#aaa', fontSize: '.85rem', marginTop: '1rem' },
};
