import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';

// «Формирование поставки» — рабочая страница заказа товаров
// Собирается из аналитики (что заказать): позиции, поставщик, какая закупка (ссылка/цена), количество
export default function OrderForm() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [suppliesList, setSuppliesList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [soldByProduct, setSoldByProduct] = useState({});
  const [period, setPeriod] = useState(30);

  // Заказ: отмеченные позиции, поставщик, закупка, количество, цена
  const [picked, setPicked] = useState({});
  const [qty, setQty] = useState({});
  const [sup, setSup] = useState({});
  const [pur, setPur] = useState({});
  const [cost, setCost] = useState({});

  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const from = new Date();
        from.setDate(from.getDate() - period);
        const fromStr = from.toISOString().split('T')[0];
        const [prodRes, supRes, supListRes, woRes, recRes] = await Promise.all([
          supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('supplies').select('*').eq('user_id', user.id).order('date', { ascending: true }),
          supabase.from('suppliers').select('*').eq('user_id', user.id),
          supabase.from('writeoffs').select('*').eq('user_id', user.id),
          supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', fromStr),
        ]);
        if (prodRes.error) throw prodRes.error;
        setProducts((prodRes.data || []).filter(p => !p.hidden && p.type !== 'service'));
        setSuppliesList(supRes.data || []);
        setSuppliersList(supListRes.data || []);

        // Остатки: приход − списание
        const map = {};
        (supRes.data || []).forEach(sp => {
          (sp.items || []).forEach(it => {
            const pid = it.prodId;
            if (pid == null) return;
            if (!map[pid]) map[pid] = { qty: 0, cost: 0 };
            const q = Number(it.qty) || 0;
            map[pid].qty += q;
            map[pid].cost += q * (Number(it.cost) || 0);
          });
        });
        (woRes.data || []).forEach(w => {
          (w.items || []).forEach(it => {
            const pid = it.prodId;
            if (pid == null || !map[pid]) return;
            const q = Number(it.qty) || 0;
            const prevQty = map[pid].qty || 0;
            const avg = prevQty > 0 ? map[pid].cost / prevQty : 0;
            map[pid].qty -= q;
            map[pid].cost -= avg * q;
          });
        });
        setStockMap(map);

        // Продажи из чеков (с учётом возвратов)
        const recs = recRes.data || [];
        const sold = {};
        if (recs.length > 0) {
          const { data: items } = await supabase.from('receipt_items')
            .select('id,receipt_id,product_id,product_name,quantity,total')
            .in('receipt_id', recs.map(r => r.id));
          const recById = {};
          recs.forEach(r => { recById[r.id] = r; });
          (items || []).forEach(it => {
            const pid = it.product_id != null ? String(it.product_id) : null;
            if (!pid) return;
            const r = recById[it.receipt_id];
            const qtyAll = Number(it.quantity) || 0;
            const totalAll = Number(it.total) || 0;
            let retQty = 0, retSum = 0;
            if (r && (r.refund_items || []).length) {
              const unit = qtyAll > 0 ? totalAll / qtyAll : 0;
              (r.refund_items || []).forEach(rf => {
                if (rf.item_id == null || String(rf.item_id) !== String(it.id)) return;
                const rq = Number(rf.qty) || 0;
                if (rq <= 0) return;
                retQty += rq; retSum += unit * rq;
              });
            }
            if (!sold[pid]) sold[pid] = { qty: 0, revenue: 0 };
            sold[pid].qty += Math.max(0, qtyAll - retQty);
            sold[pid].revenue += Math.max(0, totalAll - retSum);
          });
        }
        setSoldByProduct(sold);
      } catch (e) {
        showToast('Ошибка загрузки: ' + (e.message || 'неизвестная'));
      }
      setLoading(false);
    })();
  }, [user, period]);

  // История закупок по каждому товару
  const purchasesByProduct = useMemo(() => {
    const map = {};
    suppliesList.forEach(sp => {
      const date = sp.date || (sp.created_at || '').slice(0, 10) || '';
      (sp.items || []).forEach(it => {
        const pid = it.prodId != null ? String(it.prodId) : null;
        if (!pid) return;
        if (!map[pid]) map[pid] = [];
        map[pid].push({
          date,
          supplierName: sp.supplier_name || '',
          supplierId: sp.supplier_id || null,
          cost: Number(it.cost) || 0,
          orderUrl: (it.orderUrl || '').trim(),
        });
      });
    });
    Object.keys(map).forEach(pid => {
      map[pid].forEach(rec => {
        const s = suppliersList.find(x => (rec.supplierId && String(x.id) === String(rec.supplierId)) || x.name === rec.supplierName);
        rec.method = s ? (s.contact_method || '') : '';
        rec.contact = s ? (s.order_link || '') : '';
        rec.supplierId = s ? s.id : rec.supplierId;
      });
      map[pid].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });
    return map;
  }, [suppliesList, suppliersList]);

  // Позиции «что заказать»: заканчивается или уже нет
  const orderRows = useMemo(() => {
    return products.map(p => {
      const st = stockMap[p.id] || { qty: 0, cost: 0 };
      const q = Math.max(0, st.qty);
      const sold = soldByProduct[String(p.id)] || { qty: 0 };
      const dailySales = sold.qty / (period || 1);
      const daysLeft = dailySales > 0 ? Math.floor(q / dailySales) : (q > 0 ? 999 : 0);
      const costPrice = st.qty > 0 && st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
      return { ...p, qty: q, dailySales, daysLeft, costPrice };
    }).filter(r => r.qty === 0 || (r.dailySales > 0 && r.daysLeft <= 7))
      .sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));
  }, [products, stockMap, soldByProduct, period]);

  // Открытие: отметить все, подставить последнего поставщика и его последнюю закупку
  useEffect(() => {
    if (loading || orderRows.length === 0) return;
    const p = {}, q = {}, s = {}, u = {}, c = {};
    orderRows.forEach(r => {
      const pid = String(r.id);
      const hist = purchasesByProduct[pid] || [];
      p[pid] = true;
      s[pid] = hist[0] ? hist[0].supplierName : '';
      u[pid] = 0;
      c[pid] = hist[0] ? hist[0].cost : (r.costPrice || 0);
      q[pid] = Math.max(1, Math.ceil((r.dailySales || 0) * 14) - r.qty);
    });
    setPicked(p); setQty(q); setSup(s); setPur(u); setCost(c);
  }, [loading, orderRows, purchasesByProduct]);

  // Позиции с выбранными поставщиком/закупкой/ценой
  const rows = useMemo(() => {
    return orderRows.map(r => {
      const pid = String(r.id);
      const hist = purchasesByProduct[pid] || [];
      const chosenSup = sup[pid] !== undefined ? sup[pid] : (hist[0] ? hist[0].supplierName : '');
      const supHist = chosenSup ? hist.filter(h => h.supplierName === chosenSup) : [];
      const purIdx = pur[pid] !== undefined ? pur[pid] : 0;
      const purchase = supHist[purIdx] || supHist[0] || null;
      const lastCost = purchase ? purchase.cost : (r.costPrice || 0);
      const c = cost[pid] !== undefined ? cost[pid] : lastCost;
      const q = qty[pid] !== undefined ? qty[pid] : Math.max(1, Math.ceil((r.dailySales || 0) * 14) - r.qty);
      return {
        ...r,
        pid,
        history: hist,
        supHistory: supHist,
        supplierName: chosenSup,
        purIdx,
        lastCost,
        cost: c,
        qty: q,
        orderUrl: purchase ? purchase.orderUrl : '',
        method: purchase ? purchase.method : '',
        contact: purchase ? purchase.contact : '',
        sum: (q === '' ? 0 : q) * (c === '' ? 0 : c),
      };
    });
  }, [orderRows, purchasesByProduct, sup, pur, cost, qty]);

  const pickedRows = rows.filter(r => picked[r.pid]);
  const pickedCount = pickedRows.length;
  const pickedSum = pickedRows.reduce((s, r) => s + r.sum, 0);

  // Группы по поставщику + позиции без поставщика
  const groups = useMemo(() => {
    const byKey = {};
    const noSupplier = [];
    pickedRows.forEach(r => {
      if (!r.supplierName) { noSupplier.push(r); return; }
      if (!byKey[r.supplierName]) byKey[r.supplierName] = { name: r.supplierName, method: r.method, contact: r.contact, items: [] };
      byKey[r.supplierName].items.push(r);
      if (!byKey[r.supplierName].method && r.method) {
        byKey[r.supplierName].method = r.method;
        byKey[r.supplierName].contact = r.contact;
      }
    });
    const list = Object.values(byKey).map(g => {
      const total = g.items.reduce((s, r) => s + r.sum, 0);
      const lines = g.items.map((r, i) => `${i + 1}. ${r.name} — ${r.qty} шт`);
      const text = 'Заказ:\n' + lines.join('\n') + '\nИтого: ' + g.items.length + ' поз.' + (total > 0 ? ', ' + total.toLocaleString() + ' ' + cur : '');
      return { ...g, total, text };
    });
    return { list, noSupplier };
  }, [pickedRows, cur]);

  const sendGroup = (g) => {
    const text = encodeURIComponent(g.text);
    const raw = (g.contact || '').trim();
    if (g.method === 'whatsapp' && raw) return window.open('https://wa.me/' + raw.replace(/[^0-9]/g, '') + '?text=' + text, '_blank');
    if (g.method === 'telegram' && raw) return window.open('https://t.me/' + raw.replace(/^@/, '') + '?text=' + text, '_blank');
    if (g.method === 'max' && raw) return window.open(raw, '_blank');
    const links = g.items.filter(x => x.orderUrl);
    if (links.length === 0) return showToast('У позиций нет ссылок на товар');
    links.forEach(x => window.open(/^https?:\/\//i.test(x.orderUrl) ? x.orderUrl : 'https://' + x.orderUrl, '_blank'));
  };

  if (loading) return <CenterSpinner />;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate('/stock/health')} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--muted)', padding: 0, lineHeight: 1 }}>←</button>
            <h1 style={{ margin: 0 }}>Формирование поставки</h1>
          </div>
          <div className="sub">Отметьте товары, выберите поставщика и закупку — затем отправьте заказ</div>
        </div>
        <div className="page-actions">
          <button className="f-pill" onClick={() => {
            const all = pickedCount === rows.length;
            const p = {};
            rows.forEach(r => { p[r.pid] = !all; });
            setPicked(p);
          }}>{pickedCount === rows.length ? 'Снять все' : 'Выбрать все'}</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="sk-card"><div className="sk-empty">Все товары обеспечены — заказывать нечего</div></div>
      ) : (
        <>
          {/* Итого */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.7rem 1rem', background: 'linear-gradient(135deg,#4a92ff 0%,#1d78fc 45%,#0d4ea8 100%)', borderRadius: 12, color: '#fff', marginBottom: '.85rem' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 600 }}>Отмечено: {pickedCount} поз.</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>{pickedSum.toLocaleString()} {cur}</span>
          </div>

          {/* Таблица позиций */}
          <div className="sk-card" style={{ padding: 0, marginBottom: '1rem' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="ord-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th style={{ minWidth: 180, textAlign: 'left' }}>Товар</th>
                    <th style={{ minWidth: 140, textAlign: 'left' }}>Поставщик</th>
                    <th style={{ minWidth: 200, textAlign: 'left' }}>Закупка</th>
                    <th style={{ width: 90, textAlign: 'center' }}>Закупить</th>
                    <th style={{ width: 92, textAlign: 'right' }}>Последняя</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Цена закупки</th>
                    <th style={{ width: 104, textAlign: 'right' }}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const on = !!picked[r.pid];
                    const supNames = Array.from(new Set((r.history || []).map(h => h.supplierName).filter(Boolean)));
                    return (
                      <tr key={r.pid} style={{ background: on ? 'rgba(29,120,252,.03)' : '#fff' }}>
                        <td style={{ textAlign: 'center' }}>
                          <span className="dd-cb" onClick={() => setPicked(prev => ({ ...prev, [r.pid]: !prev[r.pid] }))}
                            style={{ width: 17, height: 17, border: '1.5px solid ' + (on ? '#1F75FF' : '#c9c9d1'), borderRadius: '50%', background: on ? '#1F75FF' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            {on && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                          </span>
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#222', lineHeight: 1.25 }}>{r.name}</div>
                          <div style={{ fontSize: '.68rem', color: 'var(--sk-muted)' }}>
                            остаток {r.qty} шт · {r.dailySales >= 1 ? Math.round(r.dailySales) : r.dailySales.toFixed(2)} шт/день
                          </div>
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          {supNames.length > 0 ? (
                            <select value={r.supplierName || ''} className="ord-sel"
                              onChange={e => {
                                setSup(prev => ({ ...prev, [r.pid]: e.target.value }));
                                setPur(prev => ({ ...prev, [r.pid]: 0 }));
                                setCost(prev => { const n = { ...prev }; delete n[r.pid]; return n; });
                              }}>
                              <option value="">не выбран</option>
                              {supNames.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: '.72rem', color: '#dc2626', fontWeight: 600 }}>Поставщик не выбран</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          {r.supHistory && r.supHistory.length > 0 ? (
                            <select value={r.purIdx} className="ord-sel"
                              onChange={e => {
                                setPur(prev => ({ ...prev, [r.pid]: parseInt(e.target.value) || 0 }));
                                setCost(prev => { const n = { ...prev }; delete n[r.pid]; return n; });
                              }}>
                              {r.supHistory.map((h, ix) => (
                                <option key={ix} value={ix}>
                                  {h.date || '—'} · {h.cost.toLocaleString()} {cur}{h.orderUrl ? ' · ссылка' : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: '.72rem', color: 'var(--sk-muted)' }}>закупок не было</span>
                          )}
                          {r.orderUrl && (
                            <div style={{ marginTop: '3px' }}>
                              <a href={(/^https?:\/\//i.test(r.orderUrl) ? r.orderUrl : 'https://' + r.orderUrl)} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: '.68rem', color: '#1F75FF', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                Открыть ссылку ↗
                              </a>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="number" min="0" value={r.qty}
                            onChange={e => setQty(prev => ({ ...prev, [r.pid]: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0) }))}
                            style={{ width: 66, padding: '.25rem .3rem', border: '1px solid rgba(29,120,252,.2)', borderRadius: 6, fontSize: '.76rem', textAlign: 'center', fontFamily: 'inherit', outline: 'none' }} />
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '.76rem', color: 'var(--sk-muted)', whiteSpace: 'nowrap' }}>
                          {r.lastCost > 0 ? r.lastCost.toLocaleString() + ' ' + cur : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="number" min="0" value={r.cost}
                            onChange={e => setCost(prev => ({ ...prev, [r.pid]: e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0) }))}
                            style={{ width: 78, padding: '.25rem .3rem', border: '1px solid rgba(29,120,252,.2)', borderRadius: 6, fontSize: '.76rem', textAlign: 'center', fontFamily: 'inherit', outline: 'none' }} />
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '.8rem', fontWeight: 700, color: '#111', whiteSpace: 'nowrap' }}>
                          {r.sum.toLocaleString()} {cur}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Группы по поставщикам */}
          {groups.list.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', marginBottom: '.75rem' }}>
              {groups.list.map((g, gi) => (
                <div key={gi} style={{ border: '1px solid rgba(29,120,252,.14)', borderRadius: 12, padding: '.7rem .85rem', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: '.84rem', fontWeight: 700, color: '#222' }}>
                        {g.name}
                        {g.method === 'whatsapp' ? ' · WhatsApp' : g.method === 'telegram' ? ' · Telegram' : g.method === 'max' ? ' · MAX' : g.method === 'link' ? ' · маркетплейс' : ''}
                      </div>
                      <div style={{ fontSize: '.7rem', color: 'var(--sk-muted)' }}>
                        {g.items.length} поз.{g.total > 0 ? ' · ' + g.total.toLocaleString() + ' ' + cur : ''}
                      </div>
                    </span>
                    <button type="button" className="sk-dd-btn" onClick={() => sendGroup(g)}>
                      {(g.method === 'whatsapp' || g.method === 'telegram' || g.method === 'max')
                        ? 'Отправить в ' + (g.method === 'whatsapp' ? 'WhatsApp' : g.method === 'telegram' ? 'Telegram' : 'MAX')
                        : 'Открыть ссылки (' + g.items.filter(x => x.orderUrl).length + ')'}
                    </button>
                  </div>
                  <div style={{ marginTop: '.5rem', background: '#f6f9ff', border: '1px solid rgba(29,120,252,.1)', borderRadius: 8, padding: '.55rem .65rem', fontSize: '.73rem', color: '#3b4657', whiteSpace: 'pre-line', lineHeight: 1.45 }}>
                    {g.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Без поставщика */}
          {groups.noSupplier.length > 0 && (
            <div style={{ border: '1px solid rgba(220,38,38,.25)', background: '#fff7f7', borderRadius: 12, padding: '.7rem .85rem' }}>
              <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#dc2626' }}>
                Поставщик не выбран — {groups.noSupplier.length} поз.
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--sk-muted)', marginTop: '2px' }}>
                Выберите поставщика в колонке «Поставщик», чтобы отправить заказ
              </div>
              <button type="button" className="f-pill" style={{ marginTop: '.5rem' }}
                onClick={() => {
                  const text = 'Заказ:\n' + groups.noSupplier.map((r, i) => `${i + 1}. ${r.name} — ${r.qty} шт`).join('\n');
                  navigator.clipboard.writeText(text);
                  showToast('Список скопирован');
                }}>
                Скопировать список
              </button>
            </div>
          )}
        </>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#111', color: '#fff', padding: '.6rem 1.1rem', borderRadius: 999, fontSize: '.8rem', zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </>
  );
}
