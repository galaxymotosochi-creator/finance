import { useState, useEffect } from 'react';
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
      const [empRes, prRes, crRes] = await Promise.all([
        supabase.from('employees').select('*').eq('user_id', user.id).order('name'),
        supabase.from('products').select('id,name,type,cat').eq('user_id', user.id),
        supabase.from('stock_categories').select('id,name,type').eq('user_id', user.id),
      ]);
      setEmployees(empRes.data || []);
      setProds(prRes.data || []);
      setCats(crRes.data || []);

      const { data: recs } = await supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', from).lte('date', to).order('created_at', { ascending: false });
      const rlist = recs || [];
      const byEmp = {};
      if (rlist.length > 0) {
        const { data: items } = await supabase.from('receipt_items').select('*').in('receipt_id', rlist.map(r => r.id));
        const prData = prRes.data || [], crData = crRes.data || [];
        (items || []).forEach(it => {
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
          E.items.push({ date: String(r.date || '').split('T')[0], name: it.product_name, type, qty, total, bonus });
        });
      }
      const revenue = rlist.reduce((sum, r) => sum + Math.max(0, (Number(r.total_amount) || 0) - (Number(r.refund_amount) || 0)), 0);
      const list = Object.values(byEmp).map(e => {
        const st = (e.rules || []).find(r => r.scope === 'store_sales');
        let storeBonus = 0, storePct = null;
        if (st) {
          const v = Number(st.val) || 0;
          storeBonus = st.vt === 'fixed' ? v : Math.round(revenue * v / 100);
          storePct = st.vt === 'fixed' ? null : v;
        }
        const itemsBonus = (st && st.stack === false) ? 0 : e.bonus;
        return { ...e, items: e.items.sort((a, b) => (a.date < b.date ? 1 : -1)), itemsBonus, storeBonus, storePct, bonus: itemsBonus + storeBonus };
      });
      list.sort((a, b) => b.sum - a.sum);
      setEmpSales(list);
      setRevenue(revenue);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

  const totals = empSales.reduce((s, e) => ({ qty: s.qty + e.totalQty, totalQty: s.totalQty + e.totalQty, prodQty: s.prodQty + e.prodQty, prodSum: s.prodSum + e.prodSum, svcQty: s.svcQty + e.svcQty, svcSum: s.svcSum + e.svcSum, comboQty: s.comboQty + e.comboQty, comboSum: s.comboSum + e.comboSum, sum: s.sum + e.sum, bonus: s.bonus + e.bonus }), { qty: 0, totalQty: 0, prodQty: 0, prodSum: 0, svcQty: 0, svcSum: 0, comboQty: 0, comboSum: 0, sum: 0, bonus: 0 });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Отчёты — продажи по сотрудникам</h1>
          <div className="sub">Кто сколько продал (товары) и выполнил (услуги) за период, и бонус по правилам</div>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      {/* Период */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.6rem', flexWrap: 'wrap' }}>
        <span onClick={() => { setFrom('2000-01-01'); setTo('2999-12-31'); }}
          style={{ padding: '.28rem .85rem', borderRadius: '100px', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', background: from === '2000-01-01' ? '#111' : '#eee', color: from === '2000-01-01' ? '#fff' : '#555', fontFamily: 'inherit', border: 'none', whiteSpace: 'nowrap' }}>Все время</span>
        <select
          value={from === '2000-01-01' ? '' : (to === tzToday() ? (from === tzToday() ? '0' : from === tzOffsetDate(1) ? '1' : from === tzOffsetDate(7) ? '7' : from === tzOffsetDate(30) ? '30' : (from === (tzToday().slice(0, 8) + '01')) ? 'month' : 'custom') : 'custom')}
          onChange={e => {
            const k = e.target.value;
            if (k === 'month') { const t = tzToday(); setTo(t); setFrom(t.slice(0, 8) + '01'); }
            else if (k === '0' || k === '1' || k === '7' || k === '30') { setTo(tzToday()); setFrom(tzOffsetDate(Number(k))); }
          }}
          style={{ border: '1.5px solid var(--border)', borderRadius: '8px', padding: '.28rem .5rem', fontSize: '.8rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', color: from === '2000-01-01' ? '#9aa0ab' : '#222' }}>
          <option value="">Выберите период</option>
          <option value="0">Сегодня</option>
          <option value="1">Вчера</option>
          <option value="7">7 дней</option>
          <option value="30">30 дней</option>
          <option value="month">Этот месяц</option>
        </select>
        <span style={{ color: '#999', fontSize: '.8rem' }}>—</span>
        <input type="date" value={from === '2000-01-01' ? '' : from} onChange={e => setFrom(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: '6px', padding: '4px 6px', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none' }} />
        <input type="date" value={to === '2999-12-31' ? '' : to} onChange={e => setTo(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: '6px', padding: '4px 6px', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none' }} />
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
                <th style={{ textAlign: 'left' }}>Товары</th>
                <th style={{ textAlign: 'left' }}>Сумма товаров</th>
                <th style={{ textAlign: 'left' }}>Услуги</th>
                <th style={{ textAlign: 'left' }}>Сумма услуг</th>
                <th style={{ textAlign: 'left' }}>Комбо</th>
                <th style={{ textAlign: 'left' }}>Сумма комбо</th>
                <th style={{ textAlign: 'left' }}>Сумма продаж</th>
                <th style={{ textAlign: 'left' }}>Вознаграждение</th>
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
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.prodQty}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.prodSum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.svcQty}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.svcSum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.comboQty}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.comboSum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.sum.toLocaleString()} {cur}</td>
                  <td style={{ fontWeight: 600, color: '#222', textAlign: 'left' }}>{totals.bonus ? '+' + totals.bonus.toLocaleString() + ' ' + cur : '—'}</td>
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
        <td style={{ textAlign: 'left', color: '#555' }}>{e.prodQty || '—'}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.prodSum ? e.prodSum.toLocaleString() + ' ' + cur : '—'}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.svcQty || '—'}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.svcSum ? e.svcSum.toLocaleString() + ' ' + cur : '—'}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.comboQty || '—'}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.comboSum ? e.comboSum.toLocaleString() + ' ' + cur : '—'}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.sum.toLocaleString()} {cur}</td>
        <td style={{ textAlign: 'left', color: '#555' }}>{e.bonus ? '+' + e.bonus.toLocaleString() + ' ' + cur : '—'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="10" style={{ padding: 0, background: '#fafbfc' }}>
            <div className="product-table" style={{ padding: '.5rem' }}>
              <table className="data-table">
                <thead id="colHeaders">
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: 0 }}>Дата</th>
                    <th style={{ textAlign: 'left' }}>Позиция</th>
                    <th style={{ textAlign: 'left' }}>Тип</th>
                    <th style={{ textAlign: 'left' }}>Сумма</th>
                    <th style={{ textAlign: 'left' }}>Вознаграждение</th>
                  </tr>
                </thead>
                <tbody>
                  {e.items.map((it, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'left', paddingLeft: 0 }}>{fmtD(it.date)}</td>
                      <td style={{ textAlign: 'left' }}>{it.name}{it.qty > 1 ? ' x' + it.qty : ''}</td>
                      <td style={{ textAlign: 'left' }}>{it.type === 'service' ? 'услуга' : it.type === 'combo' ? 'комбо' : 'товар'}</td>
                      <td style={{ textAlign: 'left' }}>{it.total.toLocaleString()} {cur}</td>
                      <td style={{ textAlign: 'left' }}>{it.bonus ? '+' + it.bonus.toLocaleString() + ' ' + cur : '—'}</td>
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
