import Modal from '../../components/Modal';
import SectionHelp from '../../components/SectionHelp';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { fmtDate } from '../../lib/dates';
import { getCurrencySymbol } from '../../lib/currency';
import { scanBarcode, beep } from '../../lib/barcodeScanner';
import Loader from '../../components/Loader';




const CAT_LABELS = {material:'Материалы',tool:'Инструменты',equipment:'Оборудование',other:'Прочее'};

function recalcTotals(doc) {
  let tb = 0, ta = 0, sh = 0, su = 0;
  doc.items.forEach(it => {
    // actual = null → товар ещё не посчитан, считаем = учтено (без изменений)
    const actual = (it.actual === null || it.actual === undefined || it.actual === '') ? it.expected : it.actual;
    const cb = it.expected * it.cost, ca = actual * it.cost;
    tb += cb; ta += ca;
    const diff = actual - it.expected;
    if (diff < 0) sh += Math.abs(diff) * it.cost;
    if (diff > 0) su += diff * it.cost;
  });
  doc.totals = { totalBefore: tb, totalAfter: ta, shortage: sh, surplus: su, result: ta - tb };
  return doc;
}

// Сумма недостачи в деньгах: по себестоимости или по розничной цене
function shortageAmount(doc, valuation) {
  return doc.items.reduce((s, it) => {
    const actual = it.actualEff !== undefined ? it.actualEff : ((it.actual === null || it.actual === undefined || it.actual === '') ? it.expected : it.actual);
    if (actual >= it.expected) return s;
    const unit = valuation === 'retail' && it.price > 0 ? it.price : (it.cost || 0);
    return s + (it.expected - actual) * unit;
  }, 0);
}

