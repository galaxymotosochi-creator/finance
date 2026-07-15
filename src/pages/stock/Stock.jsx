import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const CAT_LABELS = { material:'Материалы', tool:'Инструменты', equipment:'Оборудование', other:'Прочее' };
const getProducts = () => JSON.parse(localStorage.getItem('products88') || '[]');
const setProducts = (list) => localStorage.setItem('products88', JSON.stringify(list));
const INITIAL_KEY = 'initialStock88';

function buildStockMap(supplies, initial) {
  const map = {};
  supplies.forEach(sp => {
    if (!map[sp.prodId]) map[sp.prodId] = { qty: 0, cost: 0 };
    map[sp.prodId].qty += sp.qty || 0;
    map[sp.prodId].cost += (sp.cost || 0) * (sp.qty || 0);
  });
  // Add initial stock if any
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
  return map;
}

const getInitialStock = () => {
  try { return JSON.parse(localStorage.getItem(INITIAL_KEY)); }
  catch { return null; }
};

const setInitialStock = (data) => {
  localStorage.setItem(INITIAL_KEY, JSON.stringify(data));
};

export default function Stock() {
  const { user } = useAuth();
  const [products, setProductsState] = useState([]);
  const [search, setSearch] = useState('');
  const [stockMap, setStockMap] = useState({});
  const [showInitModal, setShowInitModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [initQty, setInitQty] = useState({});
  const [initCost, setInitCost] = useState({});
  const [initSearch, setInitSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suppliesCache, setSuppliesCache] = useState([]);
  const [initialCache, setInitialCache] = useState(null);
  const [productsFromDB, setProductsFromDB] = useState([]);
  const [selectedCats, setSelectedCats] = useState(null);
  const [catOpen, setCatOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [supRes, prodRes, initRes] = await Promise.all([
      supabase.from('supplies').select('items').eq('user_id', user.id),
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('initial_stocks').select('*').eq('user_id', user.id).single()
    ]);
    const items = supRes.data || [];
    const supplies = [];
    items.forEach(sp => { (sp.items||[]).forEach(it => { supplies.push(it); }); });
    setSuppliesCache(supplies);
    const initial = initRes.data || getInitialStock();
    if (!initRes.data && initial && initial.done) {
      const { error } = await supabase.from('initial_stocks').insert({ id: Date.now(), user_id: user.id, items: initial.items || {}, costs: initial.costs || {}, done: initial.done });
      if (!error) localStorage.removeItem(INITIAL_KEY);
    }
    setInitialCache(initial);
    setStockMap(buildStockMap(supplies, initial));
    if (prodRes.data) setProductsState(prodRes.data);
    setProductsFromDB(prodRes.data || []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 1800);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    const handler = (e) => { if (!e.target.closest('.stock-filter-links') && !e.target.closest('div[style*="position:absolute"]')) setCatOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  let allCats = [...new Set(products.map(p => CAT_LABELS[p.cat] || p.cat || 'Без категории'))].sort();
  let items = products.filter(p => p && !p.hidden);
  if (selectedCats && selectedCats.size > 0) {
    items = items.filter(p => selectedCats.has(CAT_LABELS[p.cat] || p.cat || 'Без категории'));
  }
  items = items.sort((a, b) => { const qa = stockMap[a.id]?.qty || 0; const qb = stockMap[b.id]?.qty || 0; if (qa > 0 && qb <= 0) return -1; if (qa <= 0 && qb > 0) return 1; return 0; });
  const q = search.toLowerCase().trim();
  if (q) items = items.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));

  const totalQty = items.reduce((s, p) => s + (stockMap[p.id]?.qty || 0), 0);
  const totalSum = items.reduce((s, p) => {
    const st = stockMap[p.id];
    if (!st) return s;
    const costPrice = st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
    return s + costPrice * st.qty;
  }, 0);

  const editPrice = (id) => {
    const val = prompt('Новая цена продажи:');
    if (val === null || val === '') return;
    const price = parseFloat(val);
    if (isNaN(price) || price < 0) return alert('Некорректная цена');
    let list = getProducts();
    list = list.map(x => x.id === id ? { ...x, price } : x);
    setProducts(list);
    setProductsState(list);
  };

  const navigateTo = (page) => {
    window.location.hash = page;
    window.dispatchEvent(new Event('hashchange'));
  };

  // Initial stock handlers
  const openInitialStock = () => {
    const existing = getInitialStock();
    if (existing && existing.done) {
      setShowConfirm(true);
    } else {
      prepareInitModal();
    }
  };

  const prepareInitModal = () => {
    const existing = getInitialStock();
    const qtyMap = {};
    const costMap = {};
    (productsFromDB.length ? productsFromDB : products).forEach(p => {
      qtyMap[p.id] = existing && existing.items ? (existing.items[p.id] || 0) : 0;
      costMap[p.id] = existing && existing.costs ? (existing.costs[p.id] || 0) : 0;
    });
    setInitQty(qtyMap);
    setInitCost(costMap);
    setInitSearch('');
    setInitSearch('');
    setShowInitModal(true);
  };

  const confirmCorrection = () => {
    setShowConfirm(false);
    prepareInitModal();
  };

  const cancelCorrection = () => {
    setShowConfirm(false);
  };

  const saveInitialStock = async () => {
    const filtered = {};
    const filteredCosts = {};
    let hasData = false;
    Object.keys(initQty).forEach(id => {
      const v = parseInt(initQty[id]) || 0;
      if (v > 0) { filtered[id] = v; filteredCosts[id] = parseInt(initCost[id]) || 0; hasData = true; }
    });
    if (!hasData && products.length > 0) {
      alert('Введите количество хотя бы для одного товара');
      return;
    }
    const { error } = await supabase.from('initial_stocks').upsert({ user_id: user.id, items: filtered, costs: filteredCosts, done: true }).eq('user_id', user.id);
    if (!error) { setShowInitModal(false); await load(); setToast('Начальные остатки сохранены'); }
    else alert(error.message);
  };

  const filteredProducts = initSearch.trim()
    ? (productsFromDB.length ? productsFromDB : products).filter(p => p.name.toLowerCase().includes(initSearch.toLowerCase().trim()))
    : (productsFromDB.length ? productsFromDB : products);

  return (
    <>
      {toast && <div className="toast toast-success">{toast}</div>}

      <div className="page-header">
        <div>
          <h1>Остатки</h1>
          <div className="sub">Учет количества и фактического наличия товаров</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={openInitialStock}>+ Ввести начальные остатки</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />
      <div className="search-row" style={{display:'flex',alignItems:'center',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap'}}>
        <div className="stock-search" style={{display:'flex',alignItems:'center',gap:'.3rem',width:'30%',minWidth:'180px',maxWidth:'400px',border:'1px solid var(--border)',borderRadius:'6px',padding:'7px .5rem',background:'var(--body-bg)'}}>
          <span style={{fontSize:'.75rem',color:'var(--muted)',lineHeight:1}}>🔍</span>
          <input type="text" placeholder="Быстрый поиск" value={search} onChange={e => setSearch(e.target.value)}
            style={{border:'none',outline:'none',flex:1,fontSize:'.8rem',fontFamily:'var(--font)',background:'none',padding:0}} />
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'.15rem',marginLeft:'auto',position:'relative'}}>
          <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:selectedCats&&selectedCats.size>0?600:400,color:'#555',cursor:'pointer',borderRight:'none',lineHeight:1}}
            onClick={e=>{e.stopPropagation();setCatOpen(!catOpen)}}>Категории</span>
          {catOpen && (
            <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'180px',padding:'.35rem',zIndex:100}}>
              {allCats.map(cat => {
                const checked = selectedCats && selectedCats.has(cat);
                return (
                  <div key={cat} onClick={()=>{const s=new Set(selectedCats);if(s.has(cat))s.delete(cat);else s.add(cat);setSelectedCats(s.size?s:null)}}
                    style={{display:'flex',alignItems:'center',gap:'.35rem',padding:'.3rem .5rem',borderRadius:'4px',cursor:'pointer',fontSize:'.78rem',color:'#555',background:'transparent'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f5f5f5'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <input type="checkbox" checked={!!checked} onChange={()=>{}} style={{accentColor:'var(--secondary)',cursor:'pointer',margin:0}} />
                    {cat}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table className="data-table" style={{minWidth:'680px'}}>
          <thead id="stockColHeaders">
            <tr>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left',minWidth:'200px'}}>Товар</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Артикул</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Штрихкод</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Категория</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Остаток</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Мин. остаток</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Закуп</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Продажа</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Наценка</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Сумма</th>
            </tr>
          </thead>
          <tbody id="stockTableBody">
            {items.length === 0 ? (
              <tr>
                <td colSpan="10">
                  <div className="empty-products">
                    <div className="big-icon">📦</div>
                    <p>Товаров на складе нет</p>
                  </div>
                </td>
              </tr>
            ) : items.map(p => {
              const st = stockMap[p.id] || { qty: 0, cost: 0 };
              const qty = st.qty;
              const costPrice = st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
              const retailPrice = p.price || 0;
              const sumValue = costPrice * qty;
              const markup = retailPrice - costPrice;
              const markupPct = costPrice > 0 ? Math.round((markup / costPrice) * 100) : 0;
              return (
                <tr key={p.id}>
                  <td style={{textAlign:'left',whiteSpace:'nowrap'}}>
                    <span style={{color:'#555'}}>{p.name}</span>
                  </td>
                  <td style={{textAlign:'left',color:'#555',fontFamily:'monospace'}}>{p.sku || '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{p.barcode || '—'}</td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap'}}><span className="prod-cat">{CAT_LABELS[p.cat] || p.cat || '—'}</span></td>
                  <td style={{textAlign:'left',color:'#555'}}>{qty}</td>
                  <td style={{textAlign:'left',color:'#555'}}>
                    {p.min_qty > 0 ? (
                      <span style={{color: qty >= p.min_qty ? '#16a34a' : '#dc2626',fontWeight:500}}>
                        {qty + ' / ' + p.min_qty + ' шт'}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{textAlign:'left',color:'#555'}}>{costPrice.toLocaleString()}</td>
                  <td style={{textAlign:'left',color:'#555'}}>
                    <span className="editable-price"
                      style={{cursor:'pointer',color:'#555',borderBottom:'1px dashed #999',paddingBottom:'1px'}}
                      onClick={() => editPrice(p.id)}>{retailPrice.toLocaleString()}</span>
                  </td>
                  <td style={{textAlign:'left',color:'#555'}}>
                    <span className={`markup-badge${markup >= 0 ? '' : ' neg'}`}>
                      {markup >= 0 ? '+' : ''}{markup.toLocaleString()}{markupPct ? ` (${markupPct}%)` : ''}
                    </span>
                  </td>
                  <td style={{textAlign:'left',color:'#555'}}>{sumValue.toLocaleString()}</td>
                </tr>
              );
            })}
            {items.length > 0 && (
              <tr className="total-row">
                <td style={{fontWeight:600,textAlign:'left'}}>Итого</td>
                <td></td>
                <td></td>
                <td></td>
                <td style={{textAlign:'left',fontWeight:700}}>{totalQty}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td style={{textAlign:'left',fontWeight:700}}>{totalSum.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirm correction modal */}
      {showConfirm && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setShowConfirm(false)}}}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <button className="modal-close" onClick={()=>setShowConfirm(false)}>&times;</button>
            <h2 style={{fontSize:'1rem'}}>Начальные остатки уже внесены</h2>
            <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.75rem 0',lineHeight:1.5}}>
              Вы уже вносили начальные остатки. Хотите их откорректировать?
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={cancelCorrection}>Нет</button>
              <button className="btn btn-account-select" onClick={confirmCorrection} style={{marginLeft:'.5rem'}}>Да, откорректировать</button>
            </div>
          </div>
        </div>
      )}

      {/* Initial stock modal */}
      {showInitModal && (
        <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setShowInitModal(false)}}}>
          <div className="modal-box" style={{maxWidth:'520px',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
            <button className="modal-close" onClick={()=>setShowInitModal(false)}>&times;</button>
            <h2 style={{fontSize:'1rem'}}>Введите начальные остатки</h2>
            <div className="sub" style={{marginBottom:'.5rem'}}>Укажите количество каждого товара на складе</div>

            <div className="stock-search" style={{marginBottom:'.6rem'}}>
              <span style={{fontSize:'.75rem',color:'var(--muted)'}}>🔍</span>
              <input type="text" placeholder="Поиск товара" value={initSearch} onChange={e=>setInitSearch(e.target.value)}
                style={{border:'none',outline:'none',flex:1,fontSize:'.8rem',fontFamily:'var(--font)',background:'none',padding:0}} />
            </div>

            <div style={{overflowY:'auto',flex:1,border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'.35rem'}}>
              {filteredProducts.length === 0 ? (
                <p style={{textAlign:'center',padding:'1rem',color:'var(--muted)',fontSize:'.82rem'}}>Товары не найдены</p>
              ) : filteredProducts.map(p => (
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.45rem .5rem',borderBottom:'1px solid var(--border)'}}>
                  <span style={{flex:1,fontSize:'.82rem',fontWeight:400}}>{p.name}</span>
                  {p.sku && <span style={{fontSize:'.72rem',color:'var(--muted)',fontFamily:'monospace'}}>{p.sku}</span>}
                  <input type="number" min="0" value={initQty[p.id] || ''}
                    onChange={function(e){var v=e.target.value;setInitQty(function(prev){var r=Object.assign({},prev);r[p.id]=v===''?0:Math.max(0,parseInt(v)||0);return r})}}
                    placeholder="0"
                    style={{width:'65px',padding:'.35rem .4rem',fontSize:'.8rem',border:'1px solid var(--border)',borderRadius:'5px',outline:'none',textAlign:'center',fontFamily:'var(--font)'}} />
                  <input type="number" min="0" value={initCost[p.id] || ''}
                    onChange={function(e){var v=e.target.value;setInitCost(function(prev){var r=Object.assign({},prev);r[p.id]=v===''?0:Math.max(0,parseInt(v)||0);return r})}}
                    placeholder="Цена"
                    style={{width:'80px',padding:'.35rem .4rem',fontSize:'.8rem',border:'1px solid var(--border)',borderRadius:'5px',outline:'none',textAlign:'center',fontFamily:'var(--font)'}} />
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{marginTop:'.5rem',borderTop:'none',paddingTop:0}}>
              <button className="btn btn-outline" onClick={()=>setShowInitModal(false)} style={{marginRight:'.5rem'}}>Отмена</button>
              <button className="btn btn-account-select" onClick={saveInitialStock}>Сохранить остатки</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
