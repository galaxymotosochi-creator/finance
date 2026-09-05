import Modal from '../../components/Modal';
import SectionHelp from '../../components/SectionHelp';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';

const CAT_LABELS = { material:'Материалы', tool:'Инструменты', equipment:'Оборудование', other:'Прочее' };
const getProducts = () => JSON.parse(localStorage.getItem('products88') || '[]');
const setProducts = (list) => localStorage.setItem('products88', JSON.stringify(list));
const INITIAL_KEY = 'initialStock88';

function buildStockMap(supplies, initial, writeoffs) {
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
  // Списания (продажи со склада, акты списания) — уменьшают остаток.
  // Иначе раздел «Остатки» расходится с кассой (та вычитает списания).
  // Вместе с количеством уменьшаем и стоимость (по средней) — иначе себестоимость завышается.
  (writeoffs || []).forEach(wo => {
    const pid = wo.product_id;
    if (pid && map[pid]) {
      const avg = map[pid].qty > 0 ? map[pid].cost / map[pid].qty : 0;
      const q = Number(wo.quantity) || 0;
      map[pid].qty -= q;
      map[pid].cost = Math.max(0, map[pid].cost - q * avg);
      if (map[pid].qty < 0) map[pid].qty = 0;
    }
  });
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
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [products, setProductsState] = useState([]);
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [stStatus, setStStatus] = useState('all'); // all | in (в наличии) | low (заканчиваются) | out (закончились)
  const [stockMap, setStockMap] = useState({});
  const [showInitModal, setShowInitModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [initQty, setInitQty] = useState({});
  const [initCost, setInitCost] = useState({});
  const [initSearch, setInitSearch] = useState('');
  const [initSearchFocus, setInitSearchFocus] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suppliesCache, setSuppliesCache] = useState([]);
  const [initialCache, setInitialCache] = useState(null);
  const [productsFromDB, setProductsFromDB] = useState([]);
  const [selectedCats, setSelectedCats] = useState(null);
  const [catOpen, setCatOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [supRes, prodRes, initRes, woRes] = await Promise.all([
        supabase.from('supplies').select('items').eq('user_id', user.id),
        supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('initial_stocks').select('*').eq('user_id', user.id).single(),
        supabase.from('writeoffs').select('product_id,quantity').eq('user_id', user.id)
      ]);
      if (supRes.error) throw supRes.error;
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
      setStockMap(buildStockMap(supplies, initial, woRes.data || []));
      if (prodRes.data) setProductsState(prodRes.data);
      setProductsFromDB(prodRes.data || []);
    } catch (e) {
      alert('Ошибка загрузки остатков: ' + (e.message || 'неизвестная ошибка'));
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  // После синхронизации офлайн-очереди — пересчитываем остатки с сервера
  useEffect(() => {
    const onSynced = () => { if (user) load(); };
    window.addEventListener('atlaspos:synced', onSynced);
    return () => window.removeEventListener('atlaspos:synced', onSynced);
  }, [user]);

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

  // Категории: «Без категории» всегда первой, остальные — по алфавиту (по-русски)
  const sortCats = (a, b) => { if (a === 'Без категории') return -1; if (b === 'Без категории') return 1; return a.localeCompare(b, 'ru'); };
  let allCats = [...new Set(products.map(p => CAT_LABELS[p.cat] || p.cat || 'Без категории'))].sort(sortCats);
  // Статус наличия товара: out — закончился, low — заканчивается (≤ мин. остатка), in — в наличии
  const stOf = (p) => { const stq = stockMap[p.id]?.qty || 0; const mn = p.min_qty || 0; return stq === 0 ? 'out' : (mn > 0 && stq <= mn ? 'low' : 'in'); };
  let items = products.filter(p => p && !p.hidden);
  if (selectedCats && selectedCats.size > 0) {
    items = items.filter(p => selectedCats.has(CAT_LABELS[p.cat] || p.cat || 'Без категории'));
  }
  if (stStatus !== 'all') {
    items = items.filter(p => stOf(p) === stStatus);
  }
  const q = search.toLowerCase().trim();
  if (q) items = items.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  // Сортировка: сначала совпадения по названию, потом по артикулу (по остаткам — как было)
  items = items.sort((a, b) => {
    const qa = stockMap[a.id]?.qty || 0; const qb = stockMap[b.id]?.qty || 0;
    if (qa > 0 && qb <= 0) return -1; if (qa <= 0 && qb > 0) return 1;
    if (q) {
      const nameHit = (p) => p.name.toLowerCase().includes(q) ? 0 : 1;
      const d = nameHit(a) - nameHit(b);
      if (d !== 0) return d;
    }
    return 0;
  });

  const totalQty = items.reduce((s, p) => s + (stockMap[p.id]?.qty || 0), 0);
  // Итоговая сумма закупа (количество × себестоимость) и продажи (количество × цена)
  const totalCost = items.reduce((s, p) => {
    const st = stockMap[p.id];
    if (!st) return s;
    const costPrice = st.qty > 0 && st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
    return s + costPrice * st.qty;
  }, 0);
  const totalRetail = items.reduce((s, p) => s + ((stockMap[p.id]?.qty || 0) * (p.price || 0)), 0);

  // Плашки «под поиском» — по ВСЕМ товарам (без услуг), не зависят от поиска и фильтра категорий
  const goodsAll = products.filter(p => p && !p.hidden && p.type !== 'service');
  const goodsQty = goodsAll.reduce((s, p) => s + (stockMap[p.id]?.qty || 0), 0);
  const goodsRetail = goodsAll.reduce((s, p) => s + ((stockMap[p.id]?.qty || 0) * (p.price || 0)), 0);
  const goodsCost = goodsAll.reduce((s, p) => {
    const st = stockMap[p.id];
    if (!st) return s;
    const costPrice = st.qty > 0 && st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
    return s + costPrice * st.qty;
  }, 0);
  const goodsProfit = goodsRetail - goodsCost;
  const goodsMargin = goodsCost > 0 ? Math.round(goodsProfit / goodsCost * 100) : null;
  const stockTiles = [
    { label: 'Товаров в наличии', value: `${goodsQty.toLocaleString()} шт` },
    { label: 'Сумма товаров', value: `${goodsRetail.toLocaleString()} ${cur}` },
    { label: 'Себестоимость товаров', value: `${goodsCost.toLocaleString()} ${cur}` },
    { label: 'Потенциальная прибыль', value: `${goodsProfit.toLocaleString()} ${cur}`, color: goodsProfit < 0 ? '#c62828' : '#111' },
    { label: 'Средняя наценка', value: goodsMargin === null ? '—' : `${goodsMargin}%`, color: goodsMargin !== null && goodsMargin < 0 ? '#c62828' : '#111' },
  ];

  // Выгрузка текущего списка (с учётом фильтров) в CSV — открывается в Excel
  const exportStock = () => {
    const esc = (s) => { const v = String(s == null ? '' : s); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const head = ['Товар', 'Артикул', 'Штрихкод', 'Категория', 'Остаток', 'Мин. остаток', 'Закуп', 'Продажа', 'Наценка', 'Сумма'];
    const lines = [head.join(';')];
    items.forEach(p => {
      const st = stockMap[p.id] || { qty: 0, cost: 0 };
      const qty = st.qty || 0;
      const costPrice = st.qty > 0 && st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
      const markup = (p.price || 0) - costPrice;
      const markupPct = costPrice > 0 ? Math.round((markup / costPrice) * 100) : 0;
      lines.push([
        p.name, p.sku || '', p.barcode || '', CAT_LABELS[p.cat] || p.cat || '',
        qty, p.min_qty > 0 ? p.min_qty : '',
        costPrice * qty, p.price || 0,
        (markup >= 0 ? '+' : '') + markup + (markupPct ? ' (' + markupPct + '%)' : ''),
        (p.price || 0) * qty,
      ].map(esc).join(';'));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'остатки.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setToast('Файл «остатки.csv» выгружен');
  };

  const editPrice = async (id) => {
    const val = prompt('Новая цена продажи:');
    if (val === null || val === '') return;
    const price = parseFloat(val);
    if (isNaN(price) || price < 0) return alert('Некорректная цена');
    // Раньше цена менялась только в localStorage и пропадала после перезагрузки — теперь сохраняем в БД
    const { error } = await supabase.from('products').update({ price }).eq('id', id);
    if (error) return alert('Ошибка сохранения цены: ' + error.message);
    setProductsState(prev => prev.map(x => x.id === id ? { ...x, price } : x));
    setProductsFromDB(prev => prev.map(x => x.id === id ? { ...x, price } : x));
    setToast('Цена обновлена');
  };

  const navigateTo = (page) => {
    window.location.hash = page;
    window.dispatchEvent(new Event('hashchange'));
  };

  // Initial stock handlers
  const openInitialStock = () => {
    // Читаем сохранённые остатки из БД (а не только localStorage — иначе после сохранения показываются нули)
    const existing = initialCache || getInitialStock();
    if (existing && existing.done) {
      setShowConfirm(true);
    } else {
      prepareInitModal();
    }
  };

  const prepareInitModal = () => {
    const existing = initialCache || getInitialStock();
    const qtyMap = {};
    const costMap = {};
    (productsFromDB.length ? productsFromDB : products).filter(p => p && p.type !== 'service').forEach(p => {
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
    const { error, queued } = await supabase.from('initial_stocks').upsert({ user_id: user.id, items: filtered, costs: filteredCosts, done: true }).eq('user_id', user.id);
    if (!error) {
      // Синхронизируем и в localStorage, чтобы повторное открытие показывало сохранённые значения
      setInitialStock({ items: filtered, costs: filteredCosts, done: true });
      setShowInitModal(false);
      if (queued) {
        // Офлайн: показываем новые остатки сразу (пересчёт по локальным данным)
        const init = { user_id: user.id, items: filtered, costs: filteredCosts, done: true };
        setInitialCache(init);
        setStockMap(buildStockMap(suppliesCache, init, []));
        setToast('Начальные остатки сохранены (ждёт синхронизации)');
      } else {
        await load(); setToast('Начальные остатки сохранены');
      }
    }
    else alert(error.message);
  };

  const initProducts = (productsFromDB.length ? productsFromDB : products).filter(p => p && p.type !== 'service');
  const filteredProducts = initSearch.trim()
    ? initProducts.filter(p => p.name.toLowerCase().includes(initSearch.trim().toLowerCase()))
    : initProducts.slice();

  return (
    <>
      {toast && <div className="toast toast-success">{toast}</div>}

      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1>Остатки</h1>
            <SectionHelp
              title="Раздел «Остатки»"
              intro="Склад вашего бизнеса: сколько каждого товара есть в наличии и на какую сумму. Остатки обновляются сами — при продажах, поставках, списаниях и инвентаризации."
              blocks={[
                { title: 'Как добавить товар на склад (2 способа)', items: [
                  <>Товар <b>уже куплен</b> и лежит у вас — кнопка «+ Ввести начальные остатки». Вносится один раз: количество + себестоимость за единицу.</>,
                  <>Товар <b>закупаете сейчас</b> — оформите поставку (раздел «Поставки»).</>,
                ]},
                { title: 'Поиск и фильтры', items: [
                  <>🔍 <b>Быстрый поиск</b> — ищет товар по названию и артикулу.</>,
                  <>«<b>Категории</b>» — фильтр по группам: отмечаете галочками, какие категории показывать.</>,
                ]},
                { title: 'Столбцы таблицы', items: [
                  <><b>Товар</b> — название позиции.</>,
                  <><b>Артикул</b> — ваш код товара (для поиска и учета).</>,
                  <><b>Штрихкод</b> — код со сканера, если используете.</>,
                  <><b>Категория</b> — к какой группе относится товар.</>,
                  <><b>Остаток</b> — сколько сейчас на складе в штуках.</>,
                  <><b>Мин. остаток</b> — желаемый минимум. Если остаток ниже него — цифра красная, если выше — зелёная.</>,
                  <><b>Закуп</b> — сумма закупа: остаток × себестоимость.</>,
                  <><b>Продажа</b> — цена за штуку. <b>Клик по цене</b> — быстро изменить её.</>,
                  <><b>Наценка</b> — разница между ценой продажи и себестоимостью: сумма и процент.</>,
                  <><b>Сумма</b> — остаток × цена продажи (сколько можно выручить за весь товар).</>,
                ]},
                { title: 'Строка «Итого»', text: <>Внизу таблицы — суммарные цифры по всем показанным товарам: общий остаток, общая сумма закупа и общая сумма продажи.</> },
              ]}
            />
          </div>
          <div className="sub">Учет количества и фактического наличия товаров</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-dark" onClick={openInitialStock} style={{padding:'.5rem .9rem',fontWeight:600}}>+ Ввести начальные остатки</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />
      <div className="search-row" style={{display:'flex',alignItems:'center',marginBottom:'.5rem',width:'100%',flexWrap:'wrap',gap:'.4rem'}}>
        <div className="stock-search" style={{display:'flex',alignItems:'center',gap:'.4rem',width:'15%',minWidth:'110px',maxWidth:'200px',border:'1px solid '+(searchFocus?'#111':'#e2e2e6'),borderRadius:'100px',padding:'8px 16px',background:'#fff',boxShadow:searchFocus?'0 2px 8px rgba(0,0,0,.12)':'0 1px 3px rgba(0,0,0,.05)',transition:'border-color .15s, box-shadow .15s'}}
          onFocus={()=>setSearchFocus(true)} onBlur={()=>setSearchFocus(false)}>
          <span style={{display:'flex',color:searchFocus?'#111':'#999',transition:'color .15s'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input type="text" placeholder="Быстрый поиск" value={search} onChange={e => setSearch(e.target.value)}
            style={{border:'none',outline:'none',flex:1,fontSize:'.8rem',fontFamily:'var(--font)',background:'none',padding:0}} />
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'.25rem',marginLeft:'auto',position:'relative',flexWrap:'wrap',justifyContent:'flex-end'}}>
          {/* Фильтр по наличию — пилюли (вариант 3: активная — жёлтый градиент) */}
          {[['all', 'Все'], ['in', 'В наличии'], ['low', 'Заканчиваются'], ['out', 'Закончились']].map(([v, l]) => (
            <button key={v} onClick={() => setStStatus(v)}
              style={{
                border: 'none', background: stStatus === v ? 'linear-gradient(135deg,#ffdd2d,#fff9db)' : 'transparent',
                color: stStatus === v ? '#111' : '#777', padding: '9px 16px', borderRadius: '100px',
                fontSize: '.8rem', fontWeight: stStatus === v ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', lineHeight: 1, transition: 'all .12s',
              }}
              onMouseEnter={e => { if (stStatus !== v) e.currentTarget.style.color = '#333'; }}
              onMouseLeave={e => { if (stStatus !== v) e.currentTarget.style.color = '#777'; }}>{l}</button>
          ))}

          {/* Категории — жёлтая пилюля */}
          <button
            onClick={e => { e.stopPropagation(); setCatOpen(!catOpen); }}
            style={{
              border: 'none', background: 'linear-gradient(135deg,#ffdd2d,#fff9db)', color: '#111',
              padding: '9px 16px', borderRadius: '100px', fontSize: '.8rem', fontWeight: 400, cursor: 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '4px',
              marginLeft: '.25rem', boxShadow: '0 1px 4px rgba(255,205,0,.25)',
            }}
          >Категории<span style={{ fontSize: '.6rem', opacity: .7 }}>▾</span></button>

          {catOpen && (
            <div onClick={e => e.stopPropagation()} style={{position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'none',borderRadius:'16px',boxShadow:'0 12px 36px rgba(0,0,0,.12)',minWidth:'180px',padding:'8px',zIndex:100}}>
              {allCats.map(cat => {
                const checked = selectedCats && selectedCats.has(cat);
                return (
                  <div key={cat} onClick={()=>{const s=new Set(selectedCats);if(s.has(cat))s.delete(cat);else s.add(cat);setSelectedCats(s.size?s:null)}}
                    className={'cat-dd-item'+(checked?' sel':'')}>
                    <span className="dd-cb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>
                    {cat}
                  </div>
                );
              })}
            </div>
          )}

          {/* Выгрузка в Excel — жёлтая круглая кнопка */}
          <button onClick={exportStock} title="Выгрузить в Excel"
            style={{
              width: '34px', height: '34px', flexShrink: 0, border: 'none', borderRadius: '100px',
              background: 'linear-gradient(135deg,#ffdd2d,#fff9db)', color: '#111', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
              boxShadow: '0 1px 5px rgba(255,205,0,.35)', marginLeft: '.15rem',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 10px rgba(255,205,0,.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 5px rgba(255,205,0,.35)'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
          </button>
        </div>
      </div>

      {/* Плашки-итоги по складу (эталон: Transactions.jsx «Доходы и расходы», компактнее — 5 в ряд)
          Товаров в наличии — суммарно штук по всем товарам (без услуг);
          Сумма товаров — остатки по цене продажи; Себестоимость — по средней цене закупа;
          Потенциальная прибыль — разница; Средняя наценка — прибыль ÷ себестоимость */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', margin: '.75rem 0' }}>
          {stockTiles.map(t => (
            <div key={t.label} style={{ background: 'linear-gradient(135deg,#ffdd2d,#fff9db)', borderRadius: '14px', padding: '10px 12px', boxShadow: '0 2px 10px rgba(255,205,0,.3)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,.55)', marginBottom: '4px', lineHeight: 1.25 }}>{t.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: t.color || '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.value}</div>
            </div>
          ))}
        </div>
      )}

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
                    <p>Склад пока пуст</p>
                    <div style={{maxWidth:'420px',margin:'0 auto',textAlign:'left',fontSize:'.8rem',color:'#555',lineHeight:1.6,marginTop:'.5rem'}}>
                      <b>Как добавить товар на склад:</b><br />
                      • Товар <b>уже куплен</b> и лежит у вас — нажмите «Ввести начальные остатки» и укажите его количество<br />
                      • Товар <b>закупаете сейчас</b> — оформите Поставку (раздел «Поставки»)<br />
                      После этого остатки появятся здесь и будут меняться сами при продажах.
                    </div>
                  </div>
                </td>
              </tr>
            ) : items.map(p => {
              const st = stockMap[p.id] || { qty: 0, cost: 0 };
              const qty = st.qty;
              const costPrice = st.qty > 0 && st.cost > 0 ? Math.round(st.cost / st.qty) : 0;
              const retailPrice = p.price || 0;
              const sumValue = retailPrice * qty; // «Сумма» = количество × цена продажи
              const markup = retailPrice - costPrice;
              const markupPct = costPrice > 0 ? Math.round((markup / costPrice) * 100) : 0;
              return (
                <tr key={p.id}>
                  <td style={{textAlign:'left',whiteSpace:'nowrap',fontSize:'.78rem',color:'#222'}}>
                    <span>{p.name}</span>
                  </td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'#222',fontFamily:'monospace'}}>{p.sku || '—'}</td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'#222'}}>{p.barcode || '—'}</td>
                  <td style={{textAlign:'left',whiteSpace:'nowrap',fontSize:'.78rem',color:'#222'}}><span className="prod-cat">{CAT_LABELS[p.cat] || p.cat || '—'}</span></td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'#222'}}>{qty}</td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'#222'}}>
                    {p.min_qty > 0 ? (
                      <span style={{color: qty >= p.min_qty ? '#16a34a' : '#dc2626',fontWeight:500}}>
                        {qty + ' / ' + p.min_qty + ' шт'}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'#222'}}>{(costPrice * qty).toLocaleString()}</td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'#222'}}>
                    <span className="editable-price"
                      style={{cursor:'pointer',color:'#222',borderBottom:'1px dashed #999',paddingBottom:'1px'}}
                      onClick={() => editPrice(p.id)}>{retailPrice.toLocaleString()}</span>
                  </td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'#222'}}>
                    <span className={`markup-badge${markup >= 0 ? '' : ' neg'}`}>
                      {markup >= 0 ? '+' : ''}{markup.toLocaleString()}{markupPct ? ` (${markupPct}%)` : ''}
                    </span>
                  </td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'#222'}}>{sumValue.toLocaleString()}</td>
                </tr>
              );
            })}
            {items.length > 0 && (
              <tr className="total-row">
                <td style={{fontWeight:500,fontSize:'.78rem',color:'#222',textAlign:'left'}}>Итого:</td>
                <td></td>
                <td></td>
                <td></td>
                <td style={{fontWeight:500,fontSize:'.78rem',color:'#222',textAlign:'left'}}>{totalQty}</td>
                <td></td>
                <td style={{fontWeight:500,fontSize:'.78rem',color:'#222',textAlign:'left'}}>{totalCost.toLocaleString()}</td>
                <td></td>
                <td></td>
                <td style={{fontWeight:500,fontSize:'.78rem',color:'#222',textAlign:'left'}}>{totalRetail.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showConfirm} onClose={()=>setShowConfirm(false)} title="Начальные остатки уже внесены" subtitle="Вы уже вносили начальные остатки. Хотите их откорректировать?" width="narrow"
        actions={<>
          <button className="btn btn-ghost" onClick={cancelCorrection}>Нет</button>
          <button type="button" className="btn btn-dark" onClick={confirmCorrection}>Да, откорректировать</button>
        </>}>
      </Modal>

      <Modal open={showInitModal} onClose={()=>setShowInitModal(false)} title="Введите начальные остатки" subtitle="Сколько товара уже есть на складе на старте (без оформления поставок) — вносится один раз" width="wide">

            <div className="stock-search" style={{display:'inline-flex',alignItems:'center',gap:'.4rem',marginBottom:'.6rem',border:'1px solid '+(initSearchFocus?'#111':'#e2e2e6'),borderRadius:'100px',padding:'8px 16px',background:'#fff',boxShadow:initSearchFocus?'0 2px 8px rgba(0,0,0,.12)':'0 1px 3px rgba(0,0,0,.05)',transition:'border-color .15s, box-shadow .15s'}}
              onFocus={()=>setInitSearchFocus(true)} onBlur={()=>setInitSearchFocus(false)}>
              <span style={{display:'flex',color:initSearchFocus?'#111':'#999',transition:'color .15s'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              </span>
              <input type="text" placeholder="Поиск товара" value={initSearch} onChange={e=>setInitSearch(e.target.value)}
                style={{border:'none',outline:'none',width:'110px',fontSize:'.8rem',fontFamily:'var(--font)',background:'none',padding:0}} />
            </div>

            <div style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.25rem .5rem .35rem',borderBottom:'1px solid var(--border)'}}>
              <span style={{flex:1,fontSize:'.8125rem',fontWeight:600,color:'#333'}}>Товар</span>
              <span style={{width:'65px',textAlign:'center',fontSize:'.8125rem',fontWeight:600,color:'#333'}}>Кол-во</span>
              <span style={{width:'80px',textAlign:'center',fontSize:'.8125rem',fontWeight:600,color:'#333'}}>Цена закупа</span>
            </div>

            <div style={{overflowY:'auto',flex:1}}>
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
                    placeholder="0"
                    style={{width:'80px',padding:'.35rem .4rem',fontSize:'.8rem',border:'1px solid var(--border)',borderRadius:'5px',outline:'none',textAlign:'center',fontFamily:'var(--font)'}} />
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{marginTop:'.5rem',borderTop:'none',paddingTop:0}}>
              <button type="button" className="btn btn-dark" onClick={saveInitialStock}>Сохранить остатки</button>
            </div>
      </Modal>
    </>
  );
}
