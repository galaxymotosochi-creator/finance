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

export default function ProductReport() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [from, setFrom] = useState(() => { const t = tzToday(); return t.slice(0, 8) + '01'; });
  const [to, setTo] = useState(() => tzToday());
  const [period, setPeriod] = useState('month');
  const [periodLabel, setPeriodLabel] = useState('Этот месяц');
  const [showPeriod, setShowPeriod] = useState(false);
  const periodWrapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [prods, setProds] = useState([]); // итоговые строки по товарам
  const [revenue, setRevenue] = useState(0);
  const [cost, setCost] = useState(0);
  const [qty, setQty] = useState(0);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Все товары (включая скрытые — по ним есть продажи) для маппинга id → product
      const prRes = await supabase.from('products').select('id,name,sku,barcode,type').eq('user_id', user.id);
      const prList = prRes.data || [];
      // Поставки — для расчёта средней себестоимости (как в PnL)
      const supRes = await supabase.from('supplies').select('items').eq('user_id', user.id);

      const { data: recs } = await supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', from).lte('date', to).order('created_at', { ascending: false });
      const rlist = recs || [];
      let itList = [];
      if (rlist.length > 0) {
        const { data: items } = await supabase.from('receipt_items').select('id,receipt_id,product_id,product_name,quantity,total').in('receipt_id', rlist.map(r => r.id));
        itList = items || [];
      }

      // Средняя себестоимость за шт: prodId -> avg (сумма закупок / количество), из поставок
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

      // Маппинг по product_id (и по product_name как запасной)
      const byId = {};
      prList.forEach(p => { byId[String(p.id)] = p; });

      const byProd = {}; // product_key -> агрегат
      const getKey = (pid, pname) => {
        if (pid != null && pid !== '' && byId[String(pid)]) return 'id:' + pid;
        if (pname) return 'name:' + pname;
        return 'id:';
      };
      const ensure = (key) => {
        if (!byProd[key]) byProd[key] = { key, qty: 0, sum: 0, cost: 0 };
        return byProd[key];
      };

      // Карта чеков (для возвратов refund_items по позициям)
      const recById = {};
      rlist.forEach(r => { recById[r.id] = r; });

      itList.forEach(it => {
        const r = recById[it.receipt_id];
        const pid = it.product_id != null ? String(it.product_id) : null;
        const pr = pid && byId[pid] ? byId[pid] : null;
        const key = getKey(pid, it.product_name);
        const row = ensure(key);
        const av = (pr ? avgCost[String(pr.id)] : null) || avgCost[pid] || 0;
        const qtySales = Number(it.quantity) || 0;
        const totalSales = Number(it.total) || 0; // итог позиции (с учётом скидки на позицию)
        // Возвраты по этой позиции (частичные/полные) — вычитаем из кол-ва и выручки
        let retQty = 0, retSum = 0;
        if (r && (r.refund_items || []).length) {
          const unit = qtySales > 0 ? totalSales / qtySales : 0;
          (r.refund_items || []).forEach(rf => {
            if (rf.item_id == null || String(rf.item_id) !== String(it.id)) return;
            const rq = Number(rf.qty) || 0;
            if (rq <= 0) return;
            retQty += rq;
            retSum += unit * rq; // возврат по средней цене единицы позиции
          });
        }
        const qtyNet = Math.max(0, qtySales - retQty);
        if (qtyNet <= 0) return;
        const totalNet = Math.max(0, totalSales - retSum);
        row.qty += qtyNet;
        row.sum += totalNet;
        row.cost += av * qtyNet; // себестоимость только по фактически проданному (без возвратов)
        row._pr = pr || row._pr;
      });

      const rows = Object.values(byProd).map(r => {
        const pr = r._pr;
        return {
          name: pr ? pr.name : (r.key.indexOf('name:') === 0 ? r.key.slice(5) : 'Товар'),
          barcode: pr ? (pr.barcode || '') : '',
          sku: pr ? (pr.sku || '') : '',
          type: pr ? pr.type : 'product',
          qty: r.qty,
          sum: rq(r.sum),
          cost: rq(r.cost),
          profit: rq(r.sum - r.cost),
        };
      });
      rows.sort((a, b) => b.sum - a.sum);

      const totQty = rows.reduce((s, x) => s + x.qty, 0);
      const totSum = rows.reduce((s, x) => s + x.sum, 0);
      const totCost = rows.reduce((s, x) => s + x.cost, 0);

      setProds(rows);
      setQty(totQty);
      setRevenue(totSum);
      setCost(totCost);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

  // период как в «Продажи по сотрудникам»
  const applyPeriod = (k) => {
    setPeriod(k);
    if (k === 'all') { setFrom('2000-01-01'); setTo('2999-12-31'); setPeriodLabel('Все время'); return; }
    if (k === 'today') { setTo(tzToday()); setFrom(tzToday()); setPeriodLabel('Сегодня'); return; }
    if (k === 'yesterday') { setTo(tzToday()); setFrom(tzOffsetDate(1)); setPeriodLabel('Вчера'); return; }
    if (k === 'week') { setTo(tzToday()); setFrom(tzOffsetDate(7)); setPeriodLabel('7 дней'); return; }
    if (k === 'month30') { setTo(tzToday()); setFrom(tzOffsetDate(30)); setPeriodLabel('30 дней'); return; }
    if (k === 'month') { const t = tzToday(); setTo(t); setFrom(t.slice(0, 8) + '01'); setPeriodLabel('Этот месяц'); return; }
  };

  // закрытие выпадающего меню периода при клике вне (как в «Продажи по сотрудникам»)
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

  const tProfit = revenue - cost;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Продажи по товарам</h1>
          <div className="sub">Продажи, себестоимость и маржинальность по товарам за период</div>
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
      ) : prods.length === 0 ? (
        <div className="empty-products" style={{ marginTop: '1.5rem' }}>
          <div className="big-icon">📊</div>
          <p>За этот период нет продаж товаров</p>
        </div>
      ) : (
        <div className="product-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table">
            <thead id="colHeaders">
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 0 }}>Наименование</th>
                <th style={{ textAlign: 'left' }}>Штрихкод</th>
                <th style={{ textAlign: 'left' }}>Артикул</th>
                <th style={{ textAlign: 'left' }}>Выручка</th>
                <th style={{ textAlign: 'left' }}>Себестоимость продаж</th>
                <th style={{ textAlign: 'left' }}>Прибыль</th>
                <th style={{ textAlign: 'left' }}>Продано</th>
                <th style={{ textAlign: 'left' }}>Рентабельность</th>
                <th style={{ textAlign: 'left' }}>Маржинальность</th>
              </tr>
            </thead>
            <tbody>
              {prods.map((p, i) => (
                <tr key={p.key ? p.key : i}>
                  <td style={{ textAlign: 'left', paddingLeft: 0 }}>
                    <span className="prod-name">{p.name}</span>
                  </td>
                  <td style={{ textAlign: 'left', color: '#555', whiteSpace: 'nowrap' }}>{p.barcode || '—'}</td>
                  <td style={{ textAlign: 'left', color: '#555', whiteSpace: 'nowrap' }}>{p.sku || '—'}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{p.sum.toLocaleString()} {cur}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{p.cost ? p.cost.toLocaleString() + ' ' + cur : '—'}</td>
                  <td style={{ textAlign: 'left', color: p.profit >= 0 ? '#228b22' : '#c0392b', fontWeight: 600 }}>{p.profit >= 0 ? p.profit.toLocaleString() : '−' + Math.abs(p.profit).toLocaleString()} {cur}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{p.qty.toLocaleString()}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{pct(p.profit, p.cost)}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{pct(p.profit, p.sum)}</td>
                </tr>
              ))}
              {prods.length > 0 && (
                <tr className="total-row">
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left', paddingLeft: 0 }}>Итого:</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>—</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>—</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{revenue.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{cost.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: tProfit >= 0 ? '#222' : '#c0392b', textAlign: 'left' }}>{tProfit >= 0 ? tProfit.toLocaleString() : '−' + Math.abs(tProfit).toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{qty.toLocaleString()}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{pct(tProfit, cost)}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{pct(tProfit, revenue)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// округление до копеек
function rq(n) { return Math.round((Number(n) || 0) * 100) / 100; }
