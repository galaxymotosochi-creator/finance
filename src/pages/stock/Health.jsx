import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';
import Modal from '../../components/Modal';

export default function Health() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [suppliesCache, setSuppliesCache] = useState([]);
  const [writeoffs, setWriteoffs] = useState([]);
  const [soldByProduct, setSoldByProduct] = useState({});
  const [suppliesList, setSuppliesList] = useState([]); // поставки целиком — для последней закупки и ссылок
  const [suppliersList, setSuppliersList] = useState([]); // справочник поставщиков — способ заказа и контакт
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [topSort, setTopSort] = useState('qty'); // qty | revenue | profit
  const [showDead, setShowDead] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  // Модалка «Заказ»: выбранные позиции и количество к закупке
  const [orderModal, setOrderModal] = useState(false);
  const [orderPicked, setOrderPicked] = useState({});  // { productId: true }
  const [orderQty, setOrderQty] = useState({});        // { productId: число }
  const [tblPos, setTblPos] = useState({ left: false, right: false });
  const tblElRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const from = new Date();
        from.setDate(from.getDate() - period);
        const fromStr = from.toISOString().split('T')[0];
        const [prodRes, supRes, woRes, recRes, supListRes] = await Promise.all([
          supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('supplies').select('*').eq('user_id', user.id).order('date', { ascending: true }),
          supabase.from('writeoffs').select('*').eq('user_id', user.id),
          supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', fromStr),
          supabase.from('suppliers').select('*').eq('user_id', user.id),
        ]);
        if (prodRes.error) throw prodRes.error;
        if (prodRes.data) setProducts(prodRes.data.filter(p => !p.hidden && p.type !== 'service'));
        const supplies = [];
        (supRes.data || []).forEach(sp => { (sp.items || []).forEach(it => { supplies.push(it); }); });
        setSuppliesCache(supplies);
        setSuppliesList(supRes.data || []);
        setSuppliersList(supListRes.data || []);
        setWriteoffs(woRes.data || []);

        // Продажи из чеков: количество, выручка, с учётом возвратов
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
            const qtyNet = Math.max(0, qtyAll - retQty);
            const sumNet = Math.max(0, totalAll - retSum);
            if (!sold[pid]) sold[pid] = { qty: 0, revenue: 0, lastDate: null };
            sold[pid].qty += qtyNet;
            sold[pid].revenue += sumNet;
            const d = r ? (r.date || r.created_at) : null;
            if (d && (!sold[pid].lastDate || d > sold[pid].lastDate)) sold[pid].lastDate = d;
          });
        }
        setSoldByProduct(sold);
      } catch (e) {
        alert('Ошибка загрузки аналитики: ' + (e.message || 'неизвестная ошибка'));
      }
      setLoading(false);
    })();
  }, [user, period]);

  // Остатки: поставки + начальные − списания
  const stockMap = useMemo(() => {
    const map = {};
    suppliesCache.forEach(it => {
      const pid = it.product_id;
      if (!pid) return;
      if (!map[pid]) map[pid] = { qty: 0, cost: 0 };
      map[pid].qty += Number(it.quantity) || 0;
      map[pid].cost += Number(it.total) || (Number(it.quantity) || 0) * (Number(it.price) || 0);
    });
    try {
      const initial = JSON.parse(localStorage.getItem('initialStock88'));
      if (initial && initial.items) {
        Object.keys(initial.items).forEach(id => {
          const q = parseInt(initial.items[id]) || 0;
          const c = (initial.costs && parseInt(initial.costs[id])) || 0;
          if (q <= 0) return;
          if (!map[id]) map[id] = { qty: 0, cost: 0 };
          map[id].qty += q;
          map[id].cost += c * q;
        });
      }
    } catch (e) { /* нет начальных остатков */ }
    writeoffs.forEach(wo => {
      const pid = wo.product_id;
      if (!pid || !map[pid]) return;
      const q = Number(wo.quantity) || 0;
      const avg = map[pid].qty > 0 ? map[pid].cost / map[pid].qty : 0;
      map[pid].qty -= q;
      map[pid].cost -= avg * q;
    });
    return map;
  }, [suppliesCache, writeoffs]);

  // Последняя закупка по каждому товару: поставщик, дата, цена, ссылка на товар
  const lastPurchase = useMemo(() => {
    const map = {};
    suppliesList.forEach(sp => {
      const date = sp.date || (sp.created_at || '').slice(0, 10) || '';
      (sp.items || []).forEach(it => {
        const pid = it.prodId != null ? String(it.prodId) : null;
        if (!pid) return;
        const prev = map[pid];
        const cur = {
          date,
          supplierName: sp.supplier_name || sp.supplierName || '',
          supplierId: sp.supplier_id || null,
          cost: Number(it.cost) || 0,
          orderUrl: it.orderUrl || '',
        };
        if (!prev || date >= (prev.date || '')) map[pid] = cur;
      });
    });
    // Дополняем из справочника поставщиков: способ заказа и контакт для чата
    Object.keys(map).forEach(pid => {
      const rec = map[pid];
      const sup = suppliersList.find(x => (rec.supplierId && String(x.id) === String(rec.supplierId)) || x.name === rec.supplierName);
      rec.method = sup ? (sup.contact_method || '') : '';
      rec.link = sup ? (sup.order_link || '') : '';
    });
    return map;
  }, [suppliesList, suppliersList]);

  // Ссылка для заказа: сначала ссылка на товар из последней закупки, затем канал поставщика
  const orderAction = (pid) => {
    const rec = lastPurchase[String(pid)];
    if (!rec) return null;
    const url = (rec.orderUrl || '').trim();
    if (url) return { kind: 'link', url, label: 'Открыть' };
    if (rec.method === 'whatsapp' && rec.link) return { kind: 'whatsapp', url: 'https://wa.me/' + rec.link.replace(/[^0-9]/g, ''), label: 'WhatsApp' };
    if (rec.method === 'telegram' && rec.link) return { kind: 'telegram', url: 'https://t.me/' + rec.link.replace(/^@/, ''), label: 'Telegram' };
    if (rec.method === 'max' && rec.link) return { kind: 'max', url: rec.link, label: 'MAX' };
    return null;
  };

  // Данные по каждому товару: продажи за период, деньги, остаток, прогноз
  const rows = useMemo(() => {
    return products.map(p => {
      const st = stockMap[p.id] || { qty: 0, cost: 0 };
      const qty = Math.max(0, st.qty);
      const costPrice = st.qty > 0 && st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
      const retailPrice = p.price || 0;
      const sold = soldByProduct[String(p.id)] || { qty: 0, revenue: 0, lastDate: null };
      const dailySales = sold.qty / (period || 1);
      const daysLeft = dailySales > 0 ? Math.floor(qty / dailySales) : (qty > 0 ? 999 : 0);
      const revenue = Math.round(sold.revenue);
      const cost = Math.round(costPrice * sold.qty);
      const profit = revenue - cost;
      const lp = lastPurchase[String(p.id)];
      const lastCost = lp && lp.cost > 0 ? lp.cost : costPrice;
      return { ...p, qty, costPrice, retailPrice, soldQty: sold.qty, revenue, profit, dailySales, daysLeft, sumValue: costPrice * qty,
        lastCost, lastSupplier: lp ? lp.supplierName : '', lastDate: lp ? lp.date : '' };
    });
  }, [products, stockMap, soldByProduct, period, lastPurchase]);

  // Блок 2 — что заказать
  const orderRows = useMemo(() => {
    return rows
      .filter(r => r.qty === 0 || (r.dailySales > 0 && r.daysLeft <= 7))
      .sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));
  }, [rows]);

  // Позиции к заказу с данными последней закупки, каналом и предложенным количеством
  const orderData = useMemo(() => {
    return orderRows.map(r => {
      const rec = lastPurchase[String(r.id)] || {};
      const act = orderAction(r.id);
      const suggest = Math.max(1, Math.ceil((r.dailySales || 0) * 14) - r.qty);
      return {
        ...r,
        suggest,
        lastCost: r.lastCost || 0,
        supplierName: r.lastSupplier || rec.supplierName || '',
        method: rec.method || '',
        contact: rec.link || '',
        action: act,
      };
    });
  }, [orderRows, lastPurchase]);

  // Группировка отмеченных позиций по поставщику — для формирования заказов
  const orderGroups = useMemo(() => {
    const picked = orderData.filter(r => orderPicked[String(r.id)]);
    const byKey = {};
    picked.forEach(r => {
      const key = r.supplierName || '— без поставщика —';
      if (!byKey[key]) byKey[key] = { name: key, method: r.method, contact: r.contact, items: [] };
      byKey[key].items.push(r);
      if (!byKey[key].method && r.method) { byKey[key].method = r.method; byKey[key].contact = r.contact; }
    });
    return Object.values(byKey).map(g => ({
      ...g,
      total: g.items.reduce((s, r) => s + (orderQty[String(r.id)] ?? r.suggest) * (r.lastCost || 0), 0),
    }));
  }, [orderData, orderPicked, orderQty]);

  const orderPickedCount = Object.values(orderPicked).filter(Boolean).length;
  const orderPickedSum = orderGroups.reduce((s, g) => s + g.total, 0);

  // Открытие модалки: по умолчанию отмечены все, количество — предложенное
  const openOrderModal = () => {
    const picked = {}; const qty = {};
    orderData.forEach(r => { picked[String(r.id)] = true; qty[String(r.id)] = r.suggest; });
    setOrderPicked(picked); setOrderQty(qty); setOrderModal(true);
  };

  // Текст заказа для мессенджера
  const orderText = (group) => {
    const lines = group.items.map((r, i) => `${i + 1}. ${r.name} — ${orderQty[String(r.id)] ?? r.suggest} шт`);
    const sum = group.items.reduce((s, r) => s + (orderQty[String(r.id)] ?? r.suggest) * (r.lastCost || 0), 0);
    return 'Заказ:\n' + lines.join('\n') + '\nИтого: ' + group.items.length + ' поз., ' + sum.toLocaleString() + ' ' + cur;
  };

  const sendOrder = (group) => {
    const text = encodeURIComponent(orderText(group));
    const raw = (group.contact || '').trim();
    if (group.method === 'whatsapp' && raw) return window.open('https://wa.me/' + raw.replace(/[^0-9]/g, '') + '?text=' + text, '_blank');
    if (group.method === 'telegram' && raw) return window.open('https://t.me/' + raw.replace(/^@/, '') + '?text=' + text, '_blank');
    if (group.method === 'max' && raw) return window.open(raw, '_blank');
    // Ссылки на товары — открываем каждую
    group.items.forEach(r => { if (r.action && r.action.url) window.open(r.action.url, '_blank'); });
  };

  // Плитки-итоги
  const tiles = useMemo(() => {
    const soldItems = rows.filter(r => r.soldQty > 0);
    const totalQty = soldItems.reduce((s, r) => s + r.soldQty, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const profit = rows.reduce((s, r) => s + r.profit, 0);
    const toOrder = rows.filter(r => r.qty === 0 || (r.dailySales > 0 && r.daysLeft <= 7));
    const frozen = rows.filter(r => r.soldQty === 0 && r.qty > 0);
    const frozenSum = frozen.reduce((s, r) => s + r.sumValue, 0);
    return { soldCount: soldItems.length, totalQty, revenue, profit, toOrder, frozen, frozenSum };
  }, [rows]);

  // Блок 1 — ТОП продаж
  const topRows = useMemo(() => {
    const list = rows.filter(r => r.soldQty > 0);
    if (topSort === 'revenue') list.sort((a, b) => b.revenue - a.revenue);
    else if (topSort === 'profit') list.sort((a, b) => b.profit - a.profit);
    else list.sort((a, b) => b.soldQty - a.soldQty);
    return list.slice(0, 10);
  }, [rows, topSort]);

  // Блок 3 — замороженные деньги
  const frozenRows = useMemo(() => {
    return rows.filter(r => r.soldQty === 0 && r.qty > 0).sort((a, b) => b.sumValue - a.sumValue);
  }, [rows]);

  // Блок 4 — мёртвые позиции
  const deadRows = useMemo(() => rows.filter(r => r.soldQty === 0), [rows]);

  const onTblScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left: false, right: false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const checkTbl = () => {
    const el = tblElRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left: false, right: false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  useEffect(() => {
    const t = setTimeout(checkTbl, 150);
    window.addEventListener('resize', checkTbl);
    return () => { clearTimeout(t); window.removeEventListener('resize', checkTbl); };
  }, [loading, topSort, period]);

  const navigate = useNavigate();
  const navigateTo = (path) => navigate(path);

  const dot = (r) => r.qty === 0 ? '#dc2626' : (r.dailySales > 0 && r.daysLeft <= 7 ? '#dc2626' : (r.dailySales > 0 && r.daysLeft <= 30 ? '#ffcf2e' : '#1F75FF'));

  if (loading) return <CenterSpinner />;

  return (
    <>
      {/* Шапка */}
      <div className="sk-bar">
        <div className="grow">
          <h1>Аналитика товаров</h1>
          <div className="sub">Что продаётся, что заказать и где заморожены деньги</div>
        </div>
        <div className="***">
          {[[7, '7 дн'], [30, '30 дн'], [90, '90 дн']].map(([v, l]) => (
            <button key={v} type="button" className={'f-pill' + (period === v ? ' on' : '')}
              onClick={() => setPeriod(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%' }} />

      {/* Плитки-итоги */}
      <div className="sk-tiles" style={{ marginTop: '.75rem' }}>
        <div className="sk-tile sk-primary">
          <div className="sk-t">Продано за {period} дней</div>
          <div className="sk-v">{tiles.totalQty.toLocaleString()} шт</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.8)', marginTop: '2px' }}>{tiles.soldCount} позиций</div>
        </div>
        <div className="sk-tile sk-gold">
          <div className="sk-t">Выручка</div>
          <div className="sk-v">{tiles.revenue.toLocaleString()} {cur}</div>
          <div style={{ fontSize: '11px', color: 'rgba(0,0,0,.55)', marginTop: '2px' }}>
            прибыль {tiles.profit >= 0 ? '+' : ''}{tiles.profit.toLocaleString()} {cur}
          </div>
        </div>
        <div className="sk-tile">
          <div className="sk-t">Заказать срочно</div>
          <div className="sk-v" style={{ color: tiles.toOrder.length > 0 ? '#dc2626' : 'var(--sk-ink)' }}>{tiles.toOrder.length} позиций</div>
          <div style={{ fontSize: '11px', color: 'var(--sk-muted)', marginTop: '2px' }}>закончились или ≤ 7 дней</div>
        </div>
        <div className="sk-tile">
          <div className="sk-t">Заморожено</div>
          <div className="sk-v" style={{ color: tiles.frozenSum > 0 ? '#dc2626' : 'var(--sk-ink)' }}>{tiles.frozenSum.toLocaleString()} {cur}</div>
          <div style={{ fontSize: '11px', color: 'var(--sk-muted)', marginTop: '2px' }}>{tiles.frozen.length} позиций без продаж</div>
        </div>
      </div>

      {/* Блок 1 — ТОП продаж */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1rem 0 .5rem', flexWrap: 'wrap', gap: '.4rem' }}>
        <div style={{ fontSize: '.92rem', fontWeight: 800, color: 'var(--sk-ink)' }}>Что продаётся лучше всего</div>
        <div style={{ display: 'flex', gap: '.25rem' }}>
          {[['qty', 'По штукам'], ['revenue', 'По выручке'], ['profit', 'По прибыли']].map(([v, l]) => (
            <button key={v} type="button" className={'f-pill' + (topSort === v ? ' on' : '')}
              onClick={() => setTopSort(v)}>{l}</button>
          ))}
        </div>
      </div>

      {topRows.length === 0 ? (
        <div className="sk-card"><div className="sk-empty">Продаж за этот период нет</div></div>
      ) : (
        <div className="***">
          <div className="sk-fade sk-fade-l" style={{ opacity: tblPos.left ? 1 : 0 }}></div>
          <div className="sk-fade sk-fade-r" style={{ opacity: tblPos.right ? 1 : 0 }} data-arrow="top"></div>
          <div className="sk-card" style={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }} ref={tblElRef} onScroll={onTblScroll}>
            <table className="sk-table ***" style={{ minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '200px', textAlign: 'left' }}>Товар</th>
                  <th style={{ textAlign: 'left' }}>Продано</th>
                  <th style={{ textAlign: 'left' }}>Выручка</th>
                  <th style={{ textAlign: 'left' }}>Прибыль</th>
                  <th style={{ textAlign: 'left' }}>Остаток</th>
                  <th style={{ textAlign: 'left' }}>Хватит</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>
                      <span style={{ color: 'var(--sk-muted)', marginRight: '6px' }}>{i + 1}.</span>{r.name}
                    </td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.soldQty.toLocaleString()} шт</td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.revenue.toLocaleString()} {cur}</td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: r.profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {r.profit >= 0 ? '+' : ''}{r.profit.toLocaleString()} {cur}
                    </td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.qty.toLocaleString()} шт</td>
                    <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222', whiteSpace: 'nowrap' }}>
                      {r.qty === 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>закончился</span>
                        : r.daysLeft === 999 ? '—' : r.daysLeft + ' дн'}
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dot(r), marginLeft: '6px' }}></span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Блок 2 — Что заказать */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1.1rem 0 .5rem', flexWrap: 'wrap', gap: '.5rem' }}>
        <div style={{ fontSize: '.92rem', fontWeight: 800, color: 'var(--sk-ink)' }}>
          Что заказать <span style={{ fontSize: '.78rem', fontWeight: 500, color: 'var(--sk-muted)' }}>— заканчивается при текущих продажах</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', flexWrap: 'wrap' }}>
          {orderRows.length > 6 && (
            <button type="button" className={'f-pill' + (showOrder ? ' on' : '')} onClick={() => setShowOrder(!showOrder)}>
              {showOrder ? 'Скрыть список' : 'Показать список'} <span className="car-tri" style={{ display: 'inline-block', transform: showOrder ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
            </button>
          )}
          {orderRows.length > 0 && (
            <button type="button" className="sk-dd-btn" onClick={openOrderModal}>Сформировать заказ</button>
          )}
        </div>
      </div>
      {orderRows.length === 0 ? (
        <div className="sk-card"><div className="sk-empty">Все товары обеспечены — заказывать нечего</div></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {(showOrder ? orderRows : orderRows.slice(0, 6)).map(r => {
              const pct = r.qty === 0 ? 0 : Math.min(100, Math.round(((r.daysLeft === 999 ? 90 : r.daysLeft) / 90) * 100));
              const need = Math.max(1, Math.ceil(r.dailySales * 14) - r.qty);
              return (
                <div key={r.id} className="sk-tile" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--sk-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <span className="f-pill on" style={{ fontSize: '.62rem', padding: '2px 8px', cursor: 'default' }}>{r.qty === 0 ? 'Закончился' : '≤ ' + r.daysLeft + ' дн'}</span>
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--sk-muted)', margin: '6px 0' }}>
                    Осталось {r.qty} шт / Продается в день {r.dailySales >= 1 ? Math.round(r.dailySales) : r.dailySales.toFixed(2)} шт
                  </div>
                  <div style={{ background: '#eef4ff', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: pct <= 15 ? '#dc2626' : '#1F75FF', borderRadius: '6px', transition: 'width .3s ease' }}></div>
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--sk-muted)', marginTop: '6px' }}>
                    За {period} дней продано {r.soldQty} шт / Выручка {r.revenue.toLocaleString()} {cur}
                  </div>
                  {r.lastSupplier && (
                    <div style={{ fontSize: '.72rem', color: 'var(--sk-muted)', marginTop: '4px' }}>
                      Последняя закупка: {r.lastSupplier}{r.lastDate ? ' · ' + r.lastDate : ''} · по {r.lastCost.toLocaleString()} {cur}
                    </div>
                  )}
                  {orderAction(r.id) && (
                    <div style={{ fontSize: '.72rem', marginTop: '4px' }}>
                      <span style={{ color: 'var(--sk-muted)' }}>Заказ: </span>
                      <a href={orderAction(r.id).url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#111', fontWeight: 600, textDecoration: 'none' }}>
                        {orderAction(r.id).label} <span className="car-tri" style={{ fontSize: '12px' }}>↗</span>
                      </a>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button type="button" className="sk-dd-btn" style={{ width: 'auto' }}
                      onClick={openOrderModal}>
                      {r.qty === 0 ? 'Заказать товар' : 'Заказать ещё ' + need + ' шт'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {!showOrder && orderRows.length > 6 && (
            <div style={{ fontSize: '.74rem', color: 'var(--sk-muted)', marginTop: '.5rem', textAlign: 'center' }}>
              Показаны первые 6 из {orderRows.length} — раскройте список, чтобы увидеть все
            </div>
          )}
        </>
      )}

      {/* Блок 3 — Замороженные деньги */}
      <div style={{ fontSize: '.92rem', fontWeight: 800, color: 'var(--sk-ink)', margin: '1.1rem 0 .5rem' }}>
        Замороженные деньги <span style={{ fontSize: '.78rem', fontWeight: 500, color: 'var(--sk-muted)' }}>— лежит, но не продаётся за {period} дней</span>
      </div>
      {frozenRows.length === 0 ? (
        <div className="sk-card"><div className="sk-empty">Все товары продаются — заморозки нет</div></div>
      ) : (
        <div className="sk-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="sk-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Товар</th>
                <th style={{ textAlign: 'left' }}>Лежит</th>
                <th style={{ textAlign: 'left' }}>Вложено</th>
                <th style={{ textAlign: 'left' }}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {frozenRows.map(r => (
                <tr key={r.id}>
                  <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.name}</td>
                  <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#222' }}>{r.qty} шт · без продаж</td>
                  <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#dc2626', fontWeight: 600 }}>{r.sumValue.toLocaleString()} {cur}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button type="button" className="f-pill" onClick={() => navigateTo('/stock/writeoffs')}>Уценить / Списать</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Блок 4 — Мёртвые позиции */}
      <div style={{ fontSize: '.92rem', fontWeight: 800, color: 'var(--sk-ink)', margin: '1.1rem 0 .5rem' }}>
        Мёртвые позиции <span style={{ fontSize: '.78rem', fontWeight: 500, color: 'var(--sk-muted)' }}>— ни одной продажи за {period} дней</span>
      </div>
      <div className="sk-card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--sk-ink)' }}>
            Позиций: <b>{deadRows.length}</b> · вложено: <b style={{ color: deadRows.length > 0 ? '#dc2626' : 'var(--sk-ink)' }}>{deadRows.reduce((s, r) => s + r.sumValue, 0).toLocaleString()} {cur}</b>
          </div>
          {deadRows.length > 0 && (
            <button type="button" className={'f-pill' + (showDead ? ' on' : '')} onClick={() => setShowDead(!showDead)}>
              {showDead ? 'Скрыть список' : 'Показать список'} <span className="car-tri" style={{ transform: showDead ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
          )}
        </div>
        {showDead && deadRows.length > 0 && (
          <div style={{ marginTop: '.6rem', borderTop: '1px solid rgba(29,120,252,.14)', paddingTop: '.5rem' }}>
            {deadRows.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.45rem .55rem', borderRadius: '.5rem', fontSize: '.8rem', color: '#5b6472' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dfe6f2', flexShrink: 0 }}></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{r.qty} шт</span>
                <span style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#111' }}>{r.sumValue.toLocaleString()} {cur}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка «Заказ»: галочки, количество, последняя цена закупки, отправка поставщикам */}
      <Modal open={orderModal} onClose={() => setOrderModal(false)} title="Заказ товаров"
        subtitle={orderPickedCount > 0 ? `Отмечено ${orderPickedCount} поз. · ${orderPickedSum.toLocaleString()} ${cur}` : 'Отметьте товары, которые нужно заказать'}
        width="large"
        actions={<>
          <button type="button" className="btn btn-outline" onClick={() => setOrderModal(false)}>Закрыть</button>
          <button type="button" className="btn btn-outline" onClick={() => {
            const all = orderPickedCount === orderData.length;
            const picked = {}; 
            orderData.forEach(r => { picked[String(r.id)] = !all; });
            setOrderPicked(picked);
          }}>{orderPickedCount === orderData.length ? 'Снять все' : 'Выбрать все'}</button>
        </>}>
        {orderData.length === 0 ? (
          <div className="sk-empty">Нет позиций к заказу</div>
        ) : (
          <>
            {/* Позиции с галочками — таблица со скроллом (мобильная + планшет) */}
            <div style={{ border: '1px solid rgba(29,120,252,.14)', borderRadius: 12, overflow: 'hidden', marginBottom: '.75rem' }}>
              <div className="ord-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxHeight: 380, overflowY: 'auto' }}>
                <table className="ord-table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}></th>
                      <th style={{ minWidth: 170, textAlign: 'left' }}>Товар</th>
                      <th style={{ width: 84, textAlign: 'center' }}>Закупить</th>
                      <th style={{ width: 82, textAlign: 'right' }}>Цена</th>
                      <th style={{ width: 96, textAlign: 'right' }}>Сумма</th>
                      <th style={{ width: 104, textAlign: 'center' }}>Заказ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderData.map(r => {
                      const id = String(r.id);
                      const on = !!orderPicked[id];
                      const q = orderQty[id] ?? r.suggest;
                      const act = r.action;
                      return (
                        <tr key={r.id} style={{ background: on ? 'rgba(29,120,252,.03)' : '#fff' }}>
                          <td style={{ textAlign: 'center' }}>
                            <span className="dd-cb" onClick={() => setOrderPicked(prev => ({ ...prev, [id]: !prev[id] }))}
                              style={{ width: 17, height: 17, border: '1.5px solid ' + (on ? '#1F75FF' : '#c9c9d1'), borderRadius: '50%', background: on ? '#1F75FF' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              {on && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                            </span>
                          </td>
                          <td style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#222', whiteSpace: 'normal', lineHeight: 1.25 }}>{r.name}</div>
                            <div style={{ fontSize: '.68rem', color: 'var(--sk-muted)', whiteSpace: 'nowrap' }}>
                              остаток {r.qty} шт · {r.dailySales >= 1 ? Math.round(r.dailySales) : r.dailySales.toFixed(2)} шт/день
                              {r.lastSupplier ? ' · ' + r.lastSupplier : ''}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="number" min="0" value={q}
                              onChange={e => setOrderQty(prev => ({ ...prev, [id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                              style={{ width: 64, padding: '.2rem .3rem', border: '1px solid rgba(29,120,252,.2)', borderRadius: 6, fontSize: '.75rem', textAlign: 'center', fontFamily: 'inherit', outline: 'none' }} />
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '.75rem', color: '#222', whiteSpace: 'nowrap' }}>{r.lastCost.toLocaleString()} {cur}</td>
                          <td style={{ textAlign: 'right', fontSize: '.78rem', fontWeight: 700, color: '#111', whiteSpace: 'nowrap' }}>{(q * r.lastCost).toLocaleString()} {cur}</td>
                          <td style={{ textAlign: 'center' }}>
                            {act ? (
                              <a href={act.url} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: '.72rem', fontWeight: 600, color: '#1F75FF', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                {act.label} <span style={{ fontSize: '11px' }}>↗</span>
                              </a>
                            ) : <span style={{ fontSize: '.72rem', color: 'var(--sk-muted)' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Итого */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem .75rem', background: 'linear-gradient(135deg,#4a92ff 0%,#1d78fc 45%,#0d4ea8 100%)', borderRadius: 12, color: '#fff', marginBottom: '.75rem' }}>
              <span style={{ fontSize: '.8rem', fontWeight: 600 }}>Отмечено: {orderPickedCount} поз.</span>
              <span style={{ fontSize: '1rem', fontWeight: 800 }}>{orderPickedSum.toLocaleString()} {cur}</span>
            </div>

            {/* Группы по поставщикам — кнопки отправки */}
            {orderGroups.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                {orderGroups.map((g, gi) => (
                  <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', border: '1px solid rgba(29,120,252,.14)', borderRadius: 12, padding: '.6rem .75rem', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#222' }}>{g.name}</div>
                      <div style={{ fontSize: '.68rem', color: 'var(--sk-muted)' }}>
                        {g.items.length} поз. · {g.total.toLocaleString()} {cur}
                        {g.method === 'link' ? ' · заказ по ссылкам' : g.method === 'whatsapp' ? ' · WhatsApp' : g.method === 'telegram' ? ' · Telegram' : g.method === 'max' ? ' · MAX' : ''}
                      </div>
                    </span>
                    <button type="button" className="sk-dd-btn"
                      onClick={() => sendOrder(g)}>
                      {g.method === 'whatsapp' ? 'Отправить в WhatsApp' : g.method === 'telegram' ? 'Отправить в Telegram' : g.method === 'max' ? 'Отправить в MAX' : 'Открыть ссылки'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
