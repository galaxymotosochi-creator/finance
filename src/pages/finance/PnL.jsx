import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';


export default function PnL() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [errMsg, setErrMsg] = useState(null);

  const getDateRange = () => {
    const now = new Date();
    let from;
    if (period === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1);
    } else if (period === 'year') {
      from = new Date(now.getFullYear(), 0, 1);
    }
    const to = now.toISOString().split('T')[0];
    return { from: from.toISOString().split('T')[0], to };
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      try {
        const dr = getDateRange();
        const now = new Date();

        // Все данные параллельно
        const [
          { data: recs },
          { data: allRecs },
          { data: supplies },
          { data: products },
          { data: expenses },
          { data: cats },
          { data: accts },
          { data: allTx },
          { data: writeoffs },
          { data: invRes },
        ] = await Promise.all([
          // Чеки за период
          supabase.from('receipts').select('id,total_amount,discount_sum')
            .eq('user_id', user.id).gte('date', dr.from).lte('date', dr.to),
          // Все чеки (для расчёта остатков склада)
          supabase.from('receipts').select('id')
            .eq('user_id', user.id),
          supabase.from('supplies').select('items').eq('user_id', user.id),
          // Все товары (включая скрытые — по ним тоже продажи/себестоимость)
          supabase.from('products').select('id,name').eq('user_id', user.id),
          // Расходные транзакции за период
          supabase.from('transactions').select('amount,category_id')
            .eq('user_id', user.id).eq('type', 'expense').gte('date', dr.from).lte('date', dr.to),
          supabase.from('categories').select('id,type').eq('user_id', user.id),
          supabase.from('accounts').select('id,name,balance').eq('user_id', user.id),
          // Все транзакции для баланса счетов
          supabase.from('transactions').select('account_id,type,amount,date,status')
            .eq('user_id', user.id),
          supabase.from('writeoffs').select('items').eq('user_id', user.id),
          // Инвентаризации за период — недостачи (расход) и излишки (доход)
          supabase.from('inventory').select('result').eq('user_id', user.id).eq('status', 'completed').gte('date', dr.from).lte('date', dr.to),
        ]);

        // Продажи за период (total_amount уже с учётом скидок) + сумма скидок (аналитика)
        const salesRev = (recs || []).reduce((s, r) => s + (r.total_amount || 0), 0);
        const discounts = (recs || []).reduce((s, r) => s + (Number(r.discount_sum) || 0), 0);
        // Прочие доходы = поступления за период, не связанные с продажами (не переводы, не свои деньги владельца)
        const saleCatIdPnl = ((cats || []).find(c => c && c.type === 'income' && c.name === 'Доход от продаж') || {}).id || null;
        let otherIncome = 0;
        (allTx || []).forEach(t => {
          if (!t || t.type !== 'income') return;
          if (t.status && t.status !== 'paid') return;
          const ds = String(t.date || '').split('T')[0];
          if (!ds || ds < dr.from || ds > dr.to) return;
          if (t.kind === 'transfer' || t.kind === 'collection' || t.kind === 'owner_deposit' || t.kind === 'owner_withdraw') return;
          const dsc = String(t.description || '');
          if (dsc.indexOf('Кассовая смена') === 0 || dsc.indexOf('по чеку') >= 0 || dsc.indexOf('Перевод') === 0 || dsc.indexOf('перевод') === 0) return;
          if (saleCatIdPnl && String(t.category_id) === String(saleCatIdPnl)) return;
          otherIncome += Number(t.amount) || 0;
        });

        // Позиции чеков ЗА ПЕРИОД (для себестоимости) — только чеки периода
        const periodRecIds = (recs || []).map(r => r.id);
        const { data: recItems } = periodRecIds.length
          ? await supabase.from('receipt_items').select('product_name,quantity,total').in('receipt_id', periodRecIds)
          : { data: [] };

        // Все ID чеков (для расчёта остатков склада)
        const allRecIds = (allRecs || []).map(r => r.id);
        const { data: recItemsAll } = allRecIds.length
          ? await supabase.from('receipt_items').select('product_name,quantity').in('receipt_id', allRecIds)
          : { data: [] };

        // Себестоимость — средняя цена из поставок
        const costTotals = {};
        (supplies || []).forEach(sp => (sp.items || []).forEach(it => {
          if (!costTotals[it.prodId]) costTotals[it.prodId] = { qty: 0, cost: 0 };
          costTotals[it.prodId].qty += it.qty || 0;
          costTotals[it.prodId].cost += (it.cost || 0) * (it.qty || 0);
        }));
        const avgCost = {};
        Object.entries(costTotals).forEach(([id, v]) => {
          if (v.qty > 0) avgCost[id] = v.cost / v.qty;
        });

        // Маппинг имени товара → id
        const prodNameMap = {};
        (products || []).forEach(p => { prodNameMap[p.name] = p.id; });

        // Себестоимость проданного ЗА ПЕРИОД (по средней цене из поставок)
        let totalCogs = 0;
        (recItems || []).forEach(item => {
          const pid = prodNameMap[item.product_name];
          if (pid && avgCost[pid]) {
            totalCogs += (item.quantity || 0) * avgCost[pid];
          }
        });

        // Карта категорий: id → {name, type}
        const catMap = {};
        (cats || []).forEach(c => { catMap[c.id] = c; });
        // Группируем операционные расходы по категориям
        const opByCat = {};
        let opTotal = 0;
        (expenses || []).forEach(t => {
          // Взнос/вывод своих денег владельца, переводы и инкассации — не операционные расходы
          if (t.kind === 'owner_deposit' || t.kind === 'owner_withdraw' || t.kind === 'transfer' || t.kind === 'collection') return;
          const tdesc = String(t.description || '');
          if (tdesc.indexOf('Перевод') === 0 || tdesc.indexOf('Инкассация') === 0) return;
          const cat = catMap[t.category_id];
          if (cat && (cat.name === 'Перевод между счетами' || cat.name === 'Инкассация')) return;
          // Если категория указана, но не найдена или не операционная — пропускаем
          if (t.category_id) {
            if (!cat || cat.type !== 'expense') return;
          }
          const name = cat ? (cat.name || 'Без названия') : 'Без категории';
          if (!opByCat[name]) opByCat[name] = 0;
          opByCat[name] += t.amount || 0;
          opTotal += t.amount || 0;
        });
        const opList = Object.entries(opByCat).sort((a, b) => b[1] - a[1]);

        // Недостачи и излишки по инвентаризациям за период
        let shortages = 0, surpluses = 0;
        (invRes || []).forEach(inv => {
          let r = {};
          try { r = JSON.parse(inv.result || '{}'); } catch (e) {}
          shortages += parseFloat(r.businessLoss) || 0;
          surpluses += parseFloat(r.surplusAmount) || 0;
        });

        // Чистая прибыль
        const grossProfit = salesRev - totalCogs;
        const netProfit = grossProfit + otherIncome - opTotal - shortages + surpluses;
        const profitability = salesRev > 0 ? Math.round(netProfit / salesRev * 100) : 0;

        // Товарный запас (по себестоимости) = приход − списания − продажи
        const stockQty = {};
        (supplies || []).forEach(sp => (sp.items || []).forEach(it => {
          if (!stockQty[it.prodId]) stockQty[it.prodId] = { qty: 0 };
          stockQty[it.prodId].qty += it.qty || 0;
        }));
        (writeoffs || []).forEach(w => (w.items || []).forEach(it => {
          if (stockQty[it.prodId]) stockQty[it.prodId].qty -= it.qty || 0;
        }));
        (recItemsAll || []).forEach(item => {
          const pid = prodNameMap[item.product_name];
          if (pid && stockQty[pid]) stockQty[pid].qty -= item.quantity || 0;
        });
        let totalStockValue = 0;
        for (const [id, v] of Object.entries(stockQty)) {
          const costPerUnit = avgCost[id];
          if (costPerUnit && v.qty > 0) {
            totalStockValue += v.qty * costPerUnit;
          }
        }

        // Деньги на счетах = балансы + транзакции
        const txById = {};
        (allTx || []).forEach(t => {
          if (!txById[t.account_id]) txById[t.account_id] = 0;
          txById[t.account_id] += Number(t.amount || 0) * (t.type === 'income' ? 1 : -1);
        });
        const totalCash = (accts || []).reduce((s, a) => {
          return s + (parseFloat(a.balance) || 0) + (txById[a.id] || 0);
        }, 0);

        setData({
          salesRev,
          discounts,
          otherIncome,
          totalCogs,
          grossProfit,
          opList,
          opTotal,
          shortages,
          surpluses,
          netProfit,
          profitability,
          stockValue: totalStockValue,
          totalCash,
          month: now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
        });
      } catch (e) {
        setErrMsg(e.message || 'неизвестная ошибка');
        console.error('PnL error:', e);
      }
      setLoading(false);
    })();
  }, [user, period]);

  const Btn = ({ p, label }) => (
    <button
      onClick={() => setPeriod(p)}
      style={{
        padding: '5px 14px', borderRadius: '100px', border: '1.5px solid rgba(0,0,0,.12)',
        background: period === p ? '#111' : 'transparent',
        color: period === p ? '#fff' : '#555',
        fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '.72rem',
      }}
    >{label}</button>
  );

  if (loading) {
    return <CenterSpinner />;
  }

  const d = data;
  if (errMsg) return <div className="empty-products"><div className="big-icon">⚠️</div><p>Ошибка загрузки: {errMsg}</p></div>;
  if (!d) return <div className="empty-products"><div className="big-icon">📊</div><p>Нет данных</p></div>;

  // Период для шапки отчёта (01.09.2026 — 04.09.2026)
  const dr = getDateRange();
  const fmtIso = (s) => { if (!s) return ''; const [y, m, dd] = s.split('-'); return `${dd}.${m}.${y}`; };
  const periodLabel = `${fmtIso(dr.from)} — ${fmtIso(dr.to)}`;
  const fmt = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString();

  // Донат: шкала рентабельности — полный круг = 40% (в макете 27,5% → дуга ~2/3)
  const ARC = 540;
  const MAX_RENT = 40;
  const donutFrac = Math.max(0, Math.min(1, (d.profitability || 0) / MAX_RENT));
  const donutOffset = ARC * (1 - donutFrac);

  // Строки отчёта: группа «Доходы» (итог зелёным) → группа «Расходы» (итог красным)
  const incomeTotal = (d.salesRev + d.discounts) + d.otherIncome + d.surpluses;
  const expenseTotal = d.discounts + d.totalCogs + d.opTotal + d.shortages;
  const rowData = [
    { key: 'h-inc', name: 'Доходы', value: `${fmt(incomeTotal)} ${cur}`, nameColor: '#16a34a', valueColor: '#16a34a', valueWeight: 400 },
    { key: 'sales', name: 'Доход от продаж', value: fmt(d.salesRev + d.discounts) },
    ...(d.otherIncome > 0 ? [{ key: 'oi', name: 'Прочие доходы', value: fmt(d.otherIncome) }] : []),
    ...(d.surpluses > 0 ? [{ key: 'sur', name: 'Излишки по инвентаризации', value: fmt(d.surpluses) }] : []),
    { key: 'h-exp', name: 'Расходы', value: `${fmt(expenseTotal)} ${cur}`, nameColor: '#dc2626', valueColor: '#dc2626', valueWeight: 400 },
    ...(d.discounts > 0 ? [{ key: 'disc', name: 'Скидки с продаж', value: fmt(d.discounts) }] : []),
    { key: 'cogs', name: 'Закупка товара', value: fmt(d.totalCogs) },
    ...d.opList.map(([name, amt], i) => ({ key: 'op' + i, name, value: fmt(amt) })),
    ...(d.shortages > 0 ? [{ key: 'short', name: 'Недостачи по инвентаризации', value: fmt(d.shortages) }] : []),
  ];

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', fontFamily: "'Golos Text',system-ui,sans-serif" }}>
      {/* Шапка */}
      <div className="page-header" style={{ marginBottom: '14px' }}>
        <div><h1>Чистая прибыль</h1><div className="sub">{d.month}</div></div>
        <div className="page-actions" style={{ display: 'flex', gap: '4px' }}>
          <Btn p="month" label="Месяц" />
          <Btn p="quarter" label="Квартал" />
          <Btn p="year" label="Год" />
        </div>
      </div>

      {/* Окно (эталон pnl-donut-v5) */}
      <div style={{
        background: 'linear-gradient(150deg,#fff,#fff8e6)',
        borderRadius: '22px', padding: '26px',
        boxShadow: '0 14px 40px rgba(0,0,0,.08)', border: '1px solid #f2ecdc',
        display: 'flex', gap: '30px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* Донат-круг */}
        <div style={{ position: 'relative', width: '210px', height: '210px', flexShrink: 0, margin: '0 auto' }}>
          <svg width="210" height="210" viewBox="0 0 210 210">
            <defs>
              <linearGradient id="pnlDonutGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffdd2d" />
                <stop offset="1" stopColor="#ffb300" />
              </linearGradient>
            </defs>
            <circle cx="105" cy="105" r="86" fill="none" stroke="#f1ece0" strokeWidth="18" />
            <circle cx="105" cy="105" r="86" fill="none" stroke="url(#pnlDonutGrad)" strokeWidth="18" strokeLinecap="round" strokeDasharray="540" strokeDashoffset={donutOffset} transform="rotate(-90 105 105)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '11px', color: '#999', fontWeight: 500 }}>Чистая прибыль</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#111', letterSpacing: '-.02em' }}>{fmt(d.netProfit)} {cur}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: d.profitability >= 0 ? '#16a34a' : '#dc2626' }}>{d.profitability}%</div>
            <div style={{ fontSize: '10.5px', color: '#bbb', fontWeight: 500 }}>рентабельность</div>
          </div>
        </div>

        {/* Отчёт о прибыли */}
        <div style={{ flex: 1, minWidth: '290px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: '6px', marginBottom: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#999' }}>Отчёт о прибыли</span>
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#999' }}>{periodLabel}</span>
          </div>

          {rowData.map((r, i) => (
            <Line key={r.key} name={r.name} value={r.value} nameColor={r.nameColor} valueColor={r.valueColor} valueWeight={r.valueWeight} last={i === rowData.length - 1} />
          ))}

          {/* Итог — жёлтый градиент */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '10px', padding: '12px 14px', marginTop: '10px', background: 'linear-gradient(135deg,#ffdd2d,#fff9db)', color: '#111' }}>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Чистая прибыль</span>
            <b style={{ fontSize: '20px', fontWeight: 800 }}>{fmt(d.netProfit)} {cur}</b>
          </div>

          {/* Показатели: запас и деньги на счетах */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <MiniStat label="Товарный запас" value={`${fmt(d.stockValue)} ${cur}`} />
            <MiniStat label="Деньги на счетах" value={`${fmt(d.totalCash)} ${cur}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ name, value, nameColor = '#333', valueColor = '#111', valueWeight = 600, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', padding: '6px 0', borderBottom: last ? 'none' : '1px solid #f2f2f2', fontSize: '14px' }}>
      <span style={{ color: nameColor }}>{name}</span>
      <span style={{ fontWeight: valueWeight, color: valueColor }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ flex: 1, background: '#fff', border: '1px solid #f0f0f0', borderRadius: '12px', padding: '9px 12px' }}>
      <div style={{ fontSize: '10.5px', color: '#999', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#111' }}>{value}</div>
    </div>
  );
}
