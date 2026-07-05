import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Registers({ fullscreen }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allCats, setAllCats] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [payMode, setPayMode] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientDrop, setClientDrop] = useState(false);
  const [openShiftCashier, setOpenShiftCashier] = useState('');
  const [openShiftBal, setOpenShiftBal] = useState('0');
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCat, setAddCat] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addUnit, setAddUnit] = useState('');
  const [addType, setAddType] = useState('product');
  const [addSku, setAddSku] = useState('');
  const [addBarcode, setAddBarcode] = useState('');
  const [addWeight, setAddWeight] = useState('0');
  const [addWeightUnit, setAddWeightUnit] = useState('кг');
  const [addDesc, setAddDesc] = useState('');
  const [showPay, setShowPay] = useState(false);
  const [paySplit, setPaySplit] = useState(false);
  const [payUnpaid, setPayUnpaid] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [splitAmts, setSplitAmts] = useState({});
  const [showActions, setShowActions] = useState(false);
  const [editingCashier, setEditingCashier] = useState(false);
  const [displayCashierName, setDisplayCashierName] = useState('');
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closeFactBal, setCloseFactBal] = useState('');
  const [shiftTx, setShiftTx] = useState([]);
  const [registerReceipts, setRegisterReceipts] = useState([]);
  const [receiptComment, setReceiptComment] = useState('');
  const [heldReceipts, setHeldReceipts] = useState([]);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [heldIndex, setHeldIndex] = useState(0);
  const [promos, setPromos] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [uploadingId, setUploadingId] = useState(null);

  const abbreviateName = (name) => {
    if (!name) return name;
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const surname = parts[0];
    const initials = parts.slice(1).map(p => p.charAt(0) + '.').join(' ');
    return surname + ' ' + initials;
  };

  const getOwnerName = () => {
    try {
      const saved = localStorage.getItem('settings_owner');
      if (saved) {
        const o = JSON.parse(saved);
        if (o.firstName || o.lastName) return [o.lastName, o.firstName, o.patronymic].filter(Boolean).join(' ');
      }
    } catch(e) {}
    return null;
  };
  // Асинхронно загружаем ФИО из Supabase при монтировании
  const [ownerName, setOwnerName] = useState(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('last_name, first_name, patronymic')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data && (data.first_name || data.last_name)) {
          setOwnerName([data.last_name, data.first_name, data.patronymic].filter(Boolean).join(' '));
        }
      } catch(e) {}
    })();
  }, [user]);
  const localName = getOwnerName();
  const userName = abbreviateName(ownerName || localName || user?.user_metadata?.full_name) || user?.email?.split('@')[0] || 'Кассир';
  const effectiveName = displayCashierName || userName || activeShift?.cashier_name || 'Кассир';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [pRes, cRes, sRes, aRes, clRes, proRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('stock_categories').select('*').eq('user_id', user.id).order('name'),
        supabase.from('shifts').select('*').eq('user_id', user.id).eq('status', 'open').maybeSingle(),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
        supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
        supabase.from('promos').select('*').eq('user_id', user.id),
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (cRes.data) { setCategories(cRes.data.filter(c => c.type === 'product')); setAllCats(cRes.data); }
      if (aRes.data) setAccounts(aRes.data);
      if (clRes && clRes.data) setClients(clRes.data);
      if (proRes?.data) setPromos(proRes.data);
      if (sRes.data) {
        setActiveShift(sRes.data);
        // Синхронизируем имя кассира из настроек
        if (userName && sRes.data.cashier_name !== userName) {
          supabase.from('shifts').update({ cashier_name: userName }).eq('id', sRes.data.id).eq('user_id', user.id).then();
          sRes.data.cashier_name = userName;
        }
      } else {
        setOpenShiftCashier(userName);
        setShowOpenShift(true);
      }
      // Загружаем остатки склада
      Promise.all([
        supabase.from('supplies').select('items').eq('user_id', user.id),
        supabase.from('writeoffs').select('items').eq('user_id', user.id),
      ]).then(function(rr){
        var sm = {};
        (rr[0].data||[]).forEach(function(sp){ (sp.items||[]).forEach(function(it){
          if (!sm[it.prodId]) sm[it.prodId] = 0;
          sm[it.prodId] += it.qty || 0;
        });});
        (rr[1].data||[]).forEach(function(wo){ (wo.items||[]).forEach(function(it){
          if (sm[it.prodId]) sm[it.prodId] -= it.qty || 0;
        });});
        setStockMap(sm);
      });
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); } }, [toast]);

  const filtered = useMemo(() => {
    let items = products;
    if (catFilter !== 'all') items = items.filter(p => (p.cat || '') === catFilter);
    if (search) { const q = search.toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(q)); }
    // Сортировка: сначала с остатком, потом нулевые, скрытые в конце
    return [...items].sort((a, b) => {
      const aHidden = a.hidden ? 1 : 0;
      const bHidden = b.hidden ? 1 : 0;
      if (aHidden !== bHidden) return aHidden - bHidden;
      const aStock = a.type === 'service' ? 1 : ((stockMap[a.id] || 0) > 0 ? 1 : 0);
      const bStock = b.type === 'service' ? 1 : ((stockMap[b.id] || 0) > 0 ? 1 : 0);
      if (aStock !== bStock) return bStock - aStock;
      return a.name?.localeCompare(b.name || '');
    });
  }, [products, search, catFilter, stockMap]);

  const findPromo = (product) => {
    const today = new Date().toISOString().split('T')[0];
    return promos.find(p => {
      if (p.start_date > today || p.end_date < today) return false;
      if (!p.conditions || !p.conditions.type) return true;
      const cond = p.conditions;
      if (cond.type === 'all') return true;
      if (cond.type === 'category_products') { const cn = allCats.find(c => c.id === parseInt(cond.catId))?.name; return product.type !== 'service' && cn && cn === product.cat; }
      if (cond.type === 'category_services') { const cn = allCats.find(c => c.id === parseInt(cond.catId))?.name; return product.type === 'service' && cn && cn === product.cat; }
      if (cond.type === 'specific_products' || cond.type === 'specific_services') return cond.productIds && cond.productIds.includes(product.id);
      return false;
    });
  };

  const addToCart = (p) => {
    const stock = stockMap[p.id] || 0;
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      const currentQty = ex ? ex.qty : 0;
      if (p.type !== 'combo' && currentQty >= stock && p.type !== 'service') { setToast('На складе только ' + stock + ' шт'); return prev; }
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      const promo = findPromo(p);
      const origPrice = p.price || 0;
      const discountPct = promo ? (promo.discount || 0) : 0;
      const finalPrice = discountPct > 0 ? Math.round(origPrice * (100 - discountPct) / 100) : origPrice;
      const comboData = p.type === 'combo' && p.combo_items ? { combo_items: p.combo_items } : {};
      return [...prev, { id: p.id, name: p.name, price: origPrice, qty: 1, cat: p.cat || '', free_price: p.free_price || false, final_price: finalPrice, promo_id: promo?.id || null, discount_percent: discountPct, ...comboData }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      const i = prev.find(x => x.id === id);
      if (!i) return prev;
      const n = i.qty + delta;
      if (n <= 0) return prev.filter(x => x.id !== id);
      return prev.map(x => x.id === id ? { ...x, qty: n } : x);
    });
  };

  const total = cart.reduce((s, i) => s + (i.final_price || i.price) * i.qty, 0);
  const totalOriginal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountTotal = totalOriginal - total;
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  const openPay = () => {
    if (!cart.length) return;
    setPayMode(null);
    setPaySplit(false);
    setPayUnpaid(false);
    setSplitAmts({});
    setPayAmount(String(Math.round(total)));
    setShowPay(true);
  };

  const processPay = async () => {
    if (!cart.length) return;
    const date = new Date().toISOString().split('T')[0];
    
    // Получаем или создаём категорию «Доход от продаж»
    let saleCatId = null;
    const { data: cats } = await supabase.from('categories').select('id').eq('user_id', user.id).eq('name', 'Доход от продаж').maybeSingle();
    if (cats) {
      saleCatId = cats.id;
    } else {
      const { data: newCat } = await supabase.from('categories').insert({ user_id: user.id, name: 'Доход от продаж', type: 'income' }).select('id').single();
      if (newCat) saleCatId = newCat.id;
    }

    // Номер чека
    const { count } = await supabase.from('receipts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const receiptNum = (count || 0) + 1;

    // Определяем статус чека
    var receiptStatus = 'paid';
    if (payUnpaid) receiptStatus = 'unpaid';
    else if (payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) < total) receiptStatus = 'partially_paid';

    // Создаём чек
    var receiptId = null;
    var clientObj = clients.find(c => c.id === selectedClient);
    var { data: newReceipt, error: receiptErr } = await supabase.from('receipts').insert({
      user_id: user.id, receipt_number: receiptNum,
      date, total_amount: total, comment: receiptComment.trim() || null,
      discount_sum: cart.reduce((s, i) => s + ((i.price - (i.final_price || i.price)) * i.qty), 0),
      status: receiptStatus,
      client_id: selectedClient || null,
      client_name: clientObj?.name || '',
      shift_id: activeShift?.id || null,
      cashier_name: activeShift?.cashier_name || userName || '',
      source: 'register',
    }).select('id').single();
    if (receiptErr || !newReceipt) {
      // Таблица receipts может ещё не существовать — продолжаем без чеков
      console.warn('Не удалось создать чек:', receiptErr?.message);
    } else {
      receiptId = newReceipt.id;
      // Сохраняем товары чека
      var receiptItems = [];
      cart.forEach(function(item) {
        var entry = {
          receipt_id: receiptId,
          product_name: item.name, quantity: item.qty,
          price: item.price, total: (item.final_price || item.price) * item.qty,
          discount_percent: item.discount_percent || 0,
          discount_amount: ((item.price - (item.final_price || item.price)) * item.qty),
          promo_id: item.promo_id || null,
        };
        if (item.combo_items && item.combo_items.length > 0) {
          entry.combo_items = item.combo_items.map(function(ci) { return { name: ci.name, qty: ci.qty * item.qty, price: ci.price }; });
        }
        receiptItems.push(entry);
      });
      var { error: itemsErr } = await supabase.from('receipt_items').insert(receiptItems);
      if (itemsErr) console.warn('Не удалось сохранить товары чека:', itemsErr.message);
    }

    if (payUnpaid) {
      // Неоплаченный чек — одна транзакция на весь чек без счёта
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id, type: 'income', amount: total,
        description: 'Продажа по чеку №' + receiptNum,
        date, status: 'unpaid', category_id: saleCatId,
      });
      setProcessingPay(false); if (error) return setToast('Ошибка: ' + error.message);
      setRegisterReceipts(prev => [...prev, { amount: total, description: 'Продажа по чеку №' + receiptNum, created_at: new Date().toISOString(), status: 'unpaid', type:'income' }]);
      setCart([]); setShowPay(false);
      setProcessingPay(false); return setToast('Чек №' + receiptNum + ' сохранён (не оплачен)');
    }

    if (paySplit) {
      // Раздельная оплата — по одной транзакции на каждую часть
      const entries = Object.entries(splitAmts).filter(([, v]) => v && parseFloat(v) > 0);
      if (entries.length === 0) { setProcessingPay(false); return setToast('⚠️ Укажите суммы для оплаты'); }
      const sum = entries.reduce((s, [, v]) => s + parseFloat(v), 0);
      if (Math.abs(sum - total) > 0.01) { setProcessingPay(false); return setToast('⚠️ Сумма оплаты не совпадает с итогом'); }
      let part = 1;
      for (const [acId, amt] of entries) {
        const { error } = await supabase.from('transactions').insert({
          user_id: user.id, type: 'income', amount: parseFloat(amt),
          description: 'Продажа по чеку №' + receiptNum + ' (Часть ' + part + ')',
          date, account_id: acId, status: 'paid', category_id: saleCatId,
        });
        if (error) { setProcessingPay(false); return setToast('Ошибка: ' + error.message); }
        part++;
      }
      setRegisterReceipts(prev => [...prev, { amount: total, description: 'Продажа по чеку №' + receiptNum, created_at: new Date().toISOString(), status: 'paid', type:'income' }]);
      setCart([]); setShowPay(false); setPayMode(null);
      setProcessingPay(false); return setToast('Чек №' + receiptNum + ' — оплачено с нескольких счетов');
    }

    // Обычная оплата на один счёт — с учётом частичной оплаты
    if (!payMode) { setProcessingPay(false); return setToast('⚠️ Выберите способ оплаты'); }
    const selectedAc = accounts.find(a => a.id === payMode);
    // Наличные → перенаправляем на счёт Касса
    var targetAc = selectedAc;
    if (selectedAc && selectedAc.type === 'cash') {
      targetAc = accounts.find(a => a.type === 'cash_register') || selectedAc;
    }
    const paidAmt = payAmount ? parseFloat(payAmount) : total;
    
    if (!selectedClient) {
      setProcessingPay(false); return setToast('⚠️ Выберите клиента');
    }
    
    if (paidAmt > 0) {
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id, type: 'income', amount: Math.min(paidAmt, total),
        description: (paidAmt >= total ? 'Продажа по чеку №' : 'Частичная оплата по чеку №') + receiptNum,
        date, account_id: targetAc?.id || null, status: 'paid', category_id: saleCatId,
      });
      if (error) { setProcessingPay(false); return setToast('Ошибка: ' + error.message); }
    }
    
    // Долг на остаток — записываем клиенту
    if (paidAmt > 0 && paidAmt < total) {
      const remain = total - paidAmt;
      // Транзакция долга (не влияет на Cash Flow)
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id, type: 'income', amount: remain,
        description: 'Долг по чеку №' + receiptNum,
        date, status: 'debt', category_id: saleCatId,
      });
      if (error) { setProcessingPay(false); return setToast('Ошибка: ' + error.message); }
      
      // Обновляем долг клиента
      if (selectedClient) {
        const client = clients.find(c => c.id === selectedClient);
        const curDebt = parseFloat(client?.debt) || 0;
        const { error: debtErr } = await supabase.from('clients').update({debt: curDebt - remain}).eq('id', selectedClient);
        if (debtErr) console.error('Ошибка обновления долга клиента:', debtErr);
      }
    }
    
    // Уменьшаем остатки на складе (только для оплаченных чеков)
    if (!payUnpaid) {
      try {
        var woItems = [];
        cart.forEach(function(item){
          if (item.combo_items && item.combo_items.length > 0) {
            item.combo_items.forEach(function(ci){
              var prod = products.find(function(p){ return p.id === ci.id; });
              if (prod && prod.type !== 'service') {
                woItems.push({prodId:ci.id, name:ci.name, qty:ci.qty * item.qty, cost:0});
              }
            });
          } else {
            woItems.push({prodId:item.id, name:item.name, qty:item.qty, cost:0});
          }
        });
        await supabase.from('writeoffs').insert({
          id: Date.now(), user_id: user.id, name: 'Продажа по чеку №' + receiptNum,
          items: woItems, quantity: woItems.reduce(function(s,i){return s+i.qty},0),
          reason: 'Продажа', date: date, created_at: new Date().toISOString()
        });
      } catch(e) { console.error('Ошибка списания со склада:', e); }
      // Обновляем stockMap после списания
      Promise.all([
        supabase.from('supplies').select('items').eq('user_id', user.id),
        supabase.from('writeoffs').select('items').eq('user_id', user.id),
      ]).then(function(rr){
        var sm = {};
        (rr[0].data||[]).forEach(function(sp){ (sp.items||[]).forEach(function(it){
          if (!sm[it.prodId]) sm[it.prodId] = 0;
          sm[it.prodId] += it.qty || 0;
        });});
        (rr[1].data||[]).forEach(function(wo){ (wo.items||[]).forEach(function(it){
          if (sm[it.prodId]) sm[it.prodId] -= it.qty || 0;
        });});
        setStockMap(sm);
      });
    }
    
    setRegisterReceipts(prev => [...prev, { amount: total, description: 'Продажа по чеку №' + receiptNum, created_at: new Date().toISOString(), status: paidAmt >= total ? 'paid' : 'partially_paid', type:'income' }]);
    setReceiptComment('');
    setCart([]); setShowPay(false); setPayMode(null);
    const msg = paidAmt >= total 
      ? 'Чек №' + receiptNum + ' — ' + total.toLocaleString() + ' ₽'
      : 'Чек №' + receiptNum + ' — оплачено ' + paidAmt.toLocaleString() + ' ₽, долг ' + (total - paidAmt).toLocaleString() + ' ₽';
    setToast(msg);
    setProcessingPay(false);
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (!addName.trim()) return setToast('⚠️ Введите название');
    const price = parseFloat(addPrice) || 0;
    const { error } = await supabase.from('products').insert({
      id: Date.now(), name: addName.trim(), cat: addCat, price, unit: addUnit || 'шт',
      type: addType, sku: addSku.trim(), barcode: addBarcode.trim(),
      weight: parseFloat(addWeight) || 0, weight_unit: addWeightUnit,
      description: addDesc, user_id: user.id, hidden: false,
    });
    if (error) return setToast('' + error.message);
    setShowAdd(false);
    setAddName(''); setAddCat(''); setAddPrice(''); setAddUnit(''); setAddType('product');
    setAddSku(''); setAddBarcode(''); setAddWeight('0'); setAddWeightUnit('кг'); setAddDesc('');
    // Refresh products
    const { data } = await supabase.from('products').select('*').eq('user_id', user.id).order('name');
    if (data) setProducts(data);
    setToast('Товар добавлен!');
  };

  const resizePhoto = (file, maxW=600) => new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxW) { h = h * maxW / w; w = maxW; }
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(blob => {
        URL.revokeObjectURL(url);
        res(new File([blob], file.name, {type:'image/jpeg'}));
      }, 'image/jpeg', 0.6);
    };
    img.onerror = rej;
    img.src = url;
  });

  const uploadPhoto = async (product, file) => {
    if (!file || uploadingId) return;
    setUploadingId(product.id);
    try {
      const resized = await resizePhoto(file).catch(() => null) || file;
      const ext = 'jpg';
      const filePath = `${user.id}/${product.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('product-photos').upload(filePath, resized, { upsert: true });
      if (uploadErr) {
        // Может bucket не создан — попробуем
        await supabase.storage.createBucket('product-photos', { public: true }).catch(() => {});
        const retry = await supabase.storage.from('product-photos').upload(filePath, resized, { upsert: true });
        if (retry.error) return setToast('⚠️ ' + retry.error.message);
      }
      const { data: { publicUrl } } = supabase.storage.from('product-photos').getPublicUrl(filePath);
      const { error: updateErr } = await supabase.from('products').update({ photo_url: publicUrl }).eq('id', product.id);
      if (updateErr) return setToast('⚠️ Ошибка сохранения: ' + updateErr.message);
      // Refresh products
      const { data } = await supabase.from('products').select('*').eq('user_id', user.id).order('name');
      if (data) setProducts(data);
      setUploadingId(null);
      setToast('Фото успешно загружено!');
    } catch(e) {
      setUploadingId(null);
      setToast('⚠️ Ошибка: ' + e.message);
    }
  };

  const openShift = async () => {
    const bal = parseFloat(openShiftBal) || 0;
    const { data, error } = await supabase.from('shifts').insert({
      user_id: user.id, opening_balance: bal, status: 'open', cashier_name: openShiftCashier.trim() || userName,
    }).select().single();
    if (error) return setToast('Ошибка: ' + error.message);
    if (data) setActiveShift(data);
    setShowOpenShift(false);
  };

  // Сканер штрихкода (камера)
  var scanBarcode = function(onResult){
  if (!navigator.mediaDevices) { setToast && setToast('Камера недоступна'); return; }
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
    var done=function(val){if(val&&!lock){lock=true;beep();if(onResult)onResult(val);setTimeout(function(){lock=false},3000)}cl()};
    var cl=function(){if(q){q.stop();q=null}w.remove();c.remove()};
    i.onkeydown=function(e){if(e.key==='Enter'&&i.value.trim()){done(i.value.trim())}};c.onclick=cl;
    Quagga.init({
      inputStream:{name:'Live',type:'LiveStream',target:v,targetSize:1,constraints:{width:640,height:480,facingMode:'environment'}},
      decoder:{readers:['ean_reader','ean_8_reader','code_128_reader','code_39_reader','upc_reader','upc_e_reader']},
      locate:true
    },function(err){if(err){setToast && setToast('Ошибка камеры');return}
      q=Quagga;Quagga.start();
      Quagga.onDetected(function(data){if(data&&data.codeResult&&data.codeResult.code){done(data.codeResult.code)}});
    });
  }).catch(function(){setToast && setToast('Ошибка загрузки сканера')});
};

if (loading) return <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#fff',zIndex:9999}}><div style={{fontSize:'3rem',marginBottom:'1rem'}}>⏳</div><div style={{fontSize:'1rem',color:'#888'}}>Загрузка...</div></div>;

  return (
    <div style={{background:'#f5f5f7',height:'100%',display:'flex',padding:'20px',width:'100vw',boxSizing:'border-box',fontFamily:'Inter,-apple-system,BlinkMacSystemFont,sans-serif'}}>
      <div style={{display:'flex',flex:1,flexShrink:0,width:'100%',background:'#fff',borderRadius:'24px',overflow:'hidden',boxShadow:'0 8px 60px rgba(0,0,0,.06)'}}>
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'1rem 1.5rem',fontSize:'.9rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}

      {/* Левая панель — чек */}
      <div style={{width:'280px',flexShrink:0,display:'flex',flexDirection:'column',background:'#fff',borderRight:'1px solid #eee',overflow:'hidden'}}>
        {/* Шапка Вариант 3 — плашка с тенью */}
        <div style={{margin:'10px',background:'#fff',borderRadius:'12px',padding:'8px 14px',display:'flex',alignItems:'center',gap:'10px',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
          <span style={{width:'5px',height:'5px',borderRadius:'50%',background:'#ff6052',display:'block',flexShrink:0,minWidth:'5px',minHeight:'5px'}}></span>
          <span style={{width:'5px',height:'5px',borderRadius:'50%',background:'#ffbd2e',display:'block',flexShrink:0,minWidth:'5px',minHeight:'5px'}}></span>
          <span style={{width:'5px',height:'5px',borderRadius:'50%',background:'#28c93f',display:'block',flexShrink:0,minWidth:'5px',minHeight:'5px'}}></span>
          <span style={{fontSize:'12px',fontWeight:700,color:'#222',marginLeft:'8px',flex:1}}>Касса</span>
          <span style={{fontSize:'12px',fontWeight:500,color:'#888',cursor:'pointer'}} onClick={() => { if (activeShift) setEditingCashier(true); else setShowOpenShift(true); }} title="Нажмите чтобы изменить">
            {displayCashierName || activeShift?.cashier_name || userName}
          </span>

          <span onClick={() => { if (activeShift) setShowActions(true); else setShowOpenShift(true); }} style={{fontSize:'14px',cursor:'pointer',color:'#999',padding:'2px',marginLeft:'12px',userSelect:'none',lineHeight:1,display:'inline-flex',alignItems:'center'}}>⚙</span>
        </div>

        {/* Список товаров в чеке */}
        <div style={{flex:1,overflowY:'auto'}}>
          {cart.length === 0 ? (
            <div style={{textAlign:'center',padding:'2rem 1rem',color:'#bbb',fontSize:'13px'}}>Выберите товары</div>
          ) : cart.map((item, i) => (
            <div key={item.id} style={{padding:'10px 14px',borderBottom:'1px solid #f5f5f5'}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'13px',fontWeight:500}}>{item.name}</div>
                  {item.combo_items && item.combo_items.length > 0 ? (
                    <div style={{fontSize:'10px',color:'#999',marginTop:'2px'}}>Cocтaв: {item.combo_items.map(function(ci, j){return <span key={ci.id}>{ci.name} x{ci.qty}{j < item.combo_items.length - 1 ? ', ' : ''}</span>;})}</div>
                  ) : null}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                  <button onClick={function(){updateQty(item.id, -1)}} style={{width:'24px',height:'24px',borderRadius:'6px',border:'1px solid #e0e0e0',background:'#fff',fontSize:'14px',cursor:'pointer',color:'#333',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>-</button>
                  <span style={{fontWeight:600,minWidth:'16px',textAlign:'center',fontSize:'13px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{item.qty}</span>
                  <button onClick={function(){updateQty(item.id, 1)}} style={{width:'24px',height:'24px',borderRadius:'6px',border:'1px solid #e0e0e0',background:'#fff',fontSize:'14px',cursor:'pointer',color:'#333',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>+</button>
                </div>
                {item.free_price ? (
                  <input type="number" min="0" step="0.01" value={item.price} 
                    onChange={function(e){var v=parseFloat(e.target.value)||0;setCart(function(p){return p.map(function(x){return x.id===item.id?{...x,price:v}:x})})}}
                    style={{width:'80px',textAlign:'right',border:'1.5px solid #e0e0e0',borderRadius:'6px',padding:'4px 6px',fontSize:'13px',fontWeight:600,fontFamily:'inherit',outline:'none'}} />
                ) : (
                  <div style={{fontSize:'13px',fontWeight:700,minWidth:'60px',textAlign:'right'}}>{((item.final_price || item.price) * item.qty).toLocaleString()} ₽</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Итого и оплата */}
        <div style={{padding:'14px',borderTop:'1px solid #eee',display:'flex',flexDirection:'column',gap:'10px'}}>
            {discountTotal > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px',color:'#999'}}>
                <span>Итого:</span>
                <span style={{textDecoration:'line-through',color:'#bbb'}}>{totalOriginal.toLocaleString()} ₽</span>
              </div>
            )}
            {discountTotal > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px',color:'#16a34a'}}>
                <span>Скидка:</span>
                <span>-{discountTotal.toLocaleString()} ₽</span>
              </div>
            )}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'12px',color:'#999'}}>К оплате:</span>
              <span style={{fontSize:'20px',fontWeight:800}}>{total.toLocaleString()} ₽</span>
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              {cart.length > 0 && (
                <button onClick={function(){var items=cart.map(function(i){return {id:i.id,name:i.name,price:i.price,qty:i.qty}});setHeldReceipts(function(p){return [...p,{items:items,total:total,client:selectedClient,clientName:clients.find(function(c){return c.id===selectedClient;})?.name||'',createdAt:Date.now(),id:Date.now()}]});setCart([]);setToast('Чек отложен')}} style={{
                  flex:1, padding:'13px', borderRadius:'100px', border:'1.5px solid #ddd',
                  background:'#fff', color:'#555', fontSize:'14px', fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit',
                }}>Отложить</button>
              )}
              <button onClick={openPay} disabled={!cart.length} style={{
                flex:1, padding:'13px', borderRadius:'100px', border:'none',
                background: cart.length ? '#ffdd2d' : '#ddd',
                color: cart.length ? '#111' : '#fff', fontSize:'14px', fontWeight:700,
                cursor: cart.length ? 'pointer' : 'default', fontFamily:'inherit',
              }}>Продажа</button>
            </div>
          </div>
      </div>

      {/* Правая панель — товары */}
      <div style={{flex:'1 1 auto',display:'flex',flexDirection:'column',padding:'16px',overflow:'auto',width:'100%',minWidth:0}}>
        {/* Поиск */}
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Поиск"
            style={{flex:1,border:'1px solid #eee',borderRadius:'10px',padding:'9px 14px',fontSize:'13px',outline:'none',fontFamily:'inherit',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}} />
          <span onClick={function(){scanBarcode(function(bc){
            var found=products.find(function(p){return p.barcode===bc;});
            if(found){addToCart(found);setToast('Найден: '+found.name)}else setToast('Товар со штрихкодом '+bc+' не найден');
          })}} title="Сканировать штрихкод"
            style={{padding:'7px 10px',border:'1.5px solid #eee',borderRadius:'10px',cursor:'pointer',fontSize:'16px',background:'#fff',lineHeight:1}}>📷</span>
          <button onClick={() => { setShowAdd(true); setAddName(''); setAddCat(''); setAddPrice(''); setAddUnit(''); setAddType('product'); setAddSku(''); setAddBarcode(''); setAddWeight('0'); setAddWeightUnit('кг'); setAddDesc(''); }} style={{padding:'9px 16px',border:'none',borderRadius:'10px',background:'#000',color:'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>+ Добавить позицию</button>
        </div>

        {/* Категории */}
        <div style={{display:'flex',gap:'4px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px'}}>
          <button onClick={() => setCatFilter('all')} style={{
            padding:'5px 12px', borderRadius:'6px', border:'none', fontSize:'11px',
            fontWeight: catFilter === 'all' ? 600 : 500, cursor:'pointer', whiteSpace:'nowrap',
            background: catFilter === 'all' ? '#000' : '#e8e8ed',
            color: catFilter === 'all' ? '#fff' : '#666', fontFamily:'inherit',
          }}>Все</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.name)} style={{
              padding:'5px 12px', borderRadius:'6px', border:'none', fontSize:'11px',
              fontWeight: catFilter === c.name ? 600 : 500, cursor:'pointer', whiteSpace:'nowrap',
              background: catFilter === c.name ? '#000' : '#e8e8ed',
              color: catFilter === c.name ? '#fff' : '#666', fontFamily:'inherit',
            }}>{c.name}</button>
          ))}
        </div>

        {/* Сетка товаров */}
        <div style={{flex:1,overflowY:'auto',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gridAutoRows:'210px',gap:'8px',alignContent:'start',minHeight:0,width:'100%'}}>
          {filtered.length === 0 ? (
            <div style={{gridColumn:'1/-1',textAlign:'center',padding:'3rem 0',color:'#bbb',fontSize:'13px'}}>Нет товаров</div>
          ) : filtered.map(p => (
            <div key={p.id} onClick={function(){var oos=p.type!=='service'&&(stockMap[p.id]||0)<=0;if(!oos)addToCart(p)}}
              style={{background: (p.type!=='service'&&(stockMap[p.id]||0)<=0)?'#fafafa':'#fff',borderRadius:'14px',padding:'14px',cursor:(p.type!=='service'&&(stockMap[p.id]||0)<=0)?'default':'pointer',transition:'all .12s',display:'flex',flexDirection:'column',border:'1px solid '+( (p.type!=='service'&&(stockMap[p.id]||0)<=0)?'#f0f0f0':'#eee' ),boxShadow:'0 1px 4px rgba(0,0,0,.05)',height:'100%',opacity:(p.type!=='service'&&(stockMap[p.id]||0)<=0)?.5:1}}
              onMouseEnter={e => { var oos=p.type!=='service'&&(stockMap[p.id]||0)<=0;if(!oos){e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.06)'}} }
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.03)' } }>
              {/* Фото / иконка загрузки */}
              <div style={{height:'100px',marginBottom:'8px',borderRadius:'8px',overflow:'hidden',background:'#f9f9f9',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',border:'1px dashed '+(p.photo_url?'transparent':'#ddd')}}
                onClick={function(e){e.stopPropagation();if(p.photo_url&&!confirm('Заменить фото?'))return;var inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=function(ev){var f=ev.target.files[0];if(f){uploadPhoto(p,f)}};inp.click()}}
              >
                {uploadingId === p.id ? (
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px'}}>
                    <div style={{width:'40px',height:'4px',borderRadius:'2px',background:'#e0e0e0',overflow:'hidden'}}>
                      <div style={{width:'100%',height:'100%',background:'#111',borderRadius:'2px',animation:'loadbar 1.2s infinite'}}></div>
                    </div>
                    <span style={{fontSize:'10px',color:'#999'}}>загрузка...</span>
                  </div>
                ) : p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} style={{width:'100%',height:'100%',objectFit:'cover',display:'block',borderRadius:'8px'}} />
                ) : (
                  <span style={{fontSize:'28px',opacity:0.3}}>📷</span>
                )}
              </div>
              <div style={{fontSize:'12px',fontWeight:600,color: (p.type!=='service'&&(stockMap[p.id]||0)<=0)?'#999':'#222',lineHeight:1.3}}>{p.name}</div>
              <div style={{marginTop:'auto',display:'flex',flexDirection:'column',gap:'1px'}}>
                {p.cat && <div style={{fontSize:'10px',color: (p.type!=='service'&&(stockMap[p.id]||0)<=0)?'#ccc':'#999'}}>{p.cat}</div>}
                <div style={{display:'flex',alignItems:'baseline',gap:'8px'}}>
                <span style={{fontSize:'16px',fontWeight:800,color: (p.type!=='service'&&(stockMap[p.id]||0)<=0)?'#bbb':'#000'}}>{(p.price||0).toLocaleString()} ₽</span>
                {(p.type!=='service'&&(stockMap[p.id]||0)<=0) ? null : (
                  <span style={{fontSize:'10px',fontWeight:500,color:'#16a34a'}}>остаток: {stockMap[p.id] || 0}</span>
                )}
              </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      </div>

      {/* Модалка добавления товара */}
      {showAdd && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowAdd(false); }}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <button className="modal-close" onClick={() => setShowAdd(false)}>&times;</button>
            <h2>Добавить позицию</h2>
            <div className="sub">Новый товар появится в каталоге и разделе «Товары и услуги»</div>
            <form onSubmit={saveProduct}>
              <div className="form-group">
                <label>Название</label>
                <input type="text" value={addName} onChange={e => setAddName(e.target.value)} required placeholder="Например: свечи зажигания" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Категория</label>
                  <select value={addCat} onChange={e => setAddCat(e.target.value)}>
                    <option value="">— выберите —</option>
                    {allCats.filter(c => c.type === 'product').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Тип</label>
                  <select value={addType} onChange={e => setAddType(e.target.value)}>
                    <option value="product">Товар</option>
                    <option value="service">Услуга</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Цена продажи (₽)</label>
                  <input type="number" min="0" step="0.01" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Ед. измерения</label>
                  <select value={addUnit} onChange={e => setAddUnit(e.target.value)}>
                    <option value="">— выберите —</option>
                    <option value="шт">шт</option>
                    <option value="кг">кг</option>
                    <option value="л">л</option>
                    <option value="усл">усл</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Артикул</label>
                  <input type="text" value={addSku} onChange={e => setAddSku(e.target.value)} placeholder="ART-001" />
                </div>
                {addType !== 'service' && <div className="form-group">
                  <label>Штрихкод</label>
                  <input type="text" value={addBarcode} onChange={e => setAddBarcode(e.target.value)} placeholder="4600000000000" />
                </div>}
                {addType === 'service' && <div className="form-group"></div>}
              </div>
              {addType !== 'service' && <div className="form-row">
                <div className="form-group">
                  <label>Вес</label>
                  <input type="number" min="0" step="0.01" value={addWeight} onChange={e => setAddWeight(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Ед. веса</label>
                  <select value={addWeightUnit} onChange={e => setAddWeightUnit(e.target.value)}>
                    <option value="г">г</option>
                    <option value="кг">кг</option>
                    <option value="т">т</option>
                  </select>
                </div>
              </div>}
              <div className="form-group">
                <label>Описание</label>
                <textarea rows="2" value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Дополнительная информация..." />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-account-select">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка оплаты */}
      {showPay && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowPay(false); }}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowPay(false)}>&times;</button>
            <h2 style={{marginBottom:'16px',fontSize:'1.15rem',fontWeight:700}}>Чек №{(shiftTx.length || 0) + 1} — {total.toLocaleString()} ₽</h2>

            {/* Выбор счёта */}
            <div className="form-group">
              <label>Способ оплаты</label>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {accounts.filter(function(a){return a.type !== 'cash';}).map(a => (
                  <button key={a.id} onClick={() => setPayMode(a.id)} style={{
                    flex:1, padding:'8px 6px', borderRadius:'8px', border:'1.5px solid #eee',
                    background: payMode === a.id ? '#111' : '#fff',
                    color: payMode === a.id ? '#fff' : '#555',
                    fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'inherit',whiteSpace:'nowrap',minWidth:'60px'
                  }}>{a.type === 'cash_register' ? 'Наличные' : a.name}</button>
                ))}
              </div>
            </div>

            {/* Сумма оплаты */}
            {payMode && !paySplit && (
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'12px',fontWeight:600,color:'#888',display:'block',marginBottom:'6px'}}>Сумма</label>
                <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                  <input type="number" min="0" step="0.01" placeholder={total.toString()} 
                    value={payAmount} 
                    onChange={e => setPayAmount(e.target.value)}
                    style={{width:'50%',border:'1.5px solid #e0e0e0',borderRadius:'8px',padding:'9px 10px',fontSize:'13px',outline:'none',fontFamily:'inherit'}} />
                  {payUnpaid ? (
                    <span style={{fontSize:'11px',fontWeight:600,padding:'1px 8px',borderRadius:'100px',background:'#fef2f2',color:'#dc2626'}}>✕ Долг</span>
                  ) : (payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) >= total) ? (
                    <span style={{fontSize:'11px',fontWeight:600,padding:'1px 8px',borderRadius:'100px',background:'#f0fdf4',color:'#16a34a'}}>✓ Оплачено</span>
                  ) : null}
                </div>
                {payAmount && parseFloat(payAmount) > total && (
                  <div style={{fontSize:'11px',color:'#16a34a',marginTop:'4px'}}>Сдача: {(parseFloat(payAmount) - total).toLocaleString()} ₽</div>
                )}
              </div>
            )}
            
            <div className="form-group">
              <label>Клиент</label>
              <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                <div style={{position:'relative',flex:1}}>
                  <input type="text" placeholder="Поиск по имени или телефону..." 
                    value={selectedClient ? (clients.find(c => c.id === selectedClient)?.name || clientSearch) : clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setSelectedClient(''); setClientDrop(true); }}
                    onFocus={() => setClientDrop(true)}
                    onBlur={() => setTimeout(() => setClientDrop(false), 200)}
                    style={{width:'100%'}} />
                  {clientDrop && (
                    <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #eee',borderRadius:'8px',boxShadow:'0 4px 12px rgba(0,0,0,.1)',zIndex:10,maxHeight:'180px',overflowY:'auto',marginTop:'2px'}}>
                      {clients.filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)).map(c => (
                        <div key={c.id} onMouseDown={() => { setSelectedClient(c.id); setClientSearch(c.name + (c.phone ? ' | '+c.phone : '')); setClientDrop(false); }}
                          style={{padding:'8px 10px',cursor:'pointer',fontSize:'13px',borderBottom:'1px solid #f5f5f5',background: selectedClient === c.id ? '#f5f5f5' : '#fff'}}
                          onMouseEnter={e => e.currentTarget.style.background='#f9f9f9'}
                          onMouseLeave={e => e.currentTarget.style.background='#fff'}>{c.name}{(()=>{try{const j=JSON.parse(c.comment||'{}');return j.n1?' | '+j.n1:''}catch(e){return ''}})()}{c.phone ? ' | '+c.phone : ''}</div>
                      ))}
                      {clients.filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)).length === 0 && (
                        <div style={{padding:'10px',fontSize:'12px',color:'#999',textAlign:'center'}}>Ничего не найдено</div>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => { setShowAddClient(true); setNewClientName(''); setNewClientPhone(''); setClientSearch(''); }} 
                  style={{padding:'8px 12px',border:'none',borderRadius:'8px',background:'#000',color:'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>+</button>
              </div>
              {payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) < total && (
                <div style={{fontSize:'11px',color:'#92400e',marginTop:'4px',background:'#fff3cd',padding:'4px 8px',borderRadius:'6px'}}>
                  Остаток {(total - parseFloat(payAmount)).toLocaleString()} ₽ — уйдёт в долг
                </div>
              )}
            </div>

            {/* Комментарий к чеку */}
            <div className="form-group" style={{marginBottom:'8px'}}>
              <input type="text" value={receiptComment} onChange={e=>setReceiptComment(e.target.value)} placeholder="Комментарий к чеку (пробег, примечание...)" 
                style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e0e0e0',borderRadius:'8px',fontSize:'13px',outline:'none',fontFamily:'inherit'}} />
            </div>

            {/* Ползунок «Разделить на счета» */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
              <label style={{position:'relative',display:'inline-block',width:'36px',height:'20px',cursor:'pointer'}}>
                <input type="checkbox" checked={paySplit} onChange={e => { setPaySplit(e.target.checked); if (!e.target.checked) setSplitAmts({}); }} style={{opacity:0,width:0,height:0}} />
                <span style={{position:'absolute',inset:0,background:paySplit?'#000':'#ddd',borderRadius:'100px',transition:'.2s'}}>
                  <span style={{position:'absolute',top:'2px',left:paySplit?'18px':'2px',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',transition:'.2s'}}></span>
                </span>
              </label>
              <span style={{fontSize:'13px',fontWeight:500,color:'#111'}}>Разделить на счета</span>
            </div>

            {paySplit && (
              <div style={{marginBottom:'14px'}}>
                {accounts.filter(function(a){return a.type !== 'cash';}).map(a => {
                  const amt = parseFloat(splitAmts[a.id]) || 0;
                  const remain = total - Object.entries(splitAmts).filter(([id]) => id !== a.id).reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
                  return (
                    <div key={a.id} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px',justifyContent:'flex-end'}}>
                      <span style={{fontSize:'12px',fontWeight:500,color:'#555'}}>{a.type === 'cash_register' ? 'Наличные' : a.name}</span>
                      <input type="number" min="0" step="0.01" placeholder={Math.round(remain).toString()} 
                        value={splitAmts[a.id] || ''} 
                        onChange={e => setSplitAmts({...splitAmts, [a.id]: e.target.value})}
                        style={{width:'90px',border:'1.5px solid #eee',borderRadius:'6px',padding:'5px 8px',fontSize:'13px',outline:'none',fontFamily:'inherit',textAlign:'right'}} />
                    </div>
                  );
                })}
                <div style={{fontSize:'12px',fontWeight:600,marginTop:'4px',color: Math.abs(total - Object.values(splitAmts).reduce((s, v) => s + (parseFloat(v) || 0), 0)) < 0.01 ? '#16a34a' : '#dc2626'}}>
                  {(total - Object.values(splitAmts).reduce((s, v) => s + (parseFloat(v) || 0), 0)).toLocaleString()} ₽
                </div>
              </div>
            )}

            {/* Ползунок «Не оплачивать» */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'18px'}}>
              <label style={{position:'relative',display:'inline-block',width:'36px',height:'20px',cursor:'pointer'}}>
                <input type="checkbox" checked={payUnpaid} onChange={e => { setPayUnpaid(e.target.checked); if (e.target.checked) { setPaySplit(false); setSplitAmts({}); }} } style={{opacity:0,width:0,height:0}} />
                <span style={{position:'absolute',inset:0,background:payUnpaid?'#dc2626':'#ddd',borderRadius:'100px',transition:'.2s'}}>
                  <span style={{position:'absolute',top:'2px',left:payUnpaid?'18px':'2px',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',transition:'.2s'}}></span>
                </span>
              </label>
              <span style={{fontSize:'13px',fontWeight:500,color:'#111'}}>Не оплачивать сейчас (долг)</span>
            </div>

            <div style={{textAlign:'center',marginTop:'16px',borderTop:'1px solid #eee',paddingTop:'14px'}}>
              <button type="button" onClick={processPay} disabled={!selectedClient}
                style={{padding:'.5rem 1.5rem',borderRadius:'100px',border:'none',background:'#ffdd2d',color:'#111',fontSize:'.85rem',fontWeight:700,cursor: selectedClient ? 'pointer' : 'not-allowed',fontFamily:'inherit',opacity: selectedClient ? 1 : 0.4}}>{payUnpaid ? 'Сохранить' : 'Оплатить'}</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка создания клиента */}
      {showAddClient && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowAddClient(false); }}>
          <div className="modal-box" style={{maxWidth:'380px'}}>
            <button className="modal-close" onClick={() => setShowAddClient(false)}>&times;</button>
            <h2>Новый клиент</h2>
            <div className="sub" style={{marginBottom:'12px'}}>Добавьте клиента для привязки к чеку</div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newClientName.trim()) return setToast('⚠️ Введите имя');
              var { data, error } = await supabase.from('clients').insert({
                user_id: user.id, name: newClientName.trim(), phone: newClientPhone.trim(),
              }).select();
              if (error) return setToast('' + error.message);
              // Обновляем список клиентов
              var clData = await supabase.from('clients').select('*').eq('user_id', user.id).order('name');
              if (clData.data) setClients(clData.data);
              // Автоматически выбираем нового клиента
              if (data && data.length > 0) setSelectedClient(data[0].id);
              setShowAddClient(false);
              setToast('Клиент добавлен');
            }}>
              <div className="form-group">
                <label>Имя</label>
                <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} required placeholder="Иван Иванов" autoFocus />
              </div>
              <div className="form-group">
                <label>Телефон</label>
                <input type="text" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} placeholder="+7 (999) 123-45-67" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-account-select">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка открытия смены */}
      {showOpenShift && (function(){
        var cashRegAc = accounts.find(function(a){return a.type === 'cash_register';});
        var cashRegBal = 0;
        if (cashRegAc) {
          cashRegBal = parseFloat(cashRegAc.balance) || 0;
        }
        // Считаем баланс кассы по всем транзакциям (если shiftTx пуст)
        var txData = shiftTx.length > 0 ? shiftTx : null;
        if (!txData && cashRegAc) {
          (function(){ supabase.from('transactions').select('amount,type,account_id').eq('account_id',cashRegAc.id).then(function(r){
            if(r.data) r.data.forEach(function(t){ cashRegBal += Number(t.amount||0) * (t.type==='income'?1:-1); });
            if (openShiftBal === '0' && cashRegBal > 0) setOpenShiftBal(String(Math.round(Math.max(0,cashRegBal))));
          }); })();
        } else if (txData && cashRegAc) {
          txData.forEach(function(t){if(t.account_id===cashRegAc.id) cashRegBal += Number(t.amount||0) * (t.type==='income'?1:-1);});
          if (openShiftBal === '0' && cashRegBal > 0) setOpenShiftBal(String(Math.round(Math.max(0,cashRegBal))));
        }
        return (
          <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowOpenShift(false); }}>
            <div className="modal-box" style={{maxWidth:'380px'}}>
              <button className="modal-close" onClick={() => setShowOpenShift(false)}>&times;</button>
              <h2>Открытие смены</h2>
              <div className="sub">Для работы кассы необходимо открыть смену</div>
              <form onSubmit={e => { e.preventDefault(); openShift(); }}>
                <div className="form-group"><label>Кассир</label><input type="text" value={openShiftCashier} onChange={e => setOpenShiftCashier(e.target.value)} /></div>
                <div className="form-group"><label>Остаток денег на начало дня</label>
                  <div style={{display:'flex',gap:'.35rem',alignItems:'center'}}>
                    <input type="number" placeholder="0" min="0" step="0.01" value={openShiftBal} onChange={e => setOpenShiftBal(e.target.value)} autoFocus />
                    {cashRegBal > 0 && <span style={{fontSize:'.75rem',color:'var(--muted)',whiteSpace:'nowrap'}}>Баланс Кассы: {Math.round(cashRegBal).toLocaleString()} ₽</span>}
                  </div>
                </div>
                <div className="modal-actions"><button type="submit" className="btn btn-account-select">Открыть смену</button></div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Меню действий */}
      {showActions && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowActions(false); }}>
          <div className="modal-box" style={{maxWidth:'340px'}}>
            <button className="modal-close" onClick={() => setShowActions(false)}>&times;</button>
            <h2 style={{textAlign:'center',fontSize:'0'}}></h2>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'16px'}}>
              <button onClick={async () => {
                setShowActions(false);
                const start = new Date(activeShift.opened_at);
                const now = new Date();
                const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).gte('created_at', start.toISOString()).lte('created_at', now.toISOString()).order('created_at', { ascending: false });
                setShiftTx(data || []);
                setShowCloseShift(true);
              }} style={{padding:'12px 16px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#111',fontSize:'13px',fontWeight:600,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>Закрыть смену</button>
              <button onClick={async () => {
                setShowActions(false);
                const start = new Date(activeShift.opened_at);
                const now = new Date();
                const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).gte('created_at', start.toISOString()).lte('created_at', now.toISOString()).order('created_at', { ascending: false });
                setShiftTx(data || []);
              }} style={{padding:'12px 16px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#111',fontSize:'13px',fontWeight:600,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>Чеки за смену</button>
              <button onClick={() => { setShowActions(false); setEditingCashier(true); }} style={{padding:'12px 16px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#111',fontSize:'13px',fontWeight:600,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>👤 Сменить кассира</button>
              {heldReceipts.length > 0 && (
                <button onClick={()=>{setShowActions(false);setHeldIndex(0);setShowHoldModal(true)}} style={{padding:'12px 16px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#111',fontSize:'13px',fontWeight:600,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>Отложенные чеки ({heldReceipts.length})</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модалка смены кассира */}
      {editingCashier && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setEditingCashier(false); }}>
          <div className="modal-box" style={{maxWidth:'340px'}}>
            <button className="modal-close" onClick={() => setEditingCashier(false)}>&times;</button>
            <h2>Сменить кассира</h2>
            <div className="sub" style={{marginBottom:'12px'}}>Введите Фамилию и Имя</div>
            <input type="text" value={displayCashierName || effectiveName || ''} onChange={e => setDisplayCashierName(e.target.value)}
              placeholder="Фамилия Имя" autoFocus
              style={{width:'100%',padding:'10px 12px',border:'1px solid #ddd',borderRadius:'8px',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} />
            <div style={{marginTop:'12px',display:'flex',gap:'8px'}}>
              <button onClick={() => setEditingCashier(false)} style={{flex:1,padding:'10px',borderRadius:'8px',border:'1px solid #ddd',background:'#fff',fontSize:'13px',fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Отмена</button>
              <button onClick={async () => {
                const name = displayCashierName.trim() || userName;
                if (activeShift && name) {
                  await supabase.from('shifts').update({ cashier_name: name }).eq('id', activeShift.id).eq('user_id', user.id);
                  setActiveShift({...activeShift, cashier_name: name});
                }
                setDisplayCashierName(name);
                setEditingCashier(false);
              }} style={{flex:1,padding:'10px',borderRadius:'8px',border:'none',background:'#000',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Чеки за смену */}
      {registerReceipts.length > 0 && !showCloseShift && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') { setRegisterReceipts([]); } }}>
          <div className="modal-box" style={{maxWidth:'520px'}}>
            <button className="modal-close" onClick={() => setRegisterReceipts([])}>&times;</button>
            <h2>Чеки за смену</h2>
            <div className="sub" style={{marginBottom:'12px'}}>Чеки, пробитые через кассу</div>
            <div style={{overflowY:'auto',maxHeight:'50vh'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #eee'}}>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'left'}}>Чек</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Товар</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Время</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Способ</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Статус</th>
                    <th style={{padding:'8px 10px',fontSize:'11px',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.04em',background:'#fafafa',textAlign:'center'}}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {registerReceipts.map((t, i) => {
                    const ac = accounts.find(a => a.id === t.account_id);
                    const time = new Date(t.created_at).toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
                    return (
                      <tr key={i} style={{borderBottom:'1px solid #f5f5f5'}}>
                        <td style={{padding:'10px 10px',fontWeight:600,textAlign:'left'}}>{i + 1}</td>
                        <td style={{padding:'10px 10px',textAlign:'center'}}>{t.description}</td>
                        <td style={{padding:'10px 10px',color:'#999',textAlign:'center'}}>{time}</td>
                        <td style={{padding:'10px 10px',textAlign:'center'}}>{ac?.name || '—'}</td>
                        <td style={{padding:'10px 10px',textAlign:'center'}}>
                          <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'100px',background: t.status === 'debt' ? '#fef2f2' : t.status === 'unpaid' ? '#fff3cd' : '#f0fdf4',color: t.status === 'debt' ? '#dc2626' : t.status === 'unpaid' ? '#d97706' : '#16a34a'}}>{t.status === 'debt' ? 'Долг' : t.status === 'unpaid' ? 'Не оплачен' : 'Оплачен'}</span>
                        </td>
                        <td style={{padding:'10px 10px',textAlign:'center',fontWeight:700,color: t.type === 'income' ? '#16a34a' : '#dc2626'}}>{t.type === 'income' ? '+' : ''}{(t.amount || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:'12px 0',borderTop:'1px solid #eee',marginTop:'12px',display:'flex',alignItems:'baseline',gap:'6px',fontWeight:800,fontSize:'15px'}}>
              <span>Итого:</span>
              <span>+{registerReceipts.filter(t => t.status !== 'debt').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0).toLocaleString()} ₽</span>
            </div>
            <div className="modal-actions">
              <button className="btn btn-account-select" onClick={() => setRegisterReceipts([])}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Закрытие смены */}
      {showCloseShift && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowCloseShift(false); }}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <button className="modal-close" onClick={() => setShowCloseShift(false)}>&times;</button>
            <h2>Закрытие смены</h2>
            <div className="sub" style={{marginBottom:'12px'}}>Проверьте баланс перед закрытием</div>
            
            <div style={{background:'#f9f9f9',borderRadius:'10px',padding:'12px',fontSize:'13px',lineHeight:1.8,marginBottom:'12px'}}>
              <div style={{display:'flex'}}>
                <span style={{flex:1}}>Начальный остаток</span>
                <span>{(parseFloat(activeShift.opening_balance) || 0).toLocaleString()} ₽</span>
              </div>
              <div style={{borderTop:'1px solid #eee',margin:'4px 0'}}></div>
              {(() => {
                const byAc = {};
                shiftTx.filter(t => t.type === 'income' && t.status !== 'debt').forEach(t => {
                  const key = t.account_id || 'unknown';
                  byAc[key] = (byAc[key] || 0) + (parseFloat(t.amount) || 0);
                });
                const acMap = {};
                accounts.forEach(a => { acMap[a.id] = a.name; });
                return Object.entries(byAc).map(([acId, amt]) => (
                  <div key={acId} style={{display:'flex',padding:'2px 0'}}>
                    <span style={{flex:1}}>{acMap[acId] || 'Без счёта'}</span>
                    <span>+{amt.toLocaleString()} ₽</span>
                  </div>
                ));
              })()}
              <div style={{borderTop:'1px solid #eee',margin:'4px 0'}}></div>
              <div style={{display:'flex',fontWeight:800}}>
                <span style={{flex:1}}>Расчётный остаток</span>
                <span>{( (parseFloat(activeShift.opening_balance)||0) + shiftTx.filter(t => t.type === 'income' && t.status !== 'debt').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) ).toLocaleString()} ₽</span>
              </div>
            </div>

            <div className="form-group">
              <label>Фактический остаток в кассе (₽)</label>
              <input type="number" min="0" step="0.01" placeholder="0" value={closeFactBal} onChange={e => setCloseFactBal(e.target.value)} autoFocus />
            </div>
            {closeFactBal && (() => {
              const calcBal = (parseFloat(activeShift.opening_balance)||0) + shiftTx.filter(t => t.type === 'income' && t.status !== 'debt').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
              const fact = parseFloat(closeFactBal) || 0;
              const diff = fact - calcBal;
              if (Math.abs(diff) < 0.01) {
                return <div style={{textAlign:'center',padding:'6px',background:'#f0fdf4',borderRadius:'8px',color:'#16a34a',fontWeight:600,fontSize:'13px',marginBottom:'8px'}}>✅ Касса сходится</div>;
              } else {
                return <div style={{textAlign:'center',padding:'6px',background:'#fef2f2',borderRadius:'8px',color:'#dc2626',fontWeight:600,fontSize:'13px',marginBottom:'8px'}}>⚠️ Расхождение: {diff > 0 ? 'излишек' : 'недостача'} {Math.abs(diff).toLocaleString()} ₽</div>;
              }
            })()}

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowCloseShift(false)}>Отмена</button>
              <button type="button" className="btn btn-account-select" style={{background:'#dc2626',color:'#fff'}} onClick={async () => {
                const fact = parseFloat(closeFactBal);
                if (isNaN(fact)) return setToast('⚠️ Введите фактический остаток');
                const calcBal = (parseFloat(activeShift.opening_balance)||0) + shiftTx.filter(t => t.type === 'income' && t.status !== 'debt').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
                const { error } = await supabase.from('shifts').update({
                  closed_at: new Date().toISOString(),
                  closing_balance: fact,
                  status: 'closed',
                }).eq('id', activeShift.id);
                if (error) return setToast('' + error.message);
                setShowCloseShift(false); setCloseFactBal(''); setShiftTx([]);
                setActiveShift(null);
                setShowOpenShift(true);
                setOpenShiftCashier(userName);
                setOpenShiftBal('0');
                setToast('Смена закрыта' + (Math.abs(fact - calcBal) > 0.01 ? ' (расхождение ' + (fact - calcBal > 0 ? 'излишек' : 'недостача') + ' ' + Math.abs(fact - calcBal).toLocaleString() + ' ₽)' : ''));
              }}>Закрыть смену</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка отложенных чеков — карусель */}
      {showHoldModal && heldReceipts.length > 0 && (function(){
        var cur = heldReceipts[heldIndex];
        if (!cur) return null;
        return (
          <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active'){setShowHoldModal(false)}}}>
            <div className="modal-box" style={{maxWidth:'460px',maxHeight:'85vh',display:'flex',flexDirection:'column',gap:'14px'}}>
              <button className="modal-close" onClick={function(){setShowHoldModal(false)}}>&times;</button>
              
              {/* Шапка */}
              <div style={{marginBottom:'2px'}}>
                <span style={{fontSize:'1.2rem',fontWeight:700,letterSpacing:'-.02em'}}>Чек #{cur.id?.toString().slice(-3) || '—'}</span>
                {cur.clientName ? (
                  <div className="sub" style={{marginBottom:0,fontSize:'.8rem',color:'var(--muted)'}}>
                    {cur.clientName} | {cur.items?.length || 0} товаров | {Number(cur.total||0).toLocaleString()} ₽
                  </div>
                ) : null}
              </div>

              {/* Серая плашка с товарами */}
              <div style={{background:'#f9f9f9',borderRadius:'12px',padding:'14px',fontSize:'13px',lineHeight:2,flex:1,overflowY:'auto'}}>
                {/* Заголовки */}
                <div style={{display:'flex',fontSize:'10px',fontWeight:600,color:'#aaa',padding:'2px 0 4px',borderBottom:'1px solid #e8e8e8',marginBottom:'2px'}}>
                  <span style={{flex:1}}>Товар</span>
                  <span style={{width:'50px',textAlign:'center'}}>Кол-во</span>
                  <span style={{width:'60px',textAlign:'right'}}>Цена</span>
                  <span style={{width:'80px',textAlign:'right'}}>Сумма</span>
                </div>
                {(cur.items||[]).map(function(item,i){
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'4px'}}>
                      <span style={{flex:1,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</span>
                      <span style={{width:'50px',textAlign:'center',color:'#888',fontSize:'12px'}}>{item.qty}</span>
                      <span style={{width:'60px',textAlign:'right',color:'#888',fontSize:'12px'}}>{Number(item.price).toLocaleString()}</span>
                      <span style={{width:'80px',textAlign:'right',fontWeight:600}}>{Number(item.price*item.qty).toLocaleString()} ₽</span>
                    </div>
                  );
                })}
                <div style={{borderTop:'1px solid #e8e8e8',margin:'4px 0'}}></div>
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:'14px',padding:'2px 0'}}>
                  <span>Итого</span>
                  <span>{Number(cur.total||0).toLocaleString()} ₽</span>
                </div>
              </div>

              {/* Кнопки */}
              <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                <button type="button" onClick={function(){
                  var newList = heldReceipts.filter(function(_,i){return i!==heldIndex;});
                  setHeldReceipts(newList);
                  if (heldIndex >= newList.length) setHeldIndex(Math.max(0, newList.length-1));
                  if (newList.length === 0) setShowHoldModal(false);
                  setToast('Чек удалён');
                }} style={{flex:1,padding:'10px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#888',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>✕ Удалить</button>
                <button type="button" onClick={function(){
                  setCart(cur.items || []);
                  setSelectedClient(cur.client || '');
                  setClientSearch(cur.clientName || '');
                  var newList = heldReceipts.filter(function(_,i){return i!==heldIndex;});
                  setHeldReceipts(newList);
                  setShowHoldModal(false);
                }} style={{flex:1,padding:'10px',borderRadius:'10px',border:'none',background:'#111',color:'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>→ Продолжить</button>
              </div>

              {/* Точки */}
              <div style={{display:'flex',gap:'5px',justifyContent:'center',alignItems:'center',marginTop:'10px'}}>
                {heldReceipts.map(function(_,i){return <span key={i} style={{height:'4px',borderRadius:'100px',background:i===heldIndex?'#111':'#ddd',width:i===heldIndex?'20px':'6px',transition:'.3s'}}></span>;})}
              </div>

              {/* Навигация */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px',paddingTop:'10px',marginTop:'8px',borderTop:'1px solid #f0f0f0',fontSize:'11px',color:'#999'}}>
                <span onClick={function(){if(heldIndex>0)setHeldIndex(heldIndex-1)}} style={{fontSize:'18px',color:heldIndex>0?'#111':'#bbb',cursor:heldIndex>0?'pointer':'default',userSelect:'none',lineHeight:1}}>←</span>
                <span>Чек {heldIndex+1} из {heldReceipts.length}</span>
                <span onClick={function(){if(heldIndex<heldReceipts.length-1)setHeldIndex(heldIndex+1)}} style={{fontSize:'18px',color:heldIndex<heldReceipts.length-1?'#111':'#bbb',cursor:heldIndex<heldReceipts.length-1?'pointer':'default',userSelect:'none',lineHeight:1}}>→</span>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}