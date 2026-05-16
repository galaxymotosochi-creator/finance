import { useState, useEffect, useCallback } from 'react';

const CAT_LABELS = { material:'Материалы', tool:'Инструменты', equipment:'Оборудование', other:'Прочее' };

const ALL_COLUMNS = [
  { id:'name', label:'Название', always: true },
  { id:'category', label:'Категория', def:true },
  { id:'barcode', label:'Штрихкод', def:false },
  { id:'type', label:'Тип', def:false },
  { id:'weight', label:'Весовой товар', def:false },
  { id:'unit', label:'Ед. измерения', def:false },
  { id:'costNoVat', label:'Себес. без НДС', def:true },
  { id:'costWithVat', label:'Себес. с НДС', def:false },
  { id:'price', label:'Цена', def:true },
  { id:'profit', label:'Прибыль', def:false },
  { id:'margin', label:'Наценка', def:true },
];

const getCats = () => JSON.parse(localStorage.getItem('prodCats88') || '[]');
const getProducts = () => JSON.parse(localStorage.getItem('products88') || '[]');
const setProducts = (list) => localStorage.setItem('products88', JSON.stringify(list));
const getTrash = () => JSON.parse(localStorage.getItem('trash88') || '[]');
const setTrash = (list) => localStorage.setItem('trash88', JSON.stringify(list));
const getCols = () => {
  const saved = localStorage.getItem('productsCols');
  if (saved) return new Set(JSON.parse(saved));
  return new Set(ALL_COLUMNS.filter(c => c.def).map(c => c.id));
};
const setCols = (set) => localStorage.setItem('productsCols', JSON.stringify([...set]));

const COL_ORDER = ['name','category','barcode','type','weight','unit','costNoVat','costWithVat','price','profit','margin'];
const COL_LABELS = { name:'Название', category:'Категория', barcode:'Штрихкод', type:'Тип', weight:'Весовой товар', unit:'Ед. измерения', costNoVat:'Себес. без НДС', costWithVat:'Себес. с НДС', price:'Цена', profit:'Прибыль', margin:'Наценка' };

