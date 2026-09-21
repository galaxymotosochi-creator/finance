import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getCurrencySymbol } from '../lib/currency';
import CenterSpinner from '../components/CenterSpinner';

const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

function locStr(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

export default function Dashboard() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [openRow, setOpenRow] = useState(null);

  const now = new Date();
  const todayLabel = now.getDate() + ' ' + MONTHS_GEN[now.getMonth()] + ' ' + now.getFullYear();

  // Диапазон дат для выбранного периода
  const getDateRange = () => {
    const n = new Date();
    const to = locStr(n);
    if (period === 'day') return { from: to, to };
    if (period === 'week') { const f = new Date(n); f.setDate(f.getDate() - 6); return { from: locStr(f), to }; }
    if (period === 'month') return { from: locStr(new Date(n.getFullYear(), n.getMonth(), 1)), to };
    if (period === 'quarter') { const q = Math.floor(n.getMonth() / 3); return { from: locStr(new Date(n.getFullYear(), q * 3, 1)), to }; }
    return { from: locStr(new Date(n.getFullYear(), 0, 1)), to }; // year
  };

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const dr = getDateRange();
        const [{ data: txs }, { data: allTx }, { data: accts }, { data: debtClients }, { data: prods }, { data: supRaw }, { data: wo }, { data: recs }, { data: allClients }, { data: receiptsAll }] = await Promise.all([
          supabase.from('transactions').select('type,amount,category_id,status,account_id,date,kind,description').eq('user_id', user.id).gte('date', dr.from).lte('date', dr.to),
          supabase.from('transactions').select('type,amount,account_id,date,status,kind,description').eq('user_id', user.id),
          supabase.from('accounts').select('id,name,balance,type').eq('user_id', user.id),
          supabase.from('clients').select('name,debt').eq('user_id', user.id).not('debt', 'is', null).lt('debt', 0).order('debt', { ascending: true }),
          supabase.from('products').select('id,name,type,price,min_qty').eq('user_id', user.id).eq('hidden', false),
          supabase.from('supplies').select('items').eq('user_id', user.id),
          supabase.from('writeoffs').select('items').eq('user_id', user.id),
          supabase.from('receipts').select('id,total_amount,date,client_id').eq('user_id', user.id).gte('date', dr.from).lte('date', dr.to),
          supabase.from('clients').select('id').eq('user_id', user.id),
          supabase.from('receipts').select('total_amount,date,client_id').eq('user_id', user.id),
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
        const cashBal = acctList.find(a => a.type === 'cash_register')?.balance || 0;
        const bankBal = acctList.filter(a => a.type === 'bank' || a.type === 'checking' || a.type === 'account').reduce((s, a) => s + a.balance, 0);

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

        // Склад
        const sm = {};
        (supRaw || []).forEach(sp => (sp.items || []).forEach(it => { if (!sm[it.prodId]) sm[it.prodId] = { qty: 0, cost: 0 }; sm[it.prodId].qty += it.qty || 0; sm[it.prodId].cost += (it.cost || 0) * (it.qty || 0); }));
        (wo || []).forEach(w => { const pid = w.product_id; if (pid != null && sm[pid]) sm[pid].qty -= w.quantity || 0; });
        const deficit = (prods || [])
          .filter(p => p.type !== 'service' && p.type !== 'combo' && p.min_qty > 0)
          .map(p => ({ name: p.name, qty: sm[p.id]?.qty || 0, min: p.min_qty, need: Math.max(0, p.min_qty - (sm[p.id]?.qty || 0)) }))
          .filter(p => p.qty < p.min).sort((a, b) => (a.qty / a.min) - (b.qty / b.min));
        const stockCost = Object.values(sm).reduce((s, v) => s + v.cost, 0);
        const stockRetail = (prods || []).reduce((s, p) => s + ((sm[p.id]?.qty || 0) * (p.price || 0)), 0);
        const stockPositions = (prods || []).filter(p => p.type !== 'service').length;

        // Клиенты
        const debt = Math.abs((debtClients || []).reduce((s, c) => s + (c.debt || 0), 0));
        const totalClients = (allClients || []).length;
        const buyCount = {};
        (receiptsAll || []).forEach(r => { if (r.client_id) buyCount[r.client_id] = (buyCount[r.client_id] || 0) + 1; });
        const repeatClients = totalClients > 0 ? Math.round(Object.values(buyCount).filter(c => c >= 2).length / totalClients * 100) : 0;

        // Выручка по дням (или по месяцам при периоде «год»)
        const recAll = (receiptsAll || []).map(r => ({ d: String(r.date || '').slice(0, 10), amt: Number(r.total_amount) || 0 }));
        const sumR = (a, b) => recAll.filter(r => r.d >= a && r.d <= b).reduce((s, r) => s + r.amt, 0);
        const tStr = locStr(new Date());
        const cmp = {
          today: sumR(tStr, tStr),
          yesterday: sumR(locStr(new Date(Date.now() - 86400000)), locStr(new Date(Date.now() - 86400000))),
          week: sumR(locStr(new Date(Date.now() - 6 * 86400000)), tStr),
          month: sumR(locStr(new Date(now.getFullYear(), now.getMonth(), 1)), tStr),
          year: sumR(now.getFullYear() + '-01-01', tStr),
        };

        // График: дни месяца (по умолчанию) или месяцы (при годе)
        let bars = [];
        let barsTotal = 0;
        if (period === 'year') {
          for (let m = 0; m < 12; m++) {
            const f = locStr(new Date(now.getFullYear(), m, 1));
            const l = locStr(new Date(now.getFullYear(), m + 1, 0));
            const v = sumR(f, l);
            bars.push({ label: MONTHS_SHORT[m], tip: MONTHS_SHORT[m] + ' · ' + v.toLocaleString('ru-RU') + ' ' + cur, val: v });
          }
          barsTotal = bars.reduce((s, b) => s + b.val, 0);
        } else {
          const y = now.getFullYear(), mo = now.getMonth();
          const daysInMonth = new Date(y, mo + 1, 0).getDate();
          const from = new Date(y, mo, 1), to = new Date(y, mo, daysInMonth);
          for (let dd = 1; dd <= daysInMonth; dd++) {
            const f = locStr(new Date(y, mo, dd));
            const v = sumR(f, f);
            bars.push({ label: dd, tip: dd + ' ' + MONTHS_SHORT[mo] + ' · ' + v.toLocaleString('ru-RU') + ' ' + cur, val: v });
          }
          barsTotal = sumR(locStr(from), locStr(to));
        }
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

        if (!alive) return;
        setData({
          rev, exp, profit: rev - exp, salesRev, cogs,
          cashBal, bankBal, totalCash, acctList,
          debt, debtors: debtClients || [], totalClients, repeatClients,
          deficit, stockCost, stockRetail, stockPositions,
          bars, barsTotal, barsMax, cmp,
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
  }, [user, period]);

  const d = data;
  if (loading) return <CenterSpinner />;
  if (!d) return <div className="dash-empty">Нет данных</div>;

  const profitPct = d.rev > 0 ? Math.round(d.profit / d.rev * 100) : 0;
  const prevMonthRev = d.bars ? d.bars.slice(0, -1).reduce((s, b) => s + b.val, 0) : 0;

  const subSections = [
    {
      key: 'finance', icon: '📊', name: 'Финансы', desc: 'Выручка, расходы, прибыль',
      right: { v: `${(d.profit || 0).toLocaleString('ru-RU')} ${cur}`, s: 'прибыль' },
      items: [
        { l: 'Выручка', v: `${(d.rev || 0).toLocaleString('ru-RU')} ${cur}` },
        { l: 'Расходы', v: `${(d.exp || 0).toLocaleString('ru-RU')} ${cur}`, c: 'bad' },
        { l: 'Чистая прибыль', v: `${(d.profit || 0).toLocaleString('ru-RU')} ${cur}`, c: d.profit >= 0 ? 'good' : 'bad' },
        { l: 'Рентабельность', v: `${profitPct}%` },
      ],
    },
    {
      key: 'accounts', icon: '🏦', name: 'Счета', desc: 'Касса, банк, резерв',
      right: { v: `${(d.totalCash || 0).toLocaleString('ru-RU')} ${cur}`, s: 'всего' },
      items: [
        ...(d.acctList || []).map(a => ({ l: a.name, v: `${(a.balance || 0).toLocaleString('ru-RU')} ${cur}`, c: a.balance < 0 ? 'bad' : null })),
        ...((d.acctList || []).length === 0 ? [{ l: 'Счетов нет', v: '—' }] : []),
      ],
    },
    {
      key: 'stock', icon: '📦', name: 'Склад', desc: 'Товарный запас',
      right: { v: `${(d.stockCost || 0).toLocaleString('ru-RU')} ${cur}`, s: 'по себестоимости' },
      items: [
        { l: 'Позиций всего', v: String(d.stockPositions || 0) },
        { l: 'На исходе (меньше нормы)', v: String((d.deficit || []).length), c: (d.deficit || []).length > 0 ? 'bad' : null },
        { l: 'Себестоимость запаса', v: `${(d.stockCost || 0).toLocaleString('ru-RU')} ${cur}` },
        { l: 'В продаже (розница)', v: `${(d.stockRetail || 0).toLocaleString('ru-RU')} ${cur}` },
      ],
    },
    {
      key: 'clients', icon: '👥', name: 'Клиенты', desc: 'База, долги',
      right: { v: String(d.totalClients || 0), s: `долги ${(d.debt || 0).toLocaleString('ru-RU')} ${cur}` },
      items: [
        { l: 'Клиентов в базе', v: String(d.totalClients || 0) },
        { l: 'Повторные покупки', v: `${d.repeatClients || 0}%`, c: 'good' },
        { l: 'С задолженностью', v: String((d.debtors || []).length), c: (d.debtors || []).length > 0 ? 'bad' : null },
        { l: 'Сумма долгов', v: `${(d.debt || 0).toLocaleString('ru-RU')} ${cur}`, c: d.debt > 0 ? 'bad' : null },
      ],
    },
    {
      key: 'salary', icon: '💰', name: 'Зарплата', desc: 'Начислено, сотрудники',
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
          <div className="dash-date">{todayLabel}</div>
        </div>
        <div className="dash-spacer" />
        <div className="seg">
          {[['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год']].map(([k, l]) => (
            <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
      </div>

      {/* ЖЁЛТАЯ ПЛАШКА ПРИБЫЛИ */}
      <div className="hero">
        <div className="lbl">Чистая прибыль за период</div>
        <div className="val">{(d.profit || 0).toLocaleString('ru-RU')} {cur}</div>
        <div className="delta">{`▲ рентабельность ${profitPct}%`}</div>
        <div className="chips">
          <div className="chip">Рентабельность <b>{profitPct}%</b></div>
          <div className="chip">Выручка <b>{(d.rev || 0).toLocaleString('ru-RU')} {cur}</b></div>
          <div className="chip">Расходы <b>{(d.exp || 0).toLocaleString('ru-RU')} {cur}</b></div>
        </div>
      </div>

      {/* ВЫРУЧКА СТОЛБЦАМИ */}
      <div className="card">
        <div className="card-h">
          <span className="t">{period === 'year' ? 'Выручка по месяцам' : 'Выручка по дням'}</span>
          <span className="v">{(d.barsTotal || 0).toLocaleString('ru-RU')} {cur}</span>
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
          {period === 'year'
            ? MONTHS_SHORT.map((m, i) => <span key={i}>{m}</span>)
            : (d.bars || []).filter(b => b.label % 2 === 1).map((b, i) => <span key={i}>{b.label}</span>)}
        </div>
      </div>

      {/* KPI */}
      <div className="kpis">
        <div className="kpi">
          <div className="k-lbl">Касса сейчас</div>
          <div className="k-val">{(d.cashBal || 0).toLocaleString('ru-RU')} {cur}</div>
          <div className={'k-sub ' + (d.cashBal >= 0 ? 'ok' : 'warn')}>{d.cashBal >= 0 ? 'в норме' : 'ниже нуля'}</div>
        </div>
        <div className="kpi">
          <div className="k-lbl">На счетах</div>
          <div className="k-val">{(d.bankBal || 0).toLocaleString('ru-RU')} {cur}</div>
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
          <div className={'k-sub ' + ((d.deficit || []).length > 0 ? 'warn' : 'ok')}>{(d.deficit || []).length} на исходе</div>
        </div>
      </div>

      {/* ПОКАЗАТЕЛИ */}
      <div className="card">
        <div className="card-h"><span className="t">Показатели периода</span></div>
        <div className="metrics">
          <div className="metric"><div className="m-l">Прибыль</div><div className="m-v">{(d.profit || 0).toLocaleString('ru-RU')} {cur}</div><div className={'m-d ' + (d.profit >= 0 ? 'up' : 'down')}>{d.profit >= 0 ? '▲' : '▼'} {profitPct}%</div></div>
          <div className="metric"><div className="m-l">Средний чек</div><div className="m-v">{(d.avgCheck || 0).toLocaleString('ru-RU')} {cur}</div><div className="m-d up">{d.buyers || 0} чеков</div></div>
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
                <div className="ic">{sec.icon}</div>
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
