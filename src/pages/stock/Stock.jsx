import { useState, useEffect } from 'react';

const CAT_LABELS = { material:'Материалы', tool:'Инструменты', equipment:'Оборудование', other:'Прочее' };
const getProducts = () => JSON.parse(localStorage.getItem('products88') || '[]');
const setProducts = (list) => localStorage.setItem('products88', JSON.stringify(list));
const getSupplies = () => JSON.parse(localStorage.getItem('supplies88') || '[]');

function buildStockMap(supplies) {
  const map = {};
  supplies.forEach(sp => {
    if (!map[sp.prodId]) map[sp.prodId] = { qty: 0, cost: 0 };
    map[sp.prodId].qty += sp.qty || 0;
    map[sp.prodId].cost += (sp.cost || 0) * (sp.qty || 0);
  });
  return map;
}

export default function Stock() {
  const [products, setProductsState] = useState([]);
  const [search, setSearch] = useState('');
  const [stockMap, setStockMap] = useState({});

  const load = () => {
    const supplies = getSupplies();
    setStockMap(buildStockMap(supplies));
    setProductsState(getProducts());
  };

  useEffect(() => { load(); }, []);

  let items = products.filter(p => stockMap[p.id] && stockMap[p.id].qty > 0);
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

  return (
    <>
      <div className="stock-toolbar">
        <div>
          <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
            <h1 style={{fontSize:'1.2rem',fontWeight:600,margin:0}}>Остатки</h1>
            <span className="stock-count">{items.length}</span>
          </div>
          <div className="sub" style={{marginBottom:0}}>Управляйте остатками на складе</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'.3rem'}}>
          <button className="stock-icon-btn">📊</button>
          <button className="stock-icon-btn">📥</button>
          <button className="stock-icon-btn">🖨</button>
          <button className="stock-add-btn" onClick={() => navigateTo('/stock/products')}>+ Добавить</button>
        </div>
      </div>

      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="stock-filterbar" style={{borderTop:'none',borderBottom:'none'}}>
        <div className="stock-search">
          <span style={{fontSize:'.75rem',color:'var(--muted)'}}>🔍</span>
          <input type="text" placeholder="Быстрый поиск" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="stock-filter-links">
          <span className="stock-filter-link">Поставщик</span>
          <span className="stock-filter-link">Счет</span>
          <span className="stock-filter-link">Категории</span>
          <span className="stock-filter-link stock-filter-add">+ Фильтр</span>
        </div>
      </div>

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table style={{minWidth:'680px'}}>
          <thead id="stockColHeaders">
            <tr>
              <th>Артикул</th>
              <th>Товар</th>
              <th>Категория</th>
              <th className="tr">Остаток</th>
              <th className="tr">Закуп</th>
              <th className="tr">Продажа</th>
              <th className="tr">Наценка</th>
              <th className="tr">Сумма</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody id="stockTableBody">
            {items.length === 0 ? (
              <tr>
                <td colSpan="9">
                  <div className="empty-products">
                    <div className="big-icon">📦</div>
                    <p>Товаров на складе нет</p>
                  </div>
                </td>
              </tr>
            ) : items.map(p => {
              const st = stockMap[p.id];
              const qty = st.qty;
              const costPrice = st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
              const retailPrice = p.price || 0;
              const sumValue = costPrice * qty;
              const markup = retailPrice - costPrice;
              const markupPct = costPrice > 0 ? Math.round((markup / costPrice) * 100) : 0;
              const low = qty <= 5;

              return (
                <tr key={p.id}>
                  <td style={{fontSize:'.72rem',color:'var(--muted)',fontFamily:'monospace'}}>{p.sku || '—'}</td>
                  <td>
                    <span style={{fontWeight:400}}>{p.name}</span>
                    {low && <span style={{color:'#dc2626',fontSize:'.65rem'}}> ⚠</span>}
                  </td>
                  <td><span className="prod-cat">{CAT_LABELS[p.cat] || p.cat || '—'}</span></td>
                  <td className={`tr${low ? ' stock-low' : ''}`}>{qty}</td>
                  <td className="tr">{costPrice.toLocaleString()}</td>
                  <td className="tr">
                    <span className="editable-price"
                      style={{cursor:'pointer',color:'var(--primary)',fontWeight:500,borderBottom:'1px dashed var(--primary)',paddingBottom:'1px'}}
                      onClick={() => editPrice(p.id)}>{retailPrice.toLocaleString()}</span>
                  </td>
                  <td className="tr">
                    <span className={`markup-badge${markup >= 0 ? '' : ' neg'}`}>
                      {markup >= 0 ? '+' : ''}{markup.toLocaleString()}{markupPct ? ` (${markupPct}%)` : ''}
                    </span>
                  </td>
                  <td className="tr">{sumValue.toLocaleString()}</td>
                  <td>
                    <span style={{color:'var(--primary)',cursor:'pointer',fontSize:'.72rem'}}
                      onClick={() => navigateTo('/stock/products')}>Ред.</span>
                  </td>
                </tr>
              );
            })}
            {items.length > 0 && (
              <tr className="total-row">
                <td></td>
                <td style={{fontWeight:600}}>Итого</td>
                <td></td>
                <td className="tr" style={{fontWeight:700}}>{totalQty}</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="tr" style={{fontWeight:700}}>{totalSum.toLocaleString()}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
