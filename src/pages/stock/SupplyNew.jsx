import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { fmtDate } from '../../lib/dates';

export default function SupplyNew() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPayPanel, setShowPayPanel] = useState(false);

  // Form fields
  const [supName, setSupName] = useState('');
  const [supCustom, setSupCustom] = useState('');
  const [invoice, setInvoice] = useState('');
  const now = useMemo(() => new Date(), []);
  const [dateStr, setDateStr] = useState(now.toISOString().split('T')[0]);
  const [timeStr, setTimeStr] = useState(now.toTimeString().slice(0,5));
  const [comment, setComment] = useState('');
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);

  // Add-item inline
  const [addSearch, setAddSearch] = useState('');
  const [addProdId, setAddProdId] = useState('');
  const [addQty, setAddQty] = useState('1');
  const [addUnit, setAddUnit] = useState('шт');
  const [addCost, setAddCost] = useState('');
  const [addDrop, setAddDrop] = useState(false);

  // Import
  const [dragOver, setDragOver] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('products').select('*').eq('user_id', user.id).order('name'),
      supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
      supabase.from('accounts').select('*').eq('user_id', user.id),
    ]).then(([p, s, a]) => {
      if (p.data) setProducts(p.data);
      if (s.data) setSuppliers(s.data);
      if (a.data) setAccounts(a.data);
      setLoading(false);
    });
  }, [user]);

  const filtered = addSearch.trim()
    ? products.filter(p => p.name.toLowerCase().includes(addSearch.toLowerCase()))
    : [];

  const selectProduct = (prod) => {
    setAddProdId(prod.id);
    setAddSearch(prod.name);
    setAddCost(String(prod.cost_price || prod.price || 0));
    setAddUnit(prod.unit || 'шт');
    setAddDrop(false);
  };

  const addItem = () => {
    if (!addProdId) return showToast('Выберите товар');
    const prod = products.find(p => p.id === addProdId);
    if (!prod) return showToast('Товар не найден');
    const qty = parseFloat(addQty) || 1;
    const cost = parseFloat(addCost) || 0;
    setItems(prev => [...prev, {
      prodId: prod.id, name: prod.name, sku: prod.article || '',
      qty, unit: addUnit, cost, sum: qty * cost
    }]);
    setAddSearch(''); setAddProdId(''); setAddQty('1'); setAddCost('');
    setAddUnit('шт'); setAddDrop(false);
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItemQty = (idx, qty) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: parseFloat(qty) || 0, sum: (parseFloat(qty) || 0) * it.cost } : it));
  };
  const updateItemCost = (idx, cost) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, cost: parseFloat(cost) || 0, sum: it.qty * (parseFloat(cost) || 0) } : it));
  };

  const totalSum = items.reduce((acc, it) => acc + it.sum, 0);
  const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

  const save = async () => {
    if (!items.length) return showToast('Добавьте хотя бы один товар');
    setSaving(true);
    const supplier = supCustom.trim() || supName || '—';
    const obj = {
      id: Date.now(),
      user_id: user.id,
      supplier_name: supplier,
      invoice: invoice.trim() || '—',
      date: dateStr,
      status: 'received',
      items: items.map(it => ({ prodId: it.prodId, name: it.name, qty: it.qty, cost: it.cost })),
      total: totalSum,
      paid: totalPaid,
      payments,
      comment: comment.trim(),
    };
    const { error } = await supabase.from('supplies').insert(obj);
    if (error) { showToast('Ошибка: ' + error.message); setSaving(false); return; }

    // Update product stock
    for (const it of items) {
      const prod = products.find(p => p.id === it.prodId);
      if (prod) {
        const curStock = parseFloat(prod.stock) || 0;
        await supabase.from('products').update({ stock: curStock + it.qty }).eq('id', it.prodId);
      }
    }

    setSaving(false);
    showToast('✅ Поставка проведена');
    setTimeout(() => navigate('/stock/supplies'), 1200);
  };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const parsed = [];
      for (const row of rows) {
        const name = String(row['Наименование'] || row['Товар'] || row['Название'] || row['name'] || '').trim();
        const qty = parseFloat(row['Количество'] || row['Кол-во'] || row['qty'] || row['quantity'] || 0);
        const cost = parseFloat(row['Цена'] || row['Цена за единицу'] || row['cost'] || row['price'] || 0);
        const unit = String(row['Ед.изм'] || row['Фасовки'] || row['unit'] || 'шт').trim();
        if (!name) continue;
        const prod = products.find(p => p.name.toLowerCase() === name.toLowerCase());
        parsed.push({
          prodId: prod?.id || name,
          name,
          sku: prod?.article || '',
          qty: qty || 1,
          unit: unit || 'шт',
          cost: cost || 0,
          sum: (qty || 1) * (cost || 0)
        });
      }
      if (parsed.length) {
        setItems(prev => [...prev, ...parsed]);
        showToast(`Импортировано ${parsed.length} позиций`);
      } else {
        showToast('Не найдено позиций в файле');
      }
    } catch (err) {
      showToast('Ошибка импорта: ' + err.message);
    }
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Toast */}
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.includes('✅') ? '#16a34a' : '#111', color: '#fff', padding: '.6rem 1.2rem', borderRadius: 10, fontSize: '.85rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.15)' }}>{toast}</div>}

      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate('/stock/supplies')} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--muted)', padding: 0, lineHeight: 1 }}>←</button>
            <h1 style={{ margin: 0 }}>Добавление поставки</h1>
          </div>
          <div className="sub">Заполните данные и добавьте товары</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" style={{ gap: 4 }} onClick={() => window.print()}>🖨️ Печать</button>
        </div>
      </div>

      {/* Fields — flat layout without card */}
      <div style={{ marginBottom: 20 }}>
        
        {/* Row 1: Date & time */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>Дата и время поставки</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
              style={{ width: 'auto', padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', background: 'var(--body-bg)' }} />
            <input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)}
              style={{ width: 'auto', padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', background: 'var(--body-bg)' }} />
          </div>
        </div>

        {/* Row 2: Supplier */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>Поставщик</label>
          <div style={{ display: 'flex', gap: 6, maxWidth: 280 }}>
            <select value={supName} onChange={e => { setSupName(e.target.value); if (e.target.value) setSupCustom(''); }}
              style={{ flex: 1, padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', background: 'var(--body-bg)', color: supName ? 'inherit' : '#999' }}>
              <option value="">Выберите поставщика</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              <option value="__new__">+ Новый поставщик</option>
            </select>
            {supName === '__new__' && (
              <input type="text" placeholder="Название" value={supCustom} onChange={e => setSupCustom(e.target.value)}
                style={{ flex: 1, padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none' }} />
            )}
          </div>
        </div>

        {/* Row 3: Warehouse | Payment | Comment */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>Склад</label>
            <select style={{ width: '100%', padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', background: 'var(--body-bg)' }}>
              <option>Основной</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>Оплата</label>
            <div onClick={() => setShowPayPanel(true)} style={{ cursor: 'pointer', width: '100%' }}>
              {payments.length === 0 ? (
                <div style={{ width: '100%', padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', color: 'var(--muted)', background: 'var(--body-bg)', lineHeight: '1.3' }}>+ Добавить платеж</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', background: 'var(--body-bg)' }}>
                  {payments.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem' }}>
                      <span style={{ fontWeight: 600 }}>{Number(p.amount).toLocaleString()} ₽</span>
                      <span style={{ color: 'var(--muted)' }}>— {p.method}</span>
                      <span onClick={e => { e.stopPropagation(); setPayments(prev => prev.filter((_, j) => j !== i)); }} style={{ marginLeft: 'auto', color: '#dc2626', cursor: 'pointer', fontSize: '.75rem' }}>✕</span>
                    </div>
                  ))}
                  <div style={{ fontSize: '.72rem', color: 'var(--primary)', cursor: 'pointer' }}>+ Добавить ещё</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>Комментарий</label>
            <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Примечание к поставке..."
              style={{ width: '100%', padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', background: 'var(--body-bg)' }} />
          </div>
        </div>

        {/* Payment panel */}
        {showPayPanel && (
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 14px', marginBottom: 14, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>Сумма</label>
                <input type="number" id="payAmount" placeholder="0" style={{ width: '100%', padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none' }} />
              </div>
              <div style={{ flex: 2, minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>Счёт</label>
                <select id="payMethod" style={{ width: '100%', padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', background: 'var(--body-bg)' }}>
                  <option value="">Выберите счёт</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {Number(a.balance||0).toLocaleString()} ₽</option>)}
                </select>
              </div>
              <button onClick={() => {
                const amt = parseFloat(document.getElementById('payAmount')?.value);
                const method = document.getElementById('payMethod')?.selectedOptions?.[0]?.text?.split(' — ')?.[0] || 'Наличные';
                if (!amt || amt <= 0) return showToast('Введите сумму');
                setPayments(prev => [...prev, { amount: amt, method, date: new Date().toISOString() }]);
                setShowPayPanel(false);
              }} style={{ padding: '.45rem .9rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Добавить</button>
            </div>
          </div>
        )}
      </div>

        {/* Import zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          style={{
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 12, padding: '1.2rem', textAlign: 'center', marginBottom: 16,
            background: dragOver ? 'var(--primary-ghost)' : '#fafafa',
            transition: 'all .15s', cursor: 'pointer'
          }}
          onClick={() => document.getElementById('supplyFileInput')?.click()}
        >
          <div style={{ fontSize: '.9rem', marginBottom: 4 }}>📄</div>
          <div style={{ fontSize: '.82rem', fontWeight: 600, color: '#333' }}>Импорт поставки</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 4 }}>
            Нажмите для выбора файла или перетащите таблицу в формате CSV, XLS, XLSX
          </div>
          <input id="supplyFileInput" type="file" accept=".csv,.xls,.xlsx" style={{ display: 'none' }} onChange={handleFileDrop} />
        </div>

        {/* Items table */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.3px' }}>
              Товары {items.length > 0 && <span style={{ color: '#999', fontWeight: 400 }}>({items.length})</span>}
            </span>
            <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Цена за единицу</span>
          </div>

          {/* Add row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, position: 'relative' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input type="text" value={addSearch} onChange={e => { setAddSearch(e.target.value); setAddDrop(true); setAddProdId(''); }}
                placeholder="Наименование товара..." onFocus={() => setAddDrop(true)}
                style={{ width: '100%', padding: '.45rem .55rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', background: 'var(--body-bg)' }} />
              {addDrop && filtered.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.08)', maxHeight: 180, overflowY: 'auto', marginTop: 2 }}>
                  {filtered.map(p => (
                    <div key={p.id} onClick={() => selectProduct(p)}
                      style={{ padding: '.4rem .55rem', cursor: 'pointer', fontSize: '.8rem', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '.72rem' }}>{p.article || ''} · {p.unit || 'шт'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input type="number" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="Кол-во"
              style={{ width: 70, padding: '.45rem .4rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', textAlign: 'center', background: 'var(--body-bg)' }} />
            <input type="number" value={addCost} onChange={e => setAddCost(e.target.value)} placeholder="Цена"
              style={{ width: 85, padding: '.45rem .4rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', textAlign: 'center', background: 'var(--body-bg)' }} />
            <button onClick={addItem} style={{ padding: '.45rem .75rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>+</button>
          </div>

          {/* Items list */}
          {items.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '.78rem', border: '1px solid var(--border)', borderRadius: 8, background: '#fafafa' }}>
              Добавьте товары вручную или импортируйте из файла
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '.35rem .5rem', textAlign: 'left', fontWeight: 600, fontSize: '.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.3px' }}>Товар</th>
                    <th style={{ padding: '.35rem .5rem', textAlign: 'center', fontWeight: 600, fontSize: '.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.3px', width: 50 }}>Кол-во</th>
                    <th style={{ padding: '.35rem .5rem', textAlign: 'right', fontWeight: 600, fontSize: '.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.3px', width: 80 }}>Цена</th>
                    <th style={{ padding: '.35rem .5rem', textAlign: 'right', fontWeight: 600, fontSize: '.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.3px', width: 80 }}>Сумма</th>
                    <th style={{ padding: '.35rem .5rem', textAlign: 'center', width: 24 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '.35rem .5rem', fontWeight: 500 }}>{it.name}</td>
                      <td style={{ padding: '.35rem .5rem', textAlign: 'center' }}>
                        <input type="number" value={it.qty} onChange={e => updateItemQty(i, e.target.value)}
                          style={{ width: 56, padding: '.2rem .3rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '.78rem', textAlign: 'center', fontFamily: 'inherit', outline: 'none', background: 'var(--body-bg)' }} />
                      </td>
                      <td style={{ padding: '.35rem .5rem', textAlign: 'right' }}>
                        <input type="number" value={it.cost} onChange={e => updateItemCost(i, e.target.value)}
                          style={{ width: 70, padding: '.2rem .3rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '.78rem', textAlign: 'center', fontFamily: 'inherit', outline: 'none', background: 'var(--body-bg)' }} />
                      </td>
                      <td style={{ padding: '.35rem .5rem', textAlign: 'right', fontWeight: 600 }}>{it.sum.toLocaleString()} ₽</td>
                      <td style={{ padding: '.35rem .5rem', textAlign: 'center' }}>
                        <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '.8rem' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, padding: '.6rem 0', borderTop: '2px solid var(--border)', marginTop: 4 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>К оплате</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{totalSum.toLocaleString()} ₽</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Итого</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: totalPaid > 0 && totalPaid >= totalSum ? '#16a34a' : '#111' }}>
              {totalPaid > 0 ? `${totalPaid.toLocaleString()} ₽` : `${totalSum.toLocaleString()} ₽`}
            </div>
            {totalPaid > 0 && totalPaid < totalSum && (
              <div style={{ fontSize: '.72rem', color: '#d97706' }}>Долг: {(totalSum - totalPaid).toLocaleString()} ₽</div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/stock/supplies')} style={{ fontFamily: 'inherit' }}>Отмена</button>
          <button onClick={save} disabled={saving}
            style={{
              padding: '.55rem 1.4rem', background: saving ? '#ccc' : 'var(--primary)', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: '.82rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all .12s', fontFamily: 'inherit'
            }}>
            {saving ? '⏳ Сохранение...' : '💾 Провести поставку'}
          </button>
        </div>

    </div>
  );
}
