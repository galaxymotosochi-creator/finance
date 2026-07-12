import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { showToast } from '../../components/Toast';

const REPORTS = [
  { id: 'sales', label: 'Товары и услуги', desc: 'Продажи по каждому товару и услуге за период' },
  { id: 'profit', label: 'Прибыль', desc: 'Доходы минус расходы за период' },
  { id: 'employees', label: 'По сотрудникам', desc: 'Продажи по каждому сотруднику' },
  { id: 'categories', label: 'По категориям', desc: 'Продажи по категориям товаров' },
  { id: 'products', label: 'По товарам', desc: 'Топ продаваемых товаров' },
  { id: 'yearly', label: 'Годовой', desc: 'Сводка за год' },
];

export default function Reports() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeReport = searchParams.get('report') || null;
  const setActiveReport = (val) => {
    if (val) setSearchParams({ report: val });
    else setSearchParams({});
  };
  const [period, setPeriod] = useState('today');
  const [showPeriod, setShowPeriod] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [periodLabel, setPeriodLabel] = useState(() => 'Сегодня (' + new Date().toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'2-digit'}) + ')');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.stock-filter-link')) { setShowPeriod(false); setShowDownload(false); }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (!activeReport || !user) return;
    loadReport();
  }, [activeReport, user]);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeReport === 'sales') {
        // Получаем все чеки за период
        const { data: receiptsData } = await supabase
          .from('receipts')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', dateFrom + 'T00:00:00')
          .lte('created_at', dateTo + 'T23:59:59')
          .order('created_at', { ascending: false });
        
        const receiptIds = (receiptsData||[]).map(r => r.id);
        
        // Получаем все товары из чеков
        const { data: itemsData } = await supabase
          .from('receipt_items')
          .select('*')
          .in('receipt_id', receiptIds.length > 0 ? receiptIds : [0]);
        
        // Получаем себестоимость товаров
        const { data: productsData } = await supabase
          .from('products')
          .select('id, cost')
          .eq('user_id', user.id);
        const costMap = {};
        (productsData||[]).forEach(p => costMap[p.id] = parseFloat(p.cost) || 0);

        // Группируем по товарам
        const grouped = {};
        (itemsData||[]).forEach(item => {
          const key = item.product_id || item.product_name || '—';
          if (!grouped[key]) grouped[key] = { name: item.product_name || '—', qty: 0, total: 0, cost: 0, productId: item.product_id };
          grouped[key].qty += Number(item.quantity) || 0;
          grouped[key].total += Number(item.total) || 0;
          grouped[key].cost += (Number(item.quantity) || 0) * (costMap[item.product_id] || 0);
        });

        const items = Object.values(grouped).sort((a, b) => b.total - a.total);
        const totalQty = items.reduce((s, i) => s + i.qty, 0);
        const totalRevenue = items.reduce((s, i) => s + i.total, 0);
        const totalCost = items.reduce((s, i) => s + i.cost, 0);

        setData({ items, totalQty, totalRevenue, totalCost });
      }
    } catch(e) { showToast('Ошибка загрузки отчёта', 'error'); }
    setLoading(false);
  };

  const fmtDate = (d) => d.toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'2-digit'});

  const setPeriodRange = (p) => {
    setPeriod(p);
    setShowPeriod(false);
    const now = new Date();
    if (p === 'all') {
      setDateFrom(''); setDateTo('');
      setPeriodLabel('Все время');
    } else {
      let from = new Date(now);
      if (p === 'today') { }
      else if (p === 'yesterday') { from.setDate(from.getDate() - 1); now.setDate(now.getDate() - 1); }
      else if (p === 'week') { from.setDate(from.getDate() - 7); }
      else if (p === 'month') { from.setMonth(from.getMonth() - 1); }
      else if (p === 'quarter') { from.setMonth(from.getMonth() - 3); }
      else if (p === 'year') { from.setFullYear(from.getFullYear() - 1); }
      else return;
      setDateFrom(from.toISOString().split('T')[0]);
      setDateTo(now.toISOString().split('T')[0]);
      const labels = { today:'Сегодня', yesterday:'Вчера', week:'Неделя', month:'Месяц', quarter:'Квартал', year:'Год' };
      const fromStr = fmtDate(from);
      const toStr = fmtDate(now);
      if (p === 'today' || p === 'yesterday') setPeriodLabel(labels[p] + ' (' + toStr + ')');
      else setPeriodLabel(labels[p] + ' (' + fromStr + ' — ' + toStr + ')');
    }
    setTimeout(() => loadReport(), 10);
  };

  const exportReportCsv = () => {
    if (!data || !data.items) return;
    const rows = [['Товар / Услуга','Кол-во','Валовый оборот','Скидка','Выручка','Прибыль']];
    data.items.forEach(it => {
      rows.push([it.name, it.qty, it.total, 0, it.total, it.total - it.cost]);
    });
    const totalRow = ['Итого', data.totalQty, data.totalRevenue, 0, data.totalRevenue, data.totalRevenue - data.totalCost];
    rows.push(totalRow);
    const csv = rows.map(r => r.map(v => typeof v === 'string' ? '"'+v+'"' : v).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'Отчет - Товары и услуги.csv'; a.click();
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeReport && (
              <button onClick={() => setActiveReport(null)} style={{background:'none',border:'none',fontSize:'1.1rem',cursor:'pointer',color:'var(--muted)',padding:0,lineHeight:1}}>←</button>
            )}
            <h1 style={{ margin: 0 }}>{activeReport ? (REPORTS.find(r => r.id === activeReport)?.label || 'Отчёт') : 'Отчёты'}</h1>
          </div>
          <div className="sub" style={{marginTop:4}}>Аналитика и статистика по продажам</div>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {/* Плашки отчетов */}
      {!activeReport && (
        <div className="product-table">
          <div style={{display:'flex',flexWrap:'wrap',gap:12,padding:'.5rem 0'}}>
            {REPORTS.map(r => (
              <div key={r.id} onClick={() => setActiveReport(r.id)}
                style={{
                  width:'calc(33.33% - 8px)', minWidth:200, flex:1,
                  padding:'1rem 1.2rem', border:'1px solid var(--border)',
                  borderRadius:12, cursor:'pointer', background:'var(--body-bg)',
                  transition:'all .15s', display:'flex', flexDirection:'column', gap:4
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#555'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={{fontSize:'.9rem',fontWeight:600,color:'#333'}}>{r.label}</div>
                <div style={{fontSize:'.75rem',color:'var(--muted)',lineHeight:1.4}}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Отчет по продажам */}
      {activeReport === 'sales' && (
        <>
          <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:12,marginLeft:'auto',justifyContent:'flex-end'}}>
            <div style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
              <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.75rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}
                onClick={e=>{e.stopPropagation();setShowDownload(!showDownload);setShowPeriod(false)}}>Скачать</span>
              {showDownload && (
                <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'230px',padding:'.35rem',zIndex:100}}>
                  <div style={{fontSize:'.72rem',color:'var(--muted)',marginBottom:'.5rem',padding:'0 .25rem'}}>
                    Вы скачиваете отчет за <b>{periodLabel.toLowerCase()}</b>.
                  </div>
                  <div style={{display:'flex',gap:'.35rem',justifyContent:'center'}}>
                    <span onClick={()=>{exportReportCsv();setShowDownload(false)}}
                      style={{padding:'.35rem .7rem',fontSize:'.75rem',fontWeight:600,borderRadius:'6px',cursor:'pointer',background:'var(--secondary)',color:'#fff',border:'none',fontFamily:'var(--font)'}}>Скачать</span>
                    <span onClick={()=>{setShowDownload(false);setShowPeriod(true)}}
                      style={{padding:'.35rem .7rem',fontSize:'.75rem',borderRadius:'6px',cursor:'pointer',background:'transparent',border:'1px solid var(--border)',color:'var(--muted)',fontFamily:'var(--font)'}}>Изменить даты</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
              <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.75rem',color:'#555',cursor:'pointer',borderRight:'none',lineHeight:1,whiteSpace:'nowrap'}}
                onClick={e=>{e.stopPropagation();setShowPeriod(!showPeriod)}}>{periodLabel}</span>
              {showPeriod && (
                <div onClick={e=>e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'210px',padding:'.35rem',zIndex:100}}>
                  {[{key:'all',label:'Все время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Неделя'},{key:'month',label:'Месяц'},{key:'quarter',label:'Квартал'},{key:'year',label:'Год'}].map(p=>{
                    const isActive = period === p.key;
                    return (
                      <div key={p.key} onClick={()=>setPeriodRange(p.key)}
                        style={{display:'flex',alignItems:'center',gap:'.35rem',padding:'.3rem .5rem',borderRadius:'4px',cursor:'pointer',fontSize:'.78rem',color:'#555',background:'transparent'}}>
                        <input type="checkbox" checked={isActive} onChange={()=>{}} style={{cursor:"pointer",margin:0}} />
                        {p.label}
                      </div>
                    );
                  })}
                  <div style={{borderTop:'1px solid var(--border)',paddingTop:'.35rem',marginTop:'.15rem'}}>
                    <div style={{fontSize:'.72rem',color:'var(--muted)',padding:'.2rem .5rem',marginBottom:'.25rem'}}>Свой период</div>
                    <div style={{display:'flex',gap:'.25rem',padding:'.25rem .5rem'}}>
                      <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px',fontFamily:'var(--font)',outline:'none'}} />
                      <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px',fontFamily:'var(--font)',outline:'none'}} />
                    </div>
                    <div style={{padding:'.25rem .5rem'}}>
                      <button onClick={()=>{if(!dateFrom||!dateTo)return alert('Выберите обе даты');setPeriodLabel(dateFrom.split('-').reverse().join('.')+' — '+dateTo.split('-').reverse().join('.'));setPeriod('custom');setShowPeriod(false);setTimeout(()=>loadReport(),10)}}
                        style={{width:'100%',padding:'.35rem .5rem',fontSize:'.75rem',fontFamily:'var(--font)',background:'var(--secondary)',color:'#fff',border:'none',borderRadius:'4px',cursor:'pointer',fontWeight:600}}>Применить</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Таблица */}
          <div className="product-table" style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead id="colHeaders">
                <tr>
                  <th style={{textAlign:'left'}}>Товар / Услуга</th>
                  <th style={{textAlign:'left'}}>Кол-во</th>
                  <th style={{textAlign:'left'}}>Валовый оборот</th>
                  <th style={{textAlign:'left'}}>Скидка</th>
                  <th style={{textAlign:'left'}}>Выручка</th>
                  <th style={{textAlign:'left'}}>Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6"><div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div></td></tr>
                ) : !data || data.items.length === 0 ? (
                  <tr><td colSpan="6"><div className="empty-products"><div className="big-icon">📊</div><p>Нет продаж за выбранный период</p></div></td></tr>
                ) : data.items.map((it, idx) => {
                  const margin = it.total - it.cost;
                  return (
                  <tr key={idx}>
                    <td style={{textAlign:'left',color:'#555'}}>{it.name}</td>
                    <td style={{textAlign:'left',color:'#555'}}>{it.qty} шт</td>
                    <td style={{textAlign:'left',color:'#555'}}>{it.total.toLocaleString()} ₽</td>
                    <td style={{textAlign:'left',color:'#555'}}>—</td>
                    <td style={{textAlign:'left',color:'#555'}}>{it.total.toLocaleString()} ₽</td>
                    <td style={{textAlign:'left',color: margin >= 0 ? '#16a34a' : '#dc2626'}}>{margin.toLocaleString()} ₽</td>
                  </tr>
                )})}
                {/* Итого */}
                {data && data.items.length > 0 && (
                  <tr className="total-row">
                    <td style={{fontWeight:600}}>Итого:</td>
                    <td style={{textAlign:'left'}}>{data.totalQty} шт</td>
                    <td style={{textAlign:'left'}}>{data.totalRevenue.toLocaleString()} ₽</td>
                    <td style={{textAlign:'left'}}>—</td>
                    <td style={{textAlign:'left'}}>{data.totalRevenue.toLocaleString()} ₽</td>
                    <td style={{textAlign:'left',color:(data.totalRevenue - data.totalCost) >= 0 ? '#16a34a' : '#dc2626'}}>{(data.totalRevenue - data.totalCost).toLocaleString()} ₽</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Заглушки для остальных отчетов */}
      {activeReport && activeReport !== 'sales' && (
        <div style={{padding:'1rem',color:'var(--muted)',textAlign:'center'}}>
          <p style={{marginTop:12,fontSize:'.82rem'}}>Отчёт «{REPORTS.find(r => r.id === activeReport)?.label}» будет добавлен позже</p>
        </div>
      )}
    </>
  );
}
