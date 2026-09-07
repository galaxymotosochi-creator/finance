import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';

// Месяцы (заголовки столбцов) и аббревиатуры
const MONLONG = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONSHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

// Локальная дата без UTC-сдвига
const toD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const N = (x) => Number(x) || 0;

export default function AnnualReport() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);   // строки отчёта
  const [cellVals, setCellVals] = useState({}); // cellVals[rowKey:mi]
  const [monthVals, setMonthVals] = useState(Array.from({ length: 12 }, () => ({ income: 0, expense: 0, profit: 0, cash: 0 })));
  const [errMsg, setErrMsg] = useState(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setErrMsg(null);
    (async () => {
      try {
        const from = `${year}-01-01`;
        const to = `${year}-12-31`;

        // ---- Данные по году ----
        const [
          { data: recs },        // чеки года
          { data: supplies },
          { data: products },    // id->тип (для себестоимости проданного)
          { data: allTx },       // все транзакции (для остатка на конец каждого месяца)
          { data: cats },
          { data: accts },
          { data: saleInv },     // инвентаризации за год (недостачи/излишки)
        ] = await Promise.all([
          supabase.from('receipts').select('id,total_amount,discount_sum,date,refund_items,refund_amount,cashier_name')
            .eq('user_id', user.id).gte('date', from).lte('date', to),
          supabase.from('supplies').select('items').eq('user_id', user.id),
          supabase.from('products').select('id,name,type').eq('user_id', user.id),
          supabase.from('transactions').select('*').eq('user_id', user.id),
          supabase.from('categories').select('id,name,type').eq('user_id', user.id),
          supabase.from('accounts').select('id,name,balance').eq('user_id', user.id),
          supabase.from('inventory').select('result,date').eq('user_id', user.id).eq('status', 'completed').gte('date', from).lte('date', to),
        ]);

        // Категория «Доход от продаж» (маркер продаж в транзакциях)
        const saleTxCatId = ((cats || []).find(c => c && c.type === 'income' && c.name === 'Доход от продаж') || {}).id || null;
        const catMap = {};
        (cats || []).forEach(c => { catMap[c.id] = c; });

        // ---- Загрузка позиций чеков года (для себестоимости проданного) ----
        const yearRecIds = (recs || []).map(r => r.id);
        const { data: recItems } = yearRecIds.length
          ? await supabase.from('receipt_items').select('product_id,product_name,quantity,created_at').in('receipt_id', yearRecIds)
          : { data: [] };

        // ---- Себестоимость: средняя цена из всех поставок (как в PnL) ----
        const costTotals = {};
        (supplies || []).forEach(sp => (sp.items || []).forEach(it => {
          if (!costTotals[it.prodId]) costTotals[it.prodId] = { qty: 0, cost: 0 };
          costTotals[it.prodId].qty += N(it.qty);
          costTotals[it.prodId].cost += N(it.cost) * N(it.qty);
        }));
        const avgCost = {};
        Object.entries(costTotals).forEach(([id, v]) => { if (v.qty > 0) avgCost[id] = v.cost / v.qty; });

        // ВСЕ чеки (не только летом периода) — себестоимость по всем продажам продукта нужна для avgCost,
        // который выше уже из поставок. Для себестоимости проданного считаем по товарам чеков года по product_id.
        const prodById = {};
        (products || []).forEach(p => { prodById[String(p.id)] = p; });

        // ---- Массив из 12 месяцев с агрегатами ----
        const M = Array.from({ length: 12 }, (_, idx) => ({
          idx,
          sales: 0,        // выручка по чекам (с учётом возвратов = total_amount, возвраты уже вычтены в total_amount чека)
          discounts: 0,
          cogs: 0,         // себестоимость проданных товаров за месяц (по дате чека)
          shortages: 0,    // недостачи инвентаризации
          surpluses: 0,    // излишки инвентаризации
          cash: 0,         // деньги на счетах на конец месяца (накопленно)
          txIncomeByCat: {}, // прочие доходы по категориям (и доход от продаж через транзакции НЕ сюда)
          txExpByCat: {},    // операционные расходы по категориям
        }));

        const monthOfDate = (ds) => {
          if (!ds) return -1;
          const p = String(ds).split('T')[0].split('-');
          if (p.length < 2) return -1;
          return (parseInt(p[0], 10) === year) ? (parseInt(p[1], 10) - 1) : -1;
        };

        // 1) Продажи и скидки по чекам года — сумма чеков уже финальная (total_amount), возвраты вычтены из неё.
        (recs || []).forEach(r => {
          const mi = monthOfDate(r.date);
          if (mi < 0) return;
          M[mi].sales += N(r.total_amount);
          M[mi].discounts += N(r.discount_sum);
        });

        // 2) Себестоимость проданного — по позициям чеков этого месяца, средняя цена поставки.
        const recDateById = {};
        (recs || []).forEach(r => { recDateById[r.id] = r.date; });
        (recItems || []).forEach(it => {
          const rdate = recDateById[it.receipt_id];
          const mi = monthOfDate(rdate);
          if (mi < 0) return;
          const pid = it.product_id != null ? String(it.product_id) : null;
          const pr = pid && prodById[pid];
          // себестоимость учитываем для товаров (у услуг/комбо поставок обычно нет — avgCost пуст => 0)
          if (pr && avgCost[String(pr.id)]) {
            M[mi].cogs += N(it.quantity) * avgCost[String(pr.id)];
          }
        });

        // 3) Прочие доходы и операционные расходы по категориям из транзакций года
        (allTx || []).forEach(t => {
          if (!t) return;
          const mi = monthOfDate(t.date || t.created_at);
          if (mi < 0) return;
          // только оплаченные
          if (t.status && t.status !== 'paid') return;
          const dsc = String(t.description || '');
          const isOwner = t.kind === 'owner_deposit' || t.kind === 'owner_withdraw';
          const isTransfer = t.kind === 'transfer' || t.kind === 'collection';
          const isInternal = isOwner || isTransfer || dsc.indexOf('Перевод') === 0 || dsc.indexOf('Инкассация') === 0 || dsc.indexOf('перевод') === 0;
          const cat = catMap[t.category_id];
          const xferCatName = cat && (cat.name === 'Перевод между счетами' || cat.name === 'Инкассация');

          if (t.type === 'income') {
            // исключаем продажи (они не должны дублировать чеки) и внутренние движения
            const isSale = (saleTxCatId && String(t.category_id) === String(saleTxCatId))
              || dsc.indexOf('Кассовая смена') === 0
              || dsc.indexOf('по чеку') >= 0;
            if (isInternal || isSale) return;
            const name = cat ? (cat.name || 'Без названия') : 'Без категории';
            M[mi].txIncomeByCat[name] = (M[mi].txIncomeByCat[name] || 0) + N(t.amount);
          } else if (t.type === 'expense') {
            if (isInternal || xferCatName) return;
            if (t.category_id) {
              if (!cat || cat.type !== 'expense') {
                // если категория не expense — это может быть себестоимость прихода или спец; в PnL пропускаем
                return;
              }
            }
            const name = cat ? (cat.name || 'Без названия') : 'Без категории';
            M[mi].txExpByCat[name] = (M[mi].txExpByCat[name] || 0) + N(t.amount);
          }
        });

        // 4) Недостачи/излишки по инвентаризации за год
        (saleInv || []).forEach(inv => {
          const mi = monthOfDate(inv.date);
          if (mi < 0) return;
          let r = {};
          try { r = JSON.parse(inv.result || '{}'); } catch (e) {}
          M[mi].shortages += parseFloat(r.businessLoss) || 0;
          M[mi].surpluses += parseFloat(r.surplusAmount) || 0;
        });

        // 5) Деньги на счетах на конец каждого месяца: баланс счёта (уже учтён в данных?) В PnL:
        // деньги = сумма(баланс счёта) + сумма движений транзакций.
        // Но так как транзакции хранят полную историю, а balance на счёте обычно отражает текущее состояние,
        // чтобы получить «на конец месяца», добавляем движения до конца месяца к стартовому (баланс − все движения).
        // Надёжнее: деньги на конец года считаем по балансам, а для промежуточных месяцев берём накопленно.
        // Для расчёта «на конец месяца X» вычислим все движения до конца X и добавим стартовый капитал.
        // Стартовый = баланс всех счетов − (все движения по всем счетам за всё время) [приближённо, если баланс хранит текущее]
        // В PnL используется: cash = sum(balance + sum(delta)). Это даёт cash с учётом всех движений поверх баланса,
        // т.е. если транзакции не дублируют баланс, это скорее «полные деньги». Считаем накопленно от баланса:

        // Готовим накопительные движения до конца каждого месяца (income +, expense −, transfer учтём истинно по счёту:
        // на счетах деньги от переводов двигаются, но для «сколько денег в бизнесе» переводы между своими счетами
        // не создают новых денег. Но здесь счета все свои — переводы не добавляют «деньги в бизнесе» (перемещение).
        // Для правильного остатка считаем приход/расход по каждому счёту с учётом направленности (transfer идёт
        // со счёта и на счёт — суммируем net по каждому счёту).

        // Построим net-delta на счёт от каждой транзакции
        const txByMonthByAcc = Array.from({ length: 12 }, () => ({})); // [mi][accId] = net delta за месяц
        (allTx || []).forEach(t => {
          if (!t || !t.account_id) return;
          const mi = monthOfDate(t.date || t.created_at);
          if (mi < 0) return;
          if (t.status && t.status !== 'paid') return;
          const net = (t.type === 'income' ? 1 : -1) * N(t.amount);
          txByMonthByAcc[mi][t.account_id] = (txByMonthByAcc[mi][t.account_id] || 0) + net;
        });
        // Текущий баланс счёта минус все движения = стартовый остаток (до учёта транзакций)
        const totalDelta = {};
        (allTx || []).forEach(t => {
          if (!t || !t.account_id) return;
          if (t.status && t.status !== 'paid') return;
          totalDelta[t.account_id] = (totalDelta[t.account_id] || 0) + (t.type === 'income' ? 1 : -1) * N(t.amount);
        });
        const startBal = {};
        (accts || []).forEach(a => {
          startBal[a.id] = (parseFloat(a.balance) || 0) - (totalDelta[a.id] || 0);
        });
        // Накопим деньги на конец каждого месяца
        const runningAcc = {}; // accId -> накопл
        (accts || []).forEach(a => { runningAcc[a.id] = startBal[a.id] || 0; });
        M.forEach(m => {
          Object.entries(txByMonthByAcc[m.idx]).forEach(([accId, delta]) => {
            runningAcc[accId] = (runningAcc[accId] || 0) + delta;
          });
          m.cash = Object.values(runningAcc).reduce((s, v) => s + v, 0);
        });

        // ---- Формирование строк ----
        // Собираем набор уникальных категорий доходов и расходов по году
        const incomeCatNames = new Set();
        const expCatNames = new Set();
        M.forEach(m => {
          Object.keys(m.txIncomeByCat).forEach(n => incomeCatNames.add(n));
          Object.keys(m.txExpByCat).forEach(n => expCatNames.add(n));
        });
        // Строки: фикс-доходы сверху, потом операционные расходы, потом себестоимость, недостачи/скидки.
        const incomeCatList = Array.from(incomeCatNames).sort((a, b) => a.localeCompare(b, 'ru'));
        const expCatList = Array.from(expCatNames).sort((a, b) => a.localeCompare(b, 'ru'));

        // cells: массив строк. Каждая: { key, name, type: 'income'|'expense'|'subtotal'|'cash'|..., income:bool }
        const buildRows = [];
        // ДОХОДЫ
        buildRows.push({ key: 'inc-head', kind: 'head', label: 'Доходы', color: '#16a34a' });
        buildRows.push({ key: 'd-sales', kind: 'item', label: 'Доход от продаж', income: true, section: 'income' });
        incomeCatList.forEach(cat => buildRows.push({ key: 'd-other-' + cat, kind: 'item', label: cat, income: true, section: 'income-other' }));
        buildRows.push({ key: 'd-surplus', kind: 'item', label: 'Излишки по инвентаризации', income: true, section: 'income-surplus' });
        // РАСХОДЫ
        buildRows.push({ key: 'exp-head', kind: 'head', label: 'Расходы', color: '#dc2626' });
        buildRows.push({ key: 'd-cogs', kind: 'item', label: 'Закупка товара (себестоимость)', income: false, section: 'cogs' });
        expCatList.forEach(cat => buildRows.push({ key: 'd-exp-' + cat, kind: 'item', label: cat, income: false, section: 'exp' }));
        buildRows.push({ key: 'd-shortage', kind: 'item', label: 'Недостачи по инвентаризации', income: false, section: 'exp-shortage' });
        // Итог по месяцу и прибыль добавляем как отдельные строки внизу (по ТЗ внизу итог, прибыль, деньги)
        buildRows.push({ key: 'sub-month', kind: 'subtotal', label: 'Итог за месяц' });
        buildRows.push({ key: 'sub-profit', kind: 'profit', label: 'Чистая прибыль' });
        buildRows.push({ key: 'sub-cash', kind: 'cash', label: 'Деньги на конец месяца' });

        // Заполняем значения ячеек
        const cellVals = {}; // key_row_key -> число по месяцу
        const monthVals = Array.from({ length: 12 }, () => ({
          income: 0, expense: 0, profit: 0, cash: 0,
        }));
        M.forEach((m, mi) => {
          const otherIn = Object.values(m.txIncomeByCat).reduce((s, v) => s + v, 0);
          const opExps = Object.values(m.txExpByCat).reduce((s, v) => s + v, 0);
          const profit = (m.sales - m.cogs) + otherIn + m.surpluses - opExps - m.shortages;

          // Доход от продаж
          cellVals['d-sales:' + mi] = m.sales;
          incomeCatList.forEach(cat => { cellVals['d-other-' + cat + ':' + mi] = m.txIncomeByCat[cat] || 0; });
          cellVals['d-surplus:' + mi] = m.surpluses;
          cellVals['d-cogs:' + mi] = m.cogs;
          expCatList.forEach(cat => { cellVals['d-exp-' + cat + ':' + mi] = m.txExpByCat[cat] || 0; });
          cellVals['d-shortage:' + mi] = m.shortages;

          monthVals[mi].income = m.sales + otherIn + m.surpluses; // сумма строк «Доходы»
          monthVals[mi].expense = m.cogs + opExps + m.shortages;   // сумма строк «Расходы»
          monthVals[mi].profit = profit;
          monthVals[mi].cash = m.cash;
        });

        setRows(buildRows);
        setCellVals(cellVals);
        setMonthVals(monthVals);
      } catch (e) {
        console.error('AnnualReport:', e);
        setErrMsg(e.message || 'неизвестная ошибка');
      }
      setLoading(false);
    })();
  }, [user, year]);

  if (loading) return <CenterSpinner />;
  if (errMsg) return <div className="empty-products"><div className="big-icon">⚠️</div><p>Ошибка загрузки: {errMsg}</p></div>;

  const fmt = (n) => { const v = Math.round((N(n)) * 100) / 100; return v.toLocaleString('ru-RU'); };

  // Год с кнопками вперёд/назад
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Годовой отчёт</h1>
          <div className="sub">Доходы и расходы по категориям, каждый столбец — месяц</div>
        </div>
        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => setYear(y => y - 1)} style={{ ...navBtn }}>‹</button>
          <span style={{ minWidth: '70px', textAlign: 'center', fontWeight: 700, fontSize: '.9rem' }}>{year}</span>
          <button onClick={() => setYear(y => (y < new Date().getFullYear() ? y + 1 : y))} style={{ ...navBtn }}>›</button>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      <div className="product-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: '.5rem' }}>
        <table className="annual-table">
          <thead>
            <tr>
              <th>Показатель</th>
              {MONSHORT.map((mn, i) => (
                <th key={mn} title={MONLONG[i]}>{mn}</th>
              ))}
              <th className="br">Год</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              if (r.kind === 'head') {
                return (
                  <tr key={r.key} className="head">
                    <td colSpan={14} style={{ color: r.color }}>{r.label}</td>
                  </tr>
                );
              }
              if (r.kind === 'item') {
                const vals = MONSHORT.map((_, mi) => cellVals[r.key + ':' + mi] || 0);
                const yearSum = vals.reduce((a, b) => a + b, 0);
                const isIncome = r.income;
                const col = isIncome ? '#1e7d32' : '#c0392b';
                const cls = r.section === 'cogs' ? ' section-before' : '';
                return (
                  <tr key={r.key} className={"item" + cls}>
                    <td className="cat">{r.label}</td>
                    {vals.map((v, mi) => (
                      <td key={mi} style={{ color: col, opacity: v ? 1 : .4 }}>{v ? fmt(v) : '0'}</td>
                    ))}
                    <td className="br" style={{ color: col, fontWeight: 700 }}>{fmt(yearSum)}</td>
                  </tr>
                );
              }
              if (r.kind === 'subtotal') {
                return (
                  <tr key={r.key} className="subtotal">
                    <td className="cat">Итог за месяц</td>
                    {MONSHORT.map((_, mi) => (
                      <td key={mi} style={{ color: (monthVals[mi].income - monthVals[mi].expense) >= 0 ? '#222' : '#c0392b' }}>{fmt(monthVals[mi].income - monthVals[mi].expense)}</td>
                    ))}
                    <td className="br" style={{ color: '#222' }}>{fmt(monthVals.reduce((s, m) => s + (m.income - m.expense), 0))}</td>
                  </tr>
                );
              }
              if (r.kind === 'profit') {
                return (
                  <tr key={r.key} className="profit">
                    <td className="cat" style={{ color: '#1e7d32' }}>Чистая прибыль</td>
                    {MONSHORT.map((_, mi) => (
                      <td key={mi}>{fmt(monthVals[mi].profit)}</td>
                    ))}
                    <td className="br">{fmt(monthVals.reduce((s, m) => s + m.profit, 0))}</td>
                  </tr>
                );
              }
              return (
                <tr key={r.key} className="cash">
                  <td className="cat">Деньги на конец месяца</td>
                  {MONSHORT.map((_, mi) => (
                    <td key={mi}>{fmt(monthVals[mi].cash)}</td>
                  ))}
                  <td className="br">{fmt(monthVals[11].cash)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: '.68rem', color: '#999', marginTop: '.5rem', lineHeight: 1.5 }}>
        «Чистая прибыль» = Доход от продаж + прочие доходы + излишки − закупка товара − расходы по категориям − недостачи.
        «Деньги на конец месяца» — накопленный остаток на всех финансовых счетах.
      </div>
    </div>
  );
}

const navBtn = {
  padding: '4px 12px', borderRadius: '100px', border: '1.5px solid rgba(0,0,0,.15)',
  background: '#fff', color: '#111', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '.9rem', lineHeight: 1,
};
