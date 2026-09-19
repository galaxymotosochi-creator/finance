import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';

export default function Health() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [suppliesCache, setSuppliesCache] = useState([]);
  const [writeoffs, setWriteoffs] = useState([]);
  const [soldByProduct, setSoldByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [topSort, setTopSort] = useState('qty'); // qty | revenue | profit
  const [showDead, setShowDead] = useState(false);
  const [tblPos, setTblPos] = useState({ left: false, right: false });
  const tblElRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const from = new Date();
        from.setDate(from.getDate() - period);
        const fromStr = from.toISOString().split('T')[0];
        const [prodRes, supRes, woRes, recRes] = await Promise.all([
          supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('supplies').select('items').eq('user_id', user.id),
          supabase.from('writeoffs').select('*').eq('user_id', user.id),
          supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', fromStr),
        ]);
        if (prodRes.error) throw prodRes.error;
        if (prodRes.data) setProducts(prodRes.data.filter(p => !p.hidden && p.type !== 'service'));
        const supplies = [];
        (supRes.data || []).forEach(sp => { (sp.items || []).forEach(it => { supplies.push(it); }); });
        setSuppliesCache(supplies);
        setWriteoffs(woRes.data || []);

        // Продажи из чеков: количество, выручка, с учётом возвратов
        const recs = recRes.data || [];
        const sold = {};
        if (recs.length > 0) {
          const { data: items } = await supabase.from('receipt_items')
            .select('id,receipt_id,product_id,product_name,quantity,total')
            .in('receipt_id', recs.map(r => r.id));
          const recById = {};
          recs.forEach(r => { recById[r.id] = r; });
          (items || []).forEach(it => {
            const pid = it.product_id != null ? String(it.product_id) : null;
            if (!pid) return;
            const r = recById[it.receipt_id];
            const qtyAll = Number(it.quantity) || 0;
            const totalAll = Number(it.total) || 0;
            let retQty = 0, retSum = 0;
            if (r && (r.refund_items || []).length) {
              const unit = qtyAll > 0 ? totalAll / qtyAll : 0;
              (r.refund_items || []).forEach(rf => {
                if (rf.item_id == null || String(rf.item_id) !== String(it.id)) return;
                const rq = Number(rf.qty) || 0;
                if (rq <= 0) return;
                retQty += rq; retSum += unit * rq;
              });
            }
            const qtyNet = Math.max(0, qtyAll - retQty);
            const sumNet = Math.max(0, totalAll - retSum);
            if (!sold[pid]) sold[pid] = { qty: 0, revenue: 0, lastDate: null };
            sold[pid].qty += qtyNet;
            sold[pid].revenue += sumNet;
            const d = r ? (r.date || r.created_at) : null;
            if (d && (!sold[pid].lastDate || d > sold[pid].lastDate)) sold[pid].lastDate = d;
          });
        }
        setSoldByProduct(sold);
      } catch (e) {
        alert('Ошибка загрузки аналитики: ' + (e.message || 'неизвестная ошибка'));
      }
      setLoading(false);
    })();
  }, [user, period]);

  // Остатки: поставки + начальные − списания
  const stockMap = useMemo(() => {
    const map = {};
    suppliesCache.forEach(it => {
      const pid = it.product_id;
      if (!pid) return;
      if (!map[pid]) map[pid] = { qty: 0, cost: 0 };
      map[pid].qty += Number(it.quantity) || 0;
      map[pid].cost += Number(it.total) || (Number(it.quantity) || 0) * (Number(it.price) || 0);
    });
    try {
      const initial = JSON.parse(localStorage.getItem('initialStock88'));
      if (initial && initial.items) {
        Object.keys(initial.items).forEach(id => {
          const q = parseInt(initial.items[id]) || 0;
          const c = (initial.costs && parseInt(initial.costs[id])) || 0;
          if (q <= 0) return;
          if (!map[id]) map[id] = { qty: 0, cost: 0 };
          map[id].qty += q;
          map[id].cost += c * q;
        });
      }
    } catch (e) { /* нет начальных остатков */ }
    writeoffs.forEach(wo => {
      const pid = wo.product_id;
      if (!pid || !map[pid]) return;
      const q = Number(wo.quantity) || 0;
      const avg = map[pid].qty > 0 ? map[pid].cost / map[pid].qty : 0;
      map[pid].qty -= q;
      map[pid].cost -= avg * q;
    });
    return map;
  }, [suppliesCache, writeoffs]);

  // Данные по каждому товару: продажи за период, деньги, остаток, прогноз
  const rows = useMemo(() => {
    return products.map(p => {
      const st = stockMap[p.id] || { qty: 0, cost: 0 };
      const qty = Math.max(0, st.qty);
      const costPrice = st.qty > 0 && st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
      const retailPrice = p.price || 0;
      const sold = soldByProduct[String(p.id)] || { qty: 0, revenue: 0, lastDate: null };
      const dailySales = sold.qty / (period || 1);
      const daysLeft = dailySales > 0 ? Math.floor(qty / dailySales) : (qty > 0 ? 999 : 0);
      const revenue = Math.round(sold.revenue);
      const cost = Math.round(costPrice * sold.qty);
      const profit = revenue - cost;
      return { ...p, qty, costPrice, retailPrice, soldQty: sold.qty, revenue, profit, dailySales, daysLeft, sumValue: costPrice * qty };
    });
  }, [products, stockMap, soldByProduct, period]);

  // Плитки-итоги
  const tiles = useMemo(() => {
    const soldItems = rows.filter(r => r.soldQty > 0);
    const totalQty = soldItems.reduce((s, r) => s + r.soldQty, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const profit = rows.reduce((s, r) => s + r.profit, 0);
    const toOrder = rows.filter(r => r.qty === 0 || (r.dailySales > 0 && r.daysLeft <= 7));
    const frozen = rows.filter(r => r.soldQty === 0 && r.qty > 0);
    const frozenSum = frozen.reduce((s, r) => s + r.sumValue, 0);
    return { soldCount: soldItems.length, totalQty, revenue, profit, toOrder, frozen, frozenSum };
  }, [rows]);

  // Блок 1 — ТОП продаж
  const topRows = useMemo(() => {
    const list = rows.filter(r => r.soldQty > 0);
    if (topSort === 'revenue') list.sort((a, b) => b.revenue - a.revenue);
    else if (topSort === 'profit') list.sort((a, b) => b.profit - a.profit);
    else list.sort((a, b) => b.soldQty - a.soldQty);
    return list.slice(0, 10);
  }, [rows, topSort]);

  // Блок 2 — что заказать
  const orderRows = useMemo(() => {
    return rows
      .filter(r => r.qty === 0 || (r.dailySales > 0 && r.daysLeft <= 7))
      .sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));
  }, [rows]);

  // Блок 3 — замороженные деньги
  const frozenRows = useMemo(() => {
    return rows.filter(r => r.soldQty === 0 && r.qty > 0).sort((a, b) => b.sumValue - a.sumValue);
  }, [rows]);

  // Блок 4 — мёртвые позиции
  const deadRows = useMemo(() => rows.filter(r => r.soldQty === 0), [rows]);

  const onTblScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left: false, right: false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const checkTbl = () => {
    const el = tblElRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left: false, right: false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  useEffect(() => {
    const t = setTimeout(checkTbl, 150);
    window.addEventListener('resize', checkTbl);
    return () => { clearTimeout(t); window.removeEventListener('resize', checkTbl); };
  }, [loading, topSort, period]);

  const navigateTo = (path) => {
    window.location.hash = path;
    window.dispatchEvent(new Event('hashchange'));
  };

  const dot = (r) => r.qty === 0 ? '#dc2626' : (r.dailySales > 0 && r.daysLeft <= 7 ? '#dc2626' : (r.dailySales > 0 && r.daysLeft <= 30 ? '#ffcf2e' : '#1F75FF'));

  if (loading) return <CenterSpinner />;

  return (
    <>
      {/* Шапка */}
      <div className="sk-bar">
        <div className="grow">
          <h1>Аналитика товаров</h1>
          <div className="sub">Что продаётся, что заказать и где заморожены деньги</div>
        </div>
        <div className="***">
          {[7, 30, 90].map(p => (
            <button key={p} type="button" className={'f-pill' + (period === p ? ' on' : '')}
              onClick={() => setPeriod(p)}>{p} дн</button>
          ))}
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%' }} />

      {/* Плитки-итоги */}
      <div className="sk-tiles" style={{ marginTop: '.75rem' }}>
        <div className="sk-tile sk-primary">
          <div className="sk-t">Продано за {period} дней</div>
          <div className="sk-v">{tiles.totalQty.toLocaleString()} шт</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.8)', marginTop: '2px' }}>{tiles.soldCount} позиций</div>
        </div>
        <div className="sk-tile sk-gold">
          <div className="sk-t">Выручка</div>
          <div className="sk-v">{tiles.revenue.toLocaleString()} {cur}</div>
          <div style={{ fontSize: '11px', color: 'rgba(0,0,0,.55)', marginTop: '2px' }}>
            прибыль {tiles.profit >= 0 ? '+' : ''}{tiles.profit.toLocaleString()} {cur}
          </div>
        </div>
        <div className="sk-tile">
          <div className="sk-t">Заказать срочно</div>
          <div className="sk-v" style={{ color: tiles.toOrder.length > 0 ? '#dc2626' : 'var(--sk-ink)' }}>{tiles.toOrder.length} позиций</div>
          <div style={{ fontSize: '11px', color: 'var(--sk-muted)', marginTop: '2px' }}>закончились или ≤ 7 дней</div>
        </div>
        <div className="sk-tile">
          <div className="sk-t">Заморожено</div>
          <div className="sk-v" style={{ color: tiles.frozenSum > 0 ? '#dc2626' : 'var(--sk-ink)' }}>{tiles.frozenSum.toLocaleString()} {cur}</div>
          <div style={{ fontSize: '11px', color: 'var(--sk-muted)', marginTop: '2px' }}>{tiles.frozen.length} позиций без продаж</div>
        </div>
      </div>

      {/* Блок 1 — ТОП продаж */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1rem 0 .5rem', flexWrap: 'wrap', gap: '.4rem' }}>
        <div style={{ fontSize: '.92rem', fontWeight: 800, color: 'var(--sk-ink)' }}>Что продаётся лучше всего</div>
        <div style={{ display: 'flex', gap: '.25rem' }}>
          {[['qty', 'По штукам'], ['revenue', 'По выручке'], ['profit', 'По прибыли']].map(([v, l]) => (
            <button key={v} type="button" className={'f-pill' + (topSort === v ? ' on' : '')}
              onClick={() => setTopSort(v)}>{l}</button>
          ))}
        </div>
      </div>

      {topRows.length === 0 ? (
        <div className="sk-card"><div className="sk-empty">Продаж за этот период нет</div></div>
      ) : (
        <div className="***">
          <div className="sk-fade sk-fade-l" style={{ opacity: tblPos.left ? 1 : 0 }}></div>
          <div className="sk-fade sk-fade-r" style={{ opacity: tblPos.right ? 1 : 0 }} data-arrow="top"></div>
          <div className="sk-card" style={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }} ref={tblElRef} onScroll={onTblScroll}>
            <table className="sk-table ***" style={{ minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '200px', textAlign: 'left' }}>Товар</th>
                  <th style={{ textAlign: 'left' }}>Продано</th>
                  <th style={{ textAlign: 'left' }}>Выручка</th>
                  <th style={{ textAlign: 'left' }}>Прибыль</th>
                  <th style={{ textAlign: 'left' }}>Остаток</th>
                  <th style={{ textAlign: 'left' }}>Хватит</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>
                      <span style={{ color: 'var(--sk-muted)', marginRight: '6px' }}>{i + 1}.</span>{r.name}
                    </td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.soldQty.toLocaleString()} шт</td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.revenue.toLocaleString()} {cur}</td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: r.profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {r.profit >= 0 ? '+' : ''}{r.profit.toLocaleString()} {cur}
                    </td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.qty.toLocaleString()} шт</td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222', whiteSpace: 'nowrap' }}>
                      {r.qty === 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>закончился</span>
                        : r.daysLeft === 999 ? '—' : r.daysLeft + ' дн'}
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dot(r), marginLeft: '6px' }}></span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Блок 2 — Что заказать */}
      <div style={{ fontSize: '.92rem', fontWeight: 800, color: 'var(--sk-ink)', margin: '1.1rem 0 .5rem' }}>
        Что заказать <span style={{ fontSize: '.78rem', fontWeight: 500, color: 'var(--sk-muted)' }}>— заканчивается при текущих продажах</span>
      </div>
      {orderRows.length === 0 ? (
        <div className="sk-card"><div className="sk-empty">Все товары обеспечены — заказывать нечего</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {orderRows.map(r => {
            const pct = r.qty === 0 ? 0 : Math.min(100, Math.round(((r.daysLeft === 999 ? 90 : r.daysLeft) / 90) * 100));
            const need = Math.max(1, Math.ceil(r.dailySales * 14) - r.qty);
            return (
              <div key={r.id} className="sk-tile" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                  <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--sk-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <span className="f-pill on" style={{ fontSize: '.62rem', padding: '2px 8px', cursor: 'default' }}>{r.qty === 0 ? 'Закончился' : '≤ ' + r.daysLeft + ' дн'}</span>
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--sk-muted)', margin: '6px 0' }}>
                  Осталось {r.qty} шт / Продается в день {r.dailySales >= 1 ? Math.round(r.dailySales) : r.dailySales.toFixed(2)} шт
                </div>
                <div style={{ background: '#eef4ff', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', background: pct <= 15 ? '#dc2626' : '#1F75FF', borderRadius: '6px', transition: 'width .3s ease' }}></div>
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--sk-muted)', marginTop: '6px' }}>
                  За {period} дней продано {r.soldQty} шт / Выручка {r.revenue.toLocaleString()} {cur}
                </div>
                <button type="button" className="sk-dd-btn" style={{ marginTop: '10px', width: '100%' }}
                  onClick={() => navigateTo('/stock/supply/new')}>
                  {r.qty === 0 ? 'Заказать товар' : 'Заказать ещё ' + need + ' шт'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Блок 3 — Замороженные деньги */}
      <div style={{ fontSize: '.92rem', fontWeight: 800, color: 'var(--sk-ink)', margin: '1.1rem 0 .5rem' }}>
        Замороженные деньги <span style={{ fontSize: '.78rem', fontWeight: 500, color: 'var(--sk-muted)' }}>— лежит, но не продаётся за {period} дней</span>
      </div>
      {frozenRows.length === 0 ? (
        <div className="sk-card"><div className="sk-empty">Все товары продаются — заморозки нет</div></div>
      ) : (
        <div className="sk-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="sk-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Товар</th>
                <th style={{ textAlign: 'left' }}>Лежит</th>
                <th style={{ textAlign: 'left' }}>Вложено</th>
                <th style={{ textAlign: 'left' }}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {frozenRows.map(r => (
                <tr key={r.id}>
                  <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.name}</td>
                  <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.qty} шт · без продаж</td>
                  <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#dc2626', fontWeight: 600 }}>{r.sumValue.toLocaleString()} {cur}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button type="button" className="f-pill" onClick={() => navigateTo('/stock/writeoffs')}>Уценить / Списать</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Блок 4 — Мёртвые позиции */}
      <div style={{ fontSize: '.92rem', fontWeight: 800, color: 'var(--sk-ink)', margin: '1.1rem 0 .5rem' }}>
        Мёртвые позиции <span style={{ fontSize: '.78rem', fontWeight: 500, color: 'var(--sk-muted)' }}>— ни одной продажи за {period} дней</span>
      </div>
      <div className="sk-card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--sk-ink)' }}>
            Позиций: <b>{deadRows.length}</b> · вложено: <b style={{ color: deadRows.length > 0 ? '#dc2626' : 'var(--sk-ink)' }}>{deadRows.reduce((s, r) => s + r.sumValue, 0).toLocaleString()} {cur}</b>
          </div>
          {deadRows.length > 0 && (
            <button type="button" className={'f-pill' + (showDead ? ' on' : '')} onClick={() => setShowDead(!showDead)}>
              {showDead ? 'Скрыть список' : 'Показать список'} <span className="car-tri" style={{ transform: showDead ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
          )}
        </div>
        {showDead && deadRows.length > 0 && (
          <div style={{ marginTop: '.6rem', borderTop: '1px solid rgba(29,120,252,.14)', paddingTop: '.5rem' }}>
            {deadRows.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.45rem .55rem', borderRadius: '.5rem', fontSize: '.8rem', color: '#5b6472' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dfe6f2', flexShrink: 0 }}></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{r.qty} шт</span>
                <span style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#111' }}>{r.sumValue.toLocaleString()} {cur}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
