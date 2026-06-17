import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const HEALTH = { critical: 'critical', warning: 'warning', healthy: 'healthy' };
const HEALTH_LABEL = { critical: 'Критический', warning: 'Внимание', healthy: 'Здоровый' };
const HEALTH_COLOR = { critical: '#dc2626', warning: '#f59e0b', healthy: '#16a34a' };
const HEALTH_BG = { critical: '#fef2f2', warning: '#fffbeb', healthy: '#f0fdf4' };

export default function Health() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [suppliesCache, setSuppliesCache] = useState([]);
  const [writeoffs, setWriteoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [period, setPeriod] = useState(30);
  const [simTraffic, setSimTraffic] = useState(100);
  const [showSim, setShowSim] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [prodRes, supRes, woRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('supplies').select('items').eq('user_id', user.id),
        supabase.from('writeoffs').select('*').eq('user_id', user.id),
      ]);
      if (prodRes.data) setProducts(prodRes.data.filter(p => !p.hidden));
      const supplies = [];
      (supRes.data || []).forEach(sp => { (sp.items || []).forEach(it => { supplies.push(it); }); });
      setSuppliesCache(supplies);
      setWriteoffs(woRes.data || []);
      setLoading(false);
    })();
  }, [user]);

  // Build stock map (supplies + initial stock - writeoffs)
  const stockMap = useMemo(() => {
    const map = {};
    // Supplies (приход)
    suppliesCache.forEach(sp => {
      if (!map[sp.prodId]) map[sp.prodId] = { qty: 0, cost: 0 };
      map[sp.prodId].qty += sp.qty || 0;
      map[sp.prodId].cost += (sp.cost || 0) * (sp.qty || 0);
    });
    // Initial stock
    try {
      const initial = JSON.parse(localStorage.getItem('initialStock88'));
      if (initial && initial.done && initial.items) {
        Object.keys(initial.items).forEach(id => {
          const q = parseInt(initial.items[id]) || 0;
          const c = (initial.costs && parseInt(initial.costs[id])) || 0;
          if (q > 0) {
            if (!map[id]) map[id] = { qty: 0, cost: 0 };
            map[id].qty += q;
            map[id].cost += c * q;
          }
        });
      }
    } catch (e) {}
    // Write-offs (расход)
    writeoffs.forEach(wo => {
      const pid = wo.product_id;
      if (pid) {
        if (!map[pid]) map[pid] = { qty: 0, cost: 0 };
        map[pid].qty -= wo.quantity || 0;
        if (map[pid].qty < 0) map[pid].qty = 0;
      }
    });
    return map;
  }, [suppliesCache, writeoffs]);

  // Sales velocity per product per day (based on write-offs = real расход товара)
  const salesVelocity = useMemo(() => {
    const velocity = {};
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    const periodWo = writeoffs.filter(wo =>
      new Date(wo.date || wo.created_at) >= cutoff
    );
    periodWo.forEach(wo => {
      const pid = wo.product_id;
      if (!pid) return;
      if (!velocity[pid]) velocity[pid] = { qty: 0, count: 0 };
      velocity[pid].qty += wo.quantity || 0;
      velocity[pid].count += 1;
    });
    const result = {};
    Object.keys(velocity).forEach(id => {
      result[id] = {
        dailyQty: velocity[id].qty / period,
        totalQty: velocity[id].qty,
      };
    });
    return result;
  }, [writeoffs, period]);

  const healthData = useMemo(() => {
    return products
      .filter(p => stockMap[p.id] && stockMap[p.id].qty > 0)
      .map(p => {
        const st = stockMap[p.id];
        const qty = st.qty;
        const costPrice = st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
        const retailPrice = p.price || 0;
        const markup = retailPrice - costPrice;
        const markupPct = costPrice > 0 ? Math.round((markup / costPrice) * 100) : 0;
        const sv = salesVelocity[p.id];
        const dailySales = sv ? (sv.dailyQty * simTraffic / 100) : 0;
        const daysLeft = dailySales > 0 ? Math.round(qty / dailySales) : 999;
        const sumValue = costPrice * qty;
        const totalSold = sv ? sv.totalQty : 0;

        let status = HEALTH.healthy;
        if (daysLeft <= 7) status = HEALTH.critical;
        else if (daysLeft <= 30) status = HEALTH.warning;

        const tags = [];
        if (totalSold >= 3) tags.push({ type: 'magnet', label: 'Магнит', icon: '🧲' });
        if (markupPct > 50) tags.push({ type: 'anchor', label: 'Якорь', icon: '⚓' });

        const isSlow = daysLeft > 60;

        return { ...p, qty, costPrice, retailPrice, markup, markupPct, sumValue,
          dailySales, daysLeft, status, tags, isSlow, sv };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [products, stockMap, salesVelocity, simTraffic]);

  const filtered = useMemo(() => {
    if (filter === 'all') return healthData;
    return healthData.filter(h => h.status === filter);
  }, [healthData, filter]);

  const metrics = useMemo(() => {
    const totalItems = healthData.length;
    const criticalCount = healthData.filter(h => h.status === HEALTH.critical).length;
    const warningCount = healthData.filter(h => h.status === HEALTH.warning).length;
    const healthyCount = healthData.filter(h => h.status === HEALTH.healthy).length;
    const frozenCapital = healthData.filter(h => h.isSlow).reduce((s, h) => s + h.sumValue, 0);
    const totalStockValue = healthData.reduce((s, h) => s + h.sumValue, 0);
    const avgDays = healthData.length > 0
      ? Math.round(healthData.reduce((s, h) => s + Math.min(h.daysLeft, 365), 0) / healthData.length)
      : 0;
    return { totalItems, criticalCount, warningCount, healthyCount, frozenCapital, totalStockValue, avgDays };
  }, [healthData]);

  const healthPct = (h) => {
    const supplyDays = h.daysLeft === 999 ? 90 : h.daysLeft;
    return Math.min(100, Math.round((supplyDays / 90) * 100));
  };

  const navigateTo = (path) => {
    window.location.hash = path;
    window.dispatchEvent(new Event('hashchange'));
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <>
      {/* Шапка */}
      <div className="page-header">
        <div>
          <h1>Здоровье товаров</h1>
          <div className="sub">Пульт управления капиталом — аналитика остатков и прогнозы</div>
        </div>
        <div className="page-actions" style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
          <button onClick={() => setShowSim(!showSim)}
            style={{padding:'5px 14px',borderRadius:'100px',border:'1.5px solid rgba(0,0,0,.12)',background:'transparent',fontSize:'.72rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#555'}}>
            {showSim ? '✕ Симулятор' : '📊 Что если?'}
          </button>
          {[7, 30, 90].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{padding:'5px 14px', borderRadius:'100px', border:'1.5px solid rgba(0,0,0,.12)',
                background: period === p ? '#000' : 'transparent',
                color: period === p ? '#fff' : '#555', fontSize:'.72rem', fontWeight:600,
                cursor:'pointer', fontFamily:'inherit',
              }}>{p} дн</button>
          ))}
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {/* Симулятор спроса */}
      {showSim && (
        <div style={{border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 18px',
          marginBottom:'14px', background:'#fafafa'}}>
          <div style={{fontSize:'.82rem',fontWeight:600,marginBottom:'8px',color:'#555'}}>
            📊 Симулятор спроса
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
            <span style={{fontSize:'.78rem',color:'var(--muted)'}}>Изменение трафика/продаж:</span>
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <input type="range" min="10" max="300" value={simTraffic}
                onChange={e => setSimTraffic(Number(e.target.value))}
                style={{width:'160px',accentColor:'#000'}} />
              <span style={{fontSize:'.85rem',fontWeight:700,minWidth:'45px'}}>{simTraffic}%</span>
            </div>
            <span style={{fontSize:'.72rem',color:'var(--muted)'}}>
              При текущем спросе средний запас — <b>{metrics.avgDays} дн</b>
            </span>
          </div>
        </div>
      )}

      {/* 4 метрики */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'16px'}}>
        {[
          { label:'Замороженный капитал',
            value:metrics.frozenCapital.toLocaleString()+' ₽',
            color:metrics.frozenCapital>100000?'#dc2626':metrics.frozenCapital>50000?'#f59e0b':'#16a34a',
            bg:metrics.frozenCapital>100000?'#fef2f2':metrics.frozenCapital>50000?'#fffbeb':'#f0fdf4',
            sub:'товары без движения >60 дн' },
          { label:'Здоровье склада',
            value:metrics.totalItems>0?Math.round((metrics.healthyCount/metrics.totalItems)*100)+'%':'—',
            color:'#000',bg:'#ffdd2d',
            sub:`${metrics.healthyCount} из ${metrics.totalItems} товаров` },
          { label:'Требуют внимания',
            value:(metrics.criticalCount+metrics.warningCount).toString(),
            color:metrics.criticalCount>0?'#dc2626':'#f59e0b',
            bg:metrics.criticalCount>0?'#fef2f2':'#fffbeb',
            sub:`${metrics.criticalCount} критических · ${metrics.warningCount} на грани` },
          { label:'Средний запас',value:metrics.avgDays+' дн',
            color:'#000',bg:'#f5f5f5',
            sub:'хватит при текущих продажах' },
        ].map((m,i)=>(
          <div key={i} style={{background:m.bg,borderRadius:'14px',padding:'14px 18px'}}>
            <div style={{fontSize:'.72rem',color:'rgba(0,0,0,.54)',marginBottom:'4px'}}>{m.label}</div>
            <div style={{fontSize:'1.15rem',fontWeight:800,color:m.color,marginBottom:'2px'}}>{m.value}</div>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.4)'}}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Фильтры статуса */}
      <div className="search-row" style={{display:'flex',alignItems:'center',marginBottom:'14px'}}>
        <div className="stock-filter-links" style={{display:'flex',alignItems:'center',gap:'.15rem'}}>
          {[
            {key:'all',label:`Все (${metrics.totalItems})`},
            {key:HEALTH.healthy,label:`🟢 Здоровые (${metrics.healthyCount})`},
            {key:HEALTH.warning,label:`🟡 Внимание (${metrics.warningCount})`},
            {key:HEALTH.critical,label:`🔴 Критические (${metrics.criticalCount})`},
          ].map(f=>(
            <span key={f.key} className="stock-filter-link"
              onClick={()=>setFilter(f.key)}
              style={{padding:'.15rem .45rem',fontSize:'.72rem',
                color:filter===f.key?'#000':'#555',cursor:'pointer',
                borderRight:'1px solid var(--border)',lineHeight:1,
                fontWeight:filter===f.key?600:400}}>{f.label}</span>
          ))}
        </div>
      </div>

      {/* Карточки товаров */}
      {filtered.length===0 ? (
        <div className="empty-products">
          <div className="big-icon">📦</div>
          <p>Нет товаров для отображения</p>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',gap:'12px'}}>
          {filtered.map(h=>{
            const pct = healthPct(h);
            const col = HEALTH_COLOR[h.status];
            const bcol = HEALTH_BG[h.status];
            const barColor = h.status===HEALTH.critical?'#dc2626'
              : h.status===HEALTH.warning?'#f59e0b':'#16a34a';
            return (
              <div key={h.id} style={{border:'1.5px solid #eee',borderRadius:'14px',padding:'16px',
                background:'var(--body-bg)',position:'relative',
                boxShadow:'0 1px 3px rgba(0,0,0,.04)',borderLeft:`3px solid ${col}`,
                transition:'box-shadow .15s'}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 3px 10px rgba(0,0,0,.08)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.04)'}>
                {/* Название + бейдж */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'.82rem',fontWeight:600,marginBottom:'2px',
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {h.name}
                    </div>
                    {h.sku && <div style={{fontSize:'.65rem',color:'var(--muted)',fontFamily:'monospace'}}>{h.sku}</div>}
                  </div>
                  <span style={{fontSize:'.65rem',fontWeight:600,padding:'2px 8px',borderRadius:'100px',
                    background:bcol,color:col,whiteSpace:'nowrap',marginLeft:'8px'}}>
                    {HEALTH_LABEL[h.status]}
                  </span>
                </div>

                {/* Теги */}
                {h.tags.length>0 && (
                  <div style={{display:'flex',gap:'4px',marginBottom:'8px'}}>
                    {h.tags.map((t,ti)=>(
                      <span key={ti} style={{
                        fontSize:'.62rem',fontWeight:600,padding:'1px 6px',borderRadius:'4px',
                        background:t.type==='magnet'?'#e0f2fe':'#fef3c7',color:t.type==='magnet'?'#0369a1':'#92400e'}}>
                        {t.icon} {t.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Количество */}
                <div style={{fontSize:'1.1rem',fontWeight:700,marginBottom:'4px'}}>
                  {h.qty} <span style={{fontSize:'.7rem',fontWeight:400,color:'var(--muted)'}}>шт</span>
                </div>

                {/* Прогресс-бар запаса */}
                <div style={{background:'#f0f0f0',borderRadius:'6px',height:'6px',marginBottom:'6px',overflow:'hidden'}}>
                  <div style={{
                    width:`${100-pct}%`, height:'100%', borderRadius:'6px',
                    background: barColor, transition:'width .3s ease',
                    float:'right',
                  }} />
                </div>

                {/* Дни до истощения */}
                <div style={{fontSize:'.75rem',color:'var(--muted)',marginBottom:'8px',display:'flex',justifyContent:'space-between'}}>
                  <span>
                    {h.daysLeft===999 ? '∞ нет продаж' : `Закончится через ${h.daysLeft} дн`}
                  </span>
                  {h.retailPrice>0 && <span style={{fontWeight:600}}>{h.retailPrice.toLocaleString()} ₽</span>}
                </div>

                {/* Маржа */}
                {h.markupPct!==0 && (
                  <div style={{fontSize:'.68rem',color:'var(--muted)',marginBottom:'8px'}}>
                    Маржа: <span style={{color:h.markup>=0?'#16a34a':'#dc2626',fontWeight:600}}>
                      {h.markup>=0?'+':''}{h.markup.toLocaleString()} ₽ ({h.markupPct}%)
                    </span>
                  </div>
                )}

                {/* Кнопки действий для критических */}
                {h.status===HEALTH.critical && (
                  <div style={{display:'flex',gap:'6px',marginTop:'8px',paddingTop:'10px',
                    borderTop:'1px solid #f0f0f0'}}>
                    <button onClick={()=>navigateTo('/supplies/add')}
                      style={{flex:1,padding:'5px 8px',fontSize:'.68rem',fontWeight:600,
                        borderRadius:'6px',border:'1.5px solid #16a34a',color:'#16a34a',
                        background:'#f0fdf4',cursor:'pointer',fontFamily:'inherit'}}>
                      📦 Заказать
                    </button>
                    <button
                      style={{flex:1,padding:'5px 8px',fontSize:'.68rem',fontWeight:600,
                        borderRadius:'6px',border:'1.5px solid #f59e0b',color:'#92400e',
                        background:'#fffbeb',cursor:'pointer',fontFamily:'inherit'}}>
                      🏷️ Скидку
                    </button>
                  </div>
                )}

                {/* Для медленных — кнопка возврата */}
                {h.isSlow && h.status!==HEALTH.critical && (
                  <div style={{marginTop:'8px',paddingTop:'10px',borderTop:'1px solid #f0f0f0'}}>
                    <button style={{padding:'4px 10px',fontSize:'.68rem',fontWeight:600,
                      borderRadius:'6px',border:'1.5px solid #dc2626',color:'#dc2626',
                      background:'#fef2f2',cursor:'pointer',fontFamily:'inherit',width:'100%'}}>
                      ↩️ Вернуть / Уценить
                    </button>
                  </div>
                )}

                {/* Себестоимость */}
                {h.costPrice>0 && (
                  <div style={{fontSize:'.62rem',color:'var(--muted)',marginTop:'6px'}}>
                    Себестоимость: {h.costPrice.toLocaleString()} ₽ · Сумма: {h.sumValue.toLocaleString()} ₽
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
