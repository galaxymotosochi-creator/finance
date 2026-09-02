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
          const p = prods.concat(prRes.data || []).find(x => String(x.id) === String(it.product_id));
          const type = p ? p.type : 'product';
          const bonus = calcSalesBonus(byEmp[eid]?.rules || [], { product_id: it.product_id, total, qty }, prRes.data || [], crRes.data || []).rub;
          if (!byEmp[eid]) {
            const emp = (empRes.data || []).find(x => x.id === eid);
            byEmp[eid] = { empId: eid, name: emp ? emp.name : 'Сотрудник', rules: emp ? (emp.bonus_rules || []) : [], qty: 0, prodQty: 0, svcQty: 0, sum: 0, bonus: 0, items: [] };
          }
          const E = byEmp[eid];
          E.qty += qty;
          if (type === 'service') E.svcQty += qty; else E.prodQty += qty;
          E.sum += total;
          E.bonus += bonus;
          E.items.push({ date: String(r.date || '').split('T')[0], name: it.product_name, type, qty, total, bonus });
        });
      }
      const list = Object.values(byEmp).map(e => ({ ...e, items: e.items.sort((a, b) => (a.date < b.date ? 1 : -1)) }));
      list.sort((a, b) => b.sum - a.sum);
      setEmpSales(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

  const totals = empSales.reduce((s, e) => ({ qty: s.qty + e.qty, sum: s.sum + e.sum, bonus: s.bonus + e.bonus }), { qty: 0, sum: 0, bonus: 0 });

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.6rem', flexWrap: 'wrap' }}>
        {[{ k: 0, l: 'Сегодня' }, { k: 1, l: 'Вчера' }, { k: 7, l: '7 дней' }, { k: 30, l: '30 дней' }].map(b => (
          <span key={b.k} onClick={() => { setTo(tzToday()); setFrom(tzOffsetDate(b.k)); }}
            style={{ padding: '.25rem .6rem', borderRadius: '100px', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer', background: (from === tzOffsetDate(b.k) && to === tzToday()) ? '#111' : '#eee', color: (from === tzOffsetDate(b.k) && to === tzToday()) ? '#fff' : '#555', fontFamily: 'inherit', border: 'none' }}>{b.l}</span>
        ))}
        <span onClick={() => { const t = tzToday(); setFrom(t.slice(0, 8) + '01'); setTo(t); }}
          style={{ padding: '.25rem .6rem', borderRadius: '100px', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer', background: '#eee', color: '#555', fontFamily: 'inherit', border: 'none' }}>Этот месяц</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: '6px', padding: '4px 6px', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none' }} />
        <span style={{ color: '#999', fontSize: '.8rem' }}>—</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: '6px', padding: '4px 6px', fontSize: '.78rem', fontFamily: 'inherit', outline: 'none' }} />
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
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 0 }}>Сотрудник</th>
                <th style={{ textAlign: 'left' }}>Позиций</th>
                <th style={{ textAlign: 'left' }}>Товары</th>
                <th style={{ textAlign: 'left' }}>Услуги</th>
                <th style={{ textAlign: 'left' }}>Сумма продаж</th>
                <th style={{ textAlign: 'left' }}>Бонус (по правилам)</th>
              </tr>
            </thead>
            <tbody>
              {empSales.map(e => (
                <FragmentRow key={e.empId} e={e} cur={cur} fmtD={fmtD} expanded={expanded === e.empId} onToggle={() => setExpanded(expanded === e.empId ? null : e.empId)} />
              ))}
              <tr className="total-row">
                <td style={{ fontWeight: 600, textAlign: 'left', paddingLeft: 0 }}>Итого</td>
                <td style={{ textAlign: 'left', fontWeight: 700 }}>{totals.qty}</td>
                <td style={{ textAlign: 'left' }}></td>
                <td style={{ textAlign: 'left' }}></td>
                <td style={{ textAlign: 'left', fontWeight: 700 }}>{totals.sum.toLocaleString()} {cur}</td>
                <td style={{ textAlign: 'left', fontWeight: 700, color: '#2563eb' }}>+{totals.bonus.toLocaleString()} {cur}</td>
              </tr>
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
        <td style={{ textAlign: 'left', paddingLeft: 0, fontWeight: 600 }}>{expanded ? '▾ ' : '▸ '}{e.name}</td>
        <td style={{ textAlign: 'left' }}>{e.qty}</td>
        <td style={{ textAlign: 'left', color: e.prodQty ? '#555' : '#bbb' }}>{e.prodQty || '—'}</td>
        <td style={{ textAlign: 'left', color: e.svcQty ? '#555' : '#bbb' }}>{e.svcQty || '—'}</td>
        <td style={{ textAlign: 'left' }}>{e.sum.toLocaleString()} {cur}</td>
        <td style={{ textAlign: 'left', color: e.bonus ? '#2563eb' : '#bbb', fontWeight: e.bonus ? 600 : 400 }}>{e.bonus ? '+' + e.bonus.toLocaleString() + ' ' + cur : '—'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="6" style={{ padding: 0, background: '#fafbfc' }}>
            <div style={{ padding: '.3rem .6rem .6rem', fontSize: '.75rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', width: '90px', padding: '.3rem .4rem', color: '#888', fontWeight: 500, fontSize: '.7rem' }}>Дата</th>
                    <th style={{ textAlign: 'left', padding: '.3rem .4rem', color: '#888', fontWeight: 500, fontSize: '.7rem' }}>Позиция</th>
                    <th style={{ textAlign: 'left', width: '70px', padding: '.3rem .4rem', color: '#888', fontWeight: 500, fontSize: '.7rem' }}>Тип</th>
                    <th style={{ textAlign: 'right', width: '90px', padding: '.3rem .4rem', color: '#888', fontWeight: 500, fontSize: '.7rem' }}>Сумма</th>
                    <th style={{ textAlign: 'right', width: '90px', padding: '.3rem .4rem', color: '#888', fontWeight: 500, fontSize: '.7rem' }}>Бонус</th>
                  </tr>
                </thead>
                <tbody>
                  {e.items.map((it, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'left', padding: '.25rem .4rem', color: '#777', fontSize: '.72rem' }}>{fmtD(it.date)}</td>
                      <td style={{ textAlign: 'left', padding: '.25rem .4rem', fontSize: '.74rem' }}>{it.name}{it.qty > 1 ? ' x' + it.qty : ''}</td>
                      <td style={{ textAlign: 'left', padding: '.25rem .4rem', color: it.type === 'service' ? '#7c3aed' : '#777', fontSize: '.72rem' }}>{it.type === 'service' ? 'услуга' : 'товар'}</td>
                      <td style={{ textAlign: 'right', padding: '.25rem .4rem', fontSize: '.72rem' }}>{it.total.toLocaleString()} {cur}</td>
                      <td style={{ textAlign: 'right', padding: '.25rem .4rem', fontSize: '.72rem', color: it.bonus ? '#2563eb' : '#bbb' }}>{it.bonus ? '+' + it.bonus.toLocaleString() : '—'}</td>
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
