import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      try {
        const now = new Date();
        let fromDate;

        if (period === 'day') {
          fromDate = new Date(now);
          fromDate.setHours(0, 0, 0, 0);
        } else if (period === 'week') {
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - fromDate.getDay() + 1);
          fromDate.setHours(0, 0, 0, 0);
        } else {
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const fromStr = fromDate.toISOString().split('T')[0];

        const { data } = await supabase
          .from('transactions')
          .select('type, amount, status')
          .eq('user_id', user.id)
          .gte('date', fromStr);

        let rev = 0, exp = 0;
        (data || []).forEach(tx => {
          if (tx.type === 'income' && tx.status !== 'unpaid') rev += tx.amount || 0;
          else if (tx.type === 'expense') exp += tx.amount || 0;
        });
        setRevenue(rev);
        setExpenses(exp);
      } catch (e) {
        console.error('Dashboard error:', e);
      }
      setLoading(false);
    })();
  }, [user, period]);

  const profit = revenue - expenses;

  const periodLabel = period === 'day' ? 'за сегодня' : period === 'week' ? 'за эту неделю' : 'за этот месяц';

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", color: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-.02em', marginBottom: 2 }}>Панель управления</h1>
          <p style={{ fontSize: '.82rem', color: 'rgba(0,0,0,.54)' }}>{today}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'day', label: 'День' },
            { key: 'week', label: 'Неделя' },
            { key: 'month', label: 'Месяц' },
          ].map(p => (
            <button key={p.key} onClick={function(){setPeriod(p.key)}}
              style={{
                padding: '4px 12px', borderRadius: 100,
                border: '1.5px solid rgba(0,0,0,.12)',
                background: period === p.key ? '#000' : 'transparent',
                color: period === p.key ? '#fff' : '#555',
                fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#999', fontSize:'.85rem' }}>Загрузка...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#f0fdf4', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: '.75rem', color: 'rgba(0,0,0,.54)', marginBottom: 4 }}>Выручка {periodLabel}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a' }}>+{revenue.toLocaleString()} ₽</div>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: '.75rem', color: 'rgba(0,0,0,.54)', marginBottom: 4 }}>Расходы {periodLabel}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626' }}>-{expenses.toLocaleString()} ₽</div>
            </div>
            <div style={{ background: '#ffdd2d', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: '.75rem', color: 'rgba(0,0,0,.54)', marginBottom: 4 }}>Чистая прибыль {periodLabel}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#000' }}>{profit >= 0 ? '+' : ''}{profit.toLocaleString()} ₽</div>
            </div>
          </div>
          {revenue === 0 && expenses === 0 && (
            <p style={{ fontSize: '.82rem', color: 'rgba(0,0,0,.34)', textAlign:'center', padding:'2rem' }}>
              Нет операций {periodLabel}
            </p>
          )}
        </>
      )}
    </div>
  );
}
