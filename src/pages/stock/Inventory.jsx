import { useState, useEffect } from 'react';

const getInv = () => JSON.parse(localStorage.getItem('inventory88') || '[]');
const setInv = (list) => localStorage.setItem('inventory88', JSON.stringify(list));
const getProducts = () => JSON.parse(localStorage.getItem('products88') || '[]');
const getSupplies = () => JSON.parse(localStorage.getItem('supplies88') || '[]');

const CAT_LABELS = {material:'Материалы',tool:'Инструменты',equipment:'Оборудование',other:'Прочее'};

function buildStockMap() {
  const map = {};
  getSupplies().forEach(sp => { if (!map[sp.prodId]) map[sp.prodId] = 0; map[sp.prodId] += sp.qty || 0; });
  return map;
}

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
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showResult, setShowResult] = useState(null);

  const load = () => setList(getInv());
  useEffect(() => { load(); }, []);

  const startNew = () => {
    const all = getInv();
    const num = 'INV-' + String(all.length + 1).padStart(3, '0');
    const stockMap = buildStockMap();
    const items = getProducts().filter(p => !p.hidden).map(p => ({
      prodId: p.id, name: p.name, sku: p.sku || '',
      cat: CAT_LABELS[p.cat] || p.cat || '',
      expected: stockMap[p.id] || 0, actual: stockMap[p.id] || 0,
      cost: p.costWithVat || p.costNoVat || 0
    }));
    const totalBefore = items.reduce((s, it) => s + it.expected * it.cost, 0);
    const doc = {
      id: Date.now(), number: num, date: new Date().toISOString().split('T')[0],
      responsible: '', status: 'draft', items,
      totals: { totalBefore, totalAfter: totalBefore, shortage: 0, surplus: 0, result: 0 }
    };
    all.unshift(doc); setInv(all); load(); setEditing(doc);
  };

  const cancelEdit = () => {
    if (editing) { setInv(getInv().filter(d => d.id !== editing.id)); load(); }
    setEditing(null);
  };

  const updateMeta = (id, field, value) => {
    const all = getInv(); const doc = all.find(d => d.id === id);
    if (!doc) return; doc[field] = value; setInv(all); setEditing({...doc});
  };

  const updateItem = (id, idx, actual) => {
    const all = getInv(); const doc = all.find(d => d.id === id);
    if (!doc) return;
    doc.items[idx].actual = parseInt(actual) || 0;
    recalcTotals(doc); setInv(all); setEditing({...doc});
  };

  const complete = (id) => {
    const all = getInv(); const doc = all.find(d => d.id === id);
    if (!doc) return; recalcTotals(doc); setShowResult(doc);
  };

  const confirmResult = () => {
    if (!showResult) return;
    const all = getInv(); const doc = all.find(d => d.id === showResult.id);
    if (!doc) return; doc.status = 'completed';
    setInv(all); setShowResult(null); setEditing(null); load();
  };

  const view = (id) => {
    const doc = getInv().find(d => d.id === id);
    if (doc) setViewing(viewing?.id === id ? null : doc);
  };

  const remove = (id) => {
    if (!confirm('Удалить инвентаризацию?')) return;
    setInv(getInv().filter(d => d.id !== id));
    if (viewing?.id === id) setViewing(null);
    if (editing?.id === id) setEditing(null);
    load();
  };

  // Режим редактирования
  if (editing) {
    const doc = editing;
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Инвентаризация</h1>
            <div className="sub">Сверка фактических остатков с учётными</div>
          </div>
          <div className="page-actions">
            <button className="btn btn-outline" onClick={cancelEdit} style={{fontSize:'.8rem'}}>← Назад</button>
          </div>
        </div>
        <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

        <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
          <table>
            <tbody id="inventoryTableBody">
              <tr>
                <td colSpan="5" style={{padding:'.5rem 0 1rem 0'}}>
                  <div style={{display:'flex',gap:'1.5rem',flexWrap:'wrap',alignItems:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
                      <span style={{fontSize:'.78rem',color:'var(--muted)'}}>№</span>
                      <input type="text" value={doc.number} onChange={e => updateMeta(doc.id, 'number', e.target.value)}
                        style={{padding:'.3rem',border:'1px solid var(--border)',borderRadius:'4px',fontSize:'.9rem',fontWeight:600,maxWidth:'120px'}} />
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
                      <span style={{fontSize:'.78rem',color:'var(--muted)'}}>Дата</span>
                      <input type="date" value={doc.date} onChange={e => updateMeta(doc.id, 'date', e.target.value)}
                        style={{padding:'.3rem',border:'1px solid var(--border)',borderRadius:'4px',fontSize:'.85rem'}} />
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
                      <span style={{fontSize:'.78rem',color:'var(--muted)'}}>Ответственный</span>
                      <input type="text" value={doc.responsible||''} onChange={e => updateMeta(doc.id, 'responsible', e.target.value)}
                        placeholder="ФИО" style={{padding:'.3rem',border:'1px solid var(--border)',borderRadius:'4px',fontSize:'.85rem',maxWidth:'200px'}} />
                    </div>
                  </div>
                </td>
              </tr>
              <tr><th className="prod-table-th" style={{textAlign:'left'}}>Товар</th><th className="prod-table-th">Учтено</th><th className="prod-table-th">Факт</th><th className="prod-table-th">Разница</th><th className="prod-table-th">Сумма</th></tr>
              {doc.items.map((it, idx) => {
                const diff = it.actual - it.expected;
                const diffSum = diff * it.cost;
                return (
                  <tr key={idx}>
                    <td style={{textAlign:'left'}}><div className="prod-name">{it.name}</div><div className="prod-sku">{it.sku||'—'}</div></td>
                    <td><span className="num">{it.expected}</span></td>
                    <td><input type="number" value={it.actual} min="0" onChange={e => updateItem(doc.id, idx, e.target.value)}
                      style={{width:'70px',textAlign:'center',padding:'.3rem',border:'1px solid var(--border)',borderRadius:'4px',fontSize:'.85rem'}} /></td>
                    <td><span className="num" style={{color:diff>0?'#16a34a':(diff<0?'#dc2626':'var(--muted)')}}>{diff>0?'+':''}{diff}</span></td>
                    <td><span className="num" style={{color:diffSum>0?'#16a34a':(diffSum<0?'#dc2626':'var(--muted)')}}>{diffSum>0?'+':''}{diffSum.toLocaleString()}₽</span></td>
                  </tr>
                );
              })}
              <tr><td colSpan="5" style={{textAlign:'right',padding:'1rem 0'}}>
                <button className="btn btn-primary" onClick={() => complete(doc.id)} style={{padding:'.6rem 1.5rem',fontSize:'.85rem'}}>Завершить инвентаризацию</button>
              </td></tr>
            </tbody>
          </table>
        </div>

        {showResult && (
          <div className="modal-overlay active" onClick={(e)=>e.target.className==='modal-overlay active'&&setShowResult(null)}>
            <div className="modal-box" style={{maxWidth:'600px'}}>
              <button className="modal-close" onClick={()=>setShowResult(null)}>&times;</button>
              <h2>Итог инвентаризации {showResult.number}</h2>
              <div className="sub">{showResult.date}{showResult.responsible?' • '+showResult.responsible:''}</div>
              {(()=>{
                const t=showResult.totals;
                const di=showResult.items.filter(it=>it.actual!==it.expected);
                return (<>
                  {di.length===0?<div style={{textAlign:'center',padding:'2rem',color:'var(--muted)'}}>✅ Расхождений нет</div>
                  :<table style={{width:'100%',fontSize:'.85rem',borderCollapse:'collapse'}}>
                    <thead><tr style={{fontSize:'.72rem',color:'var(--muted)',textTransform:'uppercase'}}>
                      <th style={{textAlign:'left',padding:'.35rem .3rem'}}>Товар</th><th style={{padding:'.35rem .3rem'}}>Кол-во</th><th style={{padding:'.35rem .3rem'}}>Сумма</th>
                    </tr></thead>
                    <tbody>{di.map((it,i)=>{const d=it.actual-it.expected;const ds=d*it.cost;
                      return <tr key={i}><td style={{padding:'.3rem',textAlign:'left'}}>{it.name}</td>
                      <td style={{padding:'.3rem',color:d>0?'#16a34a':'#dc2626'}}>{d>0?'+':''}{d} шт</td>
                      <td style={{padding:'.3rem',color:ds>0?'#16a34a':'#dc2626'}}>{ds>0?'+':''}{ds.toLocaleString()}₽</td></tr>;
                    })}</tbody></table>}
                  <div style={{display:'flex',flexDirection:'column',gap:'.35rem',fontSize:'.85rem',marginTop:'.75rem',paddingTop:'.5rem',borderTop:'1px solid var(--border)'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Недостача:</span><span style={{color:'#dc2626'}}>{t.shortage.toLocaleString()}₽</span></div>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Излишек:</span><span style={{color:'#16a34a'}}>{t.surplus.toLocaleString()}₽</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',fontWeight:600,borderTop:'1px solid var(--border)',paddingTop:'.35rem'}}>
                      <span>Результат:</span><span style={{color:t.result>0?'#16a34a':(t.result<0?'#dc2626':'')}}>{t.result>0?'+':''}{t.result.toLocaleString()}₽</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:'.25rem'}}><span style={{color:'var(--muted)'}}>Склад ДО:</span><span>{t.totalBefore.toLocaleString()}₽</span></div>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Склад ПОСЛЕ:</span><span>{t.totalAfter.toLocaleString()}₽</span></div>
                  </div>
                  <div className="modal-actions" style={{marginTop:'1rem'}}><button className="btn btn-primary" onClick={confirmResult}>Подтвердить</button></div>
                </>);
              })()}
            </div>
          </div>
        )}
      </>
    );
  }

  // Режим просмотра списка
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Инвентаризация</h1>
          <div className="sub">Сверка фактических остатков с учётными</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={startNew}>+ Новая инвентаризация</button>
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
              <table>
                <thead><tr>
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
                      <td><span className="num" style={{color:d>0?'#16a34a':(d<0?'#dc2626':'var(--muted)')}}>{d>0?'+':''}{d}</span></td>
                      <td><span className="num" style={{color:ds>0?'#16a34a':(ds<0?'#dc2626':'var(--muted)')}}>{ds>0?'+':''}{ds.toLocaleString()}₽</span></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table>
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
              <tr><td colSpan="5"><div className="empty-products"><div className="big-icon">📋</div><p>Инвентаризаций пока нет. Нажмите «+ Новая инвентаризация»</p></div></td></tr>
            ) : list.map(inv => {
              const diffCount = inv.items.filter(it => it.actual !== it.expected).length;
              return (
                <tr key={inv.id}>
                  <td style={{textAlign:'left'}}><div className="prod-name">{inv.number}</div></td>
                  <td style={{fontSize:'.82rem',color:'var(--muted)'}}>{inv.date||'—'}</td>
                  <td><span className="prod-cat">{diffCount} шт.</span></td>
                  <td><span className="num" style={{color:inv.totals.result>0?'#16a34a':(inv.totals.result<0?'#dc2626':'var(--muted)')}}>{inv.totals.result>0?'+':''}{inv.totals.result.toLocaleString()}₽</span></td>
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
    </>
  );
}