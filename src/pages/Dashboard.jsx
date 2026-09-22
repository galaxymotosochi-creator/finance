import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getCurrencySymbol } from '../lib/currency';
import CenterSpinner from '../components/CenterSpinner';

const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

// Иконки — 1-в-1 из бокового меню (src/components/Sidebar.jsx)
const SIDE_ICONS = {
  finance: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  registers: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="21" r="1" fill="#999"/><circle cx="20" cy="21" r="1" fill="#999"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
  stock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="19.5" r="1.5"/><circle cx="18.5" cy="19.5" r="1.5"/></svg>',
  clients: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4" fill="#999" opacity=".15"/></svg>',
  team: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4" fill="#999" opacity=".15"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
};

function locStr(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

export default function Dashboard() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [periodLabel, setPeriodLabel] = useState('Этот месяц');
  const [showPeriod, setShowPeriod] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);
  const [openRow, setOpenRow] = useState(null);
  const periodWrapRef = useRef(null);

  // Закрытие меню периода по клику вне (как в «Доходах и расходах»)
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

  const now = new Date();
  const todayLabel = now.getDate() + ' ' + MONTHS_GEN[now.getMonth()] + ' ' + now.getFullYear();

  // Диапазон дат — как в «Доходах и расходах»
  const getDateRange = () => {
    const n = new Date();
    const to = locStr(n);
    if (period === 'all') return { from: '2000-01-01', to: '2999-12-31' };
    if (period === 'today') return { from: to, to };
    if (period === 'yesterday') { const y = locStr(new Date(Date.now() - 86400000)); return { from: y, to: y }; }
    if (period === 'week') { const f = new Date(n); f.setDate(f.getDate() - 6); return { from: locStr(f), to }; }
    if (period === 'month') return { from: locStr(new Date(n.getFullYear(), n.getMonth(), 1)), to };
    if (period === 'month30') { const f = new Date(n); f.setDate(f.getDate() - 29); return { from: locStr(f), to }; }
    if (period === 'custom') return { from: customFrom || '2000-01-01', to: customTo || to };
    return { from: '2000-01-01', to: '2999-12-31' };
  };

  // Дата в шапке — по выбранному периоду (для «своёго» — диапазон, для «дня» — одна дата)
  const fmtRu = (d) => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  const headDate = (() => {
    if (period === 'all') return '';
    const r = getDateRange();
    const f = new Date((r.from === '2000-01-01' ? locStr(new Date()) : r.from) + 'T00:00:00');
    const t = new Date((r.to === '2999-12-31' ? locStr(new Date()) : r.to) + 'T00:00:00');
    if (locStr(f) === locStr(t)) return fmtRu(f);
    return fmtRu(f) + ' — ' + fmtRu(t);
  })();

  const applyPeriod = (k, label) => {
    setPeriod(k);
    if (label) setPeriodLabel(label);
    setShowPeriod(false);
  };

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const dr = getDateRange();
        const [{ data: txs }, { data: allTx }, { data: accts }, { data: debtClients }, { data: prods }, { data: supRaw }, { data: wo }, { data: recs }, { data: allClients }, { data: receiptsAll }, { data: initStock }] = await Promise.all([
          supabase.from('transactions').select('type,amount,category_id,status,account_id,date,kind,description').eq('user_id', user.id).gte('date', dr.from).lte('date', dr.to),
          supabase.from('transactions').select('type,amount,account_id,date,status,kind,description').eq('user_id', user.id),
          supabase.from('accounts').select('id,name,balance,type').eq('user_id', user.id),
          supabase.from('clients').select('name,debt').eq('user_id', user.id).not('debt', 'is', null).lt('debt', 0).order('debt', { ascending: true }),
          supabase.from('products').select('id,name,type,price,min_qty').eq('user_id', user.id).eq('hidden', false),
          supabase.from('supplies').select('items,status').eq('user_id', user.id),
          supabase.from('writeoffs').select('product_id,quantity').eq('user_id', user.id),
          supabase.from('receipts').select('id,total_amount,date,client_id').eq('user_id', user.id).gte('date', dr.from).lte('date', dr.to),
          supabase.from('clients').select('id').eq('user_id', user.id),
          supabase.from('receipts').select('total_amount,date,client_id').eq('user_id', user.id),
          supabase.from('initial_stocks').select('*').eq('user_id', user.id).maybeSingle(),
        ]);
        if (!alive) return;

        // Выручка / расходы за период
        let rev = 0, exp = 0;
        (txs || []).forEach(t => {
          const a = Number(t.amount) || 0;
          if (t.type === 'income' && (t.status === 'paid' || !t.status) && !t.kind) rev += a;
          else if (t.type === 'expense' && !t.kind) exp += a;
        });

        // Баланс счетов = начальный остаток + все транзакции
        const txById = {};
        (allTx || []).forEach(t => { txById[t.account_id] = (txById[t.account_id] || 0) + Number(t.amount || 0) * (t.type === 'income' ? 1 : -1); });
        const acctList = (accts || []).map(a => ({ name: a.name || a.type, type: a.type, id: a.id, balance: (parseFloat(a.balance) || 0) + (txById[a.id] || 0) }));
        const totalCash = acctList.reduce((s, a) => s + a.balance, 0);
        // Касса — все наличные: cash + cash_register (не теряем ни один счёт)
        const cashBal = acctList.filter(a => a.type === 'cash' || a.type === 'cash_register').reduce((s, a) => s + a.balance, 0);
        // На счетах — всё остальное (банк, расчётные, карты и т.п.)
        const bankBal = acctList.filter(a => a.type !== 'cash' && a.type !== 'cash_register').reduce((s, a) => s + a.balance, 0);

        // Себестоимость проданного (средняя себестоимость единицы из поставок)
        const costTotals = {};
        (supRaw || []).forEach(sp => (sp.items || []).forEach(it => {
          if (!costTotals[it.prodId]) costTotals[it.prodId] = { qty: 0, cost: 0 };
          costTotals[it.prodId].qty += it.qty || 0;
          costTotals[it.prodId].cost += (it.cost || 0) * (it.qty || 0);
        }));
        const costPerUnit = {};
        Object.entries(costTotals).forEach(([id, v]) => { if (v.qty > 0) costPerUnit[id] = v.cost / v.qty; });
        const prodIdMap = {};
        (prods || []).forEach(p => { prodIdMap[p.name] = p.id; });
        const rids = (recs || []).map(r => r.id);
        const { data: recItems } = rids.length ? (await supabase.from('receipt_items').select('product_name,quantity,total').in('receipt_id', rids)) : { data: [] };
        let cogs = 0;
        (recItems || []).forEach(item => {
          const pid = prodIdMap[item.product_name];
          if (pid && costPerUnit[pid]) cogs += (item.quantity || 0) * costPerUnit[pid];
        });
        const salesRev = (recs || []).reduce((s, r) => s + (Number(r.total_amount) || 0), 0);

        // Склад — как в разделе «Остатки»: поставки (без «Заказано») + начальные остатки − списания
        const sm = {};
        (supRaw || []).filter(sp => (sp.status || 'received') !== 'ordered').forEach(sp => (sp.items || []).forEach(it => {
          if (!it || !it.prodId) return;
          if (!sm[it.prodId]) sm[it.prodId] = { qty: 0, cost: 0 };
          sm[it.prodId].qty += it.qty || 0;
          sm[it.prodId].cost += (it.cost || 0) * (it.qty || 0);
        }));
        // Начальные остатки
        const init = initStock;
        if (init && init.done && init.items) {
          Object.keys(init.items).forEach(id => {
            const q = parseInt(init.items[id]) || 0;
            const c = (init.costs && parseInt(init.costs[id])) || 0;
            if (q > 0) {
              if (!sm[id]) sm[id] = { qty: 0, cost: 0 };
              sm[id].qty += q;
              sm[id].cost += c * q;
            }
          });
        }
        // Списания уменьшают остаток (и стоимость по средней)
        (wo || []).forEach(w => {
          const pid = w.product_id;
          if (pid != null && sm[pid]) {
            const avg = sm[pid].qty > 0 ? sm[pid].cost / sm[pid].qty : 0;
            sm[pid].qty -= w.quantity || 0;
            sm[pid].cost -= avg * (w.quantity || 0);
          }
        });
        const deficit = (prods || [])
          .filter(p => p.type !== 'service' && p.type !== 'combo' && p.min_qty > 0)
          .map(p => ({ name: p.name, qty: sm[p.id]?.qty || 0, min: p.min_qty, need: Math.max(0, p.min_qty - (sm[p.id]?.qty || 0)) }))
          .filter(p => p.qty < p.min).sort((a, b) => (a.qty / a.min) - (b.qty / b.min));
        const stockCost = Object.values(sm).reduce((s, v) => s + Math.max(0, v.cost), 0);
        const stockRetail = (prods || []).reduce((s, p) => s + (Math.max(0, sm[p.id]?.qty || 0) * (p.price || 0)), 0);
        const stockPositions = (prods || []).filter(p => p.type !== 'service' && p.type !== 'combo').length;
        const lowStockCount = deficit.length;

        // Клиенты
        const debt = Math.abs((debtClients || []).reduce((s, c) => s + (c.debt || 0), 0));
        const totalClients = (allClients || []).length;
        const buyCount = {};
        (receiptsAll || []).forEach(r => { if (r.client_id) buyCount[r.client_id] = (buyCount[r.client_id] || 0) + 1; });
        const repeatClients = totalClients > 0 ? Math.round(Object.values(buyCount).filter(c => c >= 2).length / totalClients * 100) : 0;

        // Выручка по дням (или по месяцам при периоде «год»)
        const recAll = (receiptsAll || []).map(r => ({ d: String(r.date || '').slice(0, 10), amt: Number(r.total_amount) || 0, ts: (r.created_at || r.date || '') }));
        const sumR = (a, b) => recAll.filter(r => r.d >= a && r.d <= b).reduce((s, r) => s + r.amt, 0);
        const tStr = locStr(new Date());
        const cmp = {
          today: sumR(tStr, tStr),
          yesterday: sumR(locStr(new Date(Date.now() - 86400000)), locStr(new Date(Date.now() - 86400000))),
          week: sumR(locStr(new Date(Date.now() - 6 * 86400000)), tStr),
          month: sumR(locStr(new Date(now.getFullYear(), now.getMonth(), 1)), tStr),
          year: sumR(now.getFullYear() + '-01-01', tStr),
        };

        // ГРАФИК: шаг столбца зависит от длины периода
        // день → часы, неделя/30 дней/месяц → дни, 3 мес → недели, год → месяцы,
        // всё время ≤ 24 мес → месяцы, иначе → годы. Свой период — по длине.
        let bars = [];
        let barsTotal = 0;
        let barsTitle = 'Выручка по дням';
        const rng = getDateRange();
        const fromD = new Date(rng.from + 'T00:00:00');
        const toD = new Date((rng.to === '2999-12-31' ? locStr(new Date()) : rng.to) + 'T00:00:00');
        const dayCount = Math.max(1, Math.round((toD - fromD) / 86400000) + 1);
        const MONTHS_SHORT_LOC = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
        const sumR2 = (a, b) => recAll.filter(r => r.d >= a && r.d <= b).reduce((s, r) => s + r.amt, 0);
        const add = (label, tip, a, b) => { const v = sumR2(a, b); bars.push({ label, tip, val: v }); };

        if (period === 'today' || period === 'yesterday') {
          // по часам: сгруппируем выручку дня по 3-часовым интервалам (по дате — сутки)
          const day = locStr(fromD);
          // Реальные часы: берём время чека (created_at). Если времени нет — график пустой, без заглушек
          const dayRecs = recAll.filter(r => r.d === day);
          const hasTime = dayRecs.some(r => String(r.ts).indexOf('T') > -1 && String(r.ts).indexOf(':') > -1);
          if (hasTime) {
            const hourly = new Array(24).fill(0);
            dayRecs.forEach(r => {
              const dt = new Date(r.ts);
              if (!isNaN(dt.getTime())) { const hh = dt.getHours(); if (hh >= 0 && hh < 24) hourly[hh] += r.amt; }
            });
            for (let h = 0; h < 24; h++) {
              const v = hourly[h];
              bars.push({ label: (h % 2 === 0 ? h : ''), tip: String(h).padStart(2, '0') + ':00 ' + v.toLocaleString('ru-RU') + ' ' + cur, val: v });
            }
          } else {
            // Времени нет — строим пустые часовые колонки (без выдуманных сумм)
            for (let h = 0; h < 24; h++) {
              bars.push({ label: (h % 2 === 0 ? h : ''), tip: String(h).padStart(2, '0') + ':00 0 ' + cur, val: 0 });
            }
          }
          barsTitle = 'Выручка по часам';
        } else if (dayCount <= 31) {
          // по дням
          for (let i = 0; i < dayCount; i++) {
            const dt = new Date(fromD); dt.setDate(dt.getDate() + i);
            const ds = locStr(dt);
            const v = sumR2(ds, ds);
            bars.push({ label: dt.getDate(), tip: dt.getDate() + '.' + String(dt.getMonth() + 1).padStart(2, '0') + ' ' + v.toLocaleString('ru-RU') + ' ' + cur, val: v });
          }
          barsTitle = 'Выручка по дням';
        } else if (dayCount <= 120) {
          // по неделям
          for (let i = 0; i < dayCount; i += 7) {
            const a = new Date(fromD); a.setDate(a.getDate() + i);
            const b = new Date(a); b.setDate(b.getDate() + 6);
            const bs = locStr(b > toD ? toD : b);
            const v = sumR2(locStr(a), bs);
            bars.push({ label: a.getDate() + '.' + (a.getMonth() + 1), tip: locStr(a).split('-').reverse().join('.') + ' — ' + bs.split('-').reverse().join('.') + ' ' + v.toLocaleString('ru-RU') + ' ' + cur, val: v });
          }
          barsTitle = 'Выручка по неделям';
        } else if (period === 'all') {
          // всё время: ≤ 24 месяцев → по месяцам, иначе → по годам
          const monthsSpan = (toD.getFullYear() - fromD.getFullYear()) * 12 + (toD.getMonth() - fromD.getMonth()) + 1;
          if (monthsSpan <= 24) {
            for (let i = 0; i < monthsSpan; i++) {
              const a = new Date(fromD.getFullYear(), fromD.getMonth() + i, 1);
              const b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
              const bs = locStr(b > toD ? toD : b);
              const v = sumR2(locStr(a), bs);
              bars.push({ label: MONTHS_SHORT_LOC[a.getMonth()], tip: MONTHS_SHORT_LOC[a.getMonth()] + ' ' + a.getFullYear() + ' ' + v.toLocaleString('ru-RU') + ' ' + cur, val: v });
            }
            barsTitle = 'Выручка по месяцам';
          } else {
            const y1 = fromD.getFullYear(), y2 = toD.getFullYear();
            for (let yr = y1; yr <= y2; yr++) {
              const a = yr + '-01-01', b = yr + '-12-31';
              const v = sumR2(a, b);
              bars.push({ label: yr, tip: yr + ' ' + v.toLocaleString('ru-RU') + ' ' + cur, val: v });
            }
            barsTitle = 'Выручка по годам';
          }
        } else if (dayCount <= 400) {
          // по месяцам (год и подобные)
          const monthsSpan = (toD.getFullYear() - fromD.getFullYear()) * 12 + (toD.getMonth() - fromD.getMonth()) + 1;
          for (let i = 0; i < monthsSpan; i++) {
            const a = new Date(fromD.getFullYear(), fromD.getMonth() + i, 1);
            const b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
            const bs = locStr(b > toD ? toD : b);
            const v = sumR2(locStr(a), bs);
            bars.push({ label: MONTHS_SHORT_LOC[a.getMonth()], tip: MONTHS_SHORT_LOC[a.getMonth()] + ' ' + a.getFullYear() + ' ' + v.toLocaleString('ru-RU') + ' ' + cur, val: v });
          }
          barsTitle = 'Выручка по месяцам';
        } else {
          const y1 = fromD.getFullYear(), y2 = toD.getFullYear();
          for (let yr = y1; yr <= y2; yr++) {
            const v = sumR2(yr + '-01-01', yr + '-12-31');
            bars.push({ label: yr, tip: yr + ' ' + v.toLocaleString('ru-RU') + ' ' + cur, val: v });
          }
          barsTitle = 'Выручка по годам';
        }
        barsTotal = bars.reduce((s, b) => s + b.val, 0);
        const barsMax = Math.max(1, ...bars.map(b => b.val));

        // Свои деньги владельца
        let ownerIn = 0, ownerOut = 0;
        (allTx || []).forEach(t => {
          if (t.kind === 'owner_deposit') ownerIn += Number(t.amount || 0);
          else if (t.kind === 'owner_withdraw') ownerOut += Number(t.amount || 0);
        });
        if (ownerIn === 0 && ownerOut === 0) {
          (allTx || []).forEach(t => {
            const dd = (t.description || '');
            if (dd.startsWith('Взнос своих денег')) ownerIn += Number(t.amount || 0);
            else if (dd.startsWith('Вывод своих денег')) ownerOut += Number(t.amount || 0);
          });
        }

        // Зарплата
        const { data: employees } = await supabase.from('employees').select('id,salary').eq('user_id', user.id);
        const salaryAccrued = (employees || []).reduce((s, e) => s + (Number(e.salary) || 0), 0);
        const empCount = (employees || []).length;

        // Категории расходов
        const ce = {};
        (txs || []).filter(t => t.type === 'expense' && !t.kind).forEach(t => { const k = t.category_id || 'other'; ce[k] = (ce[k] || 0) + (Number(t.amount) || 0); });
        const { data: catNames } = await supabase.from('categories').select('id,name').eq('user_id', user.id);
        const cm = {};
        (catNames || []).forEach(c => { cm[c.id] = c.name; });

        // Продажи: средний чек, топ товаров
        const avgCheck = (recs || []).length > 0 ? Math.round(salesRev / recs.length) : 0;
        const sold = (recItems || []).reduce((s, i) => s + (i.quantity || 0), 0);
        const top = {};
        (recItems || []).forEach(i => { const n = i.product_name || 'Товар'; if (!top[n]) top[n] = { qty: 0, rev: 0 }; top[n].qty += i.quantity || 0; top[n].rev += i.total || 0; });
        const topProducts = Object.entries(top).sort((a, b) => b[1].rev - a[1].rev).slice(0, 3).map(([n, v]) => ({ name: n, qty: v.qty, rev: v.rev }));

        // Касса = выручка за выбранный период (чеки + быстрые продажи)
        const periodRev = (recs || []).reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
        const drDays = (() => {
          const f = new Date((dr.from === '2000-01-01' ? locStr(new Date()) : dr.from) + 'T00:00:00');
          const t = new Date((dr.to === '2999-12-31' ? locStr(new Date()) : dr.to) + 'T00:00:00');
          return Math.max(1, Math.round((t - f) / 86400000) + 1);
        })();
        // Прогноз: выручка за отработанные дни / кол-во дней × 30. Показываем при периоде ≥ 3 дней
        const showForecast = drDays >= 3;
        const cashForecast = showForecast ? Math.round(periodRev / drDays * 30) : 0;
        const periodRevTotal = periodRev;

        if (!alive) return;
        setData({
          rev, exp, profit: rev - exp, salesRev, cogs,
          cashBal, bankBal, totalCash, acctList, cashForecast, showForecast, periodRevTotal,
          debt, debtors: debtClients || [], totalClients, repeatClients,
          deficit, stockCost, stockRetail, stockPositions, lowStockCount,
          bars, barsTotal, barsMax, barsTitle, cmp,
          monthRev: cmp.month, monthProfit: (cmp.month - (exp || 0)),
          avgCheck, sold, buyers: (recs || []).length, topProducts,
          ownerIn, ownerOut, ownerNet: ownerIn - ownerOut,
          salaryAccrued, empCount,
          expensesByCat: ce, catMap: cm,
        });
      } catch (e) { console.error('Dashboard error:', e); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, period, customFrom, customTo]);

  const d = data;
  if (loading) return <CenterSpinner />;
  if (!d) return <div className="dash-empty">Нет данных</div>;

  const profitPct = d.rev > 0 ? Math.round(d.profit / d.rev * 100) : 0;
  const prevMonthRev = d.bars ? d.bars.slice(0, -1).reduce((s, b) => s + b.val, 0) : 0;

  const subSections = [
    {
      key: 'finance', icon: 'finance', name: 'Финансы', desc: 'Выручка, расходы, прибыль',
      right: { v: `${(d.profit || 0).toLocaleString('ru-RU')} ${cur}`, s: 'прибыль' },
      items: [
        { l: 'Выручка', v: `${(d.rev || 0).toLocaleString('ru-RU')} ${cur}` },
        { l: 'Расходы', v: `${(d.exp || 0).toLocaleString('ru-RU')} ${cur}`, c: 'bad' },
        { l: 'Чистая прибыль', v: `${(d.profit || 0).toLocaleString('ru-RU')} ${cur}`, c: d.profit >= 0 ? 'good' : 'bad' },
        { l: 'Рентабельность', v: `${profitPct}%` },
      ],
    },
    {
      key: 'accounts', icon: 'registers', name: 'Счета', desc: 'Касса, банк, резерв',
      right: { v: `${(d.totalCash || 0).toLocaleString('ru-RU')} ${cur}`, s: 'всего' },
      items: [
        ...(d.acctList || []).map(a => ({ l: a.name, v: `${(a.balance || 0).toLocaleString('ru-RU')} ${cur}`, c: a.balance < 0 ? 'bad' : null })),
        ...((d.acctList || []).length === 0 ? [{ l: 'Счетов нет', v: '—' }] : []),
      ],
    },
    {
      key: 'stock', icon: 'stock', name: 'Склад', desc: 'Товарный запас',
      right: { v: `${(d.stockCost || 0).toLocaleString('ru-RU')} ${cur}`, s: 'по себестоимости' },
      items: [
        { l: 'Позиций всего', v: String(d.stockPositions || 0) },
        { l: 'На исходе (меньше нормы)', v: String((d.deficit || []).length), c: (d.deficit || []).length > 0 ? 'bad' : null },
        { l: 'Себестоимость запаса', v: `${(d.stockCost || 0).toLocaleString('ru-RU')} ${cur}` },
        { l: 'В продаже (розница)', v: `${(d.stockRetail || 0).toLocaleString('ru-RU')} ${cur}` },
      ],
    },
    {
      key: 'clients', icon: 'clients', name: 'Клиенты', desc: 'База, долги',
      right: { v: String(d.totalClients || 0), s: `долги ${(d.debt || 0).toLocaleString('ru-RU')} ${cur}` },
      items: [
        { l: 'Клиентов в базе', v: String(d.totalClients || 0) },
        { l: 'Повторные покупки', v: `${d.repeatClients || 0}%`, c: 'good' },
        { l: 'С задолженностью', v: String((d.debtors || []).length), c: (d.debtors || []).length > 0 ? 'bad' : null },
        { l: 'Сумма долгов', v: `${(d.debt || 0).toLocaleString('ru-RU')} ${cur}`, c: d.debt > 0 ? 'bad' : null },
      ],
    },
    {
      key: 'salary', icon: 'team', name: 'Зарплата', desc: 'Начислено, сотрудники',
      right: { v: `${(d.salaryAccrued || 0).toLocaleString('ru-RU')} ${cur}`, s: 'оклад в месяц' },
      items: [
        { l: 'Сотрудников', v: String(d.empCount || 0) },
        { l: 'Начислено за месяц', v: `${(d.salaryAccrued || 0).toLocaleString('ru-RU')} ${cur}` },
      ],
    },
  ];

  const alerts = [];
  if ((d.debtors || []).length > 0) alerts.push(`${d.debtors.length} клиентов с общей задолженностью ${(d.debt || 0).toLocaleString('ru-RU')} ${cur}`);
  if ((d.deficit || []).length > 0) alerts.push(`${d.deficit.length} товаров на исходе — пора закупать`);
  if (d.cashBal < 0) alerts.push(`Касса в минусе на ${Math.abs(d.cashBal || 0).toLocaleString('ru-RU')} ${cur}`);

  return (
    <div className="dash">
      {/* ШАПКА */}
      <div className="dash-head">
        <div>
          <h1>Панель управления</h1>
          {headDate ? <div className="dash-date">{headDate}</div> : null}
        </div>
        <div className="dash-spacer" />
        <div className="sk-period-wrap" ref={periodWrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', borderRadius: '9999px', padding: '6px 6px', fontSize: '.76rem', fontWeight: 600, lineHeight: '18px', color: '#5b6472', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            onClick={e => { e.stopPropagation(); setShowPeriod(!showPeriod); }}>
            {periodLabel}
            <span className="car-tri">▾</span>
          </button>
          {showPeriod && (
            <div onClick={e => e.stopPropagation()} style={{ display: 'block', position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#fff', border: '1px solid rgba(29,120,252,.18)', borderRadius: '.85rem', boxShadow: '0 16px 40px -14px rgba(11,18,32,.3)', minWidth: '210px', padding: '.4rem', zIndex: 100 }}>
              {[{ key: 'all', label: 'Все время' }, { key: 'today', label: 'Сегодня' }, { key: 'yesterday', label: 'Вчера' }, { key: 'week', label: 'Эта неделя' }, { key: 'month30', label: '30 дней' }, { key: 'month', label: 'Этот месяц' }].map(p => {
                const isActive = period === p.key;
                return (
                  <div key={p.key} onClick={() => applyPeriod(p.key, p.label)}
                    style={{ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem .55rem', borderRadius: '.5rem', cursor: 'pointer', fontSize: '.8rem', color: isActive ? '#0d4ea8' : '#5b6472', fontWeight: isActive ? 700 : 500, background: isActive ? '#E6F0FF' : 'transparent' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? '#1F75FF' : '#dfe6f2', flexShrink: 0 }}></span>
                    {p.label}
                  </div>
                );
              })}
              <div style={{ borderTop: '1px solid rgba(29,120,252,.14)', paddingTop: '.4rem', marginTop: '.25rem' }}>
                <div style={{ fontSize: '.72rem', color: '#5b6472', padding: '.2rem .55rem', marginBottom: '.3rem', fontWeight: 600 }}>Свой период</div>
                <div style={{ display: 'flex', gap: '.3rem', padding: '.2rem .55rem' }}>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ flex: 1, minWidth: 0, fontSize: '.72rem', padding: '.3rem', border: '1px solid rgba(29,120,252,.18)', borderRadius: '.5rem', fontFamily: 'inherit', outline: 'none' }} />
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ flex: 1, minWidth: 0, fontSize: '.72rem', padding: '.3rem', border: '1px solid rgba(29,120,252,.18)', borderRadius: '.5rem', fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div style={{ padding: '.3rem .55rem 0', textAlign: 'center' }}>
                  <button onClick={() => { if (!customFrom || !customTo) return alert('Выберите обе даты'); applyPeriod('custom', customFrom.split('-').reverse().join('.') + ' — ' + customTo.split('-').reverse().join('.')); }}
                    className="sk-dd-btn" style={{ padding: '.5rem 1.1rem' }}>Применить</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ЖЁЛТАЯ ПЛАШКА ПРИБЫЛИ */}
      <div className="hero">
        <div className="lbl">Чистая прибыль за период</div>
        <div className="val">{(d.profit || 0).toLocaleString('ru-RU')} {cur}</div>
        <div className="delta" style={{ color: profitPct >= 0 ? '#1a7f37' : '#d9534f' }}>{profitPct >= 0 ? '▲' : '▼'} рентабельность {profitPct}%</div>
        <div className="chips">
          <div className="chip">Рентабельность <b>{profitPct}%</b></div>
          <div className="chip">Выручка <b>{(d.rev || 0).toLocaleString('ru-RU')} {cur}</b></div>
          <div className="chip">Расходы <b>{(d.exp || 0).toLocaleString('ru-RU')} {cur}</b></div>
        </div>
      </div>

      {/* ВЫРУЧКА СТОЛБЦАМИ */}
      <div className="card">
        <div className="card-h">
          <span className="t">{(d.barsTitle || 'Выручка по дням')}:&nbsp;{(d.barsTotal || 0).toLocaleString('ru-RU')} {cur}</span>
        </div>
        <div className="bars">
          {(d.bars || []).map((b, i) => {
            const h = Math.max(2, Math.round((b.val / (d.barsMax || 1)) * 100));
            const isPeak = b.val > 0 && b.val === d.barsMax;
            return (
              <div key={i} className={'bar' + (isPeak ? ' peak' : '')} style={{ height: h + '%' }}>
                <span className="tip">{b.tip}</span>
              </div>
            );
          })}
        </div>
        <div className="bar-x">
          {(d.bars || []).map((b, i) => <span key={i}>{b.label}</span>)}
        </div>
      </div>

      {/* KPI */}
      <div className="kpis">
        <div className="kpi">
          <div className="k-lbl">Касса</div>
          <div className="k-val">{(d.periodRevTotal || 0).toLocaleString('ru-RU')} {cur}</div>
          {d.showForecast ? (
            <div className='k-sub ok'>прогноз за месяц {(d.cashForecast || 0).toLocaleString('ru-RU')} {cur}</div>
          ) : (
            <div className="k-sub">выручка за период</div>
          )}
        </div>
        <div className="kpi">
          <div className="k-lbl">На счетах</div>
          <div className="k-val">{(d.totalCash || 0).toLocaleString('ru-RU')} {cur}</div>
          <div className="k-sub">{d.acctList ? d.acctList.length : 0} счёта</div>
        </div>
        <div className="kpi red">
          <div className="k-lbl">Долги клиентов</div>
          <div className="k-val">{(d.debt || 0).toLocaleString('ru-RU')} {cur}</div>
          <div className="k-sub warn">{(d.debtors || []).length} должников</div>
        </div>
        <div className="kpi yellow">
          <div className="k-lbl">Товарный запас</div>
          <div className="k-val">{(d.stockCost || 0).toLocaleString('ru-RU')} {cur}</div>
          <div className={'k-sub ' + ((d.lowStockCount || 0) > 0 ? 'warn' : 'ok')}>{(d.lowStockCount || 0) > 0 ? `${d.lowStockCount} ${d.lowStockCount === 1 ? 'позиция' : (d.lowStockCount < 5 ? 'позиции' : 'позиций')} пора закупать` : 'все позиции в норме'}</div>
        </div>
      </div>

      {/* ПОКАЗАТЕЛИ */}
      <div className="card">
        <div className="card-h"><span className="t">Показатели периода</span></div>
        <div className="metrics">
          <div className="metric"><div className="m-l">Прибыль</div><div className="m-v">{(d.profit || 0).toLocaleString('ru-RU')} {cur}</div><div className={'m-d ' + (d.profit >= 0 ? 'up' : 'down')}>{d.profit >= 0 ? '▲' : '▼'} {profitPct}%</div></div>
          <div className="metric"><div className="m-l">Средний чек</div><div className="m-v">{(d.avgCheck || 0).toLocaleString('ru-RU')} {cur}</div></div>
          <div className="metric"><div className="m-l">Выручка сегодня</div><div className="m-v">{(d.cmp?.today || 0).toLocaleString('ru-RU')} {cur}</div><div className="m-d up">&nbsp;</div></div>
          <div className="metric"><div className="m-l">Клиенты</div><div className="m-v">{d.totalClients || 0}</div><div className="m-d up">{d.repeatClients || 0}% повторных</div></div>
        </div>
      </div>

      {/* СВОД ПО РАЗДЕЛАМ */}
      <div className="card">
        <div className="card-h"><span className="t">Свод по разделам</span></div>
        <div className="list">
          {subSections.map(sec => (
            <div key={sec.key}>
              <div className={'row' + (openRow === sec.key ? ' open' : '')} onClick={() => setOpenRow(openRow === sec.key ? null : sec.key)}>
                <div className="ic" dangerouslySetInnerHTML={{ __html: SIDE_ICONS[sec.icon] }} />
                <div><div className="nm">{sec.name}</div><div className="ds">{sec.desc}</div></div>
                <div className="rt"><b>{sec.right.v}</b><span>{sec.right.s}</span></div>
                <div className="arr">▾</div>
              </div>
              <div className="sub">
                <div className="sub-in">
                  {sec.items.map((it, i) => (
                    <div key={i} className="sub-i">{it.l}<span className={'sv' + (it.c ? ' ' + it.c : '')}>{it.v}</span></div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ТРЕБУЕТ ВНИМАНИЯ */}
      {alerts.length > 0 && (
        <div className="alert">
          <div className="a-h">⚠ Требует внимания</div>
          <ul>{alerts.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
