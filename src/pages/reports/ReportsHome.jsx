import { useNavigate } from 'react-router-dom';

const reports = [
  {
    key: 'sales',
    title: 'Продажи по сотрудникам',
    sub: 'Все продажи и вознаграждения сотрудников за период',
    path: '/reports/sales',
    gradient: 'linear-gradient(135deg,#16a34a,#22c55e)',
  },
  {
    key: 'products',
    title: 'Продажи по товарам',
    sub: 'Только товары — продажи и себестоимость за период',
    path: '/reports/products',
    gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)',
  },
  {
    key: 'services',
    title: 'Продажи по услугам',
    sub: 'Только услуги — оказание и выручка за период',
    path: '/reports/services',
    gradient: 'linear-gradient(135deg,#a855f7,#c084fc)',
  },
  {
    key: 'combo',
    title: 'Продажи по комбо',
    sub: 'Комплекты — выручка и прибыль по составу',
    path: '/reports/combo',
    gradient: 'linear-gradient(135deg,#ea580c,#fb923c)',
  },
  {
    key: 'category',
    title: 'Продажи по категориям',
    sub: 'Продажи товаров, услуг и комбо по всем категориям',
    path: '/reports/category',
    gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
  },
  {
    key: 'daily',
    title: 'Продажи по дням',
    sub: 'Продажи, возвраты и прибыль по каждому дню',
    path: '/reports/daily',
    gradient: 'linear-gradient(135deg,#0891b2,#22d3ee)',
  },
  {
    key: 'weekly',
    title: 'Продажи по неделям',
    sub: 'Продажи, возвраты и прибыль по каждой неделе',
    path: '/reports/weekly',
    gradient: 'linear-gradient(135deg,#4f46e5,#818cf8)',
  },
];

export default function ReportsHome() {
  const n = useNavigate();
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Отчёты</h1>
          <div className="sub">Выберите отчёт — дальше добавим новые</div>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0 1rem', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '14px' }}>
        {reports.map((r) => (
          <div key={r.key}
            onClick={() => n(r.path)}
            onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,.12)'; }}
            onMouseLeave={ev => { ev.currentTarget.style.transform = 'none'; ev.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,.06)'; }}
            style={{
              borderRadius: '18px', padding: '18px', cursor: 'pointer', color: '#fff',
              background: r.gradient, boxShadow: '0 2px 10px rgba(0,0,0,.06)',
              transition: 'transform .15s, box-shadow .15s', minHeight: '130px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '3px' }}>{r.title}</div>
              <div style={{ fontSize: '.78rem', opacity: .92, lineHeight: 1.4 }}>{r.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