export default function Inventory() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showResult, setShowResult] = useState(null);
  // Окно «Куда отнести недостачу»
  const [showAssign, setShowAssign] = useState(false);
  const [pendingDoc, setPendingDoc] = useState(null);
  const [assignValuation, setAssignValuation] = useState('cost');
  const [assignAmts, setAssignAmts] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, prodRes, supRes, initRes, woRes, empRes] = await Promise.all([
        supabase.from('inventory').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('supplies').select('items').eq('user_id', user.id),
        supabase.from('initial_stocks').select('*').eq('user_id', user.id).single(),
        supabase.from('writeoffs').select('product_id,quantity').eq('user_id', user.id),
        supabase.from('employees').select('id,name,status').eq('user_id', user.id)
      ]);
      if (invRes.error) throw invRes.error;
      if (invRes.data) setList(invRes.data);
      if (prodRes.data) setProducts(prodRes.data);
      if (empRes.data) setEmployees((empRes.data || []).filter(e => e.status !== 'fired'));
      // Остаток = поставки + начальные − списания (как в разделе «Остатки» и кассе)
      const map = {};
      (supRes.data || []).forEach(sp => {
        (sp.items||[]).forEach(it => {
          if (!map[it.prodId]) map[it.prodId] = { qty: 0, cost: 0 };
          map[it.prodId].qty += it.qty || 0;
          map[it.prodId].cost += (it.cost || 0) * (it.qty || 0);
        });
      });
      const initial = initRes.data;
      if (initial && initial.done && initial.items) {
        Object.keys(initial.items).forEach(id => {
          const q = parseInt(initial.items[id]) || 0;
          const c = (initial.costs && parseInt(initial.costs[id])) || 0;
          if (q > 0) {
            if (!map[id]) map[id] = { qty: 0, cost: 0 };
            map[id].qty += q;
            map[id].cost += c * q;
          }
        });
      }
      (woRes.data || []).forEach(wo => {
        if (map[wo.product_id]) {
          // Списание уменьшает и количество, и стоимость (по средней) — иначе себестоимость завышается
          const avg = map[wo.product_id].qty > 0 ? map[wo.product_id].cost / map[wo.product_id].qty : 0;
          const q = Number(wo.quantity) || 0;
          map[wo.product_id].qty -= q;
          map[wo.product_id].cost = Math.max(0, map[wo.product_id].cost - q * avg);
        }
      });
      setSupplies(Object.keys(map).map(k => ({ prodId: parseInt(k), qty: Math.max(0, map[k].qty), cost: map[k].cost })));
    } catch (e) {
      alert('Ошибка загрузки инвентаризации: ' + (e.message || 'неизвестная ошибка'));
    }
    setLoading(false);
  };
  
  useEffect(() => { if (user) load(); }, [user]);

  const migrate = async () => {
    const old = JSON.parse(localStorage.getItem('inventory88') || '[]');
    if (old.length > 0) {
      old.forEach(async (d) => {
        await supabase.from('inventory').insert({ id: d.id, user_id: user.id, number: d.number || '', status: d.status || 'draft', items: d.items || [], result: JSON.stringify(d.totals || {}), date: d.date || '', created_at: new Date().toISOString() });
      });
      localStorage.removeItem('inventory88');
      load();
    }
  };
  useEffect(() => { if (user && list.length === 0) migrate(); }, [user, list.length]);
  
  const startNew = async () => {
    const num = 'INV-' + String(list.length + 1).padStart(3, '0');
    const stockMap = {};
    supplies.forEach(sp => { stockMap[sp.prodId] = { qty: sp.qty || 0, cost: sp.cost || 0 }; });
    const items = products.filter(p => !p.hidden).map(p => {
      const st = stockMap[p.id] || { qty: 0, cost: 0 };
      const qty = Math.max(0, st.qty);
      // Средняя себестоимость из поставок/начальных остатков (у товара нет поля costPrice)
      const cost = qty > 0 && st.cost > 0 ? Math.round(st.cost / qty) : 0;
      return {
        prodId: p.id, name: p.name, sku: p.sku || '',
        cat: CAT_LABELS[p.cat] || p.cat || '',
        expected: qty, actual: null, cost,
        price: p.price || 0, // розничная цена — для оценки недостачи «по рознице»
        photo_url: p.photo_url || '',
        barcode: p.barcode || ''
      };
    });
    const totalBefore = items.reduce((s, it) => s + it.expected * it.cost, 0);
    const doc = {
      id: Date.now(), number: num, date: new Date().toISOString().split('T')[0],
      responsible: '', status: 'draft', items,
      totals: { totalBefore, totalAfter: totalBefore, shortage: 0, surplus: 0, result: 0 }
    };
    const { error } = await supabase.from('inventory').insert({ id: doc.id, user_id: user.id, number: doc.number, date: doc.date, status: doc.status, items: doc.items, result: JSON.stringify(doc.totals) });
    if (error) return alert('Ошибка: ' + error.message);
    await load(); setEditing(doc);
  };

  const cancelEdit = async () => {
    if (showResult) { setShowResult(null); setEditing(null); await load(); return; }
    if (editing) {
      if (!confirm('Удалить черновик ' + editing.number + '? Введённые данные пропадут.')) return;
      await supabase.from('inventory').delete().eq('id', editing.id); await load();
    }
    setEditing(null);
  };

  // «Отложить» — сохранить черновик и закрыть (можно продолжить позже)
  const saveDraft = async () => {
    if (!editing) return;
    const { error } = await supabase.from('inventory').update({ items: editing.items }).eq('id', editing.id);
    if (error) return alert('Ошибка: ' + error.message);
    setEditing(null); await load();
  };

  // Открыть черновик/документ для продолжения редактирования
  const continueEdit = (doc) => {
    if (doc.status === 'draft') {
      const d = { ...doc, items: doc.items || [] };
      recalcTotals(d); // пересчитываем итоги, иначе после «Продолжить» totals пустой → NaN
      setEditing(d);
    } else {
      view(doc.id);
    }
  };

  const updateMeta = (id, field, value) => {
    setEditing({...editing, [field]: value});
  };

  const updateItem = (id, idx, actual) => {
    const items = [...editing.items];
    // Пустое поле = товар не посчитан (null); число = посчитан
    items[idx] = {...items[idx], actual: actual === '' || actual === null || actual === undefined ? null : (parseInt(actual) || 0)};
    const updated = { ...editing, items }; recalcTotals(updated);
    setEditing(updated);
  };

  // «+» — добавить товар в посчитанные (если поле пустое — берём учтённое количество)
  const addItem = (idx) => {
    const items = [...editing.items];
    const it = items[idx];
    if (it.actual === null || it.actual === undefined || it.actual === '') {
      items[idx] = { ...it, actual: it.expected };
      const updated = { ...editing, items }; recalcTotals(updated);
      setEditing(updated);
    }
  };

  // «×» — вернуть товар в не посчитанные
  const resetItem = (idx) => {
    const items = [...editing.items];
    items[idx] = { ...items[idx], actual: null };
    const updated = { ...editing, items }; recalcTotals(updated);
    setEditing(updated);
  };

  // ===== Сканер штрихкодов: каждый скан = +1 к факту товара =====
  const [scanToast, setScanToast] = useState(null);
  const handleScan = (code) => {
    if (!editing) return;
    const idx = editing.items.findIndex(it => it.barcode && String(it.barcode).trim() === String(code).trim());
    if (idx === -1) {
      beep(300, 220, 0.2); // низкий сигнал — не найдено
      setScanToast('Штрихкод ' + code + ' не найден в списке');
      setTimeout(() => setScanToast(null), 2000);
      return;
    }
    const items = [...editing.items];
    const cur = (items[idx].actual === null || items[idx].actual === undefined || items[idx].actual === '') ? 0 : items[idx].actual;
    items[idx] = { ...items[idx], actual: cur + 1 };
    const updated = { ...editing, items }; recalcTotals(updated);
    setEditing(updated);
    setScanToast('+1: ' + items[idx].name);
    setTimeout(() => setScanToast(null), 1200);
  };

  // ===== Завершение инвентаризации: списание недостачи, оприходование излишка =====
  const complete = async (id) => {
    const doc = editing; if (!doc) return;
    if (!doc.responsible || !doc.responsible.trim()) {
      return alert('Выберите, кто проводит инвентаризацию (поле «Проводит»)');
    }
    if (!confirm('Провести инвентаризацию ' + doc.number + '?\nОстатки будут обновлены: недостача спишется, излишек оприходуется.')) return;
    const date = doc.date || new Date().toISOString().split('T')[0];

    try {
      // Продажи с момента начала инвентаризации (кассир мог продавать параллельно)
      // Факт на начало = посчитанный факт + проданное за время инвентаризации
      const startTs = doc.created_at || (doc.date ? new Date(doc.date).toISOString() : new Date().toISOString());
      const { data: recs } = await supabase.from('receipts').select('id,created_at').eq('user_id', user.id).gte('created_at', startTs);
      const recIds = (recs || []).map(r => r.id);
      const soldMap = {};
      let soldQtyTotal = 0;
      if (recIds.length) {
        const { data: rItems } = await supabase.from('receipt_items').select('product_name,quantity').in('receipt_id', recIds);
        (rItems || []).forEach(it => {
          soldMap[it.product_name] = (soldMap[it.product_name] || 0) + (Number(it.quantity) || 0);
          soldQtyTotal += Number(it.quantity) || 0;
        });
      }
      // Эффективный факт (с учётом проданного); непосчитанные (null) = учтено, без изменений
      const effItems = doc.items.map(it => {
        const base = (it.actual === null || it.actual === undefined || it.actual === '') ? it.expected : it.actual;
        return { ...it, actualEff: base + (soldMap[it.name] || 0) };
      });

      const shortageItems = effItems.filter(it => it.actualEff < it.expected);
      const surplusItems = effItems.filter(it => it.actualEff > it.expected);

      // Недостача → списания (остаток уменьшается)
      if (shortageItems.length) {
        await Promise.all(shortageItems.map(it =>
          supabase.from('writeoffs').insert({
            product_id: it.prodId, quantity: it.expected - it.actualEff, cost: it.cost || 0,
            reason: 'Недостача по инвентаризации ' + doc.number, date
          })
        ));
      }
      // Излишек → оприходование как поставка (остаток увеличивается, себестоимость пересчитается)
      if (surplusItems.length) {
        const items = surplusItems.map(it => ({ prodId: it.prodId, name: it.name, qty: it.actualEff - it.expected, cost: it.cost || 0 }));
        const total = items.reduce((s, x) => s + x.qty * x.cost, 0);
        await supabase.from('supplies').insert({
          supplier_name: 'Излишек по инвентаризации ' + doc.number,
          items, total, paid: total, status: 'received', date
        });
      }

      // Суммы в деньгах (по себестоимости — оценка по умолчанию)
      const shAmount = shortageAmount({ items: effItems }, 'cost');
      const suAmount = effItems.reduce((s, it) => it.actualEff > it.expected ? s + (it.actualEff - it.expected) * (it.cost || 0) : s, 0);
      const result = {
        ...doc.totals, valuation: 'cost',
        shortageAmount: shAmount, surplusAmount: suAmount,
        businessLoss: shAmount, assigned: [],
        soldQtyTotal, soldMap
      };

      // Сохраняем: непосчитанные товары → учтено (без изменений)
      const saveItems = doc.items.map(it => (it.actual === null || it.actual === undefined || it.actual === '') ? { ...it, actual: it.expected } : it);
      const { error } = await supabase.from('inventory').update({
        items: saveItems, result: JSON.stringify(result), status: 'completed', completed_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;

      setEditing(null); // закрываем модалку редактирования
      const completedDoc = { ...doc, totals: result, soldQtyTotal, soldMap };
      if (shAmount > 0) {
        // Есть недостача — спрашиваем, куда её отнести
        setPendingDoc(completedDoc); setAssignValuation('cost'); setAssignAmts({});
        setShowAssign(true);
      } else {
        setShowResult(completedDoc);
      }
    } catch (e) {
      alert('Ошибка завершения: ' + (e.message || 'неизвестная ошибка'));
    }
  };

  // Подтверждение распределения недостачи
  const confirmAssign = async () => {
    const doc = pendingDoc; if (!doc) return;
    // На бизнес — всегда по закупке; сотрудникам — любые суммы на выбор
    const costShortage = shortageAmount(doc, 'cost');
    const retailShortage = shortageAmount(doc, 'retail');
    const maxAllowed = Math.max(costShortage, retailShortage);
    const assigned = [];
    let totalAssigned = 0;
    employees.forEach(emp => {
      const amt = parseFloat(assignAmts[emp.id]) || 0;
      if (amt > 0) {
        assigned.push({ employeeId: emp.id, name: emp.name, amount: amt });
        totalAssigned += amt;
      }
    });
    if (maxAllowed > 0 && totalAssigned > maxAllowed + 0.01) {
      return alert('Сумма распределения (' + Math.round(totalAssigned).toLocaleString() + ' ' + cur + ') больше максимальной суммы недостачи (' + Math.round(maxAllowed).toLocaleString() + ' ' + cur + ')');
    }
    try {
      // Создаём долги сотрудникам
      if (assigned.length) {
        await Promise.all(assigned.map(a =>
          supabase.from('employee_debts').insert({
            employee_id: a.employeeId, employee_name: a.name, inventory_id: doc.id,
            amount: a.amount, valuation: 'custom', status: 'pending',
            comment: 'Недостача по инвентаризации ' + doc.number, date: new Date().toISOString()
          })
        ));
      }
      const result = {
        ...doc.totals, valuation: 'cost',
        shortageAmount: costShortage, shortageRetail: retailShortage,
        surplusAmount: doc.totals.surplusAmount,
        businessLoss: Math.max(0, costShortage - totalAssigned), assigned
      };
      const { error } = await supabase.from('inventory').update({ result: JSON.stringify(result) }).eq('id', doc.id);
      if (error) throw error;
      setShowAssign(false); setPendingDoc(null);
      setShowResult({ ...doc, totals: result });
    } catch (e) {
      alert('Ошибка: ' + (e.message || 'неизвестная ошибка'));
    }
  };

  const confirmResult = async () => {
    if (!showResult) return;
    setShowResult(null); setEditing(null); await load();
  };

  const view = (id) => {
    const doc = list.find(d => d.id === id);
    if (doc) setViewing(viewing?.id === id ? null : doc);
  };

  const remove = async (id) => {
    if (!confirm('Удалить инвентаризацию?')) return;
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) return alert('Ошибка удаления: ' + error.message);
    if (viewing?.id === id) setViewing(null);
    if (editing?.id === id) setEditing(null);
    await load();
  };

  if (loading) return <Loader />;

  const assignTotal = Object.values(assignAmts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const assignShortageCost = pendingDoc ? shortageAmount(pendingDoc, 'cost') : 0;
  const assignShortageRetail = pendingDoc ? shortageAmount(pendingDoc, 'retail') : 0;
  const assignShortage = assignShortageCost;
  const assignRemain = assignShortageCost - assignTotal;

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1>Инвентаризация</h1>
            <SectionHelp
              title="Раздел «Инвентаризация»"
              intro="Инвентаризация — это сверка: сколько товара должно быть по учёту и сколько реально лежит на складе. Помогает вовремя найти недостачи и излишки."
              blocks={[
                { title: 'Как провести инвентаризацию (по шагам)', items: [
                  <>Нажмите «<b>+ Добавить</b>» — создастся документ со списком всех товаров (остатки на момент начала).</>,
                  <>В колонке «<b>Остаток</b>» — сколько должно быть по данным программы (остатки).</>,
                  <>В колонке «<b>Факт</b>» — впишите, сколько реально насчитали на складе.</>,
                  <>Не успели досчитать — «<b>Отложить</b>»: черновик сохранится, продолжите позже (кнопка «Продолжить» в списке).</>,
                  <>Нажмите «<b>Завершить</b>» — программа спишет недостачу, оприходует излишек и покажет итог.</>,
                ]},
                { title: 'Продажи во время инвентаризации', text: <>Если кассир продаёт товары, пока вы считаете — не страшно: при завершении программа сама добавит проданное к факту и покажет это в итоге. «Факт на начало» = посчитали + продали за время подсчёта.</> },
                { title: 'Столбцы таблицы', items: [
                  <><b>Остаток</b> — остаток по данным программы (поставки + начальные остатки − списания).</>,
                  <><b>Факт</b> — реальное количество, которое вы пересчитали. Вводится вручную.</>,
                  <><b>Разница</b> — факт минус остаток: «−» недостача, «+» излишек.</>,
                  <><b>Сумма</b> — разница в деньгах, по себестоимости.</>,
                ]},
                { title: 'Результат инвентаризации', items: [
                  <><b>Недостача</b> — товара меньше, чем по учёту. Программа спишет её (остаток уменьшится) и спросит: отнести на расходы бизнеса или на сотрудника (повиснет долг, который можно удержать из зарплаты).</>,
                  <><b>Излишек</b> — товара больше, чем по учёту. Программа оприходует его (остаток увеличится), это доход.</>,
                  <>После завершения показывается итог: было, стало, сумма недостачи и излишка, куда отнесена недостача.</>,
                ]},
                { title: 'Список инвентаризаций', items: [
                  <><b>№</b> — номер документа (INV-001, INV-002...).</>,
                  <><b>Дата / Расхождений</b> — когда проводилась и сколько позиций с разницей.</>,
                  <><b>Результат</b> — итоговая сумма (плюс или минус).</>,
                  <>«<b>Открыть</b>» — посмотреть состав, кнопка ⋯ — удалить документ.</>,
                ]},
              ]}
            />
          </div>
          <div className="sub">Сверка фактических остатков с учетными</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={startNew}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {viewing && (() => {
        const doc = viewing;
        return (
          <div className="promo-detail" style={{marginBottom:'.5rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.5rem'}}>
              <div style={{fontSize:'.9rem',fontWeight:600}}>{doc.number}</div>
              <span style={{cursor:'pointer',color:'var(--muted)',fontSize:'1.1rem'}} onClick={() => setViewing(null)}>✕</span>
            </div>
            <div className="product-table" style={{overflowX:'auto'}}>
              <table className="data-table">
                <thead id="colHeaders"><tr>
                  <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Товар</th>
                  <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Остаток</th>
                  <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Факт</th>
                  <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Разница</th>
                  <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Сумма</th>
                </tr></thead>
                <tbody>
                  {doc.items.map((it,i)=>{
                    const d=it.actual-it.expected;const ds=d*it.cost;
                    return <tr key={i}>
                      <td style={{textAlign:'left'}}><div className="prod-name">{it.name}</div><div className="prod-sku">{it.sku||'—'}</div></td>
                      <td style={{textAlign:'left'}}><span className="num">{it.expected}</span></td>
                      <td style={{textAlign:'left'}}><span className="num">{it.actual}</span></td>
                      <td style={{textAlign:'left'}}><span className="num">{d>0?'+':''}{d}</span></td>
                      <td style={{textAlign:'left'}}><span className="num">{ds>0?'+':''}{ds.toLocaleString()} {cur}</span></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table className="data-table">
          <thead id="invColHeaders">
            <tr>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>№</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Дата</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Расхождений</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Результат</th>
              <th style={{width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="inventoryTableBody">
            {list.length === 0 ? (
              <tr><td colSpan="5"><div className="empty-products"><div className="big-icon">📋</div><p>Инвентаризации не проводились</p>
                    <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Запустите первую сверку фактических остатков с учетными</p></div></td></tr>
            ) : list.map(inv => {
              let totals = {};
              try { totals = JSON.parse(inv.result || '{}'); } catch (e) {}
              const result = totals.result ?? 0;
              const diffCount = inv.items.filter(it => it.actual !== it.expected).length;
              const isDraft = inv.status === 'draft';
              return (
                <tr key={inv.id}>
                  <td style={{textAlign:'left'}}>
                    <div className="prod-name">{inv.number}</div>
                    <span style={{display:'inline-block',padding:'.15rem .5rem',borderRadius:'100px',fontSize:'.68rem',fontWeight:600,background:isDraft ? '#fef3c7' : '#dcfce7',color:isDraft ? '#b45309' : '#16a34a',marginTop:'.2rem'}}>
                      {isDraft ? 'Черновик' : 'Проведена'}
                    </span>
                  </td>
                  <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}>{fmtDate(inv.date)}</td>
                  <td style={{textAlign:'left'}}><span className="prod-cat">{isDraft ? '—' : diffCount + ' шт.'}</span></td>
                  <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}><span className="num">{isDraft ? '—' : (result > 0 ? '+' : '') + result.toLocaleString() + ' ' + cur}</span></td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap'}}>
                    <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.78rem',color:'#222',background:'#eee',cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}} onClick={() => continueEdit(inv)}>{isDraft ? 'Продолжить' : 'Открыть'}</span>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={(e) => {
                        e.stopPropagation();
                        const dd = e.currentTarget.nextElementSibling;
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                        dd.classList.toggle('open');
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={() => remove(inv.id)} style={{color:'#dc3545'}}>{isDraft ? 'Удалить черновик' : 'Удалить'}</button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    

      <Modal open={editing} onClose={cancelEdit} title="Инвентаризация" subtitle={editing ? editing.number + ' · ' + fmtDate(editing.date) : ''} width={980}>
        {editing && (() => {
          const counted = editing.items.filter(it => it.actual !== null && it.actual !== undefined && it.actual !== '');
          const uncounted = editing.items.filter(it => it.actual === null || it.actual === undefined || it.actual === '');
          const t = editing.totals || {};
          return (<>
            {/* Проводит + сканер */}
            <div style={{display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.8rem',flexWrap:'wrap'}}>
              <span style={{fontSize:'.78rem',color:'#888'}}>Проводит:</span>
              <select value={editing.responsible || ''} onChange={e => setEditing({...editing, responsible: e.target.value})}
                style={{padding:'.4rem .7rem',fontSize:'.8rem',border:'1.5px solid var(--border)',borderRadius:'8px',fontFamily:'var(--font)',outline:'none',background:'#fff',color:'#222',minWidth:'220px'}}>
                <option value="">— выберите —</option>
                {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
              <button onClick={() => scanBarcode(handleScan)} title="Сканировать штрихкоды"
                style={{marginLeft:'.3rem',display:'inline-flex',alignItems:'center',justifyContent:'center',width:'30px',height:'30px',fontSize:'.95rem',borderRadius:'50%',border:'1.5px solid #d1d5db',background:'#f3f4f6',color:'#555',cursor:'pointer',fontFamily:'var(--font)',flexShrink:0}}>
                📷
              </button>
              {scanToast && (
                <span style={{background:'#111',color:'#fff',borderRadius:'100px',padding:'.3rem .8rem',fontSize:'.75rem',fontWeight:600}}>{scanToast}</span>
              )}
            </div>

            <div style={{display:'flex',gap:0,minHeight:'380px',border:'1px solid var(--border)',borderRadius:'14px',overflow:'hidden'}}>
              {/* ЛЕВО: весь список */}
              <div style={{flex:1,minWidth:0,padding:'.6rem',borderRight:'1px solid var(--border)',overflowY:'auto',maxHeight:'420px',background:'#fff'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.68rem',fontWeight:700,color:'#999',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:'.5rem'}}>
                  <span>Товары</span><span style={{background:'#eef0f3',borderRadius:'100px',padding:'.1rem .5rem',color:'#555',fontWeight:600}}>{editing.items.length}</span>
                </div>
                {uncounted.map(function(it,ui) {
                  const idx = editing.items.indexOf(it);
                  return (
                    <div key={it.prodId} style={{display:'flex',alignItems:'center',gap:'.55rem',padding:'.45rem .5rem',border:'1.5px solid #eee',borderRadius:'12px',marginBottom:'.45rem',background:'#fff'}}>
                      {it.photo_url ? <img src={it.photo_url} alt="" style={{width:'44px',height:'44px',borderRadius:'10px',objectFit:'cover',flexShrink:0}} /> : <div style={{width:'44px',height:'44px',borderRadius:'10px',background:'#f0f2f5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'#999',flexShrink:0}}>📦</div>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'.78rem',fontWeight:600,color:'#222',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.name}</div>
                        <div style={{fontSize:'.68rem',color:'#999'}}>остаток {it.expected}{it.sku ? ' · ' + it.sku : ''}</div>
                      </div>
                      <input type="number" min="0" placeholder="0" value={it.actual === null || it.actual === undefined || it.actual === '' ? '' : it.actual}
                        onChange={e => updateItem(editing.id, idx, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addItem(idx); }}
                        style={{width:'52px',padding:'.3rem .3rem',fontSize:'.85rem',fontWeight:600,border:'1.5px solid #d1d5db',borderRadius:'8px',textAlign:'center',fontFamily:'var(--font)',outline:'none'}} />
                      <button onClick={() => addItem(idx)}
                        style={{width:'26px',height:'26px',borderRadius:'50%',border:'none',background:'#111',color:'#fff',fontSize:'1rem',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',padding:0,lineHeight:1}}>+</button>
                    </div>
                  );
                })}
                {uncounted.length === 0 && <div style={{textAlign:'center',padding:'2rem .5rem',color:'#bbb',fontSize:'.78rem'}}>Все товары посчитаны 🎉</div>}
              </div>

              {/* ПРАВО: посчитанные */}
              <div style={{flex:1,minWidth:0,padding:'.6rem',overflowY:'auto',maxHeight:'420px',background:'#fafbfc'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.68rem',fontWeight:700,color:'#999',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:'.5rem'}}>
                  <span>Посчитано</span><span style={{background:'#eef0f3',borderRadius:'100px',padding:'.1rem .5rem',color:'#555',fontWeight:600}}>{counted.length}</span>
                </div>
                {counted.map(function(it) {
                  const idx = editing.items.indexOf(it);
                  const actual = it.actual;
                  const diff = actual - it.expected;
                  const ds = diff * (it.cost || 0);
                  return (
                    <div key={it.prodId} style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.4rem .5rem',border:'1.5px solid #e5e7eb',borderRadius:'12px',marginBottom:'.45rem',background:'#fff'}}>
                      <span style={{width:'22px',height:'22px',borderRadius:'50%',flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'.68rem',fontWeight:700,color:'#fff',background: diff === 0 ? '#16a34a' : '#dc2626'}}>{diff === 0 ? '✓' : '!'}</span>
                      {it.photo_url ? <img src={it.photo_url} alt="" style={{width:'38px',height:'38px',borderRadius:'9px',objectFit:'cover',flexShrink:0}} /> : <div style={{width:'38px',height:'38px',borderRadius:'9px',background:'#f5f6f8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.85rem',color:'#999',flexShrink:0}}>📦</div>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'.76rem',fontWeight:600,color:'#222',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.name}</div>
                        <div style={{fontSize:'.66rem',color:'#999'}}>факт <b style={{color:'#222'}}>{actual}</b> / остаток {it.expected}</div>
                      </div>
                      <span style={{fontSize:'.7rem',fontWeight:700,color: diff === 0 ? '#bbb' : (diff > 0 ? '#16a34a' : '#dc2626')}} className="num">{diff === 0 ? '✓' : (diff > 0 ? '+' + diff : diff)}</span>
                      <button onClick={() => resetItem(idx)}
                        style={{width:'22px',height:'22px',borderRadius:'50%',border:'1px solid #e5e7eb',background:'#fff',color:'#aaa',fontSize:'.8rem',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',padding:0,lineHeight:1}}>×</button>
                    </div>
                  );
                })}
                {counted.length === 0 && <div style={{textAlign:'center',padding:'2rem .5rem',color:'#bbb',fontSize:'.78rem'}}>Введите количество и нажмите «+»</div>}
                {/* Итог по посчитанным */}
                <div style={{background:'#fff',border:'1px solid #eee',borderRadius:'10px',padding:'.5rem .7rem',marginTop:'.6rem',fontSize:'.72rem',color:'#555'}}>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'.1rem 0'}}><span>Недостача</span><b className="num" style={{color:'#dc2626'}}>{t.shortage ? '−' + Math.round(t.shortage).toLocaleString() + ' ' + cur : '0 ' + cur}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'.1rem 0'}}><span>Излишек</span><b className="num" style={{color:'#16a34a'}}>{t.surplus ? '+' + Math.round(t.surplus).toLocaleString() + ' ' + cur : '0 ' + cur}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'.15rem 0 0',borderTop:'1px solid #f0f0f0',marginTop:'.15rem',fontSize:'.8rem'}}>
                    <span style={{fontWeight:600,color:'#222'}}>Итого</span>
                    <b className="num" style={{fontWeight:700,color: ((t.surplus || 0) - (t.shortage || 0)) >= 0 ? '#16a34a' : '#dc2626'}}>{((t.surplus || 0) - (t.shortage || 0)) >= 0 ? '+' : '−'}{Math.abs(Math.round((t.surplus || 0) - (t.shortage || 0))).toLocaleString()} {cur}</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{flexShrink:0,marginTop:'.6rem'}}>
              <button className="btn btn-ghost" onClick={cancelEdit}>Отмена</button>
              <button className="btn btn-outline" onClick={saveDraft}>Отложить</button>
              <button className="btn btn-primary" onClick={function(){complete(editing.id)}}>Завершить</button>
            </div>
          </>);
        })()}
      </Modal>

      {/* Окно: куда отнести недостачу */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Недостача: куда отнести?" subtitle={pendingDoc ? pendingDoc.number : ''} width="wide">
        {pendingDoc && (<>
          {/* Две оценки недостачи (справка): на бизнес всегда по закупке, сотрудникам — на выбор */}
          <div style={{display:'flex',gap:'.6rem',marginBottom:'.5rem',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:'200px',padding:'.6rem .8rem',borderRadius:'12px',border:'1.5px solid #e5e7eb',background:'#fff'}}>
              <div style={{fontSize:'.78rem',fontWeight:600,color:'#222'}}>По цене закупа</div>
              <div style={{fontSize:'1.05rem',fontWeight:700,color:'#dc2626',marginTop:'.2rem'}} className="num">−{Math.round(assignShortageCost).toLocaleString()} {cur}</div>
            </div>
            <div style={{flex:1,minWidth:'200px',padding:'.6rem .8rem',borderRadius:'12px',border:'1.5px solid #e5e7eb',background:'#fff'}}>
              <div style={{fontSize:'.78rem',fontWeight:600,color:'#222'}}>По цене продажи</div>
              <div style={{fontSize:'1.05rem',fontWeight:700,color:'#dc2626',marginTop:'.2rem'}} className="num">−{Math.round(assignShortageRetail).toLocaleString()} {cur}</div>
            </div>
          </div>
          <div style={{fontSize:'.74rem',color:'#888',marginBottom:'.6rem'}}>
            На сотрудника можно повесить любую сумму — по закупке или по продаже, как решите. Не распределённое уйдёт в расходы бизнеса по цене закупа.
          </div>
          {pendingDoc.soldQtyTotal > 0 && (
            <div style={{fontSize:'.76rem',color:'#2563eb',marginBottom:'.6rem',background:'#eff6ff',borderRadius:'.5rem',padding:'.4rem .6rem'}}>
              Продано во время инвентаризации: <b>{pendingDoc.soldQtyTotal} шт.</b> — уже учтено в факте.
            </div>
          )}
          <div style={{border:'1px solid var(--border)',borderRadius:'.6rem',padding:'.5rem',marginBottom:'.6rem',maxHeight:'260px',overflowY:'auto'}}>
            {employees.length === 0 ? (
              <div style={{padding:'.6rem',color:'var(--muted)',fontSize:'.8rem',textAlign:'center'}}>Сотрудники не добавлены — вся недостача уйдёт в расходы бизнеса</div>
            ) : employees.map(emp => (
              <div key={emp.id} style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.35rem 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{flex:1,fontSize:'.82rem',color:'#222'}}>{emp.name}</span>
                <input type="number" min="0" placeholder="0" value={assignAmts[emp.id] || ''}
                  onChange={e => setAssignAmts(prev => ({ ...prev, [emp.id]: e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0) }))}
                  style={{width:'110px',padding:'.35rem .4rem',fontSize:'.8rem',border:'1px solid var(--border)',borderRadius:'5px',outline:'none',textAlign:'right',fontFamily:'var(--font)'}} />
              </div>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'.8rem',padding:'.4rem .2rem'}}>
            <span style={{color:'#555'}}>Распределено на сотрудников: <b>{Math.round(assignTotal).toLocaleString()} {cur}</b></span>
            <span style={{color:'#555'}}>На расходы бизнеса: <b style={{color:assignRemain > 0 ? '#dc2626' : '#16a34a'}}>{Math.round(Math.max(0, assignRemain)).toLocaleString()} {cur}</b></span>
          </div>
          <div className="modal-actions" style={{marginTop:'.5rem',borderTop:'none',paddingTop:0}}>
            <button className="btn btn-ghost" onClick={() => setShowAssign(false)}>Назад</button>
            <button className="btn btn-primary" onClick={confirmAssign}>Подтвердить</button>
          </div>
        </>)}
      </Modal>

      {/* Окно результата */}
      <Modal open={showResult} onClose={confirmResult} title="Инвентаризация завершена" subtitle={showResult ? showResult.number : ''} width="medium">
        {showResult && (() => {
          const t = showResult.totals || {};
          return (
            <>
              <div style={{display:'flex',justifyContent:'space-between',padding:'.45rem 0',borderBottom:'1px solid var(--border)',fontSize:'.82rem',color:'#555'}}>
                <span>Стоимость по учёту (было)</span><span className="num">{Math.round(t.totalBefore||0).toLocaleString()} {cur}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'.45rem 0',borderBottom:'1px solid var(--border)',fontSize:'.82rem',color:'#555'}}>
                <span>Стоимость по факту (стало)</span><span className="num">{Math.round(t.totalAfter||0).toLocaleString()} {cur}</span>
              </div>
              {(t.shortageAmount > 0) && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'.45rem 0',borderBottom:'1px solid var(--border)',fontSize:'.82rem',color:'#dc2626'}}>
                  <span>Недостача <span style={{fontSize:'.68rem',color:'#999',fontWeight:400}}>(по закупке{t.shortageRetail ? '; по продаже −' + Math.round(t.shortageRetail).toLocaleString() + ' ' + cur : ''})</span></span><span className="num">−{Math.round(t.shortageAmount).toLocaleString()} {cur}</span>
                </div>
              )}
              {(t.surplusAmount > 0) && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'.45rem 0',borderBottom:'1px solid var(--border)',fontSize:'.82rem',color:'#16a34a'}}>
                  <span>Излишек (оприходован)</span><span className="num">+{Math.round(t.surplusAmount).toLocaleString()} {cur}</span>
                </div>
              )}
              {(t.soldQtyTotal > 0) && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'.45rem 0',borderBottom:'1px solid var(--border)',fontSize:'.78rem',color:'#2563eb'}}>
                  <span>Продано во время инвентаризации (учтено в факте)</span><span className="num">{t.soldQtyTotal} шт.</span>
                </div>
              )}
              {(t.assigned && t.assigned.length > 0) && (
                <div style={{padding:'.45rem 0',borderBottom:'1px solid var(--border)',fontSize:'.8rem',color:'#555'}}>
                  <div style={{fontWeight:600,marginBottom:'.3rem'}}>Недостача повешена на сотрудников:</div>
                  {t.assigned.map((a, i) => (
                    <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'.15rem 0'}}>
                      <span>{a.name}</span><span className="num">{Math.round(a.amount).toLocaleString()} {cur} (долг)</span>
                    </div>
                  ))}
                </div>
              )}
              {(t.businessLoss > 0) && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'.45rem 0',borderBottom:'1px solid var(--border)',fontSize:'.82rem',color:'#555'}}>
                  <span>Отнесено на расходы бизнеса</span><span className="num">{Math.round(t.businessLoss).toLocaleString()} {cur}</span>
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',padding:'.5rem 0',fontSize:'.88rem',fontWeight:700}}>
                <span style={{color:'#222'}}>Итого</span>
                <span className="num" style={{color: ((t.surplusAmount || 0) - (t.shortageAmount || 0)) >= 0 ? '#16a34a' : '#dc2626'}}>{((t.surplusAmount || 0) - (t.shortageAmount || 0)) >= 0 ? '+' : '−'}{Math.abs(Math.round((t.surplusAmount || 0) - (t.shortageAmount || 0))).toLocaleString()} {cur}</span>
              </div>
              <div style={{padding:'1rem 0 .2rem',textAlign:'center',fontSize:'.8rem',color:'#555'}}>
                Остатки на складе обновлены: недостача списана, излишек оприходован.
                {t.assigned && t.assigned.length > 0 && ' Долги сотрудников ждут удержания в разделе «Зарплата».'}
              </div>
              <div className="modal-actions" style={{marginTop:'.5rem',borderTop:'none',paddingTop:0}}>
                <button className="btn btn-primary" onClick={confirmResult}>Готово</button>
              </div>
            </>
          );
        })()}
      </Modal>
    </>
  );
}