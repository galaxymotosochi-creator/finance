export default function Dashboard() {
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const stats = { revenue: 284000, expenses: 123000, profit: 161000 };
  const cash = { cash: 34500, cashless: 128000, shift: 245 };
  const lowStock = [
    { name: 'Тормозные колодки', qty: 3, min: 10 },
    { name: 'Масло трансмиссионное', qty: 2, min: 8 },
    { name: 'Свечи зажигания', qty: 1, min: 15 },
  ];
  const employees = [
    { name: 'Алексей М.', status: 'online' },
    { name: 'Мария К.', status: 'online' },
    { name: 'Дмитрий С.', status: 'offline' },
  ];
  const topProducts = [
    { name: 'Скутер Tank Next', sold: 12, revenue: 874800 },
    { name: 'Скутер Tank X', sold: 8, revenue: 1039200 },
    { name: 'Масло моторное', sold: 34, revenue: 23800 },
    { name: 'Аккумулятор', sold: 15, revenue: 52500 },
    { name: 'Honda Sundero', sold: 3, revenue: 629700 },
  ];
  const chartData = [
    { day: 'Пн', income: 180000, outcome: 95000 },
    { day: 'Вт', income: 220000, outcome: 110000 },
    { day: 'Ср', income: 195000, outcome: 85000 },
    { day: 'Чт', income: 284000, outcome: 123000 },
    { day: 'Пт', income: 310000, outcome: 140000 },
    { day: 'Сб', income: 256000, outcome: 102000 },
    { day: 'Вс', income: 175000, outcome: 78000 },
  ];
  const operations = [
    { label: 'Продажа скутера', amount: 87200, type: 'income', time: '14:32' },
    { label: 'Запчасти', amount: 8500, type: 'expense', time: '13:15' },
    { label: 'Аренда скутера', amount: 15000, type: 'income', time: '12:40' },
    { label: 'Поставка масел', amount: 28000, type: 'expense', time: '11:00' },
    { label: 'Сервис ТО', amount: 5500, type: 'income', time: '10:20' },
  ];

  const maxVal = Math.max(...chartData.flatMap(d => [d.income, d.outcome]));

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", color: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-.02em', marginBottom: 2 }}>Панель управления</h1>
          <p style={{ fontSize: '.82rem', color: 'rgba(0,0,0,.54)' }}>{today}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['День', 'Неделя', 'Месяц'].map(p => (
            <button key={p} style={{
              padding: '4px 12px', borderRadius: 100, border: '1.5px solid rgba(0,0,0,.12)', background: p === 'День' ? '#000' : 'transparent',
              color: p === 'День' ? '#fff' : '#555', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* TOP 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Выручка сегодня', value: `+${stats.revenue.toLocaleString()} ₽`, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Расходы сегодня', value: `−${stats.expenses.toLocaleString()} ₽`, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Чистая прибыль', value: `+${stats.profit.toLocaleString()} ₽`, color: '#000', bg: '#ffdd2d' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontSize: '.75rem', color: 'rgba(0,0,0,.54)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* CHART + TOP PRODUCTS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: '.9rem', fontWeight: 700, marginBottom: 16 }}>Доходы и расходы</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
            {chartData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 100 }}>
                  <div style={{ width: '70%', height: `${(d.income / maxVal) * 80}px`, background: '#16a34a', borderRadius: '4px 4px 0 0', minHeight: 4, opacity: .8 }} />
                  <div style={{ width: '70%', height: `${(d.outcome / maxVal) * 80}px`, background: '#dc2626', borderRadius: '4px 4px 0 0', minHeight: 4, opacity: .7 }} />
                </div>
                <span style={{ fontSize: '.6rem', color: 'rgba(0,0,0,.34)' }}>{d.day}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: '.7rem', color: 'rgba(0,0,0,.54)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#16a34a', marginRight: 4 }} /> Доход</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#dc2626', marginRight: 4 }} /> Расход</span>
          </div>
        </div>

        <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: '.9rem', fontWeight: 700, marginBottom: 12 }}>Топ товаров</h2>
          {topProducts.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,.06)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.7rem', fontWeight: 700, color: 'rgba(0,0,0,.2)', minWidth: 16 }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: '.78rem', fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: '.65rem', color: 'rgba(0,0,0,.34)' }}>{p.sold} шт</div>
                </div>
              </div>
              <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#16a34a' }}>+{p.revenue.toLocaleString()} ₽</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3 CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: '.9rem', fontWeight: 700, marginBottom: 12 }}>Касса сейчас</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: '.65rem', color: 'rgba(0,0,0,.54)', marginBottom: 2 }}>Наличные</div>
              <div style={{ fontSize: '.9rem', fontWeight: 700 }}>{cash.cash.toLocaleString()} ₽</div>
            </div>
            <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: '.65rem', color: 'rgba(0,0,0,.54)', marginBottom: 2 }}>Безнал</div>
              <div style={{ fontSize: '.9rem', fontWeight: 700 }}>{cash.cashless.toLocaleString()} ₽</div>
            </div>
          </div>
          <div style={{ fontSize: '.7rem', color: 'rgba(0,0,0,.34)', marginTop: 8 }}>Смена #{cash.shift} · открыта</div>
        </div>

        <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: '.9rem', fontWeight: 700, marginBottom: 12 }}>Критические остатки</h2>
          {lowStock.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,.06)' : 'none', fontSize: '.78rem' }}>
              <span style={{ fontWeight: 500 }}>{s.name}</span>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>{s.qty} шт</span>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: '.9rem', fontWeight: 700, marginBottom: 12 }}>Сотрудники</h2>
          {employees.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,.06)' : 'none' }}>
              <span style={{ fontSize: '.82rem', fontWeight: 500 }}>{e.name}</span>
              <span style={{
                fontSize: '.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 100,
                background: e.status === 'online' ? '#f0fdf4' : '#f5f5f5', color: e.status === 'online' ? '#16a34a' : '#999',
              }}>{e.status === 'online' ? 'На смене' : 'Не в сети'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* OPERATIONS */}
      <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: '.9rem', fontWeight: 700 }}>Последние операции</h2>
          <button style={{ padding: '4px 12px', borderRadius: 100, border: '1.5px solid rgba(0,0,0,.12)', background: 'transparent', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Все →</button>
        </div>
        {operations.map((op, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,.06)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: op.type === 'income' ? '#f0fdf4' : '#fef2f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem',
              }}>
                {op.type === 'income' ? '📈' : '📉'}
              </div>
              <div>
                <div style={{ fontSize: '.8rem', fontWeight: 500 }}>{op.label}</div>
                <div style={{ fontSize: '.65rem', color: 'rgba(0,0,0,.34)' }}>{op.time}</div>
              </div>
            </div>
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: op.type === 'income' ? '#16a34a' : '#dc2626' }}>
              {op.type === 'income' ? '+' : '−'}{op.amount.toLocaleString()} ₽
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
