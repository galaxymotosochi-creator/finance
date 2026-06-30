import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStr = todayStart.toISOString().split('T')[0];

        const { data } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('user_id', user.id)
          .gte('date', todayStr);

        let rev = 0, exp = 0;
        (data || []).forEach(tx => {
          if (tx.type === 'income' && tx.status !== 'unpaid') rev += tx.amount || 0;
          else if (tx.type === 'expense') exp += tx.amount || 0;
        });
        setTodayRevenue(rev);
        setTodayExpenses(exp);
      } catch (e) {
        console.error('Dashboard error:', e);
      }
      setLoading(false);
    })();
  }, [user]);

  const profit = todayRevenue - todayExpenses;

  if (loading) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#999', fontSize:'.85rem' }}>Загрузка...</div>;
  }

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", color: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-.02em', marginBottom: 2 }}>Панель управления</h1>
          <p style={{ fontSize: '.82rem', color: 'rgba(0,0,0,.54)' }}>{today}</p>
        </div>
      </div>

      {/* TOP 3 — реальные данные */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#f0fdf4', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: '.75rem', color: 'rgba(0,0,0,.54)', marginBottom: 4 }}>Выручка сегодня</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a' }}>+{todayRevenue.toLocaleString()} ₽</div>
        </div>
        <div style={{ background: '#fef2f2', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: '.75rem', color: 'rgba(0,0,0,.54)', marginBottom: 4 }}>Расходы сегодня</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626' }}>-{todayExpenses.toLocaleString()} ₽</div>
        </div>
        <div style={{ background: '#ffdd2d', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: '.75rem', color: 'rgba(0,0,0,.54)', marginBottom: 4 }}>Чистая прибыль</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#000' }}>{profit >= 0 ? '+' : ''}{profit.toLocaleString()} ₽</div>
        </div>
      </div>

      <p style={{ fontSize: '.8rem', color: 'rgba(0,0,0,.34)', marginTop: 20 }}>
        Данные за сегодня. Другие виджеты скоро появятся.
      </p>
    </div>
  );
}
