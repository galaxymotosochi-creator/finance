import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import { tzToday, tzOffsetDate } from '../../lib/dates';
import CenterSpinner from '../../components/CenterSpinner';

const r2 = (n) => (Math.round((Number(n) || 0) * 100) / 100);
const pct = (part, whole) => {
  if (!whole) return '—';
  const v = r2((part / whole) * 100);
  return (v > 0 ? '' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%';
};

const META = {
  product: { title: 'Продажи по товарам', sub: 'Только товары — продажи, себестоимость и маржинальность за период', cols: 9 },
  service: { title: 'Продажи по услугам', sub: 'Только услуги — оказание и выручка за период', cols: 9 },
  combo:   { title: 'Продажи по комбо',   sub: 'Комплекты целиком — выручка, себестоимость состава и прибыль', cols: 9 },
};

export default function TradeReport() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const kind = new URLSearchParams(window.location.search).get('kind') || 'product';
  const [from, setFrom] = useState(() => { const t = tzToday(); return t.slice(0, 8) + '01'; });
  const [to, setTo] = useState(() => tzToday());
  const [period, setPeriod] = useState('month');
  const [periodLabel, setPeriodLabel] = useState('Этот месяц');
  const [showPeriod, setShowPeriod] = useState(false);
  const periodWrapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ qty: 0, sum: 0, cost: 0 });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const prRes = await supabase.from('products').select('id,name,sku,barcode,type,combo_items').eq('user_id', user.id);
      const prList = prRes.data || [];
      const supRes = await supabase.from('supplies').select('items').eq('user_id', user.id);

      const { data: recs } = await supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', from).lte('date', to).order('created_at', { ascending: false });
      const rlist = recs || [];
      let itList = [];
      if (rlist.length > 0) {
        const { data: items } = await supabase.from('receipt_items').select('id,receipt_id,product_id,product_name,quantity,total').in('receipt_id', rlist.map(r => r.id));
        itList = items || [];
      }

      // Средняя себестоимость за шт из поставок
      const costTotals = {};
      (supRes.data || []).forEach(sp => (sp.items || []).forEach(it => {
        const pid = String(it.prodId);
        if (!pid) return;
        if (!costTotals[pid]) costTotals[pid] = { qty: 0, cost: 0 };
        costTotals[pid].qty += Number(it.qty) || 0;
        costTotals[pid].cost += (Number(it.cost) || 0) * (Number(it.qty) || 0);
      }));
      const avgCost = {};
      Object.entries(costTotals).forEach(([id, v]) => { if (v.qty > 0) avgCost[id] = v.cost / v.qty; });
      // Себестоимость комбо = сумма себестоимости элементов состава (combo_items: {id,name,price,qty})
      const comboCost = {};
      (prList || []).forEach(p => {
        if (p.type !== 'combo' || !p.combo_items || !p.combo_items.length) return;
        let c = 0;
        (p.combo_items || []).forEach(ci => { c += (avgCost[String(ci.id)] || 0) * (Number(ci.qty) || 1); });
        comboCost[String(p.id)] = c;
      });

      const byId = {};
      prList.forEach(p => { byId[String(p.id)] = p; });

      // Агрегируем по продукту. cls: 1="товар", 2="услуга", 3="комбо" (по типу товара из карточки)
      const agg = {};
      const ensure = (pid) => {
        const pidKey = pid != null ? String(pid) : '';
        if (!agg[pidKey]) agg[pidKey] = { pidKey, qty: 0, sum: 0, cost: 0 };
        return agg[pidKey];
      };
      const cls = (p) => p ? (p.type === 'combo' ? 3 : p.type === 'service' ? 2 : 1) : 1;

      const recById = {};
      rlist.forEach(r => { recById[r.id] = r; });

      itList.forEach(it => {
        const r = recById[it.receipt_id];
        const pid = it.product_id != null ? String(it.product_id) : null;
        const pr = pid != null && pid !== '' && byId[pid] ? byId[pid] : null;
        if (!pr) return; // позиции без товара в карточке игнорируем
        if (cls(pr) !== (kind === 'product' ? 1 : kind === 'service' ? 2 : 3)) return;

        const qtySales = Number(it.quantity) || 0;
        const totalSales = Number(it.total) || 0;
        // Возвраты по позиции
        let retQty = 0, retSum = 0;
        if (r && (r.refund_items || []).length) {
          const unit = qtySales > 0 ? totalSales / qtySales : 0;
          (r.refund_items || []).forEach(rf => {
            if (rf.item_id == null || String(rf.item_id) !== String(it.id)) return;
            const rq = Number(rf.qty) || 0;
            if (rq <= 0) return;
            retQty += rq;
            retSum += unit * rq;
          });
        }
        const qtyNet = Math.max(0, qtySales - retQty);
        if (qtyNet <= 0) return;
        const totalNet = Math.max(0, totalSales - retSum);
        const row = ensure(pid);
        row.qty += qtyNet;
        row.sum += totalNet;
        // Себестоимость проданного
        const unitCost = cls(pr) === 3 ? comboCost[String(pr.id)] || 0 : avgCost[String(pr.id)] || 0;
        row.cost += unitCost * qtyNet;
        row._pr = pr;
      });

      // Выручка товара/услуги/комбо как есть; но если вид не товар — колонки штрихкода мы не обязаны, оставлю по желанию
      const list = Object.values(agg).filter(x => x.qty > 0).map(row => {
        const p = row._pr;
        return {
          pidKey: row.pidKey,
          name: p ? p.name : '—',
          sku: p ? (p.sku || '') : '',
          barcode: p ? (p.barcode || '') : '',
          qty: r2(row.qty),
          sum: r2(row.sum),
          cost: r2(row.cost),
          profit: r2(row.sum - row.cost),
        };
      }).sort((a, b) => b.sum - a.sum);

      const T = list.reduce((s, x) => ({ qty: s.qty + x.qty, sum: s.sum + x.sum, cost: s.cost + x.cost }), { qty: 0, sum: 0, cost: 0 });
      setRows(list);
      setTotals(T);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to, kind]);

  const applyPeriod = (k) => {
    setPeriod(k);
    if (k === 'all') { setFrom('2000-01-01'); setTo('2999-12-31'); setPeriodLabel('Все время'); return; }
    if (k === 'today') { setTo(tzToday()); setFrom(tzToday()); setPeriodLabel('Сегодня'); return; }
    if (k === 'yesterday') { setTo(tzToday()); setFrom(tzOffsetDate(1)); setPeriodLabel('Вчера'); return; }
    if (k === 'week') { setTo(tzToday()); setFrom(tzOffsetDate(7)); setPeriodLabel('7 дней'); return; }
    if (k === 'month30') { setTo(tzToday()); setFrom(tzOffsetDate(30)); setPeriodLabel('30 дней'); return; }
    if (k === 'month') { const t = tzToday(); setTo(t); setFrom(t.slice(0, 8) + '01'); setPeriodLabel('Этот месяц'); return; }
  };

  useEffect(() => {
    if (!showPeriod) return;
    const handler = (e) => {
      const m = periodWrapRef.current;
      if (m && m.contains(e.target)) return;
      setShowPeriod(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showPeriod]);

  const meta = META[kind] || META.product;
  const tProfit = totals.sum - totals.cost;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{meta.title}</h1>
          <div className="sub">{meta.sub}</div>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.3rem', marginBottom: '.6rem', flexWrap: 'wrap', position: 'relative' }}>
        <div ref={periodWrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          <span className="stock-filter-link"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '.28rem .6rem', fontSize: '.72rem', color: '#555', cursor: 'pointer', border: '1px solid #e0e0e4', borderRadius: '100px', lineHeight: 1, whiteSpace: 'nowrap', background: '#fff' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#999'; e.currentTarget.style.color = '#111'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e4'; e.currentTarget.style.color = '#555'; }}
            onClick={e => { e.stopPropagation(); setShowPeriod(!showPeriod); }}>{periodLabel}</span>
          {showPeriod && (
            <div onClick={e => e.stopPropagation()} style={{ display: 'block', position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--body-bg)', border: '1px solid var(--border)', borderRadius: '.6rem', boxShadow: '0 .3rem .8rem rgba(0,0,0,.1)', minWidth: '210px', padding: '.35rem', zIndex: 100 }}>
              {[{ key: 'all', label: 'Все время' }, { key: 'today', label: 'Сегодня' }, { key: 'yesterday', label: 'Вчера' }, { key: 'week', label: '7 дней' }, { key: 'month30', label: '30 дней' }, { key: 'month', label: 'Этот месяц' }].map(p => {
                const isActive = period === p.key;
                return (
                  <div key={p.key} onClick={() => { applyPeriod(p.key); setShowPeriod(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '.35rem', padding: '.3rem .5rem', borderRadius: 4, cursor: 'pointer', fontSize: '.78rem', color: '#555', background: 'transparent' }}>
                    <input type="checkbox" checked={isActive} onChange={() => {}} style={{ cursor: 'pointer', margin: 0 }} />
                    {p.label}
                  </div>
                );
              })}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '.35rem', marginTop: '.15rem' }}>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', padding: '.2rem .5rem', marginBottom: '.25rem' }}>Свой период</div>
                <div style={{ display: 'flex', gap: '.25rem', padding: '.25rem .5rem' }}>
                  <input type="date" value={from === '2000-01-01' ? '' : from} onChange={e => setFrom(e.target.value)} style={{ flex: 1, fontSize: '.72rem', padding: '.2rem', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font)', outline: 'none' }} />
                  <input type="date" value={to === '2999-12-31' ? '' : to} onChange={e => setTo(e.target.value)} style={{ flex: 1, fontSize: '.72rem', padding: '.2rem', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font)', outline: 'none' }} />
                </div>
                <div style={{ padding: '.25rem .5rem' }}>
                  <button onClick={() => { if (!from || !to) return alert('Выберите обе даты'); setPeriod('custom'); setPeriodLabel(from.split('-').reverse().join('.') + ' — ' + to.split('-').reverse().join('.')); setShowPeriod(false); }}
                    style={{ width: '100%', padding: '.35rem .5rem', fontSize: '.75rem', fontFamily: 'var(--font)', background: 'var(--secondary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Применить</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <CenterSpinner />
      ) : rows.length === 0 ? (
        <div className="empty-products" style={{ marginTop: '1.5rem' }}>
          <div className="big-icon">📊</div>
          <p>За этот период нет продаж {kind === 'combo' ? 'комбо' : kind === 'service' ? 'услуг' : 'товаров'}</p>
        </div>
      ) : (
        <div className="product-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table">
            <thead id="colHeaders">
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 0 }}>Наименование</th>
                {kind !== 'combo' && <th style={{ textAlign: 'left' }}>Штрихкод</th>}
                {kind !== 'combo' && <th style={{ textAlign: 'left' }}>Артикул</th>}
                {kind === 'combo' && <th style={{ textAlign: 'left' }}>Состав</th>}
                <th style={{ textAlign: 'left' }}>Выручка</th>
                <th style={{ textAlign: 'left' }}>Себестоимость продаж</th>
                <th style={{ textAlign: 'left' }}>Прибыль</th>
                <th style={{ textAlign: 'left' }}>Продано</th>
                <th style={{ textAlign: 'left' }}>Рентабельность</th>
                <th style={{ textAlign: 'left' }}>Маржинальность</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const pr = p._pr;
                const comboStr = (pr && pr.combo_items && pr.combo_items.length) ? pr.combo_items.map(c => (c.name || '') + ' x' + (Number(c.qty) || 1)).join(', ') : '—';
                return (
                  <tr key={p.pidKey ? p.pidKey : i}>
                    <td style={{ textAlign: 'left', paddingLeft: 0 }}>
                      <span className="prod-name">{p.name}</span>
                    </td>
                    {kind !== 'combo' && <td style={{ textAlign: 'left', color: '#555', whiteSpace: 'nowrap' }}>{p.barcode || '—'}</td>}
                    {kind !== 'combo' && <td style={{ textAlign: 'left', color: '#555', whiteSpace: 'nowrap' }}>{p.sku || '—'}</td>}
                    {kind === 'combo' && <td style={{ textAlign: 'left', color: '#888', fontSize: '.72rem', maxWidth: 220 }}>{comboStr}</td>}
                    <td style={{ textAlign: 'left', color: '#555' }}>{p.sum.toLocaleString()} {cur}</td>
                    <td style={{ textAlign: 'left', color: '#555' }}>{p.cost ? p.cost.toLocaleString() + ' ' + cur : '—'}</td>
                    <td style={{ textAlign: 'left', color: p.profit >= 0 ? '#228b22' : '#c0392b', fontWeight: 600 }}>{p.profit >= 0 ? p.profit.toLocaleString() : '−' + Math.abs(p.profit).toLocaleString()} {cur}</td>
                    <td style={{ textAlign: 'left', color: '#555' }}>{p.qty.toLocaleString()}</td>
                    <td style={{ textAlign: 'left', color: '#555' }}>{pct(p.profit, p.cost)}</td>
                    <td style={{ textAlign: 'left', color: '#555' }}>{pct(p.profit, p.sum)}</td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="total-row">
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left', paddingLeft: 0 }}>Итого:</td>
                  {kind !== 'combo' && <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>—</td>}
                  {kind !== 'combo' && <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>—</td>}
                  {kind === 'combo' && <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>—</td>}
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.sum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.cost.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: tProfit >= 0 ? '#222' : '#c0392b', textAlign: 'left' }}>{tProfit >= 0 ? tProfit.toLocaleString() : '−' + Math.abs(tProfit).toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.qty.toLocaleString()}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{pct(tProfit, totals.cost)}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{pct(tProfit, totals.sum)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
