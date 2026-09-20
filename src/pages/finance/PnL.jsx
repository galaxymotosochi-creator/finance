import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';
import SectionHelp from '../../components/SectionHelp';


export default function PnL() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [errMsg, setErrMsg] = useState(null);
  const [pnlOpen, setPnlOpen] = useState({ inc: true, exp: false });
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Локальная дата без UTC-сдвига (toISOString уводит границу на день назад в Москве)
  const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    } else if (period === 'custom') {
      return { from: customFrom || toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: customTo || toDateStr(now) };
    }
    return { from: toDateStr(from), to: toDateStr(now) };
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
          // Все чеки (для расчета остатков склада)
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

        // Продажи за период (total_amount уже с учетом скидок) + сумма скидок (аналитика)
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

        // Все ID чеков (для расчета остатков склада)
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
  }, [user, period, customFrom, customTo]);

  if (loading) {
    return <CenterSpinner />;
  }

  const d = data;
  if (errMsg) return <div className="empty-products"><div className="big-icon">⚠️</div><p>Ошибка загрузки: {errMsg}</p></div>;
  if (!d) return <div className="empty-products"><div className="big-icon">📊</div><p>Нет данных</p></div>;

  // Период для шапки отчета (01.09.2026 — 04.09.2026)
  const dr = getDateRange();
  const fmtIso = (s) => { if (!s) return ''; const [y, m, dd] = s.split('-'); return `${dd}.${m}.${y}`; };
  const periodLabel = `${fmtIso(dr.from)} — ${fmtIso(dr.to)}`;
  const fmt = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString();

  // Строки отчета: группа «Доходы» (итог зеленым) → группа «Расходы» (итог красным)
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
    <div style={{ maxWidth: '680px', margin: '0 auto', fontFamily: 'var(--font)' }}>
      {/* Шапка — фирменный стиль: голубая плашка + подсказка (как в «Чеках» и остальных разделах) */}
      <div className="sk-bar">
        <div className="grow">
          <div style={{display:'flex',alignItems:'center'}}>
            <h1>Чистая прибыль</h1>
            <SectionHelp
              title="Раздел «Чистая прибыль»"
              intro="Здесь видно, сколько бизнес заработал за период: выручка минус закупка товара, расходы и недостачи. Ниже — из чего сложилась сумма."
              faq={[
                { q: 'Что такое чистая прибыль?', a: (
                  <div>Это <b>выручка</b> за период минус <b>себестоимость товара</b>, минус <b>расходы</b> и минус <b>недостачи</b> по инвентаризации.</div>
                ) },
                { q: 'Как выбрать период?', a: (
                  <div>Кнопками справа вверху: <b>Месяц</b>, <b>Квартал</b> или <b>Год</b>. Данные пересчитываются сразу.</div>
                ) },
                { q: 'Что показывает круг?', a: (
                  <div><b>Круг</b> — доля прибыли от выручки. Если он заполнен мало при большой выручке — много уходит на закупку и расходы.</div>
                ) },
                { q: 'Почему прибыль может быть минусовой?', a: (
                  <div>Если <b>расходы и закупка выше выручки</b> — период убыточный. Смотрите строку «Закупка товара» и список расходов ниже.</div>
                ) },
              ]} />
          </div>
          <div className="sub">{d.month}</div>
        </div>
        <div className="sk-period-wrap" style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <button type="button"
            style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}
            onClick={e => { e.stopPropagation(); document.querySelectorAll('.sk-period-wrap').forEach(w => { if (!w.contains(e.currentTarget)) w.classList.remove('open'); }); e.currentTarget.parentElement.classList.toggle('open'); }}>
            {period === 'custom' ? 'Свой период' : (period === 'month' ? 'Месяц' : period === 'quarter' ? 'Квартал' : 'Год')}
            <span className="car-tri">▾</span>
          </button>
          <div className="sk-period-menu" style={{position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'260px',padding:'.4rem',zIndex:100,display:'none'}}>
            {[['month','Месяц'],['quarter','Квартал'],['year','Год']].map(([k,l]) => (
              <button key={k} type="button"
                style={period === k ? { background:'#E6F0FF', color:'#0d4ea8', fontWeight:700 } : undefined}
                onClick={e => { e.stopPropagation(); e.currentTarget.closest('.sal-dd-wrap').classList.remove('open'); setPeriod(k); }}>
                {l}
              </button>
            ))}
            <div style={{borderTop:'1px solid rgba(29,120,252,.14)',paddingTop:'.4rem',marginTop:'.25rem'}}>
              <div style={{fontSize:'.72rem',color:'#5b6472',padding:'.2rem .55rem',marginBottom:'.3rem',fontWeight:600}}>Свой период</div>
              <div style={{display:'flex',gap:'.3rem',padding:'.2rem .55rem'}}>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
              </div>
              <div style={{padding:'.3rem .55rem 0',textAlign:'center'}}>
                <button type="button" className="sk-dd-btn" style={{padding:'.5rem 1.1rem'}}
                  onClick={e => { e.stopPropagation(); e.currentTarget.closest('.sal-dd-wrap').classList.remove('open'); setPeriod('custom'); }}>Применить</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Окно — фирменные сине-жёлтые цвета */}
      <div className="pnl-frame">
        <div className="pnl-top">
        {/* KPI: чистая прибыль (жёлтый блок 1-в-1 с макетом) */}
        <div className="pnl-kpi">
          <div className="pnl-kpi-card">
            <div className="lbl">Чистая прибыль</div>
            <div className="big">{fmt(d.netProfit)} {cur}</div>
            <div className="chips">
              <div className="chip"><div className="lbl">Рентабельность</div><b>{d.profitability}%</b></div>
              <div className="chip"><div className="lbl">Выручка</div><b>{fmt(incomeTotal)} {cur}</b></div>
            </div>
          </div>
        </div>

        {/* Отчет о прибыли — Доходы/Расходы раскрываются */}
        <div style={{ flex: 1, minWidth: '290px' }}>
          <div className="pnl-rhead">
            <span>Отчёт о прибыли</span>
            <span>{periodLabel}</span>
          </div>

          <div className={'pnl-acc' + (pnlOpen.inc ? ' open' : '')}>
            <div className="pnl-acc-head" onClick={() => setPnlOpen(o => ({ ...o, inc: !o.inc }))}>
              <div className="pnl-acc-left">
                <span className="pnl-acc-car">▼</span>
                <span>Доходы</span>
              </div>
              <span className="pnl-acc-val inc">{fmt(incomeTotal)} {cur}</span>
            </div>
            <div className="pnl-acc-body">
              <div className="pnl-r"><span className="nm">Доход от продаж</span><span className="v">{fmt(d.salesRev + d.discounts)} {cur}</span></div>
              <div className="pnl-r"><span className="nm">Прочие доходы</span><span className="v">{fmt(d.otherIncome)} {cur}</span></div>
              <div className="pnl-r"><span className="nm">Излишки по инвентаризации</span><span className="v">{fmt(d.surpluses)} {cur}</span></div>
            </div>
          </div>

          <div className={'pnl-acc' + (pnlOpen.exp ? ' open' : '')}>
            <div className="pnl-acc-head" onClick={() => setPnlOpen(o => ({ ...o, exp: !o.exp }))}>
              <div className="pnl-acc-left">
                <span className="pnl-acc-car">▼</span>
                <span>Расходы</span>
              </div>
              <span className="pnl-acc-val exp">{fmt(expenseTotal)} {cur}</span>
            </div>
            <div className="pnl-acc-body">
              {d.discounts > 0 && <div className="pnl-r"><span className="nm">Скидки с продаж</span><span className="v">{fmt(d.discounts)} {cur}</span></div>}
              <div className="pnl-r"><span className="nm">Закупка товара</span><span className="v">{fmt(d.totalCogs)} {cur}</span></div>
              {d.opList.map(([name, amt], i) => (
                <div className="pnl-r" key={i}><span className="nm">{name}</span><span className="v">{fmt(amt)} {cur}</span></div>
              ))}
              {d.shortages > 0 && <div className="pnl-r"><span className="nm">Недостачи по инвентаризации</span><span className="v">{fmt(d.shortages)} {cur}</span></div>}
            </div>
          </div>

          {/* Мини-плашки: закупка, запас, деньги */}
          <div className="pnl-grid3">
            <div className="pnl-mini"><div className="lbl">ЗАКУПКА ТОВАРА</div><b>{fmt(d.totalCogs)} {cur}</b></div>
            <div className="pnl-mini"><div className="lbl">ТОВАРНЫЙ ЗАПАС</div><b>{fmt(d.stockValue)} {cur}</b></div>
            <div className="pnl-mini"><div className="lbl">ДЕНЬГИ НА СЧЕТАХ</div><b>{fmt(d.totalCash)} {cur}</b></div>
          </div>
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
