import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { fmtDate } from '../../lib/dates';



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
    const [invRes, prodRes, supRes] = await Promise.all([
      supabase.from('inventory').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('supplies').select('items').eq('user_id', user.id)
    ]);
    if (invRes.data) setList(invRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (supRes.data) {
      const map = {};
      supRes.data.forEach(sp => {
        (sp.items||[]).forEach(it => { if (!map[it.prodId]) map[it.prodId] = 0; map[it.prodId] += it.qty || 0; });
      });
      setSupplies(Object.keys(map).map(k => ({ prodId: parseInt(k), qty: map[k] })));
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
    supplies.forEach(sp => { stockMap[sp.prodId] = sp.qty || 0; });
    const items = products.filter(p => !p.hidden).map(p => ({
      prodId: p.id, name: p.name, sku: p.sku || '',
      cat: CAT_LABELS[p.cat] || p.cat || '',
      expected: stockMap[p.id] || 0, actual: stockMap[p.id] || 0,
      cost: parseFloat(p.costPrice) || 0
    }));
    const totalBefore = items.reduce((s, it) => s + it.expected * it.cost, 0);
    const doc = {
      id: Date.now(), number: num, date: new Date().toISOString().split('T')[0],
      responsible: '', status: 'draft', items,
      totals: { totalBefore, totalAfter: totalBefore, shortage: 0, surplus: 0, result: 0 }
    };
    const { error } = await supabase.from('inventory').insert({ id: doc.id, user_id: user.id, number: doc.number, date: doc.date, status: doc.status, items: doc.items, result: JSON.stringify(doc.totals) });
    if (!error) { await load(); setEditing(doc); }
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
    await supabase.from('inventory').update({ items: doc.items, result: JSON.stringify(doc.totals), status: 'completed' }).eq('id', id);
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
    await supabase.from('inventory').delete().eq('id', id);
    if (viewing?.id === id) setViewing(null);
    if (editing?.id === id) setEditing(null);
    await load();
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;
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
                  <th style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase',padding:'.5rem .5rem',borderBottom:'1px solid var(--border)'}}>Учтено</th>
                  <th style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase',padding:'.5rem .5rem',borderBottom:'1px solid var(--border)'}}>Факт</th>
                  <th style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase',padding:'.5rem .5rem',borderBottom:'1px solid var(--border)'}}>Разница</th>
                  <th style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',textTransform:'uppercase',padding:'.5rem .5rem',borderBottom:'1px solid var(--border)'}}>Сумма</th>
                </tr></thead>
                <tbody>
                  {doc.items.map((it,i)=>{
                    const d=it.actual-it.expected;const ds=d*it.cost;
                    return <tr key={i}>
                      <td style={{textAlign:'left'}}><div className="prod-name">{it.name}</div><div className="prod-sku">{it.sku||'—'}</div></td>
                      <td><span className="num">{it.expected}</span></td>
                      <td><span className="num">{it.actual}</span></td>
                      <td style={{color:'#555'}}><span className="num">{d>0?'+':''}{d}</span></td>
                      <td style={{color:'#555'}}><span className="num">{ds>0?'+':''}{ds.toLocaleString()} ₽</span></td>
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
              <th>№</th>
              <th>Дата</th>
              <th>Расхождений</th>
              <th>Результат</th>
              <th style={{width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="inventoryTableBody">
            {list.length === 0 ? (
              <tr><td colSpan="5"><div className="empty-products"><div className="big-icon">📋</div><p>Инвентаризации не проводились</p>
                    <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Запустите первую сверку фактических остатков с учетными</p></div></td></tr>
            ) : list.map(inv => {
              const diffCount = inv.items.filter(it => it.actual !== it.expected).length;
              return (
                <tr key={inv.id}>
                  <td style={{textAlign:'left'}}><div className="prod-name">{inv.number}</div></td>
                  <td style={{color:'#555'}}>{fmtDate(inv.date)}</td>
                  <td><span className="prod-cat">{diffCount} шт.</span></td>
                  <td style={{color:'#555'}}><span className="num">{(inv.totals?.result ?? 0) > 0 ? '+' : ''}{(inv.totals?.result ?? 0).toLocaleString()} ₽</span></td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                    <button className="act-btn prod-edit-btn" onClick={() => view(inv.id)}>Открыть</button>
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
    

      {editing && <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active')cancelEdit()}}>
        <div className="modal-box" style={{maxWidth:'700px',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
          <button className="modal-close" onClick={cancelEdit}>&times;</button>
          <h2>Редактирование инвентаризации</h2>
          <div className="sub" style={{marginBottom:'.75rem',flexShrink:0}}>{editing.number} - {fmtDate(editing.date)}</div>
          <div className="product-table" style={{overflowY:'auto',flex:1}}>
            <table className="data-table">
              <thead id="colHeaders"><tr><th style={{textAlign:'left'}}>Товар</th><th>Учтено</th><th>Факт</th><th>Разница</th><th>Сумма</th></tr></thead>
              <tbody>
                {editing.items.map(function(it,idx) {
                  var diff = it.actual - it.expected;
                  var ds = diff * it.cost;
                  return <tr key={idx}><td style={{textAlign:'left',color:'#555'}}><div className="prod-name">{it.name}</div><div className="prod-sku">{it.sku||'--'}</div></td>
                    <td style={{color:'#555'}}><span className="num">{it.expected}</span></td>
                    <td><input type="number" value={it.actual} min="0" onChange={function(e){updateItem(editing.id,idx,e.target.value)}} style={{width:'60px',textAlign:'left',padding:'.25rem',border:'1px solid var(--border)',borderRadius:'4px',fontSize:'.85rem'}} /></td>
                    <td style={{color:'#555'}}><span className="num">{diff>0?'+':''}{diff}</span></td>
                    <td style={{color:'#555'}}><span className="num">{ds>0?'+':''}{ds.toLocaleString()} p</span></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="modal-actions" style={{flexShrink:0,marginTop:'.5rem'}}>
            <button className="btn btn-outline" onClick={cancelEdit}>Отмена</button>
            <button className="btn btn-primary" onClick={function(){complete(editing.id)}}>Завершить</button>
          </div>
        </div>
      </div>}

</>
  );
}