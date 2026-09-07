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
// Подпись месяца — «Сентябрь», для прошлых лет добавляется год
const MYEARS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MYEARSGen = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const monthKey = (ds) => {
  const p = String(ds).split('T')[0].split('-');
  if (p.length < 3) return '';
  return p[0] + '-' + p[1]; // yyyy-mm
};
const monthLabel = (mk) => {
  const p = mk.split('-');
  if (p.length !== 2) return mk;
  const y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1;
  const cap = (MYEARS[m] || '');
  const name = cap ? cap.charAt(0).toUpperCase() + cap.slice(1) : mk;
  return name + (y !== new Date().getFullYear() ? ' ' + y : '');
};

export default function MonthlyReport() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [from, setFrom] = useState(() => { const t = tzToday(); return t.slice(0, 8) + '01'; });
  const [to, setTo] = useState(() => tzToday());
  const [period, setPeriod] = useState('month');
  const [periodLabel, setPeriodLabel] = useState('Этот месяц');
  const [showPeriod, setShowPeriod] = useState(false);
  const periodWrapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const prRes = await supabase.from('products').select('id,type').eq('user_id', user.id);
      const prList = prRes.data || [];
      const supRes = await supabase.from('supplies').select('items').eq('user_id', user.id);

      const { data: recs } = await supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', from).lte('date', to).order('date', { ascending: true });
      const rlist = recs || [];
      let itList = [];
      if (rlist.length > 0) {
        const { data: items } = await supabase.from('receipt_items').select('id,receipt_id,product_id,product_name,quantity,total').in('receipt_id', rlist.map(r => r.id));
        itList = items || [];
      }

      // Средняя себестоимость за шт из поставок (по product_id)
      const avgCost = {};
      {
        const ct = {};
        (supRes.data || []).forEach(sp => (sp.items || []).forEach(it => {
          const pid = String(it.prodId);
          if (!pid) return;
          if (!ct[pid]) ct[pid] = { qty: 0, cost: 0 };
          ct[pid].qty += Number(it.qty) || 0;
          ct[pid].cost += (Number(it.cost) || 0) * (Number(it.qty) || 0);
        }));
        Object.entries(ct).forEach(([id, v]) => { if (v.qty > 0) avgCost[id] = v.cost / v.qty; });
      }
      // Тип товара (для комбо/услуг/товаров — себестоимость только товаров обычно из поставок)
      const typeById = {};
      prList.forEach(p => { typeById[String(p.id)] = p.type; });

      // Группируем по месяцу (ключ yyyy-mm). refund_items привязаны к item чека.
      const month = {}; // monthKey -> агрегаты
      const ensure = (mk) => {
        if (!month[mk]) month[mk] = {
          mk, salesSum: 0, retSum: 0, salesCost: 0, retCost: 0, salesQty: 0, retQty: 0,
        };
        return month[mk];
      };

      const byId = {};
      prList.forEach(p => { byId[String(p.id)] = p; });

      const recById = {};
      rlist.forEach(r => { recById[r.id] = r; });

      // Продажи: себестоимость закупки на ед.
      itList.forEach(it => {
        const r = recById[it.receipt_id];
        const ds = r ? String(r.date || '').split('T')[0] : '';
        if (!ds) return;
        const mk = monthKey(ds);
        if (!mk) return;
        const d = ensure(mk);
        const pid = it.product_id != null ? String(it.product_id) : null;
        const pr = pid && pid !== '' && byId[pid] ? byId[pid] : null;
        const unitCost = (pr && (avgCost[String(pr.id)] || 0)) || 0;
        const qtySales = Number(it.quantity) || 0;
        const totalSales = Number(it.total) || 0;
        d.salesQty += qtySales;
        d.salesSum += totalSales;
        d.salesCost += unitCost * qtySales;
      });

      // Возвраты: refund_items лежат на чеке
      const rowById = {};
      itList.forEach(it => { rowById[String(it.id)] = it; });
      rlist.forEach(r => {
        const ds = String(r.date || '').split('T')[0];
        if (!ds) return;
        const mk = monthKey(ds);
        if (!mk) return;
        const d = ensure(mk);
        const rf = ((r.refund_items) || []);
        if (!rf.length) return;
        rf.forEach(ri => {
          const it = rowById[String(ri.item_id)];
          const qty = Math.max(0, Number(ri.qty) || 0);
          const amount = Math.max(0, Number(ri.total) || 0);
          const pid = (it && it.product_id != null) ? String(it.product_id) : (ri.product_id != null ? String(ri.product_id) : null);
          const pr = pid && byId[pid] ? byId[pid] : null;
          const unitCost = (pr && (avgCost[String(pr.id)] || 0)) || 0;
          d.retQty += qty;
          d.retSum += amount;
          d.retCost += unitCost * qty;
        });
      });

      const list = Object.values(month).map(d => ({
        dk: d.mk,
        label: monthLabel(d.mk),
        salesSum: r2(d.salesSum),
        retSum: r2(d.retSum),
        salesCost: r2(d.salesCost),
        retCost: r2(d.retCost),
        salesQty: Math.round(d.salesQty * 100) / 100,
        retQty: Math.round(d.retQty * 100) / 100,
        profit: r2((d.salesSum - d.retSum) - (d.salesCost - d.retCost)),
      })).sort((a, b) => (a.dk < b.dk ? -1 : 1));

      // Рентабельность/маржинальность после прибыли (по нетто-показателям дня)
      list.forEach(x => {
        x.netSum = r2(x.salesSum - x.retSum);
        x.netCost = r2(x.salesCost - x.retCost);
        x.rent = pct(x.profit, x.netCost);
        x.margin = pct(x.profit, x.netSum);
      });

      const T = list.reduce((s, x) => ({
        salesSum: s.salesSum + x.salesSum, retSum: s.retSum + x.retSum,
        salesCost: s.salesCost + x.salesCost, retCost: s.retCost + x.retCost,
        salesQty: s.salesQty + x.salesQty, retQty: s.retQty + x.retQty, profit: s.profit + x.profit,
      }), { salesSum: 0, retSum: 0, salesCost: 0, retCost: 0, salesQty: 0, retQty: 0, profit: 0 });
      setRows(list);
      setTotals(T);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

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

  // Прибыль-нетто (выручка минус себестоимость)
  const T = totals;
  const netSum = T.salesSum - T.retSum;
  const netCost = T.salesCost - T.retCost;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Продажи по месяцам</h1>
          <div className="sub">Продажи, возвраты и прибыль по каждому месяцу за период</div>
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
          <p>За этот период нет продаж</p>
        </div>
      ) : (
        <div className="product-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table">
            <thead id="colHeaders">
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 0 }}>Наименование</th>
                <th style={{ textAlign: 'left' }}>Сумма продаж</th>
                <th style={{ textAlign: 'left' }}>Сумма возврата</th>
                <th style={{ textAlign: 'left' }}>Себестоимость продаж</th>
                <th style={{ textAlign: 'left' }}>Себестоимость возвратов</th>
                <th style={{ textAlign: 'left' }}>Прибыль</th>
                <th style={{ textAlign: 'left' }}>Продажи</th>
                <th style={{ textAlign: 'left' }}>Возвраты продаж</th>
                <th style={{ textAlign: 'left' }}>Рентабельность</th>
                <th style={{ textAlign: 'left' }}>Маржинальность</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.dk + '_' + i}>
                  <td style={{ textAlign: 'left', paddingLeft: 0 }}>
                    <span className="prod-name">{p.label}</span>
                  </td>
                  <td style={{ textAlign: 'left', color: p.salesSum ? '#111' : '#999' }}>{p.salesSum.toLocaleString()} {cur}</td>
                  <td style={{ textAlign: 'left', color: p.retSum ? '#c0392b' : '#999' }}>{p.retSum ? '−' + p.retSum.toLocaleString() + ' ' + cur : '0 ' + cur}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{p.salesCost.toLocaleString()} {cur}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{p.retCost.toLocaleString()} {cur}</td>
                  <td style={{ textAlign: 'left', color: p.profit >= 0 ? '#228b22' : '#c0392b', fontWeight: 600 }}>{p.profit >= 0 ? p.profit.toLocaleString() : '−' + Math.abs(p.profit).toLocaleString()} {cur}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{p.salesQty ? p.salesQty.toLocaleString() : '0'}</td>
                  <td style={{ textAlign: 'left', color: p.retQty ? '#c0392b' : '#999' }}>{p.retQty ? p.retQty.toLocaleString() : '0'}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{p.rent}</td>
                  <td style={{ textAlign: 'left', color: '#555' }}>{p.margin}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="total-row">
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left', paddingLeft: 0 }}>Итого:</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{T.salesSum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{T.retSum ? '−' + T.retSum.toLocaleString() + ' ' + cur : '0 ' + cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{T.salesCost.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{T.retCost.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: T.profit >= 0 ? '#222' : '#c0392b', textAlign: 'left' }}>{T.profit >= 0 ? T.profit.toLocaleString() : '−' + Math.abs(T.profit).toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{T.salesQty.toLocaleString()}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{T.retQty.toLocaleString()}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{pct(T.profit, netCost)}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{pct(T.profit, netSum)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
