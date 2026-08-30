import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { fmtDate } from '../../lib/dates';
import { getCurrencySymbol } from '../../lib/currency';
import Loader from '../../components/Loader';




const CAT_LABELS = {material:'Материалы',tool:'Инструменты',equipment:'Оборудование',other:'Прочее'};

function recalcTotals(doc) {
  let tb = 0, ta = 0, sh = 0, su = 0;
  doc.items.forEach(it => {
    const cb = it.expected * it.cost, ca = it.actual * it.cost;
    tb += cb; ta += ca;
    const diff = it.actual - it.expected;
    if (diff < 0) sh += Math.abs(diff) * it.cost;
    if (diff > 0) su += diff * it.cost;
  });
  doc.totals = { totalBefore: tb, totalAfter: ta, shortage: sh, surplus: su, result: ta - tb };
  return doc;
}

export default function Inventory() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showResult, setShowResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, prodRes, supRes, initRes, woRes] = await Promise.all([
        supabase.from('inventory').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('supplies').select('items').eq('user_id', user.id),
        supabase.from('initial_stocks').select('*').eq('user_id', user.id).single(),
        supabase.from('writeoffs').select('product_id,quantity').eq('user_id', user.id)
      ]);
      if (invRes.error) throw invRes.error;
      if (invRes.data) setList(invRes.data);
      if (prodRes.data) setProducts(prodRes.data);
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
        if (map[wo.product_id]) map[wo.product_id].qty -= (Number(wo.quantity) || 0);
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
        expected: qty, actual: qty, cost
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
    if (editing) { await supabase.from('inventory').delete().eq('id', editing.id); await load(); }
    setEditing(null);
  };

  const updateMeta = (id, field, value) => {
    setEditing({...editing, [field]: value});
  };

  const updateItem = (id, idx, actual) => {
    const items = [...editing.items]; items[idx] = {...items[idx], actual: parseInt(actual) || 0};
    const updated = { ...editing, items }; recalcTotals(updated);
    setEditing(updated);
  };

  const complete = async (id) => {
    const doc = editing; if (!doc) return;
    const { error } = await supabase.from('inventory').update({ items: doc.items, result: JSON.stringify(doc.totals), status: 'completed' }).eq('id', id);
    if (error) return alert('Ошибка: ' + error.message);
    setShowResult(doc);
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
  // Режим редактирования — рендерится как модалка в основном контенте// Режим просмотра списка
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Инвентаризация</h1>
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
                  <th style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase',padding:'.5rem .5rem',borderBottom:'1px solid var(--border)',textAlign:'left'}}>Товар</th>
                  <th style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase',textAlign:'left',padding:'.5rem .5rem',borderBottom:'1px solid var(--border)'}}>Учтено</th>
                  <th style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase',textAlign:'left',padding:'.5rem .5rem',borderBottom:'1px solid var(--border)'}}>Факт</th>
                  <th style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase',textAlign:'left',padding:'.5rem .5rem',borderBottom:'1px solid var(--border)'}}>Разница</th>
                  <th style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase',textAlign:'left',padding:'.5rem .5rem',borderBottom:'1px solid var(--border)'}}>Сумма</th>
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
              return (
                <tr key={inv.id}>
                  <td style={{textAlign:'left'}}><div className="prod-name">{inv.number}</div></td>
                  <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}>{fmtDate(inv.date)}</td>
                  <td style={{textAlign:'left'}}><span className="prod-cat">{diffCount} шт.</span></td>
                  <td style={{textAlign:'left',color:'#222',fontSize:'.78rem'}}><span className="num">{result > 0 ? '+' : ''}{result.toLocaleString()} {cur}</span></td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap'}}>
                    <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.78rem',color:'#222',background:'#eee',cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}} onClick={() => view(inv.id)}>Открыть</span>
                    <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                      <button className="act-btn prod-more-btn" onClick={(e) => {
                        e.stopPropagation();
                        const dd = e.currentTarget.nextElementSibling;
                        document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                        dd.classList.toggle('open');
                      }}>⋯</button>
                      <div className="prod-dropdown">
                        <button onClick={() => remove(inv.id)} style={{color:'#dc3545'}}>Удалить</button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    

      <Modal open={editing} onClose={cancelEdit} title="Редактирование инвентаризации" subtitle={editing ? editing.number + ' - ' + fmtDate(editing.date) : ''} width="wide">
        {editing && (<>
          <div className="product-table" style={{overflowY:'auto',flex:1}}>
            <table className="data-table">
              <thead id="colHeaders"><tr><th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Товар</th><th>Учтено</th><th>Факт</th><th>Разница</th><th>Сумма</th></tr></thead>
              <tbody>
                {editing.items.map(function(it,idx) {
                  var diff = it.actual - it.expected;
                  var ds = diff * it.cost;
                  return <tr key={idx}><td style={{textAlign:'left'}}><div className="prod-name">{it.name}</div><div className="prod-sku">{it.sku||'--'}</div></td>
                    <td style={{textAlign:'left'}}><span className="num">{it.expected}</span></td>
                    <td><input type="number" value={it.actual} min="0" onChange={function(e){updateItem(editing.id,idx,e.target.value)}} style={{width:'60px',textAlign:'left',padding:'.25rem',border:'1px solid var(--border)',borderRadius:'4px',fontSize:'.85rem'}} /></td>
                    <td style={{textAlign:'left'}}><span className="num">{diff>0?'+':''}{diff}</span></td>
                    <td style={{textAlign:'left'}}><span className="num">{ds>0?'+':''}{ds.toLocaleString()} {cur}</span></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="modal-actions" style={{flexShrink:0,marginTop:'.5rem'}}>
            <button className="btn btn-outline" onClick={cancelEdit}>Отмена</button>
            <button className="btn btn-primary" onClick={function(){complete(editing.id)}}>Завершить</button>
          </div>
        </>)}
      </Modal>

</>
  );
}