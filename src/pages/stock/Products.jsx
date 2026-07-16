import Modal from '../../components/Modal';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const CAT_LABELS = { material:'Материалы', tool:'Инструменты', equipment:'Оборудование', other:'Прочее' };
const UNITS = ['шт', 'кг', 'г', 'л', 'м', 'м²', 'м³', 'уп', 'пара', 'комплект', 'мешок', 'ящик', 'рулон', 'лист'];
const SERVICE_UNITS = ['шт', 'час', 'чел', 'сеанс', 'выезд'];
const scanBarcode = (onResult) => {
  if (!navigator.mediaDevices) { alert('Камера недоступна'); return; }
  import('quagga').then(function(mod){
    var Quagga = mod.default || mod;
    var w=document.createElement('div');
    w.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center';
    var v=document.createElement('div');v.id='qv';
    v.style.cssText='position:relative;width:100%;max-width:500px;overflow:hidden;border-radius:12px;background:#000';
    var f=document.createElement('div');
    f.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;width:320px;height:130px;border:2px solid rgba(255,255,255,.5);border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.4);pointer-events:none';
    var i=document.createElement('input');i.type='text';i.placeholder='';
    i.style.cssText='width:80%;max-width:360px;margin-top:16px;padding:12px 16px;border:none;border-radius:12px;font-size:16px;text-align:center;letter-spacing:4px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.2);outline:none;font-family:inherit';
    var c=document.createElement('div');c.textContent='✕';c.title='Закрыть';
    c.style.cssText='position:fixed;top:20px;right:20px;z-index:10000;width:36px;height:36px;background:rgba(0,0,0,.4);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;font-weight:700;line-height:1';
    var beep=function(){try{var ac=new AudioContext();var g=ac.createGain();g.connect(ac.destination);g.gain.value=.15;var o=ac.createOscillator();o.type='sine';o.frequency.value=1200;o.connect(g);o.start();setTimeout(function(){o.stop();ac.close()},100)}catch(e){}};
    v.appendChild(f);w.appendChild(v);w.appendChild(i);document.body.appendChild(w);    setTimeout(function(){var c=document.getElementById("qv");if(c){c.querySelectorAll("video").forEach(function(el){el.style.cssText="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0"});c.querySelectorAll("canvas").forEach(function(el){el.style.cssText="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0"})}},200);
document.body.appendChild(c);
    var q=null;var lock=false;
    var done=function(val){if(val&&!lock){lock=true;beep();if(onResult)onResult(val);else if(typeof setFBarcode!=='undefined')setFBarcode(val);setTimeout(function(){lock=false},3000)}cl()};
    var cl=function(){if(q){q.stop();q=null}w.remove();c.remove()};
    i.onkeydown=function(e){if(e.key==='Enter'&&i.value.trim()){done(i.value.trim())}};c.onclick=cl;
    Quagga.init({
      inputStream:{name:'Live',type:'LiveStream',target:v,targetSize:1,constraints:{width:640,height:480,facingMode:'environment'}},
      decoder:{readers:['ean_reader','ean_8_reader','code_128_reader','code_39_reader','upc_reader','upc_e_reader']},
      locate:true
    },function(err){if(err){alert('Ошибка камеры');return}
      q=Quagga;Quagga.start();
      Quagga.onDetected(function(data){if(data&&data.codeResult&&data.codeResult.code){done(data.codeResult.code)}});
    });
  }).catch(function(){alert('Ошибка загрузки сканера')});
};

  const genBarcode = () => {
  let s = '';
  for (let i = 0; i < 12; i++) s += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(s[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return s + check;
};

const ALL_COLUMNS = [
  { id:'name', label:'Название', always: true },
  { id:'type', label:'Тип', def:true },
  { id:'category', label:'Категория', def:true },
  { id:'cost', label:'Себестоимость', def:true },
  { id:'price', label:'Цена', def:true },
  { id:'markup', label:'Наценка', def:true },
  // Дополнительные (не включены по умолчанию)
  { id:'unit', label:'Ед. измерения' },
  { id:'sku', label:'Артикул' },
  { id:'barcode', label:'Штрихкод' },
  { id:'weight', label:'Вес' },
  { id:'description', label:'Описание' },
];

const getCats = () => JSON.parse(localStorage.getItem('allCats88') || '[]');
const getCatsFromLocal = () => {
  let list = JSON.parse(localStorage.getItem('allCats88') || '[]');
  if (list.length === 0) list = JSON.parse(localStorage.getItem('prodCats88') || '[]');
  return list;
};
const getProducts = () => JSON.parse(localStorage.getItem('products88') || '[]');
const setProducts = (list) => localStorage.setItem('products88', JSON.stringify(list));
const getTrash = () => JSON.parse(localStorage.getItem('trash88') || '[]');
let costMapCache = null;
const getCostMap = () => {
  if (costMapCache) return costMapCache;
  const supplies = JSON.parse(localStorage.getItem('supplies88') || '[]');
  const map = {};
  supplies.forEach(sp => {
    if (!sp || !sp.prodId) return;
    if (!map[sp.prodId]) map[sp.prodId] = { qty:0, cost:0 };
    map[sp.prodId].qty += sp.qty || 0;
    map[sp.prodId].cost += (sp.cost || 0) * (sp.qty || 0);
  });
  const result = {};
  Object.keys(map).forEach(id => {
    result[id] = map[id].qty > 0 ? Math.round(map[id].cost / map[id].qty) : 0;
  });
  costMapCache = result;
  return result;
};
const refreshCostMap = async (userId) => {
  const { data } = await supabase.from('supplies').select('items').eq('user_id', userId);
  const map = {};
  (data || []).forEach(sp => { (sp.items||[]).forEach(it => {
    if (!it || !it.prodId) return;
    if (!map[it.prodId]) map[it.prodId] = { qty:0, cost:0 };
    map[it.prodId].qty += it.qty || 0;
    map[it.prodId].cost += (it.cost || 0) * (it.qty || 0);
  }); });
  const result = {};
  Object.keys(map).forEach(id => { result[id] = map[id].qty > 0 ? Math.round(map[id].cost / map[id].qty) : 0; });
  costMapCache = result;
  return result;
};
const setTrash = (list) => localStorage.setItem('trash88', JSON.stringify(list));
const getCols = () => {
  const saved = localStorage.getItem('productsCols');
  if (saved) return new Set(JSON.parse(saved));
  return new Set(ALL_COLUMNS.filter(c => c.def).map(c => c.id));
};
const setCols = (set) => localStorage.setItem('productsCols', JSON.stringify([...set]));

const COL_ORDER = ['name','type','category','cost','price','markup','unit','sku','barcode','weight','description'];
const COL_LABELS = { name:'Название', type:'Тип', category:'Категория', cost:'Себестоимость', price:'Цена', markup:'Наценка', unit:'Ед. измерения', sku:'Артикул', barcode:'Штрихкод', weight:'Вес', description:'Описание' };

export default function Products() {
  const { user } = useAuth();
  const [products, setProductsState] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCols, setActiveColsState] = useState(getCols);
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [mode, setMode] = useState('add');
  const [showTrash, setShowTrash] = useState(false);
  const [toast, setToast] = useState(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [viewProduct, setViewProduct] = useState(null);
  const [costMap, setCostMap] = useState({});
  const [cats, setCats] = useState([]);
  const [catsLoaded, setCatsLoaded] = useState(false);

  // Форма
  const [fName, setFName] = useState('');
  const [fCat, setFCat] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fUnit, setFUnit] = useState('');
  const [fSku, setFSku] = useState('');
  const [fBarcode, setFBarcode] = useState('');
  const [fType, setFType] = useState('product');
  const [fFreePrice, setFFreePrice] = useState(false);
  const [fWeight, setFWeight] = useState('0');
  const [fWeightUnit, setFWeightUnit] = useState('кг');
  const [fDesc, setFDesc] = useState('');
  const [fMinQty, setFMinQty] = useState('');
  const [fHidden, setFHidden] = useState(false);
  const [fComboItems, setFComboItems] = useState([]);
  const [fComboSearch, setFComboSearch] = useState('');
  const [typeFilterSet, setTypeFilterSet] = useState(new Set());
  const [typeOpen, setTypeOpen] = useState(false);

  // Dropdowns
  const [catOpen, setCatOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const migrateLocalData = useCallback(async () => {
    const local = JSON.parse(localStorage.getItem('products88') || '[]');
    if (local.length > 0) {
      const { data: existing } = await supabase.from('products').select('id').eq('user_id', user.id);
      if (!existing || existing.length === 0) {
        for (const p of local) {
          await supabase.from('products').insert({
            id: p.id, user_id: user.id, name: p.name, cat: p.cat,
            price: p.price, unit: p.unit, sku: p.sku, barcode: p.barcode,
            type: p.type || 'product', weight: p.weight || 0, weight_unit: p.weightUnit || 'кг',
            description: p.desc || '', hidden: p.hidden || false
          });
        }
        localStorage.removeItem('products88');
        localStorage.removeItem('trash88');
      }
    }
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setProductsState(data);
  }, [user]);

  useEffect(() => { if (user) { migrateLocalData().then(() => load()); } }, [user, load, migrateLocalData]);
  
  useEffect(() => { if (user) { refreshCostMap(user.id).then(m => setCostMap(m)); } }, [user]);
  
  useEffect(() => {
    if (!user) return;
    supabase.from('stock_categories').select('*').eq('user_id', user.id).order('created_at').then(({ data }) => {
      if (data) setCats(data);
      setCatsLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (window.location.hash.includes('add=true') || window.location.search.includes('add=true')) {
      setEditId(null);
      setShowModal(true);
      window.history.replaceState(null, '', '#/stock/products');
    }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.cat-wrapper')) setCatOpen(false);
      if (!e.target.closest('.type-wrapper')) setTypeOpen(false);
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
    setToast(msg || 'Товар успешно добавлен!');
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditId(null); setMode('add'); setFHidden(false);
    setFName(''); setFCat(''); setFPrice(''); setFUnit(''); setFSku('');
    setFBarcode(''); setFType('product'); setFWeight('0'); setFWeightUnit('кг');
    setFMinQty(''); setFDesc(''); setFComboItems([]);
    setFComboSearch('');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditId(p.id); setMode('edit'); setFHidden(p.hidden || false);
    setFName(p.name); setFCat(p.cat || ''); setFPrice(String(p.price || ''));
    setFUnit(p.unit || ''); setFSku(p.sku || ''); setFBarcode(p.barcode || '');
    setFType(p.type || 'product'); setFWeight(String(p.weight || '0'));
    setFWeightUnit(p.weightUnit || 'кг'); setFMinQty(String(p.min_qty || '')); setFDesc(p.desc || '');
    setFComboItems(p.combo_items || []);
    setFComboSearch('');
    setShowModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fName.trim()) return alert('Введите название');
    const price = fType === 'combo' ? (parseFloat(fPrice) || fComboItems.reduce(function(s,i){return s + i.price * i.qty}, 0)) : (parseFloat(fPrice) || 0);
    const productData = {
      name: fName.trim(), cat: fCat, price: price, unit: fUnit || 'шт',
      sku: fSku.trim(), barcode: fBarcode.trim(), type: fType,
      weight: fType === 'combo' ? 0 : (parseFloat(fWeight) || 0), weight_unit: fType === 'combo' ? '' : fWeightUnit,
      min_qty: parseInt(fMinQty) || 0, user_id: user.id, description: fDesc,
      hidden: editId ? fHidden : false,
      combo_items: fType === 'combo' ? fComboItems : null
    };
    if (editId) {
      const { error } = await supabase.from('products').update(productData).eq('id', editId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from('products').insert({ ...productData, id: Date.now() });
      if (error) return alert(error.message);
    }
    setShowModal(false);
    load();
    showToast(editId ? 'Товар успешно сохранён!' : 'Товар успешно добавлен!');
  };

  const remove = async (id) => {
    setRemoveTarget(id);
    setShowRemoveModal(true);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const id = removeTarget;
    let trash = getTrash();
    const { data: items } = await supabase.from("products").select("*").eq("id", id);
    if (items && items[0]) {
      trash.unshift({ ...items[0], deletedAt: Date.now() });
      setTrash(trash);
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { setShowRemoveModal(false); return alert(error.message); }
    load();
    showToast('Товар успешно удалён!');
    setShowRemoveModal(false);
    setRemoveTarget(null);
  };

  const hide = async (id) => {
    const { error } = await supabase.from('products').update({ hidden: true }).eq('id', id);
    if (error) return alert(error.message);
    load();
    showToast('Товар успешно скрыт!');
  };

  const unhide = async (id) => {
    const { error } = await supabase.from('products').update({ hidden: false }).eq('id', id);
    if (error) return alert(error.message);
    load();
  };

  const copyP = async (id) => {
    const { data } = await supabase.from('products').select('*').eq('id', id).single();
    if (!data) return showToast('Ошибка копирования');
    const { error } = await supabase.from('products').insert({
      id: Date.now(), name: data.name, type: data.type, cat: data.cat,
      price: data.price, unit: data.unit, sku: data.sku,
      barcode: data.barcode, weight: data.weight, weight_unit: data.weight_unit,
      description: data.description, free_price: data.free_price || false, user_id: user.id, hidden: false,
      combo_items: data.combo_items || null
    });
    if (error) return showToast('Ошибка: ' + error.message);
    await load();
    showToast('Товар успешно скопирован!');
  };

  const restore = async (id) => {
    let trash = getTrash();
    const idx = trash.findIndex(x => x.id === id);
    if (idx === -1) return;
    const { deletedAt, id: oldId, ...itemRest } = trash[idx];
    const { error } = await supabase.from('products').insert({ ...itemRest, user_id: user.id });
    if (error) { console.error('Restore error:', error); showToast('Ошибка: ' + error.message); return; }
    trash.splice(idx, 1);
    setTrash([...trash]);
    await load();
    setShowModal(false);
    showToast('Товар успешно восстановлен!');
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

  const toggleType = (t) => {
    const next = new Set(typeFilterSet);
    if (next.has(t)) next.delete(t); else next.add(t);
    setTypeFilterSet(next);
  };

  const selectAllTypes = () => {
    setTypeFilterSet(new Set(['product','service','combo']));
  };

  const clearAllTypes = () => {
    setTypeFilterSet(new Set());
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
    const items = products || [];
    if (items.length === 0) { showToast('Нет товаров для выгрузки'); return; }
    const typeLabel = (t) => t === 'service' ? 'Услуга' : t === 'combo' ? 'Комбо' : 'Товар';
    const data = items.map(p => ({
      'Название': p.name,
      'Тип': typeLabel(p.type),
      'Категория': CAT_LABELS[p.cat] || p.cat || '',
      'Себестоимость': p.costPrice || '',
      'Цена': p.price || '',
      'Наценка': p.price && p.costPrice ? Math.round(((p.price - p.costPrice) / p.costPrice) * 100) + '%' : '',
      'Ед. измерения': p.unit || '',
      'Артикул': p.sku || '',
      'Штрихкод': p.barcode || '',
      'Вес': p.weight || '',
      'Описание': p.description || p.desc || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:35},{wch:10},{wch:15},{wch:12},{wch:12},{wch:10},{wch:12},{wch:15},{wch:15},{wch:10},{wch:30}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');
    XLSX.writeFile(wb, 'Товары.xlsx');
  };

  const exportTemplate = () => {
    const template = [{
      'Название': '',
      'Тип': 'товар',
      'Категория': '',
      'Цена': '',
      'Ед. изм.': 'шт',
      'Артикул': '',
      'Штрихкод': '',
      'Мин. остаток': '',
      'Описание': '',
      'Вес (кг)': '',
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [{wch:35},{wch:10},{wch:15},{wch:12},{wch:10},{wch:15},{wch:15},{wch:30},{wch:10}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон товаров');
    XLSX.writeFile(wb, 'Шаблон товаров.xlsx');
  };

  const importExcel = (file) => {
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (json.length === 0) { showToast('Файл пуст'); setImporting(false); return; }

        const COL_MAP = {
          'название': 'name', 'наименование': 'name', 'товар': 'name',
          'тип': 'type', 'категория': 'category',
          'цена': 'price', 'стоимость': 'price',
          'единица': 'unit', 'ед': 'unit', 'ед.изм': 'unit', 'ед. изм': 'unit', 'ед изм': 'unit',
          'артикул': 'sku', 'код': 'sku',
          'штрихкод': 'barcode', 'штрих код': 'barcode', 'штрих-код': 'barcode',
          'описание': 'description', 'desc': 'description',
          'вес': 'weight',
          'мин. остаток': 'min_qty', 'минимальный остаток': 'min_qty',
          'себестоимость': 'cost', 'закуп': 'cost',
        };

        const headers = Object.keys(json[0]);
        const colMap = {};
        headers.forEach(h => {
          const key = h.toLowerCase().trim().replace(/\s+/g, ' ');
          colMap[h] = COL_MAP[key] || null;
        });

        let added = 0, errors = 0;
        for (const row of json) {
          try {
            const name = (row[headers.find(h => (colMap[h]||'')==='name')] || '').toString().trim();
            if (!name) { errors++; continue; }

            const typeStr = (row[headers.find(h => (colMap[h]||'')==='type')] || 'товар').toString().toLowerCase();
            const type = typeStr.includes('услуг') ? 'service' : 'product';

            const cat = (row[headers.find(h => (colMap[h]||'')==='category')] || '').toString().trim();
            const price = parseFloat(row[headers.find(h => (colMap[h]||'')==='price')]) || 0;
            const unit = (row[headers.find(h => (colMap[h]||'')==='unit')] || '').toString().trim();
            const sku = (row[headers.find(h => (colMap[h]||'')==='sku')] || '').toString().trim();
            const barcode = (row[headers.find(h => (colMap[h]||'')==='barcode')] || '').toString().trim();
            const description = (row[headers.find(h => (colMap[h]||'')==='description')] || '').toString().trim();
            const weight = parseFloat(row[headers.find(h => (colMap[h]||'')==='weight')]) || 0;
            const min_qty = parseInt(row[headers.find(h => (colMap[h]||'')==='min_qty')]) || 0;

            const { error } = await supabase.from('products').insert({
              id: Date.now() + added, user_id: user.id,
              name, type, cat: cat || null, price, unit: unit || 'шт',
              sku: sku || null, barcode: barcode || genBarcode(),
              weight, weight_unit: 'кг', description, min_qty, hidden: false
            });
            if (error) { errors++; } else { added++; }
          } catch (e) { errors++; }
        }

        showToast(`Загружено ${added} позиций${errors > 0 ? `, ${errors} с ошибками` : ''}`);
        if (added > 0) load();
      } catch (e) { showToast('Ошибка при чтении файла'); }
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // Filter products
  let filtered = products;
  const q = search.toLowerCase().trim();
  if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  if (selectedCats.size > 0) filtered = filtered.filter(p => selectedCats.has(CAT_LABELS[p.cat] || p.cat || ''));
  if (typeFilterSet.size > 0) filtered = filtered.filter(p => typeFilterSet.has(p.type));
  filtered = filtered.sort((a, b) => (a.hidden ? 1 : 0) - (b.hidden ? 1 : 0));

  const costPrice = (p) => {
    if (p.type === 'combo' && p.combo_items && p.combo_items.length > 0) {
      return p.combo_items.reduce(function(s, item) {
        return s + ((costMap[item.id] || 0) * item.qty);
      }, 0);
    }
    return costMap[p.id] || 0;
  };

  const cellHtml = (col, p) => {
    switch(col) {
      case 'name': return `<div class="prod-name" style="cursor:pointer">${p.name}</div>`;
      case 'type':
        const typeLabel = p.type === 'service' ? 'Услуга' : p.type === 'combo' ? 'Комбо' : 'Товар';
        return `<span class="prod-cat">${typeLabel}</span>`;
      case 'category': return `<span class="prod-cat">${CAT_LABELS[p.cat] || p.cat || '—'}</span>`;
      case 'cost': {
        const cp = costPrice(p);
        if (p.type === 'service') return '<span style="color:#222">—</span>';
        return `<span class="prod-cat">${cp > 0 ? cp.toLocaleString() + ' ₽' : '—'}</span>`;
      }
      case 'price': return `<span class="prod-price" style="color:#222">${(p.price || 0).toLocaleString()} ₽</span>`;
      case 'markup': {
        if (p.type === 'service') return '<span style="color:#222">—</span>';
        const cp = costPrice(p);
        if (cp <= 0) return '<span style="color:#222">—</span>';
        const mk = Math.round(((p.price || 0) - cp) / cp * 100);
        const color = mk > 0 ? '#16a34a' : mk < 0 ? '#dc2626' : '#222';
        return `<span style="color:${color}">${mk > 0 ? '+' : ''}${mk}%</span>`;
      }
      case 'unit': return `<span style="color:#222">${p.unit || '—'}</span>`;
      case 'sku': return `<span style="color:#222">${p.sku || '—'}</span>`;
      case 'barcode': return `<span style="color:#222">${p.barcode || '—'}</span>`;
      case 'weight': {
        if (p.type==='service') return '<span style="color:#555">—</span>';
        const w = parseFloat(p.weight) || 0;
        return `<span>${w > 0 ? w + (p.weightUnit||p.weight_unit||'кг') : '—'}</span>`;
      }
      case 'description': return `<span style="color:#222">${(p.description||p.desc) ? (p.description||p.desc).substring(0,40)+((p.description||p.desc).length>40?'…':'') : '—'}</span>`;
      default: return '—';
    }
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>
      <div style={{flexShrink:0}}>
        <div className="page-header">
        <div>
          <h1>Товары и услуги</h1>
          <div className="sub">Каталог товаров, услуг и комбо</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={openAdd} style={{color:'#222',fontWeight:400}}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />



      <div className="search-row" style={{display:"flex",alignItems:"center",marginBottom:".5rem",width:'100%',flexWrap:'nowrap'}}>
        <div className="stock-search" style={{display:"flex",alignItems:"center",gap:".3rem",width:"30%",minWidth:"180px",maxWidth:"400px",border:"1px solid var(--border)",borderRadius:"6px",padding:"7px .5rem",background:"var(--body-bg)"}}>
          <span style={{fontSize:".75rem",color:"var(--muted)",lineHeight:1}}>🔍</span>
          <input type="text" placeholder="Быстрый поиск" value={search} onChange={e=>setSearch(e.target.value)}
            style={{border:"none",outline:"none",flex:1,fontSize:".8rem",fontFamily:"var(--font)",background:"none",padding:0}} />
        </div>
        <div className="stock-filter-links" style={{display:"flex",alignItems:"center",gap:".15rem",marginLeft:"auto"}}>
          <div className="type-wrapper" style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
            <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"#555",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
              onClick={()=>{setTypeOpen(!typeOpen);setCatOpen(false);setColsOpen(false);setExportOpen(false)}}>Тип</span>
            {typeOpen && (
              <div className="cat-dropdown" style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'180px',padding:'.35rem',zIndex:100}}>
                <div className="cat-dd-list">
                  {[{v:'product',l:'Товары'},{v:'service',l:'Услуги'},{v:'combo',l:'Комбо'}].map(function(t) {
                    const checked = typeFilterSet.has(t.v);
                    return (
                      <div key={t.v} className="cat-dd-item" onClick={() => toggleType(t.v)}>
                        <input type="checkbox" checked={checked} onChange={()=>{}} style={{cursor:"pointer",margin:0}} />
                        <span>{t.l}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="cat-dd-actions" style={{borderTop:'1px solid var(--border)',paddingTop:'.35rem',marginTop:'.15rem'}}>
                  <span className="cat-dd-action" onClick={selectAllTypes}>Выбрать все</span>
                  <span className="cat-dd-action" onClick={clearAllTypes}>Очистить</span>
                </div>
              </div>
            )}</div>
          <div className="cat-wrapper" style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
            <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"#555",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
              onClick={()=>{setCatOpen(!catOpen);setColsOpen(false);setExportOpen(false)}}>Категория</span>
            {catOpen && (
              <div className="cat-dropdown" style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'200px',padding:'.35rem',zIndex:100}}>
                <div className="cat-dd-search">
                  <input type="text" placeholder="Поиск..." value={catFilter} onChange={e => setCatFilter(e.target.value)} />
                </div>
                <div className="cat-dd-list">
                  {(catsLoaded ? cats : []).filter(c => !catFilter || c.name.toLowerCase().includes(catFilter.toLowerCase())).map(c => {
                    const checked = selectedCats.has(c.name);
                    return (
                      <div key={c.name} className="cat-dd-item" onClick={() => toggleCat(c.name)}>
                        <input type="checkbox" checked={checked} onChange={()=>{}} style={{cursor:"pointer",margin:0}} />
                        <span>{c.name}</span>
                      </div>
                    );
                  })}
                  {cats.length === 0 && <div style={{padding:'.5rem',color:'var(--muted)',fontSize:'.78rem'}}>Нет категорий</div>}
                </div>
                <div className="cat-dd-actions" style={{borderTop:'1px solid var(--border)',paddingTop:'.35rem',marginTop:'.15rem'}}>
                  <span className="cat-dd-action" onClick={selectAllCats}>Выбрать все</span>
                  <span className="cat-dd-action" onClick={clearAllCats}>Очистить</span>
                </div>
              </div>
            )}
          </div>
          <div className="cols-wrapper" style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
            <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"#555",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
              onClick={()=>{setColsOpen(!colsOpen);setCatOpen(false);setExportOpen(false)}}>Столбцы</span>
            {colsOpen && (
              <div className="cols-dropdown" style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'210px',padding:'.35rem',zIndex:100}}>
                <div className="cols-title">Основные столбцы</div>
                <div className="cols-list">
                {ALL_COLUMNS.filter(c=>!c.always).map(function(col) {
                  const active = activeCols.has(col.id);
                  return (
                    <div key={col.id} className="cols-item" onClick={() => toggleCol(col.id)}>
                      <input type="checkbox" checked={active} onChange={()=>{}} />
                      <span>{col.label}</span>
                    </div>
                  );
                })}
              </div></div>
            )}</div>
          <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"#555",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
            onClick={()=>{setCatOpen(false);setColsOpen(false);setExportOpen(false);setShowTrash(true)}}>Корзина</span>
          <span className="stock-filter-link" style={{padding:".15rem .4rem",fontSize:".75rem",color:"#555",cursor:"pointer",borderRight:"1px solid var(--border)",lineHeight:1}}
            onClick={()=>{setCatOpen(false);setColsOpen(false);exportExcel()}}>Скачать</span>
          </div>
        </div>


      </div>
      {/* Таблица */}
      <div className="product-table" style={{overflowY:'auto',flex:1,minHeight:0}}>
        <table className="data-table">
          <thead id="colHeaders">
            <tr>
              {COL_ORDER.map(col => {
                if (col === 'name' || activeCols.has(col)) {
                  return <th key={col} data-col={col} style={col==='name'?{minWidth:'200px',textAlign:'left',color:'#222',fontWeight:400,fontSize:'.78rem'}:{textAlign:'left',color:'#222',fontWeight:400,fontSize:'.78rem'}}>{COL_LABELS[col]}</th>;
                }
                return null;
              })}
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',width:'140px',textAlign:'right'}}></th>
            </tr>
          </thead>
          <tbody id="productTableBody">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2 + activeCols.size}>
                  <div className="empty-products">
                    <div className="big-icon">📦</div>
                    <p>Каталог пуст</p>
                    <p style={{fontSize:'.82rem',color:'var(--muted)',margin:'.5rem 0 0'}}>Добавьте первый товар или услугу, чтобы начать работу</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id} style={p.hidden ? {opacity:0.35,transition:'opacity .2s'} : {}}>
                {COL_ORDER.map(col => {
                  if (col === 'name' || activeCols.has(col)) {
                    if (col === 'name') {
                      return <td key={col} style={{cursor:'pointer',textAlign:'left',whiteSpace:'nowrap'}} onClick={() => setViewProduct(p)}><div className="prod-name" style={{cursor:'pointer'}}>{p.name}</div></td>;
                    }
                    return <td key={col} style={{textAlign:'left'}} dangerouslySetInnerHTML={{__html: cellHtml(col, p)}} />;
                  }
                  return null;
                })}
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <div style={{display:'inline-block',position:'relative',zIndex:2}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={(e) => {
                      e.stopPropagation();
                      const dd = e.currentTarget.nextElementSibling;
                      document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                      dd.classList.toggle('open');
                      var _r=dd.getBoundingClientRect();if(_r.bottom>window.innerHeight)dd.classList.add('up');else dd.classList.remove('up');
                    }}>⋯</button>
                    <div className="prod-dropdown">
                      <button onClick={() => openEdit(p)}>Редактировать</button>
                      <button onClick={() => copyP(p.id)}>Копировать</button>
                      {p.hidden ? (
                        <button onClick={() => unhide(p.id)}>Восстановить</button>
                      ) : (
                        <button onClick={() => hide(p.id)}>Скрыть</button>
                      )}
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
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Редактировать позицию' : 'Добавить позицию'} subtitle="Заполните информацию о товаре или услуге" width="wide">
        <form onSubmit={save}>
              <div className="form-group">
                <label>Название</label>
                <input type="text" value={fName} onChange={e => setFName(e.target.value)} required placeholder="Например: кофе или доставка заказа" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Категория</label>
                  <select value={fCat} onChange={e => setFCat(e.target.value)}>
                    <option value="">— выберите —</option>
                    {(catsLoaded ? cats : []).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Тип</label>
                  <select value={fType} onChange={e => setFType(e.target.value)}>
                    <option value="product">Товар</option>
                    <option value="service">Услуга</option>
                    <option value="combo">Комбо</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Цена{fType === 'combo' ? ' (по умолчанию сумма состава)' : ' продажи'}</label>
                  <input type="number" min="0" step="0.01" value={fPrice || (fType === 'combo' ? fComboItems.reduce(function(s,i){return s + i.price * i.qty}, 0) : '')} onChange={function(e){setFPrice(e.target.value)}} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Ед. измерения</label>
                  <select value={fUnit} onChange={e => setFUnit(e.target.value)}>
                    <option value="">— выберите —</option>
                    {(fType === 'service' ? SERVICE_UNITS : UNITS).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Артикул</label>
                  <input type="text" value={fSku} onChange={e => setFSku(e.target.value)} placeholder="ART-001" />
                </div>
                {fType !== 'service' && <div className="form-group">
                  <label style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
                    Штрихкод
                    <span style={{display:'inline-block',padding:'.1rem .45rem',borderRadius:'100px',fontSize:'.65rem',color:'#222',background:'#eee',cursor:'pointer',fontFamily:'inherit',lineHeight:1.5}} onClick={() => setFBarcode(genBarcode())}>Сгенерировать</span>
                  </label>
                  <input type="text" value={fBarcode} onChange={e => setFBarcode(e.target.value)} placeholder="4600000000000" />
                </div>}
                {fType === 'service' && <div className="form-group"></div>}
              </div>
              {fType !== 'service' && fType !== 'combo' && <div className="form-row">
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
              </div>}
              {fType === 'combo' && <div className="form-group" style={{marginBottom:'.75rem'}}>
                <label>Состав комбо</label>
                <div style={{border:'1px solid var(--border)',borderRadius:'.6rem',padding:'.5rem',background:'var(--body-bg)'}}>
                  <div style={{display:'flex',gap:'.35rem',marginBottom:'.35rem'}}>
                    <input type="text" value={fComboSearch} onChange={function(e){setFComboSearch(e.target.value)}}
                      placeholder="Поиск товаров/услуг..."
                      style={{flex:1,padding:'.4rem .5rem',fontSize:'.78rem',border:'1px solid var(--border)',borderRadius:'.4rem',outline:'none',fontFamily:'var(--font)',background:'var(--body-bg)'}} />
                  </div>
                  {fComboSearch.length > 0 && <div style={{maxHeight:'160px',overflowY:'auto',marginBottom:'.35rem',border:'1px solid var(--border)',borderRadius:'.35rem',padding:'.2rem'}}>
                    {products.filter(function(p){return p.type !== 'combo' && (p.id !== editId) && p.name.toLowerCase().includes(fComboSearch.toLowerCase())}).map(function(p) {
                      var inCombo = fComboItems.find(function(i){return i.id === p.id});
                      return (
                        <div key={p.id} style={{display:'flex',alignItems:'center',gap:'.35rem',padding:'.25rem .35rem',borderRadius:'.3rem',cursor:'pointer',background:inCombo?'#f0f0f0':'transparent'}}
                          onClick={function() {
                            if (inCombo) { setFComboItems(fComboItems.filter(function(i){return i.id !== p.id})); }
                            else { setFComboItems([...fComboItems, { id: p.id, name: p.name, price: p.price || 0, qty: 1 }]); }
                          }}>
                          <span style={{fontSize:'.75rem',flex:1}}>{p.name}</span>
                          <span style={{fontSize:'.7rem',color:'#888'}}>{p.type === 'service' ? 'Услуга' : 'Товар'} - {(p.price||0).toLocaleString()} ₽</span>
                          {inCombo && <span style={{fontSize:'.7rem',marginLeft:'.25rem',color:'var(--primary)',fontWeight:700}}>+</span>}
                        </div>
                      );
                    })}
                  </div>}
                  {fComboItems.length > 0 && <div style={{borderTop:'1px solid var(--border)',paddingTop:'.35rem'}}>
                    <div style={{fontSize:'.72rem',fontWeight:600,color:'#555',marginBottom:'.25rem'}}>B составе:</div>
                    {fComboItems.map(function(item, idx) {
                      return (
                        <div key={item.id} style={{display:'flex',alignItems:'center',padding:'.25rem .35rem',fontSize:'.78rem'}}>
                          <span style={{flex:1}}>{item.name}</span>
                          <div style={{display:'flex',alignItems:'center',gap:'.15rem',marginLeft:'.35rem'}}>
                            <button type="button" onClick={function() {
                              var next = [...fComboItems];
                              if (next[idx].qty > 1) { next[idx].qty--; setFComboItems(next); }
                            }} style={{width:'20px',height:'20px',border:'1px solid var(--border)',borderRadius:'4px',background:'none',cursor:'pointer',fontSize:'.7rem',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>-</button>
                            <span style={{minWidth:'20px',textAlign:'center',fontWeight:600}}>{item.qty}</span>
                            <button type="button" onClick={function() {
                              var next = [...fComboItems];
                              next[idx].qty++; setFComboItems(next);
                            }} style={{width:'20px',height:'20px',border:'1px solid var(--border)',borderRadius:'4px',background:'none',cursor:'pointer',fontSize:'.7rem',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>+</button>
                          </div>
                          <span style={{width:'75px',textAlign:'right',fontWeight:600}}>{(item.price * item.qty).toLocaleString()} ₽</span>
                          <button type="button" onClick={function() { setFComboItems(fComboItems.filter(function(_, i) { return i !== idx; })) }} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:'.8rem',marginLeft:'.25rem',lineHeight:1,padding:'.1rem'}}>x</button>
                        </div>
                      );
                    })}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid var(--border)',paddingTop:'.35rem',marginTop:'.25rem',fontSize:'.78rem'}}>
                      <span style={{fontWeight:600}}>Итого:</span>
                      <span style={{fontWeight:700}}>{fComboItems.reduce(function(s,i){return s + i.price * i.qty}, 0).toLocaleString()} ₽</span>
                    </div>
                  </div>}
                </div>
              </div>}
              <div className="form-row">
                <div className="form-group" style={{maxWidth:'250px'}}>
                  <label>Минимальный остаток</label>
                  <input type="number" min="0" step="1" value={fMinQty} onChange={e => setFMinQty(e.target.value)} placeholder="0" />
                </div>
                <div className="form-group" style={{border:'none'}}></div>
              </div>
              {fType !== 'combo' && <label style={{display:'flex',alignItems:'center',gap:'.5rem',fontSize:'.75rem',fontWeight:500,color:'#222',marginBottom:'.75rem',cursor:'pointer'}}>
                <span style={{position:'relative',display:'inline-block',width:'34px',height:'20px',flexShrink:0}}>
                  <input type="checkbox" checked={fFreePrice} onChange={function(e){setFFreePrice(e.target.checked)}} style={{opacity:0,width:0,height:0,position:'absolute'}} />
                  <span style={{position:'absolute',cursor:'pointer',top:0,left:0,right:0,bottom:0,background:fFreePrice?'#111':'#ccc',borderRadius:'20px',transition:'background .2s'}}>
                    <span style={{position:'absolute',content:'',height:'16px',width:'16px',left:'2px',bottom:'2px',background:'#fff',borderRadius:'50%',transition:'transform .2s',transform:fFreePrice?'translateX(14px)':'translateX(0)'}}></span>
                  </span>
                </span>
                Продавать по свободной цене
              </label>}
              <div className="form-group">
                <label>Описание</label>
                <textarea rows="2" value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Дополнительная информация..." />
              </div>
              <div className="modal-actions">
                {editId && fHidden && (
                  <button type="button" className="btn" style={{background:'var(--primary)',color:'#000',marginRight:'.5rem',borderRadius:'100px',fontWeight:'600'}} onClick={() => restore(editId)}>Восстановить товар</button>
                )}
                <button type="submit" className="btn btn-account-select" style={{color:'#222',fontWeight:400}}>Сохранить</button>
              </div>
            </form>
      </Modal>

      {/* Модалка подтверждения удаления */}
      <Modal open={showRemoveModal} onClose={() => { setShowRemoveModal(false); setRemoveTarget(null); }} title="Удалить товар?" subtitle="Он перенесётся в корзину и будет удалён через 30 дней" width="narrow"
        actions={<>
          <button className="btn btn-ghost" onClick={() => { setShowRemoveModal(false); setRemoveTarget(null); }}>Нет</button>
          <button className="btn btn-primary" style={{background:'#dc2626',color:'#fff'}} onClick={confirmRemove}>Да</button>
        </>}>
      </Modal>

      {/* Корзина модалка */}
      <Modal open={showTrash} onClose={() => setShowTrash(false)} title="Корзина" subtitle="Товары хранятся в корзине в течение 30 дней после удаления" width="medium">
            {(() => {
              const trash = getTrash();
              if (!trash.length) {
                return <div className="empty-products"><div className="big-icon">🗑️</div><p>В корзине пока ничего нет</p></div>;
              }
              return (
                <div className="product-table" style={{maxHeight:'280px',overflowY:'auto'}}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{width:'50%'}}>Товар</th>
                        <th style={{width:'25%'}}>Статус</th>
                        <th style={{width:'25%'}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {trash.map(p => {
                        const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - p.deletedAt) / 86400000));
                        return (
                          <tr key={p.id}>
                            <td style={{textAlign:'left'}}>
                              <div className="prod-name">{p.name}</div>
                              <div className="prod-sku">{p.sku || '—'}</div>
                            </td>
                            <td style={{fontSize:'.75rem',color:'#555'}}>ещё {daysLeft} дн.</td>
                            <td style={{textAlign:'right'}}>
                              <button className="act-btn" onClick={async () => {
                                let trash = getTrash();
                                const idx = trash.findIndex(x => x.id === p.id);
                                if (idx > -1) {
                                  const { deletedAt, id: oldId, ...itemRest } = trash[idx];
                                  const { error } = await supabase.from('products').insert({ ...itemRest, user_id: user.id });
                                  if (error) { showToast('Ошибка: ' + error.message); return; }
                                  trash.splice(idx, 1);
                                  setTrash([...trash]);
                                  await load();
                                  showToast('Товар успешно восстановлен!');
                                }
                              }} style={{color:'var(--primary)',background:'transparent',border:'none',fontSize:'.78rem',fontWeight:600,cursor:'pointer',fontFamily:'var(--font)',padding:'.25rem .5rem',borderRadius:'var(--radius)'}}>Восстановить</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
      </Modal>

      {/* Toast */}
      {toast && (
        <div id="toast" style={{
          position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          background:'#fff', border:'1px solid #e5e7eb', borderRadius:'.75rem',
          padding:'.65rem 1.2rem', fontSize:'.85rem', color:'#333',
          boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)', zIndex:9999
        }}>
          {toast}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{display:'none'}}
        onChange={e=>{const f=e.target.files?.[0];if(f){importExcel(f)}e.target.value=''}} />
    </div>
  );
}