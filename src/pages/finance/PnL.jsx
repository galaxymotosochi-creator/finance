import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function PnL() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

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
        ] = await Promise.all([
          // Чеки за период
          supabase.from('receipts').select('id,total_amount')
            .eq('user_id', user.id).gte('date', dr.from).lte('date', dr.to),
          // Все чеки (для себестоимости)
          supabase.from('receipts').select('id')
            .eq('user_id', user.id),
          supabase.from('supplies').select('items').eq('user_id', user.id),
          supabase.from('products').select('id,name').eq('user_id', user.id).eq('hidden', false),
          // Расходные транзакции за период
          supabase.from('transactions').select('amount,category_id')
            .eq('user_id', user.id).eq('type', 'expense').gte('date', dr.from).lte('date', dr.to),
          supabase.from('categories').select('id,type').eq('user_id', user.id),
          supabase.from('accounts').select('id,name,balance').eq('user_id', user.id),
          // Все транзакции для баланса счетов
          supabase.from('transactions').select('account_id,type,amount,date,status')
            .eq('user_id', user.id),
          supabase.from('writeoffs').select('items').eq('user_id', user.id),
        ]);

        // Продажи за период
        const salesRev = (recs || []).reduce((s, r) => s + (r.total_amount || 0), 0);

        // Все ID чеков
        const allRecIds = (allRecs || []).map(r => r.id);
        const { data: recItemsAll } = allRecIds.length
          ? await supabase.from('receipt_items').select('product_name,quantity,total').in('receipt_id', allRecIds)
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

        // Себестоимость ВСЕХ проданных товаров (все чеки, не только за период)
        let totalCogs = 0;
        (recItemsAll || []).forEach(item => {
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
          const cat = catMap[t.category_id];
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

        // Чистая прибыль
        const grossProfit = salesRev - totalCogs;
        const netProfit = grossProfit - opTotal;
        const profitability = salesRev > 0 ? Math.round(netProfit / salesRev * 100) : 0;

        // Товарный запас (по себестоимости) — остатки на складе
        const stockQty = {};
        (supplies || []).forEach(sp => (sp.items || []).forEach(it => {
          if (!stockQty[it.prodId]) stockQty[it.prodId] = { qty: 0, cost: 0 };
          stockQty[it.prodId].qty += it.qty || 0;
          stockQty[it.prodId].cost += (it.cost || 0) * (it.qty || 0);
        }));
        (writeoffs || []).forEach(w => (w.items || []).forEach(it => {
          if (stockQty[it.prodId]) stockQty[it.prodId].qty -= it.qty || 0;
        }));
        const stockCost = Object.values(stockQty).reduce((s, v) => s + v.cost * (v.qty / (Object.values(costTotals).find(c => false) || 1)), 0);
        // Правильный расчёт товарного запаса
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
          totalCogs,
          grossProfit,
          opList,
          opTotal,

          netProfit,
          profitability,
          stockValue: totalStockValue,
          totalCash,
          month: now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
        });
      } catch (e) {
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
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#999', fontSize: '.85rem' }}>
        Загрузка...
      </div>
    );
  }

  const d = data;
  if (!d) return <div className="empty-products"><div className="big-icon">📊</div><p>Нет данных</p></div>;

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', fontFamily: "'Golos Text',system-ui,sans-serif" }}>
      {/* Шапка */}
      <div className="page-header" style={{ marginBottom: '14px' }}>
        <div><h1>Чистая прибыль</h1><div className="sub">{d.month}</div></div>
        <div className="page-actions" style={{ display: 'flex', gap: '4px' }}>
          <Btn p="month" label="Месяц" />
          <Btn p="quarter" label="Квартал" />
          <Btn p="year" label="Год" />
        </div>
      </div>

      {/* Карточка: Доходы */}
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '18px', marginBottom: '8px',
        boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #f0f0f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px', color: '#bbb', fontWeight: 600 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block', background: '#16a34a' }}></span>
          Доходы
        </div>
        <Row label="Продажи" value={`+${d.salesRev.toLocaleString()} ₽`} />
        <Row label="Себестоимость" value={`−${d.totalCogs.toLocaleString()} ₽`} color="#dc2626" />
        <div style={{ height: '1px', background: '#f0f0f0', margin: '8px 0' }} />
        <Row label="Валовая прибыль" value={`+${d.grossProfit.toLocaleString()} ₽`} color="#16a34a" bold />
      </div>

      {/* Карточка: Расходы */}
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '18px', marginBottom: '8px',
        boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #f0f0f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px', color: '#bbb', fontWeight: 600 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block', background: '#dc2626' }}></span>
          Расходы
        </div>
        {d.opList.map(([name, amt], i) => (
          <Row key={i} label={name} value={`−${amt.toLocaleString()} ₽`} color="#dc2626" />
        ))}

      </div>

      {/* Итог */}
      <div style={{
        background: '#1a1a1a', borderRadius: '14px', padding: '16px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0',
      }}>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,.5)' }}>
          Чистая прибыль
        </span>
        <span style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>
          {d.netProfit >= 0 ? '+' : ''}{d.netProfit.toLocaleString()} ₽
        </span>
      </div>

      {/* Дополнительные показатели */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
        <StatBlock label="Товарный запас" value={d.stockValue.toLocaleString()} />
        <StatBlock label="Деньги на счетах" value={d.totalCash.toLocaleString()} />
        <StatBlock label="Рентабельность" value={`${d.profitability}%`} color={d.profitability >= 0 ? '#16a34a' : '#dc2626'} />
      </div>
    </div>
  );
}

function Row({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
      <span style={{ fontSize: '13px', color: bold ? '#333' : '#666', fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: '14px', fontWeight: 600, color: color || '#111' }}>
        {value}
      </span>
    </div>
  );
}

function StatBlock({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '13px', textAlign: 'center',
      border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
    }}>
      <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '.3px', color: '#bbb', marginBottom: '3px', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: color || '#111' }}>
        {value}
      </div>
    </div>
  );
}
