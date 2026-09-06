import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import { tzToday, tzOffsetDate } from '../../lib/dates';
import CenterSpinner from '../../components/CenterSpinner';

const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const dkey = (ds) => String(ds || '').split('T')[0];

function dayLabel(iso) {
  if (!iso) return '—';
  const p = iso.split('-');
  const d = new Date(p[0], p[1] - 1, p[2]);
  return `${DOW[d.getDay()]}, ${p[2]}.${p[1]}`;
}
const rubl = (n) => Math.round(n || 0).toLocaleString('ru-RU');

export default function EmployeeReport() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [fEmpId, setFEmpId] = useState('all');
  const [fromISO, setFromISO] = useState('');
  const [toISO, setToISO] = useState('');
  const [employees, setEmployees] = useState([]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  const pickRange = (k) => {
    if (k === 0) { setFromISO(tzToday()); setToISO(tzToday()); }
    else { setToISO(tzToday()); setFromISO(tzOffsetDate(k)); }
  };
  const pickAll = () => { setFromISO(''); setToISO(''); };
  useEffect(() => { setFromISO(''); setToISO(''); }, []); // весь период по умолч.
  useEffect(() => { load(); }, [fEmpId, fromISO, toISO]); // eslint-disable-line

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const empRes = await supabase.from('employees').select('*').eq('user_id', user.id).order('name');
      const emps = empRes.data || [];
      setEmployees(emps);
      const from = fromISO || '2001-01-01';
      const to = toISO || '2999-12-31';

      const [rxRes, salRes] = await Promise.all([
        supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', from).lte('date', to),
        supabase.from('salary').select('*').eq('user_id', user.id).gte('date', from).lte('date', to),
      ]);
      const recs = rxRes.data || [];
      const sals = salRes.data || [];

      const byKey = {};
      const empName = (id) => { const e = emps.find((x) => String(x.id) === String(id)); return e ? e.name : 'Сотрудник'; };
      const rowFor = (empId, iso) => {
        if (empId == null || !iso) return null;
        const key = String(empId) + '::' + iso;
        if (!byKey[key]) byKey[key] = { empId, name: empName(empId), iso, qty: 0, receipts: 0, executorSum: 0, sellerSum: 0, executorItems: [], sellerItems: [], bonus: 0 };
        return byKey[key];
      };

      const recById = {}; recs.forEach((r) => { recById[r.id] = r; });
      let items = [];
      if (recs.length) {
        const { data } = await supabase.from('receipt_items').select('*').in('receipt_id', recs.map((r) => r.id));
        items = data || [];
      }
      const counted = {}; // receipt_id->count
      items.forEach((it) => {
        const r = recById[it.receipt_id];
        if (!r) return;
        const iso = r.date ? dkey(r.date) : null;
        const amount = Number(it.total) || 0;
        const q = Number(it.quantity) || 1;
        // исполнитель услуги/мастер — employee_id на позиции
        const exId = it.employee_id;
        if (exId != null) {
          const rw = rowFor(exId, iso);
          if (rw) { rw.executorSum += amount; rw.executorItems.push({ n: it.product_name + (q > 1 ? ' x' + q : ''), v: amount }); }
        }
        // продавец/исполнители из сплитов
        const splits = it.employee_splits || [];
        if (splits.length) {
          splits.forEach((sp) => {
            const rw = rowFor(sp.employee_id, iso);
            if (rw) { rw.sellerSum += Number(sp.amount) || 0; rw.sellerItems.push({ n: it.product_name, v: Number(sp.amount) || 0 }); }
          });
        }
      });

      // начисления зарплаты (премии) по дням
      (sals || []).forEach((s) => {
        const iso = s.date ? dkey(s.date) : (s.created_at ? dkey(s.created_at) : null);
        const eid = s.employee_id;
        const rw = rowFor(eid, iso);
        if (rw && Number(s.bonus_amount)) rw.bonus += Number(s.bonus_amount);
      });

      let rows = Object.values(byKey);
      if (fEmpId !== 'all') rows = rows.filter((x) => String(x.empId) === String(fEmpId));
      rows.sort((a, b) => (a.iso < b.iso ? 1 : -1));
      setDays(rows);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const totSales = days.reduce((s, d) => s + d.executorSum + d.sellerSum, 0);
  const totQty = days.reduce((s, d) => s + d.qty, 0);
  const totBonus = days.reduce((s, d) => s + d.bonus, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Отчёт — работа сотрудников</h1>
          <div className="sub">Продажи, исполнители и начисления по дням</div>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '.5rem', flexWrap: 'wrap', margin: '6px 0 10px' }}>
        <div>
          <div style={{ fontSize: '.68rem', color: 'rgba(0,0,0,.34)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Сотрудник</div>
          <select value={fEmpId} onChange={(e) => setFEmpId(e.target.value)}
            style={{ border: '1.5px solid var(--border)', borderRadius: '8px', padding: '.3rem .5rem', fontSize: '.8rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
            <option value="all">Все сотрудники</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          {[{ k: 0, l: 'Сегодня' }, { k: 7, l: '7 дней' }, { k: 30, l: '30 дней' }, { k: 'm', l: 'Все время' }].map((b) => (
            <span key={b.k === 'm' ? 'm' : b.k}
              onClick={() => b.k === 'm' ? pickAll() : pickRange(b.k)}
              style={{ padding: '.3rem .7rem', borderRadius: '100px', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer', background: (!fromISO && b.k === 'm') || (b.k !== 'm' && fromISO === tzOffsetDate(b.k) && toISO === tzToday()) ? '#111' : '#eee', color: ((!fromISO && b.k === 'm') || (b.k !== 'm' && fromISO === tzOffsetDate(b.k) && toISO === tzToday())) ? '#fff' : '#555', fontFamily: 'inherit', border: 'none', userSelect: 'none' }}>{b.l}</span>
          ))}
          <input type="date" value={fromISO} onChange={(e) => setFromISO(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: '6px', padding: '4px 6px', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none' }} />
          <span style={{ color: '#999', fontSize: '.8rem' }}>—</span>
          <input type="date" value={toISO} onChange={(e) => setToISO(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: '6px', padding: '4px 6px', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px', margin: '4px 0 16px' }}>
        <div style={{ borderRadius: '14px', padding: '14px 18px', color: '#fff', background: 'linear-gradient(135deg,#2563eb,#3b82f6)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: .92 }}>Продажи за период</div>
          <div style={{ fontSize: '25px', fontWeight: 800, marginTop: 5 }}>{rubl(totSales)} {cur}</div>
        </div>
        <div style={{ borderRadius: '14px', padding: '14px 18px', color: '#fff', background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: .92 }}>Чеков</div>
          <div style={{ fontSize: '25px', fontWeight: 800, marginTop: 5 }}>{totQty}</div>
        </div>
        <div style={{ borderRadius: '14px', padding: '14px 18px', color: '#fff', background: 'linear-gradient(135deg,#ea580c,#f59e0b)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: .92 }}>Премии</div>
          <div style={{ fontSize: '25px', fontWeight: 800, marginTop: 5 }}>+{rubl(totBonus)} {cur}</div>
        </div>
      </div>

      {loading ? <CenterSpinner /> : days.length === 0 ? (
        <div className="empty-products" style={{ marginTop: '1.5rem' }}>
          <div className="big-icon">📊</div>
          <p>За этот период нет данных по сотрудникам</p>
        </div>
      ) : (
        <div className="table-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 0 }}>Дата</th>
                <th style={{ textAlign: 'left' }}>Сотрудник</th>
                <th style={{ textAlign: 'right' }}>Исполнитель</th>
                <th style={{ textAlign: 'right' }}>Продавец</th>
                <th style={{ textAlign: 'left' }}>Состав</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'left', paddingLeft: 0, whiteSpace: 'nowrap' }}>{dayLabel(d.iso)}</td>
                  <td style={{ textAlign: 'left', fontWeight: 600 }}>{d.name}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{d.executorSum ? rubl(d.executorSum) + ' ' + cur : '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{d.sellerSum ? rubl(d.sellerSum) + ' ' + cur : '—'}</td>
                  <td style={{ textAlign: 'left', color: '#777', fontSize: '.76rem' }}>
                    {[...d.executorItems.slice(0, 3), ...d.sellerItems.slice(0, 3)].map((x, j) => (
                      <div key={j}>{x.n} — {rubl(x.v)} {cur}</div>
                    ))}
                    {d.executorItems.length + d.sellerItems.length === 0 && <span style={{ color: '#c7c7c7' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td style={{ fontWeight: 700, textAlign: 'left', paddingLeft: 0 }}>Итого</td>
                <td></td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{rubl(days.reduce((s, x) => s + x.executorSum, 0))} {cur}</td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{rubl(days.reduce((s, x) => s + x.sellerSum, 0))} {cur}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
