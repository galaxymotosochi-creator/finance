import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import { tzToday, tzOffsetDate } from '../../lib/dates';
import { calcSalesBonus } from '../../lib/salesBonus';
import CenterSpinner from '../../components/CenterSpinner';

const fmtD = (ds) => { if (!ds) return '—'; const p = String(ds).split('T')[0].split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : ds; };

export default function SalesReport() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [from, setFrom] = useState(() => { const t = tzToday(); return t.slice(0, 8) + '01'; });
  const [to, setTo] = useState(() => tzToday());
  const [period, setPeriod] = useState('month');
  const [periodLabel, setPeriodLabel] = useState('Этот месяц');
  const [showPeriod, setShowPeriod] = useState(false);
  const periodWrapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [prods, setProds] = useState([]);
  const [cats, setCats] = useState([]);
  const [empSales, setEmpSales] = useState([]); // [{empId, name, qty, prodQty, svcQty, sum, bonus, items:[...]}]
  const [revenue, setRevenue] = useState(0);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [empRes, prRes, crRes, salRes] = await Promise.all([
        supabase.from('employees').select('*').eq('user_id', user.id).order('name'),
        supabase.from('products').select('id,name,type,cat').eq('user_id', user.id),
        supabase.from('stock_categories').select('id,name,type').eq('user_id', user.id),
        supabase.from('salary').select('*').eq('user_id', user.id),
      ]);
      setEmployees(empRes.data || []);
      setProds(prRes.data || []);
      setCats(crRes.data || []);
      const salaries = (salRes && (salRes.data || [])) || [];

      const { data: recs } = await supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', from).lte('date', to).order('created_at', { ascending: false });
      const rlist = recs || [];
      const byEmp = {};
      let itList = [];
      if (rlist.length > 0) {
        const { data: items } = await supabase.from('receipt_items').select('*').in('receipt_id', rlist.map(r => r.id));
        itList = items || [];
        const prData = prRes.data || [], crData = crRes.data || [];
        (itList).forEach(it => {
          const eid = it.employee_id;
          if (eid == null) return;
          const r = rlist.find(x => x.id === it.receipt_id);
          if (!r) return;
          const qtyAll = Number(it.quantity) || 1;
          let retQty = 0;
          ((r.refund_items) || []).forEach(rf => { if (String(rf.item_id) === String(it.id)) retQty += Number(rf.qty) || 0; });
          const qty = Math.max(0, qtyAll - retQty);
          if (qty <= 0) return;
          const unit = qtyAll > 0 ? (Number(it.total) || 0) / qtyAll : 0;
          const total = Math.round(unit * qty);
          const prod = prData.find(x => String(x.id) === String(it.product_id));
          const type = prod ? prod.type : 'product';
          let E = byEmp[eid];
          if (!E) {
            const emp = (empRes.data || []).find(x => x.id === eid);
            E = { empId: eid, name: emp ? emp.name : 'Сотрудник', rules: emp ? (emp.bonus_rules || []) : [], qty: 0, prodQty: 0, svcQty: 0, comboQty: 0, totalQty: 0, prodSum: 0, svcSum: 0, comboSum: 0, sum: 0, bonus: 0, items: [] };
            byEmp[eid] = E;
          }
          const bonus = calcSalesBonus(E.rules, { product_id: it.product_id, total, qty }, prData, crData).rub;
          E.totalQty += qty;
          if (type === 'service') { E.svcQty += qty; E.svcSum += total; }
          else if (type === 'combo') { E.comboQty += qty; E.comboSum += total; }
          else { E.prodQty += qty; E.prodSum += total; }
          E.sum += total;
          E.bonus += bonus;
          E.items.push({ id: String(it.id), date: String(r.date || '').split('T')[0], name: it.product_name, type, qty, total, bonus });
        });
      }
      const revenue = rlist.reduce((sum, r) => sum + Math.max(0, (Number(r.total_amount) || 0) - (Number(r.refund_amount) || 0)), 0);
      // Вознаграждение за выбор продавцом/исполнителем (employee_splits из кассы: «Кто продал?»/«Кто выполняет?»)
      const rewByEmp = {};
      const rewByItem = {}; // itemId -> сумма вознаграждения за выбор конкретному сотруднику
      const addRew = (key, n, v) => { if (!rewByEmp[key]) rewByEmp[key] = { empId: key, name: n, total: 0, items: {} }; rewByEmp[key].total += v; };
      (itList).forEach(it => {
        const r = rlist.find(x => x.id === it.receipt_id);
        if (!r) return;
        const qtyAll = Number(it.quantity) || 1;
        let retQty = 0;
        ((r.refund_items) || []).forEach(rf => { if (String(rf.item_id) === String(it.id)) retQty += Number(rf.qty) || 0; });
        const availQty = Math.max(0, qtyAll - retQty);
        if (availQty <= 0) return;
        const factor = qtyAll > 0 ? availQty / qtyAll : 1;
        const sps = it.employee_splits || [];
        (sps).forEach(sp => {
          const amt = (parseFloat(sp.amount) || 0) * factor;
          if (amt <= 0) return;
          const emp = (empRes.data || []).find(x => String(x.id) === String(sp.employee_id));
          addRew(String(sp.employee_id), emp ? emp.name : (sp.name || 'Сотрудник'), amt);
          if (!rewByItem[String(it.id)]) rewByItem[String(it.id)] = {};
          rewByItem[String(it.id)][String(sp.employee_id)] = (rewByItem[String(it.id)][String(sp.employee_id)] || 0) + amt;
        });
      });
      const list = Object.values(byEmp).map(e => {
        const st = (e.rules || []).find(r => r.scope === 'store_sales');
        let storeBonus = 0, storePct = null;
        if (st) {
          const v = Number(st.val) || 0;
          storeBonus = st.vt === 'fixed' ? v : Math.round(revenue * v / 100);
          storePct = st.vt === 'fixed' ? null : v;
        }
        const itemsBonus = (st && st.stack === false) ? 0 : e.bonus;
        const rew = rewByEmp[String(e.empId)] ? rewByEmp[String(e.empId)].total : 0;
        // Вознаграждение = бонус по правилам ИЛИ/ПЛЮС сумма за выбор продавцом/исполнителем
        const itemsRew = (st && st.stack === false) ? rew : itemsBonus + rew;
        // выплачено/не выплачено Позиций: если за период есть выплаченный (paid) начисления вознаграждения — позиция с ним "выплачена", иначе остаётся невыплаченной
        const salEmpRows = (salaries || []).filter(s => String(s.employee_id || '') === String(e.empId));
        const inPer = salEmpRows.filter(s => { const pf = String(s.period_from || '').slice(0, 10), pt = String(s.period_to || '').slice(0, 10); return (!pf || pf <= to) && (!pt || pt >= from); });
        const rewSum = (s) => (Number(s.sales_bonus) || 0) + (Number(s.reward_amount) || 0);
        const paidRows = inPer.filter(s => s.status === 'paid');
        const owedRows = inPer.filter(s => s.status !== 'paid' && s.status !== 'cancelled');
        // к каждой позиции добавляем вознаграждение и признак выплаты
        const enrichedItems = e.items.map(x => {
          const itemRew = rewByItem[x.id] && rewByItem[x.id][String(e.empId)] ? rewByItem[x.id][String(e.empId)] : 0;
          const rw = (st && st.stack === false) ? itemRew : x.bonus + itemRew;
          const isPaid = (paidRows || []).some(s => (s.sales_items || []).some(i => String(i.itemId || '') === String(x.id)) || (s.reward_items || []).some(i => String(i.itemId || '') === String(x.id)));
          // если начислений за период вовсе нет — позиция ещё не выплачена
          const recPaid = inPer.length ? isPaid : false;
          return { ...x, reward: rw, recPaid, recNotPaid: !recPaid };
        }).sort((a, b) => (a.date < b.date ? 1 : -1));
        // Выплачено/Не выплачено = сумма по позициям (основная строка = сумма раскрытия)
        const paidRew = enrichedItems.reduce((a, x) => a + (x.recPaid ? (Number(x.reward) || 0) : 0), 0);
        const owedRew = enrichedItems.reduce((a, x) => a + (x.recNotPaid ? (Number(x.reward) || 0) : 0), 0);
        return { ...e, items: enrichedItems, itemsBonus, storeBonus, storePct, reward: rew, paidRew, owedRew, bonus: (st && st.stack === false) ? storeBonus + rew : itemsBonus + storeBonus + rew };
      });
      list.sort((a, b) => b.sum - a.sum);
      setEmpSales(list);
      setRevenue(revenue);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

  // период как в «Доходы и расходы»
  const applyPeriod = (k) => {
    setPeriod(k);
    if (k === 'all') { setFrom('2000-01-01'); setTo('2999-12-31'); setPeriodLabel('Все время'); return; }
    if (k === 'today') { setTo(tzToday()); setFrom(tzToday()); setPeriodLabel('Сегодня'); return; }
    if (k === 'yesterday') { setTo(tzToday()); setFrom(tzOffsetDate(1)); setPeriodLabel('Вчера'); return; }
    if (k === 'week') { setTo(tzToday()); setFrom(tzOffsetDate(7)); setPeriodLabel('7 дней'); return; }
    if (k === 'month30') { setTo(tzToday()); setFrom(tzOffsetDate(30)); setPeriodLabel('30 дней'); return; }
    if (k === 'month') { const t = tzToday(); setTo(t); setFrom(t.slice(0, 8) + '01'); setPeriodLabel('Этот месяц'); return; }
  };

  // закрытие выпадающего меню периода при клике вне (как в «Доходы и расходы»)
  useEffect(() => {
    if (!showPeriod) return;
    const handler = (e) => {
      // не закрывать, если клик внутри меню
      const m = periodWrapRef.current;
      if (m && m.contains(e.target)) return;
      setShowPeriod(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showPeriod]);

  const totals = empSales.reduce((s, e) => ({ qty: s.qty + e.totalQty, totalQty: s.totalQty + e.totalQty, prodQty: s.prodQty + e.prodQty, prodSum: s.prodSum + e.prodSum, svcQty: s.svcQty + e.svcQty, svcSum: s.svcSum + e.svcSum, comboQty: s.comboQty + e.comboQty, comboSum: s.comboSum + e.comboSum, sum: s.sum + e.sum, bonus: s.bonus + e.bonus, paidRew: s.paidRew + e.paidRew, owedRew: s.owedRew + e.owedRew }), { qty: 0, totalQty: 0, prodQty: 0, prodSum: 0, svcQty: 0, svcSum: 0, comboQty: 0, comboSum: 0, sum: 0, bonus: 0, paidRew: 0, owedRew: 0 });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Продажи по сотрудникам</h1>
          <div className="sub">Все продажи и вознаграждения сотрудников за период</div>
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
      ) : empSales.length === 0 ? (
        <div className="empty-products" style={{ marginTop: '1.5rem' }}>
          <div className="big-icon">📊</div>
          <p>За этот период нет продаж с указанными продавцами/исполнителями</p>
        </div>
      ) : (
        <div className="product-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table">
            <thead id="colHeaders">
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 0 }}>Сотрудник</th>
                <th style={{ textAlign: 'left' }}>Позиций</th>
                <th style={{ textAlign: 'left' }}>Сумма товаров</th>
                <th style={{ textAlign: 'left' }}>Сумма услуг</th>
                <th style={{ textAlign: 'left' }}>Сумма комбо</th>
                <th style={{ textAlign: 'left' }}>Сумма продаж</th>
                <th style={{ textAlign: 'left' }}>Вознаграждение</th>
                <th style={{ textAlign: 'left' }}>Выплачено</th>
                <th style={{ textAlign: 'left' }}>Не выплачено</th>
              </tr>
            </thead>
            <tbody>
              {empSales.map(e => (
                <FragmentRow key={e.empId} e={e} cur={cur} fmtD={fmtD} expanded={expanded === e.empId} onToggle={() => setExpanded(expanded === e.empId ? null : e.empId)} />
              ))}
              {empSales.length > 0 && (
                <tr className="total-row">
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left', paddingLeft: 0 }}>Итого:</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.qty}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.prodSum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.svcSum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.comboSum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.sum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.bonus ? '+' + totals.bonus.toLocaleString() + ' ' + cur : '0 ' + cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.paidRew.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.owedRew.toLocaleString()} {cur}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ e, cur, fmtD, expanded, onToggle }) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}
        onMouseEnter={ev => { ev.currentTarget.style.background = '#f5f5f5'; }}
        onMouseLeave={ev => { ev.currentTarget.style.background = ''; }}>
        <td style={{ textAlign: 'left', paddingLeft: 0 }}>
          <span className="prod-name">{expanded ? '▾ ' : '▸ '}{e.name}</span>
        </td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.totalQty}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.prodSum.toLocaleString()} {cur}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.svcSum.toLocaleString()} {cur}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.comboSum.toLocaleString()} {cur}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.sum.toLocaleString()} {cur}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.bonus ? '+' + e.bonus.toLocaleString() + ' ' + cur : '0 ' + cur}</td>
        <td style={{ textAlign: 'left', color: '#228b22' }}>{e.paidRew.toLocaleString()} {cur}</td>
        <td style={{ textAlign: 'left', color: '#c0392b' }}>{e.owedRew.toLocaleString()} {cur}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="9" style={{ padding: 0, background: '#fafbfc' }}>
            <div className="product-table" style={{ padding: '.5rem' }}>
              <table className="data-table">
                <thead id="colHeaders">
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: 0 }}>Дата</th>
                    <th style={{ textAlign: 'left' }}>Позиция</th>
                    <th style={{ textAlign: 'left' }}>Тип</th>
                    <th style={{ textAlign: 'left' }}>Сумма</th>
                    <th style={{ textAlign: 'left' }}>Вознаграждение</th>
                    <th style={{ textAlign: 'left' }}>Выплачено</th>
                    <th style={{ textAlign: 'left' }}>Не выплачено</th>
                  </tr>
                </thead>
                <tbody>
                  {e.items.map((it, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'left', paddingLeft: 0 }}>{fmtD(it.date)}</td>
                      <td style={{ textAlign: 'left' }}>{it.name}{it.qty > 1 ? ' x' + it.qty : ''}</td>
                      <td style={{ textAlign: 'left' }}>{it.type === 'service' ? 'услуга' : it.type === 'combo' ? 'комбо' : 'товар'}</td>
                      <td style={{ textAlign: 'left' }}>{it.total.toLocaleString()} {cur}</td>
                      <td style={{ textAlign: 'left' }}>{it.reward ? '+' + it.reward.toLocaleString() + ' ' + cur : '0 ' + cur}</td>
                      <td style={{ textAlign: 'left', color: '#228b22' }}>{it.recPaid ? (it.reward || 0).toLocaleString() : '0'} {cur}</td>
                      <td style={{ textAlign: 'left', color: '#c0392b' }}>{it.recNotPaid ? (it.reward || 0).toLocaleString() : '0'} {cur}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
