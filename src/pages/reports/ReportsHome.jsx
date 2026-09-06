import { useNavigate } from 'react-router-dom';

const reports = [
  {
    key: 'employees',
    title: 'Работа сотрудников',
    sub: 'Продажи, смены, исполнители, премии и штрафы по дням',
    path: '/reports/employees',
    icon: '👥',
    gradient: 'linear-gradient(135deg,#2563eb,#3b82f6)',
  },
  {
    key: 'sales',
    title: 'Продажи по сотрудникам',
    sub: 'Кто сколько продал и выполнил за период, бонус по правилам',
    path: '/reports/sales',
    icon: '📈',
    gradient: 'linear-gradient(135deg,#16a34a,#22c55e)',
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
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.7rem', lineHeight: 1 }}>{r.icon}</span>
              <span style={{ fontSize: '1.1rem', opacity: .9 }}>→</span>
            </div>
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