export default function Products() {
  const [products, setProductsState] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCols, setActiveColsState] = useState(getCols);
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [mode, setMode] = useState('add');
  const [showTrash, setShowTrash] = useState(false);
  const [toast, setToast] = useState(null);

  // Форма
  const [fName, setFName] = useState('');
  const [fCat, setFCat] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fUnit, setFUnit] = useState('');
  const [fSku, setFSku] = useState('');
  const [fBarcode, setFBarcode] = useState('');
  const [fType, setFType] = useState('product');
  const [fWeight, setFWeight] = useState('0');
  const [fWeightUnit, setFWeightUnit] = useState('кг');
  const [fCostNoVat, setFCostNoVat] = useState('0');
  const [fCostWithVat, setFCostWithVat] = useState('0');
  const [fDesc, setFDesc] = useState('');
  const [fHidden, setFHidden] = useState(false);

  // Dropdowns
  const [catOpen, setCatOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [catFilter, setCatFilter] = useState('');

  const load = useCallback(() => { setProductsState(getProducts().filter(p => !p.hidden)); }, []);

  useEffect(() => { load(); }, [load]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.cat-wrapper')) setCatOpen(false);
      if (!e.target.closest('.cols-wrapper')) setColsOpen(false);
      if (!e.target.closest('.export-wrapper')) setExportOpen(false);
      if (!e.target.closest('.prod-more-wrap')) {
        document.querySelectorAll('.prod-dropdown.open').forEach(d => d.classList.remove('open'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const showToast = (msg) => {
    setToast(msg || '✅ Товар успешно добавлен!');
    setTimeout(() => setToast(null), 1500);
  };

  const openAdd = () => {
    setEditId(null); setMode('add'); setFHidden(false);
    setFName(''); setFCat(''); setFPrice(''); setFUnit(''); setFSku('');
    setFBarcode(''); setFType('product'); setFWeight('0'); setFWeightUnit('кг');
    setFCostNoVat('0'); setFCostWithVat('0'); setFDesc('');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditId(p.id); setMode('edit'); setFHidden(p.hidden || false);
    setFName(p.name); setFCat(p.cat || ''); setFPrice(String(p.price || ''));
    setFUnit(p.unit || ''); setFSku(p.sku || ''); setFBarcode(p.barcode || '');
    setFType(p.type || 'product'); setFWeight(String(p.weight || '0'));
    setFWeightUnit(p.weightUnit || 'кг'); setFCostNoVat(String(p.costNoVat || '0'));
    setFCostWithVat(String(p.costWithVat || '0')); setFDesc(p.desc || '');
    setShowModal(true);
  };

  const save = (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название');
    const price = parseFloat(fPrice) || 0;
    const costNoVat = parseFloat(fCostNoVat) || 0;
    const costWithVat = parseFloat(fCostWithVat) || 0;
    const cost = costWithVat || costNoVat;
    const profit = price - cost;
    const margin = cost > 0 ? (profit / cost * 100) : 0;
    let list = getProducts();
    if (editId) {
      const idx = list.findIndex(x => x.id === editId);
      if (idx === -1) return alert('Товар не найден');
      list[idx] = { ...list[idx],
        name: fName.trim(), cat: fCat, price: price, unit: fUnit,
        sku: fSku.trim(), barcode: fBarcode.trim(), type: fType,
        weight: parseFloat(fWeight) || 0, weightUnit: fWeightUnit,
        costNoVat: costNoVat, costWithVat: costWithVat,
        profit: profit, margin: margin, hidden: fHidden
      };
    } else {
      list.unshift({
        id: Date.now(), name: fName.trim(), cat: fCat, price: price,
        unit: fUnit, sku: fSku.trim(), barcode: fBarcode.trim(),
        type: fType, weight: parseFloat(fWeight) || 0, weightUnit: fWeightUnit,
        costNoVat: costNoVat, costWithVat: costWithVat,
        profit: profit, margin: margin, hidden: false,
        desc: fDesc
      });
    }
    setProducts(list);
    setShowModal(false);
    load();
    showToast();
  };

  const remove = (id) => {
    if (!confirm('Удалить товар?')) return;
    let list = getProducts();
    let trash = getTrash();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return;
    const item = { ...list[idx], deletedAt: Date.now() };
    trash.unshift(item);
    list.splice(idx, 1);
    setProducts(list);
    setTrash(trash);
    load();
    showToast('🗑️ Товар перемещён в корзину');
  };

  const hide = (id) => {
    let list = getProducts();
    list = list.map(p => p.id === id ? { ...p, hidden: true } : p);
    setProducts(list);
    load();
  };

  const unhide = (id) => {
    let list = getProducts();
    list = list.map(p => p.id === id ? { ...p, hidden: false } : p);
    setProducts(list);
    load();
  };

  const copyP = (id) => {
    let list = getProducts();
    const p = list.find(x => x.id === id);
    if (!p) return;
    list.push({ ...p, id: Date.now(), hidden: false });
    setProducts(list);
    load();
    showToast('📋 Товар скопирован');
  };

  const restore = (id) => {
    let list = getProducts();
    list = list.map(p => p.id === id ? { ...p, hidden: false } : p);
    setProducts(list);
    load();
    setShowModal(false);
    showToast('🔄 Товар восстановлен');
  };

  const toggleCol = (id) => {
    const next = new Set(activeCols);
    if (next.has(id)) next.delete(id); else next.add(id);
    setActiveColsState(next);
    setCols(next);
  };

  const resetCols = () => {
    const def = new Set(ALL_COLUMNS.filter(c => c.def).map(c => c.id));
    setActiveColsState(def);
    setCols(def);
    showToast('Столбцы сброшены');
  };

  const toggleCat = (name) => {
    const next = new Set(selectedCats);
    if (next.has(name)) next.delete(name); else next.add(name);
    setSelectedCats(next);
  };

  const selectAllCats = () => {
    setSelectedCats(new Set(getCats().map(c => c.name)));
  };

  const clearAllCats = () => {
    setSelectedCats(new Set());
  };

  const exportExcel = () => {
    const data = products.map(p => ({
      'Название': p.name,
      'Категория': CAT_LABELS[p.cat] || p.cat || '',
      'Цена': p.price,
      'Ед. измерения': p.unit || '',
      'Артикул': p.sku || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:30},{wch:15},{wch:12},{wch:12},{wch:15}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');
    XLSX.writeFile(wb, 'Товары.xlsx');
  };

  // Filter products
  let filtered = products;
  const q = search.toLowerCase().trim();
  if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  if (selectedCats.size > 0) filtered = filtered.filter(p => selectedCats.has(CAT_LABELS[p.cat] || p.cat || ''));

  const cellHtml = (col, p) => {
    switch(col) {
      case 'name': return `<div class="prod-name">${p.name}</div>`;
      case 'category': return `<span class="prod-cat">${CAT_LABELS[p.cat] || p.cat || '—'}</span>`;
      case 'barcode': return `<span style="font-size:.8rem;color:var(--muted)">${p.barcode || p.sku || '—'}</span>`;
      case 'type': return `<span style="font-size:.78rem">${p.type === 'service' ? 'Услуга' : 'Товар'}</span>`;
      case 'weight': return p.weight ? `${p.weight} ${p.weightUnit || 'кг'}` : '—';
      case 'unit': return p.unit || '—';
      case 'costNoVat': return `<span class="num">${p.costNoVat != null ? p.costNoVat.toLocaleString() + '₽' : '—'}</span>`;
      case 'costWithVat': return `<span class="num">${p.costWithVat != null ? p.costWithVat.toLocaleString() + '₽' : '—'}</span>`;
      case 'price': return `<span class="prod-price">${(p.price || 0).toLocaleString()}₽</span>`;
      case 'profit': {
        const profit = p.profit;
        const color = profit > 0 ? 'color:#16a34a' : profit < 0 ? 'color:#dc2626' : '';
        return `<span class="num" style="${color}">${profit != null ? (profit > 0 ? '+' : '') + profit.toFixed(0) + '₽' : '—'}</span>`;
      }
      case 'margin': {
        const margin = p.margin;
        const color = margin > 0 ? 'color:#16a34a' : margin < 0 ? 'color:#dc2626' : '';
        return `<span class="num" style="${color}">${margin != null ? margin.toFixed(1) + '%' : '—'}</span>`;
      }
      default: return '—';
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Товары и услуги</h1>
          <div className="sub">Управляйте — добавляйте, редактируйте, ищите</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={openAdd}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="search-row">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input type="text" className="search-field" placeholder="Быстрый поиск"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="actions-group">

          {/* Категория */}
          <div className="cat-wrapper">
            <button className="text-btn" onClick={() => { setCatOpen(!catOpen); setColsOpen(false); setExportOpen(false); }}>
              Категория <span className={`act-arrow${catOpen ? ' open' : ''}`}>▼</span>
            </button>
            {catOpen && (
              <div className="cat-dropdown open">
                <div className="cat-dd-actions">
                  <span className="cat-dd-action" onClick={selectAllCats}>Выбрать все</span>
                  <span className="cat-dd-action" onClick={clearAllCats}>Очистить</span>
                </div>
                <div className="cat-dd-search">
                  <input type="text" placeholder="Поиск..." value={catFilter} onChange={e => setCatFilter(e.target.value)} />
                </div>
                <div className="cat-dd-list">
                  {getCats().filter(c => !catFilter || c.name.toLowerCase().includes(catFilter.toLowerCase())).map(c => {
                    const checked = selectedCats.has(c.name);
                    return (
                      <div key={c.name} className="cat-dd-item" onClick={() => toggleCat(c.name)}>
                        <span className={`cb${checked ? ' checked' : ''}`}>✓</span>
                        <span>{c.name}</span>
                      </div>
                    );
                  })}
                  {getCats().length === 0 && <div style={{padding:'.5rem',color:'var(--muted)',fontSize:'.78rem'}}>Нет категорий</div>}
                </div>
              </div>
            )}
          </div>

          {/* Корзина */}
          <button className="text-btn" onClick={() => { setCatOpen(false); setColsOpen(false); setExportOpen(false); setShowTrash(true); }}>Корзина</button>

          {/* Скачать */}
          <div className="export-wrapper">
            <button className="text-btn" onClick={() => { setExportOpen(!exportOpen); setCatOpen(false); setColsOpen(false); }}>
              Скачать <span className="act-arrow">▼</span>
            </button>
            {exportOpen && (
              <div className="export-dropdown open">
                <div className="export-dd-title">Вы хотите скачать товары в Excel?</div>
                <div className="export-dd-actions">
                  <span className="export-dd-btn" onClick={() => { setExportOpen(false); exportExcel(); }}>Да</span>
                  <span className="export-dd-btn export-dd-cancel" onClick={() => setExportOpen(false)}>Нет</span>
                </div>
              </div>
            )}
          </div>

          {/* Столбцы */}
          <div className="cols-wrapper">
            <button className="text-btn" onClick={() => { setColsOpen(!colsOpen); setCatOpen(false); setExportOpen(false); }}>
              Столбцы <span className="act-arrow">▼</span>
            </button>
            {colsOpen && (
              <div className="cols-dropdown open">
                <div className="cols-title">Отображать столбцы</div>
                <div className="cols-list">
                  {ALL_COLUMNS.filter(c => !c.always).map(c => {
                    const checked = activeCols.has(c.id);
                    return (
                      <div key={c.id} className="cols-item" onClick={() => toggleCol(c.id)}>
                        <span className={`cb${checked ? ' checked' : ''}`}>✓</span>
                        <span>{c.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="cols-footer">
                  <span className="cols-reset" onClick={resetCols}>Вернуть по умолчанию</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Таблица */}
      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table>
          <thead id="colHeaders">
            <tr>
              {COL_ORDER.map(col => {
                if (col === 'name' || activeCols.has(col)) {
                  return <th key={col} data-col={col}>{COL_LABELS[col]}</th>;
                }
                return null;
              })}
              <th style={{width:'140px',textAlign:'right'}}></th>
            </tr>
          </thead>
          <tbody id="productTableBody">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2 + activeCols.size}>
                  <div className="empty-products">
                    <div className="big-icon">📦</div>
                    <p>Товаров пока нет. Нажмите «+ Добавить»</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                {COL_ORDER.map(col => {
                  if (col === 'name' || activeCols.has(col)) {
                    return <td key={col} dangerouslySetInnerHTML={{__html: cellHtml(col, p)}} />;
                  }
                  return null;
                })}
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <button className="act-btn prod-edit-btn" onClick={() => openEdit(p)}>Ред.</button>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={(e) => {
                      e.stopPropagation();
                      const dd = e.currentTarget.nextElementSibling;
                      document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                      dd.classList.toggle('open');
                    }}>⋯</button>
                    <div className="prod-dropdown">
                      <button onClick={() => copyP(p.id)}>Копировать</button>
                      <button onClick={() => hide(p.id)}>Скрыть</button>
                      <button onClick={() => remove(p.id)} style={{color:'#dc3545'}}>Удалить</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модалка товара */}
      {showModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.className === 'modal-overlay active') setShowModal(false); }}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            <h2>{editId ? 'Редактировать товар' : 'Добавить товар или услугу'}</h2>
            <div className="sub">Заполните поля и нажмите Сохранить</div>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Название *</label>
                <input type="text" value={fName} onChange={e => setFName(e.target.value)} required placeholder="Например: Цемент М500" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Категория</label>
                  <select value={fCat} onChange={e => setFCat(e.target.value)}>
                    <option value="">— выберите —</option>
                    {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    {getCats().filter(c => !CAT_LABELS[c.name]).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Тип</label>
                  <select value={fType} onChange={e => setFType(e.target.value)}>
                    <option value="product">Товар</option>
                    <option value="service">Услуга</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Цена продажи (₽)</label>
                  <input type="number" min="0" step="0.01" value={fPrice} onChange={e => setFPrice(e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Ед. измерения</label>
                  <input type="text" value={fUnit} onChange={e => setFUnit(e.target.value)} placeholder="шт, кг, м²..." />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Артикул</label>
                  <input type="text" value={fSku} onChange={e => setFSku(e.target.value)} placeholder="ART-001" />
                </div>
                <div className="form-group">
                  <label>Штрихкод</label>
                  <input type="text" value={fBarcode} onChange={e => setFBarcode(e.target.value)} placeholder="4600000000000" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Вес</label>
                  <input type="number" min="0" step="0.01" value={fWeight} onChange={e => setFWeight(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Ед. веса</label>
                  <select value={fWeightUnit} onChange={e => setFWeightUnit(e.target.value)}>
                    <option value="г">г</option>
                    <option value="кг">кг</option>
                    <option value="т">т</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Себестоимость без НДС</label>
                  <input type="number" min="0" step="0.01" value={fCostNoVat} onChange={e => setFCostNoVat(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Себестоимость с НДС</label>
                  <input type="number" min="0" step="0.01" value={fCostWithVat} onChange={e => setFCostWithVat(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea rows="2" value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Дополнительная информация..." />
              </div>
              <div className="modal-actions">
                {editId && fHidden && (
                  <button type="button" className="btn" style={{background:'var(--primary)',color:'#fff',marginRight:'.5rem'}} onClick={() => restore(editId)}>Восстановить товар</button>
                )}
                <button type="submit" className="btn btn-primary">{editId ? 'Сохранить' : 'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Корзина модалка */}
      {showTrash && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.className === 'modal-overlay active') setShowTrash(false); }}>
          <div className="modal-box">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.5rem'}}>
              <h2>Корзина</h2>
              <button onClick={() => setShowTrash(false)} style={{background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'var(--muted)'}}>✕</button>
            </div>
            <div className="sub" style={{marginBottom:'1.5rem'}}>Товары хранятся в корзине в течение 30 дней после удаления</div>
            <div className="product-table">
              <table>
                <thead>
                  <tr>
                    <th style={{width:'45%'}}>Товар</th>
                    <th style={{width:'20%'}}>Категория</th>
                    <th style={{width:'35%'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const trash = getTrash();
                    if (!trash.length) {
                      return (
                        <tr><td colSpan="3"><div className="empty-products"><div className="big-icon">🗑️</div><p>В корзине пока ничего нет</p></div></td></tr>
                      );
                    }
                    return trash.map(p => {
                      const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - p.deletedAt) / 86400000));
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="prod-name">{p.name}</div>
                            <div className="prod-sku">{p.sku || '—'}</div>
                          </td>
                          <td style={{fontSize:'.78rem',color:'var(--muted)'}}>осталось {daysLeft} дн.</td>
                          <td style={{textAlign:'right'}}>
                            <button className="act-btn" onClick={() => {
                              let list = getProducts();
                              let trash = getTrash();
                              const idx = trash.findIndex(x => x.id === p.id);
                              if (idx > -1) {
                                const item = { ...trash[idx], hidden: false };
                                delete item.deletedAt;
                                list.push(item);
                                trash.splice(idx, 1);
                                setProducts(list);
                                setTrash(trash);
                                load();
                                showToast('🔄 Товар восстановлен');
                              }
                            }} style={{color:'var(--primary)'}}>Восстановить</button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div id="toast" style={{
          position:'fixed', bottom:'1.5rem', left:'50%', transform:'translateX(-50%)',
          background:'#fff', border:'1px solid #e5e7eb', borderRadius:'.75rem',
          padding:'.65rem 1.2rem', fontSize:'.85rem', color:'#333',
          boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)', zIndex:9999,
          display:'flex', alignItems:'center', gap:'.5rem'
        }}>
          {toast}
        </div>
      )}
    </>
  );
}