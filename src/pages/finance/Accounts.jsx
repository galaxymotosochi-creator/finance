import { useAuth } from '../../hooks/useAuth';
import { useAccounts } from '../../hooks/useTransactions';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';

const accMeta = [
  { type: 'cash', icon: '💵', label: 'Наличные' },
  { type: 'card', icon: '💳', label: 'Карта' },
  { type: 'transfer', icon: '🔄', label: 'Перевод' },
];

export default function Accounts() {
  const { user } = useAuth();
  const { accounts, refreshAccounts } = useAccounts();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTx = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });
    setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTx(); }, []);

  const getBalance = (type) => {
    const acct = accounts.find(a => a?.type === type);
    if (!acct) return 0;
    let bal = 0;
    (transactions || []).forEach(t => {
      if (t.account_id === acct.id) {
        bal += Number(t.amount || 0) * (t.type === 'income' ? 1 : -1);
      }
    });
    return bal;
  };

  const seedAccounts = async () => {
    if (accounts.length === 0) {
      await supabase.from('accounts').insert([
        { user_id: user.id, name: 'Наличные', type: 'cash' },
        { user_id: user.id, name: 'Карта', type: 'card' },
        { user_id: user.id, name: 'Перевод', type: 'transfer' },
      ]);
      await refreshAccounts();
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Счета</h1>
          <div className="sub" style={{ fontSize: '.85rem', color: 'var(--muted)', margin: 0 }}>Расчётные счета и кассы</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={seedAccounts}>+ Добавить счёт</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      {!loading && (
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '.75rem 0' }}>
          {accMeta.map(a => {
            const balance = getBalance(a.type);
            const acct = accounts.find(x => x?.type === a.type);
            return (
              <div key={a.type} style={{
                flex: 1, minWidth: '200px',
                background: 'var(--white)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{a.icon}</span>
                  <span style={{ fontSize: '.9rem', fontWeight: 600 }}>{a.label}</span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: balance >= 0 ? '#16a34a' : '#dc2626' }}>
                  {balance.toLocaleString()}₽
                </div>
                {acct && (
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: '.25rem' }}>
                    ID: {acct.id.slice(0, 8)}...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          <p style={{ marginBottom: '.75rem' }}>Нет созданных счетов</p>
          <button onClick={seedAccounts} style={{
            padding: '.5rem 1rem', fontSize: '.82rem',
            border: '1px solid var(--border)', borderRadius: '6px',
            background: 'var(--white)', cursor: 'pointer', fontFamily: 'var(--font)',
          }}>Создать счета</button>
        </div>
      )}

      {!loading && transactions.length === 0 && accounts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          <p>Нет транзакций по счетам</p>
        </div>
      )}
    </>
  );
}
