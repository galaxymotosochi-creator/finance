import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import useOptimisticSync from '../hooks/useOptimisticSync';
import QuaggaInit from 'quagga';
import { getCurrencySymbol } from '../lib/currency';
import { tzToday } from '../lib/dates';
import CenterSpinner from '../components/CenterSpinner';


export default function Registers({ fullscreen }) {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allCats, setAllCats] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [cart, setCart] = useState(function(){try{var c=JSON.parse(localStorage.getItem('kassa_cart')||'[]');return Array.isArray(c)?c.map(function(x){if(!x.type)x.type='product';return x;}):[]}catch(e){return []}});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [payMode, setPayMode] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  // Лояльность: программы, автоскидка, списание баллов
  const [loyaltyPrograms, setLoyaltyPrograms] = useState([]);
  const [loyaltyPct, setLoyaltyPct] = useState(0);
  const [loyaltyPointsSpend, setLoyaltyPointsSpend] = useState(0);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientBirthday, setNewClientBirthday] = useState('');
  const [newClientNote1, setNewClientNote1] = useState('');
  const [newClientNote2, setNewClientNote2] = useState('');
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
  const [processingPay, setProcessingPay] = useState(false);
  const [refundToday, setRefundToday] = useState([]); // возвраты наличными за сегодня (по закрытым чекам)
  const showToast = (msg) => { setToast(msg); };

  // Возвраты наличными, оформленные сегодня по чекам из ЗАКРЫТЫХ смен:
  // деньги отданы из текущего ящика — показываем при закрытии смены и учитываем в остатке
  const loadRefundToday = async () => {
    try {
      const cashAc = accounts.find(a => a.type === 'cash_register');
      if (!cashAc) { setRefundToday([]); return; }
      const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).eq('account_id', cashAc.id).order('created_at', { ascending: false });
      const today = tzToday();
      const list = (data || []).filter(t => t && (t.kind === 'refund' || (t.description || '').startsWith('Возврат по чеку')) && String(t.date || '').split('T')[0] === today);
      const items = [];
      for (const t of list) {
        const m = (t.description || '').match(/Возврат по чеку №\s*(\d+)/);
        let date = null;
        if (m) {
          const { data: rc } = await supabase.from('receipts').select('date').eq('user_id', user.id).eq('receipt_number', parseInt(m[1])).maybeSingle();
          if (rc) date = rc.date;
        }
        items.push({
          receipt_number: m ? m[1] : '—',
          date: date || null,
          amount: Number(t.amount) || 0,
          reason: (t.description || '').replace(/^Возврат по чеку №\s*\d+\s*[—-]?\s*/, ''),
        });
      }
      setRefundToday(items);
    } catch (e) { setRefundToday([]); }
  };
  const refundSum = (refundToday || []).reduce((s2, rf) => s2 + (Number(rf.amount) || 0), 0);
  const [showActions, setShowActions] = useState(false);
  const [editingCashier, setEditingCashier] = useState(false);
  const [displayCashierName, setDisplayCashierName] = useState('');
  const [transferEmpId, setTransferEmpId] = useState('');
  const [transferBalance, setTransferBalance] = useState('');
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closeFactBal, setCloseFactBal] = useState('');
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [shiftTx, setShiftTx] = useState([]);
  const [registerReceipts, setRegisterReceipts] = useState([]);
  const [receiptComment, setReceiptComment] = useState('');
  const [heldReceipts, setHeldReceipts] = useState([]);
  const [heldActiveId, setHeldActiveId] = useState(null); // какой отложенный чек сейчас в корзине («взят в работу»)
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [heldIndex, setHeldIndex] = useState(0);
  const [promos, setPromos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [avgCostMap, setAvgCostMap] = useState({}); // средняя себестоимость: prodId -> цена за шт
  const [isWide, setIsWide] = useState(window.innerWidth > 700);
  const [receiptDiscountPercent, setReceiptDiscountPercent] = useState(0);
  const [receiptDiscountFixed, setReceiptDiscountFixed] = useState(0);
  const [discountDropdownOpen, setDiscountDropdownOpen] = useState(false);
  const [shiftReceipts, setShiftReceipts] = useState([]);
  const [accTxList, setAccTxList] = useState([]); // транзакции по счетам — для показа реальных балансов в кассе
  const [receiptDropdownOpen, setReceiptDropdownOpen] = useState(false);
  const [activeReceiptId, setActiveReceiptId] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [currentReceiptNum, setCurrentReceiptNum] = useState(null);
  const [pinLocked, setPinLocked] = useState(true);
  // Подтверждение скидки ниже минимальной цены (пин руководителя — мастер-пин)
  const [minPriceConfirm, setMinPriceConfirm] = useState(false);
  const [minPricePin, setMinPricePin] = useState('');
  const [minPriceError, setMinPriceError] = useState(false);
  const minPriceApprovedRef = useRef(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);
  const PIN_MASTER = '8888';

  const abbreviateName = (name) => {
    if (!name) return name;
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const surname = parts[0];
    const initials = parts.slice(1).map(p => p.charAt(0) + '.').join(' ');
    return surname + ' ' + initials;
  };

  // Реальный баланс счёта: начальный остаток + все движения (доходы минус расходы)
  const accBal = (a) => {
    if (!a) return 0;
    var b = parseFloat(a.balance) || 0;
    (accTxList || []).forEach(t => { if (t.account_id === a.id) b += Number(t.amount || 0) * (t.type === 'income' ? 1 : -1); });
    return b;
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
  // Касса — полноэкранный инструмент: жёстко блокируем прокрутку страницы
  // (скролл возможен только внутри колонок каталога и чека)
  useEffect(() => {
    const prevB = document.body.style.overflow;
    const prevH = document.documentElement.style.overflow;
    const prevO = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = prevB;
      document.documentElement.style.overflow = prevH;
      document.body.style.overscrollBehavior = prevO;
      document.documentElement.style.overscrollBehavior = '';
    };
  }, []);

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

  // Оптимистичная синхронизация: офлайн-чеки фиксируются в реестре — появятся в разделе «Чеки» сразу
  useOptimisticSync({ table: 'receipts', onSynced: () => {} });
  // Офлайн-клиенты, созданные в кассе, тоже фиксируются в реестре
  useOptimisticSync({ table: 'clients', onSynced: () => {} });

  // После синхронизации офлайн-очереди — обновляем смену, чеки смены, клиентов и остатки
  useEffect(() => {
    if (!user) return;
    const onSync = async () => {
      try {
        const [sRes, clRes] = await Promise.all([
          supabase.from('shifts').select('*').eq('user_id', user.id).eq('status', 'open').maybeSingle(),
          supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
        ]);
        if (sRes && sRes.data) {
          setActiveShift(sRes.data);
          const { data: sr } = await supabase.from('receipts').select('*').eq('user_id', user.id).eq('shift_id', sRes.data.id);
          setShiftReceipts(sr || []);
        }
        if (clRes && clRes.data) setClients(clRes.data);
        recalcStockMap();
      } catch (e) { /* не критично */ }
    };
    window.addEventListener('atlaspos:synced', onSync);
    return () => window.removeEventListener('atlaspos:synced', onSync);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [pRes, cRes, sRes, aRes, clRes, proRes, empRes, loyRes, txRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('stock_categories').select('*').eq('user_id', user.id).order('name'),
        supabase.from('shifts').select('*').eq('user_id', user.id).eq('status', 'open').maybeSingle(),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
        supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
        supabase.from('promos').select('*').eq('user_id', user.id),
        supabase.from('employees').select('id, name, pin, permissions').eq('user_id', user.id).order('name'),
        supabase.from('loyalty_programs').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('account_id,type,amount').eq('user_id', user.id),
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (cRes.data) { setCategories(cRes.data.filter(c => c.type === 'product')); setAllCats(cRes.data); }
      if (aRes.data) setAccounts(aRes.data);
      if (clRes && clRes.data) setClients(clRes.data);
      if (proRes?.data) setPromos(proRes.data);
      if (empRes?.data) setEmployees(empRes.data);
      if (loyRes && !loyRes.error && loyRes.data) setLoyaltyPrograms(loyRes.data);
      if (txRes && txRes.data) setAccTxList(txRes.data);
      if (sRes.data) {
        setActiveShift(sRes.data);
        // Загружаем чеки открытой смены (для баланса кассы и закрытия)
        const { data: sr } = await supabase.from('receipts').select('*').eq('user_id', user.id).eq('shift_id', sRes.data.id);
        setShiftReceipts(sr || []);
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
      recalcStockMap();
      // Средняя себестоимость (для списаний при продаже): сумма закупок / количество
      Promise.all([
        supabase.from('supplies').select('items').eq('user_id', user.id),
        supabase.from('initial_stocks').select('*').eq('user_id', user.id).maybeSingle(),
      ]).then(function(rr){
        var cm = {};
        (rr[0].data||[]).forEach(function(sp){ (sp.items||[]).forEach(function(it){
          if (it.prodId) {
            if (!cm[it.prodId]) cm[it.prodId] = { qty: 0, cost: 0 };
            cm[it.prodId].qty += it.qty || 0;
            cm[it.prodId].cost += (it.cost || 0) * (it.qty || 0);
          }
        });});
        var init = rr[1].data;
        if (init && init.done && init.items) {
          Object.keys(init.items).forEach(function(id){
            var q = parseInt(init.items[id]) || 0;
            var c = (init.costs && parseInt(init.costs[id])) || 0;
            if (q > 0) {
              if (!cm[id]) cm[id] = { qty: 0, cost: 0 };
              cm[id].qty += q;
              cm[id].cost += c * q;
            }
          });
        }
        var avg = {};
        Object.keys(cm).forEach(function(id){ avg[id] = cm[id].qty > 0 ? Math.round(cm[id].cost / cm[id].qty) : 0; });
        setAvgCostMap(avg);
      });
      // Загружаем последний номер чека
      var { data: lastRx } = await supabase.from('receipts').select('receipt_number').eq('user_id', user.id).order('receipt_number', { ascending: false }).limit(1).maybeSingle();
      if (lastRx && lastRx.receipt_number) {
        setCurrentReceiptNum(Number(lastRx.receipt_number) + 1);
      } else {
        setCurrentReceiptNum(1);
      }
      setLoading(false);
    })();
  }, [user]);

  // Отслеживание ширины экрана для адаптивной вёрстки
  useEffect(function(){
    var handler = function(){ setIsWide(window.innerWidth > 900); };
    window.addEventListener('resize', handler);
    return function(){ window.removeEventListener('resize', handler); };
  }, []);

  // Закрытие дропдаунов по клику вне
  useEffect(function(){
    var handler = function(e){ if (!e.target.closest('.receipt-dropdown-wrap')) setReceiptDropdownOpen(false); if (!e.target.closest('.kassa-disc')) setDiscountDropdownOpen(false); };
    document.addEventListener('click', handler);
    return function(){ document.removeEventListener('click', handler); };
  }, []);

  // Проверка пин-кода: мастер-пин владельца (8888) или личный пин сотрудника
  useEffect(function(){
    if (pinValue.length === 4) {
      if (pinValue === PIN_MASTER) {
        setPinLocked(false);
        setPinValue('');
        setDisplayCashierName('');
      } else {
        // Ищем сотрудника с таким пином (у каждого сотрудника свой пин)
        const emp = (employees || []).find(function(e){ return e.pin && String(e.pin) === pinValue; });
        if (emp) {
          setPinLocked(false);
          setPinValue('');
          setOpenShiftCashier(emp.name); // при открытии смены кассир = вошедший сотрудник
          setDisplayCashierName(emp.name);
          // Если смена уже открыта — делаем вошедшего текущим кассиром
          if (activeShift) {
            const changes = activeShift.cashier_changes || [];
            changes.push({ from: activeShift.current_cashier_name || activeShift.cashier_name || userName, to: emp.name, balance: 0, timestamp: new Date().toISOString() });
            supabase.from('shifts').update({ current_cashier_name: emp.name, cashier_changes: changes }).eq('id', activeShift.id).eq('user_id', user.id).then();
            setActiveShift({ ...activeShift, current_cashier_name: emp.name, cashier_changes: changes });
          }
        } else {
          setPinError(true);
          var t = setTimeout(function(){ setPinValue(''); }, 800);
          return function(){ clearTimeout(t); };
        }
      }
    }
  }, [pinValue]);

  // Сохраняем корзину в localStorage при изменениях
  useEffect(function(){ try { localStorage.setItem('kassa_cart', JSON.stringify(cart)); } catch(e){} }, [cart]);

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
    const today = tzToday();
    // Активные акции (даты в БД — timestamptz, берём только дату)
    const active = promos.filter(p => {
      const sd = String(p.start_date || '').slice(0, 10);
      const ed = String(p.end_date || '').slice(0, 10);
      return !(sd > today || ed < today);
    });
    // Приоритет: конкретный товар → категория → все позиции
    const specific = active.find(p => {
      const cond = p.conditions || {};
      if (cond.type === 'specific_products' || cond.type === 'specific_services') {
        return cond.productIds && cond.productIds.includes(product.id);
      }
      return false;
    });
    if (specific) return specific;
    const byCat = active.find(p => {
      const cond = p.conditions || {};
      if (cond.type === 'category_products') {
        const cn = allCats.find(c => c.id === parseInt(cond.catId))?.name;
        return product.type !== 'service' && cn && cn === product.cat;
      }
      if (cond.type === 'category_services') {
        const cn = allCats.find(c => c.id === parseInt(cond.catId))?.name;
        return product.type === 'service' && cn && cn === product.cat;
      }
      return false;
    });
    if (byCat) return byCat;
    return active.find(p => {
      const cond = p.conditions || {};
      return !cond.type || cond.type === 'all';
    }) || null;
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
      return [...prev, { id: p.id, name: p.name, price: origPrice, qty: 1, cat: p.cat || '', free_price: p.free_price || false, final_price: finalPrice, promo_id: promo?.id || null, employee_id: null, sp: [], discount_percent: discountPct, type: p.type, min_price: p.min_price || 0, ...comboData }];
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

  // ===== Исполнители/продавцы с долями (несколько на позицию) =====
  const [pickEmpFor, setPickEmpFor] = useState(null); // item.id — для кого открыт выбор
  const spSum = (item) => (item.sp || []).reduce((s2, x) => s2 + (parseFloat(x.amt) || 0), 0);
  const itemTotalPrice = (item) => ((item.final_price || item.price || 0)) * item.qty;
  const addSplit = (itemId, emp) => {
    setCart(prev => prev.map(x => x.id === itemId && !(x.sp || []).some(y => y.empId === emp.id)
      ? { ...x, sp: [...(x.sp || []), { empId: emp.id, name: emp.name, amt: '' }], employee_id: (x.sp || []).length === 0 ? emp.id : x.employee_id }
      : x));
  };
  const setSplitAmt = (itemId, empId, v) => {
    setCart(prev => prev.map(x => x.id === itemId ? { ...x, sp: (x.sp || []).map(y => y.empId === empId ? { ...y, amt: v } : y) } : x));
  };
  const delSplit = (itemId, empId) => {
    setCart(prev => prev.map(x => {
      if (x.id !== itemId) return x;
      const sp = (x.sp || []).filter(y => y.empId !== empId);
      return { ...x, sp, employee_id: sp.length ? sp[0].empId : null };
    }));
  };
  const spOver = (item) => spSum(item) > itemTotalPrice(item) + 0.01;
  const empShort = (name) => { if (!name) return ''; const parts = name.trim().split(/\s+/); return parts.length > 1 ? parts[0] + ' ' + parts.slice(1).map(pp => pp[0] + '.').join(' ') : name; };

  const total = cart.reduce((s, i) => s + (i.final_price || i.price || 0) * i.qty, 0);
  const totalOriginal = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const discountTotal = totalOriginal - total;
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const receiptDiscountAmount = receiptDiscountPercent > 0 ? Math.round(total * receiptDiscountPercent / 100) : (receiptDiscountFixed > 0 ? receiptDiscountFixed : 0);
  // Лояльность: скидка по программе (постоянная/накопительная/ДР) + скидка баллами (1 балл = 1 {cur})
  const loyaltyDiscountAmount = loyaltyPct > 0 ? Math.round(total * loyaltyPct / 100) : 0;
  const loyaltyPointsAmount = Math.min(loyaltyPointsSpend, Math.max(0, total - receiptDiscountAmount - loyaltyDiscountAmount));
  const finalTotal = Math.max(0, total - receiptDiscountAmount - loyaltyDiscountAmount - loyaltyPointsAmount);

  // Пересчёт остатков склада из supplies (items) и writeoffs (product_id/quantity)
  const recalcStockMap = function(){
    Promise.all([
      supabase.from('supplies').select('items').eq('user_id', user.id),
      supabase.from('writeoffs').select('product_id,quantity').eq('user_id', user.id),
    ]).then(function(rr){
      var sm = {};
      // Приходы: items — массив {prodId, qty}
      (rr[0].data||[]).forEach(function(sp){ (sp.items||[]).forEach(function(it){
        if (it.prodId) {
          if (!sm[it.prodId]) sm[it.prodId] = 0;
          sm[it.prodId] += it.qty || 0;
        }
      });});
      // Списания: каждая строка — {product_id, quantity}
      (rr[1].data||[]).forEach(function(wo){
        var pid = wo.product_id;
        if (pid != null) {
          if (!sm[pid]) sm[pid] = 0;
          sm[pid] -= wo.quantity || 0;
        }
      });
      setStockMap(sm);
    });
  };

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
    const date = tzToday();

    // Проверки до создания чека (клиент обязателен только для продажи в долг)
    if (!selectedClient && payUnpaid) { setProcessingPay(false); return setToast('⚠️ Для продажи в долг выберите клиента'); }
    if (!payUnpaid && !payMode) { setProcessingPay(false); return setToast('⚠️ Выберите способ оплаты'); }
    // Доли исполнителей не могут превышать стоимость позиций
    const overItem = cart.find(function(x){ return spSum(x) > itemTotalPrice(x) + 0.01; });
    if (overItem) { setProcessingPay(false); return setToast('⚠️ «' + overItem.name + '»: сумма исполнителям больше стоимости — уменьшите доли'); }

    // Минимальная цена: итог чека ниже суммы минимальных цен позиций — нужно подтверждение руководителя
    const sumMinPrice = cart.reduce((s, i) => s + ((Number(i.min_price) || 0) * (i.qty || 1)), 0);
    if (!minPriceApprovedRef.current && sumMinPrice > 0 && finalTotal < sumMinPrice) {
      setMinPriceConfirm(true);
      setProcessingPay(false);
      return;
    }

    // Определяем статус чека
    var receiptStatus = 'paid';
    if (payUnpaid) receiptStatus = 'unpaid';
    else if (payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) < total) receiptStatus = 'partially_paid';

    // Разбивка оплаты по счетам (для агрегации «Кассовая смена» при закрытии)
    var payments = [];
    if (paySplit) {
      const entries = Object.entries(splitAmts).filter(([, v]) => v && parseFloat(v) > 0);
      if (entries.length === 0) { setProcessingPay(false); return setToast('⚠️ Укажите суммы для оплаты'); }
      const sum = entries.reduce((s, [, v]) => s + parseFloat(v), 0);
      if (Math.abs(sum - total) > 0.01) { setProcessingPay(false); return setToast('⚠️ Сумма оплаты не совпадает с итогом'); }
      entries.forEach(([acId, amt]) => payments.push({ account_id: acId, amount: parseFloat(amt) }));
    } else if (!payUnpaid) {
      const selAc = accounts.find(a => a.id === payMode);
      var tgt = selAc;
      if (selAc && selAc.type === 'cash') tgt = accounts.find(a => a.type === 'cash_register') || selAc;
      const paidAmt = payAmount ? parseFloat(payAmount) : total;
      if (paidAmt > 0) payments.push({ account_id: tgt?.id || null, amount: Math.min(paidAmt, total) });
    }

    // Баллы лояльности: начисление за оплату (1 {cur} = 1 балл) и списание как скидка — считаем до создания чека
    const bonusProgPay = (loyaltyPrograms || []).find(p => p.type === 'bonus');
    const paidSumPay = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const earnedPoints = (bonusProgPay && selectedClient && receiptStatus !== 'unpaid') ? Math.round(paidSumPay) : 0;
    const spentPoints = (bonusProgPay && selectedClient && receiptStatus !== 'unpaid') ? loyaltyPointsAmount : 0;

    // Номер чека
    const { data: maxReceipt } = await supabase.from('receipts').select('receipt_number').eq('user_id', user.id).order('receipt_number', { ascending: false }).limit(1).maybeSingle();
    let receiptNum = (maxReceipt?.receipt_number || 0) + 1;

    // Создаём чек
    var receiptId = null;
    // Локальный id — при офлайне чек и его позиции уходят в очередь вместе и привяжутся друг к другу
    var localReceiptId = Date.now();
    var clientObj = clients.find(c => c.id === selectedClient);
    // Формируем список товаров для items_json
    var receiptItemsNames = cart.map(function(item){
      return {name: item.name, qty: item.qty};
    });
    var { data: newReceipt, error: receiptErr } = await supabase.from('receipts').insert({
      id: localReceiptId, user_id: user.id, receipt_number: receiptNum,
      date, total_amount: finalTotal, comment: receiptComment.trim() || null,
      discount_sum: cart.reduce((s, i) => s + (((i.price || 0) - (i.final_price || i.price || 0)) * i.qty), 0) + (receiptDiscountAmount || 0) + (loyaltyDiscountAmount || 0) + (loyaltyPointsAmount || 0),
      status: receiptStatus,
      paid_amount: receiptStatus === 'paid' ? finalTotal : (receiptStatus === 'partially_paid' ? Math.min(parseFloat(payAmount)||0, finalTotal) : 0),
      payments,
      // Баллы лояльности: начислено за оплату и списано как скидка (видно в разделе «Чеки»)
      points_earned: earnedPoints,
      points_spent: spentPoints,
      client_id: selectedClient || null,
      client_name: clientObj?.name || '',
      shift_id: activeShift?.id || null,
      cashier_name: activeShift?.current_cashier_name || activeShift?.cashier_name || userName || '',
      source: 'register',
      items_json: receiptItemsNames,
    }).select('id').single();
    if (receiptErr || !newReceipt) {
      // Таблица receipts может ещё не существовать — продолжаем без чеков
      showToast('Не удалось создать чек: ' + (receiptErr?.message || ''), 'error');
      setProcessingPay(false);
      return;
    } else {
      if (newReceipt.queued) {
        // Офлайн: чек ушёл в очередь — используем локальный id и номер (сервер назначит настоящие при синхронизации)
        receiptId = localReceiptId;
      } else {
        receiptId = newReceipt.id;
        // Реальный номер от сервера (атомарный MAX+1) — чтобы транзакции/списания совпадали с чеком
        receiptNum = newReceipt.receipt_number;
      }
      // Сохраняем товары чека
      var receiptItems = [];
      cart.forEach(function(item) {
        var entry = {
          receipt_id: receiptId,
          product_id: item.id || null, // иначе сервер не может защитить товар от удаления (в чеках product_id всегда NULL)
          product_name: item.name, quantity: item.qty,
          price: (item.price || 0), total: (item.final_price || item.price || 0) * item.qty,
          discount_percent: item.discount_percent || 0,
          discount_amount: (((item.price || 0) - (item.final_price || item.price || 0)) * item.qty),
          promo_id: item.promo_id || null, employee_id: item.employee_id || null,
          employee_splits: (item.sp || []).map(function(spd){ return { employee_id: spd.empId, name: spd.name, amount: parseFloat(spd.amt) || 0 }; }),
        };
        if (item.combo_items && item.combo_items.length > 0) {
          entry.combo_items = item.combo_items.map(function(ci) { return { name: ci.name, qty: ci.qty * item.qty, price: ci.price }; });
        }
        receiptItems.push(entry);
      });
      var { error: itemsErr } = await supabase.from('receipt_items').insert(receiptItems);
      if (itemsErr) showToast('Не удалось сохранить товары чека: ' + itemsErr.message, 'error');
    }

    // Долг клиента (отрицательное число = должен)
    if (selectedClient) {
      const client = clients.find(c => c.id === selectedClient);
      const curDebt = parseFloat(client?.debt) || 0;
      if (payUnpaid) {
        await supabase.from('clients').update({debt: curDebt - total}).eq('id', selectedClient);
      } else {
        const paidAmt = payAmount ? parseFloat(payAmount) : total;
        if (paidAmt > 0 && paidAmt < total) {
          await supabase.from('clients').update({debt: curDebt - (total - paidAmt)}).eq('id', selectedClient);
        }
      }
      // Лояльность: начисление баллов за оплату (1 {cur} = 1 балл) и списание использованных баллов
      if (earnedPoints > 0 || spentPoints > 0) {
        const cur = Number(client?.points) || 0;
        await supabase.from('clients').update({ points: Math.max(0, cur + earnedPoints - spentPoints) }).eq('id', selectedClient);
      }
    }
    
    setRegisterReceipts(prev => [...prev, { amount: total, description: 'Продажа по чеку № ' + receiptNum, created_at: new Date().toISOString(), status: receiptStatus, type:'income' }]);
    setCart([]); setShowPay(false); setPayMode(null); setLoyaltyPct(0); setLoyaltyPointsSpend(0); setHeldActiveId(null);
    minPriceApprovedRef.current = false;
    setProcessingPay(false);
    const msg = receiptStatus === 'paid'
      ? 'Чек № ' + receiptNum + ' — ' + total.toLocaleString() + ' ₽'
      : (receiptStatus === 'partially_paid'
        ? 'Чек № ' + receiptNum + ' — оплачено ' + (payAmount ? parseFloat(payAmount).toLocaleString() : '0') + ' ₽, долг ' + (total - (payAmount ? parseFloat(payAmount) : 0)).toLocaleString() + ' ₽'
        : 'Чек № ' + receiptNum + ' сохранён (не оплачен)');
    setToast(msg);
    
    // Уменьшаем остатки на складе
      try {
        var woProducts = {};
        cart.forEach(function(item){
          if (item.combo_items && item.combo_items.length > 0) {
            item.combo_items.forEach(function(ci){
              var prod = products.find(function(p){ return p.id === ci.id; });
              if (prod && prod.type !== 'service') {
                if (!woProducts[ci.id]) woProducts[ci.id] = 0;
                woProducts[ci.id] += ci.qty * item.qty;
              }
            });
          } else if (item.type !== 'service') {
            if (!woProducts[item.id]) woProducts[item.id] = 0;
            woProducts[item.id] += item.qty;
          }
        });
        // Вставляем отдельную строку для каждого товара
        var woInserts = Object.keys(woProducts).map(function(prodId, i){
          return {
            id: Date.now() + i,
            user_id: user.id,
            product_id: parseInt(prodId),
            quantity: woProducts[prodId],
            cost: avgCostMap[prodId] || 0, // средняя себестоимость за шт
            reason: 'Продажа по чеку № ' + receiptNum,
            date: date,
          };
        });
        if (woInserts.length > 0) {
          await supabase.from('writeoffs').insert(woInserts);
        }
      } catch(e) { console.error('Ошибка списания со склада:', e); }
      // Обновляем stockMap после списания пересчётом из БД
      recalcStockMap();
    setReceiptComment('');
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

  // Лояльность: применяем скидку при выборе клиента
  // Приоритет: «Без скидки» → назначенная вручную программа → авто (ДР, накопительная)
  const applyLoyalty = async (clientId) => {
    setLoyaltyPct(0); setLoyaltyPointsSpend(0);
    if (!clientId) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const progs = loyaltyPrograms || [];
    const mode = client.loyalty_mode || 'auto';
    // 1) Клиент исключён из скидок
    if (mode === 'none') return;
    // 2) Назначенная вручную программа — применяем её скидку сразу
    if (mode !== 'auto') {
      const assigned = progs.find(p => String(p.id) === String(mode));
      if (assigned) { setLoyaltyPct(parseFloat(assigned.discount) || 0); return; }
    }
    // 3) Авто: ДР-скидка (в день рождения клиента)
    const now = new Date();
    const todayMD = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const isBday = String(client.birthday || '').slice(5, 10) === todayMD;
    const birthdayProg = progs.find(p => p.type === 'birthday');
    if (isBday && birthdayProg) { setLoyaltyPct(parseFloat(birthdayProg.discount) || 0); return; }
    // 4) Авто: накопительная (если сумма покупок клиента достигла порога)
    const accum = progs.find(p => p.type === 'accumulative');
    if (accum && parseFloat(accum.condition) > 0) {
      try {
        const { data: recs } = await supabase.from('receipts').select('total_amount').eq('user_id', user.id).eq('client_id', clientId);
        const clientTotal = (recs || []).reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
        if (clientTotal >= parseFloat(accum.condition)) { setLoyaltyPct(parseFloat(accum.discount) || 0); return; }
      } catch (e) {}
    }
    // Постоянной скидки больше нет — ничего не применяем
  };

  const openShift = async () => {
    const bal = parseFloat(openShiftBal) || 0;
    const { data, error } = await supabase.from('shifts').insert({
      user_id: user.id, opening_balance: bal, status: 'open', cashier_name: openShiftCashier.trim() || userName,
      // opened_at обязателен — иначе дата открытия не сохраняется (в БД будет NULL, в разделе «Смены» — 01.01.1970)
      opened_at: new Date().toISOString(),
    }).select().single();
    if (error) return setToast('Ошибка: ' + error.message);
    if (data) setActiveShift(data);
    setShowOpenShift(false);
  };

  // Сканер штрихкода (камера)
  var scanBarcode = function(onResult){
  if (!navigator.mediaDevices) { setToast && setToast('Камера недоступна'); return; }
  var Quagga = QuaggaInit;
    // Сначала показываем экран загрузки
    var w=document.createElement('div');
    w.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center';
    var loadInner=document.createElement('div');
    loadInner.style.cssText='background:#fff;border-radius:16px;padding:36px 40px;text-align:center;box-shadow:0 8px 60px rgba(0,0,0,.15)';
    loadInner.style.cssText='background:#fff;border-radius:16px;padding:28px 40px;text-align:center;box-shadow:0 8px 60px rgba(0,0,0,.15)';
    loadInner.innerHTML='<div style="width:200px;height:4px;background:#eee;border-radius:2px;overflow:hidden;margin:0 auto"><div style="width:0%;height:100%;background:#222;border-radius:2px;animation:scanLoad 2s ease-in-out forwards"></div></div>';;
    w.appendChild(loadInner);
    // Создаём контейнер для видео (скрыт пока не загрузится)
    var v=document.createElement('div');v.id='qv';
    v.style.cssText='position:relative;width:100%;max-width:500px;overflow:hidden;border-radius:12px;background:#000;display:none';
    var f=document.createElement('div');
    f.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;width:320px;height:130px;border:2px solid rgba(255,255,255,.5);border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.4);pointer-events:none';
    var i=document.createElement('input');i.type='text';i.placeholder='';
    i.style.cssText='width:80%;max-width:360px;margin-top:16px;padding:12px 16px;border:none;border-radius:12px;font-size:16px;text-align:center;letter-spacing:4px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.2);outline:none;font-family:inherit';
    var c=document.createElement('div');c.textContent='✕';c.title='Закрыть';
    c.style.cssText='position:fixed;top:20px;right:20px;z-index:10000;width:36px;height:36px;background:rgba(0,0,0,.4);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;font-weight:700;line-height:1';
    var beep=function(){try{var ac=new AudioContext();var g=ac.createGain();g.connect(ac.destination);g.gain.value=.15;var o=ac.createOscillator();o.type='sine';o.frequency.value=1200;o.connect(g);o.start();setTimeout(function(){o.stop();ac.close()},100)}catch(e){}};
    v.appendChild(f);w.appendChild(v);document.body.appendChild(w);
    // CSS анимация
    if (!document.getElementById('scan-style')) {
      var ss=document.createElement('style');ss.id='scan-style';
      ss.textContent='@keyframes scanLoad{0%{width:0%}50%{width:65%}100%{width:100%}}.scanner-visible video{animation:scanFadeIn .3s ease}@keyframes scanFadeIn{from{opacity:0}to{opacity:1}}';
      document.head.appendChild(ss);
    }
    setTimeout(function(){var c=document.getElementById("qv");if(c){c.querySelectorAll("video").forEach(function(el){el.style.cssText="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0"});c.querySelectorAll("canvas").forEach(function(el){el.style.cssText="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0"})}},200);
document.body.appendChild(c);
    var q=null;var lock=false;
    var done=function(val){if(val&&!lock){lock=true;beep();if(onResult)onResult(val);setTimeout(function(){lock=false},3000)}cl()};
    var cl=function(){if(q){q.stop();q=null}w.remove();c.remove()};
    i.onkeydown=function(e){if(e.key==='Enter'&&i.value.trim()){done(i.value.trim())}};c.onclick=cl;
    Quagga.init({
      inputStream:{name:'Live',type:'LiveStream',target:v,targetSize:1,constraints:{width:640,height:480,facingMode:'environment'}},
      decoder:{readers:['ean_reader','ean_8_reader','code_128_reader','code_39_reader','upc_reader','upc_e_reader']},
      locate:true
    },function(err){if(err){setToast && setToast('Ошибка камеры');w.remove();c.remove();return}
      // Убираем загрузку, добавляем поле ввода, показываем видео
      loadInner.remove();
      w.appendChild(i);
      v.style.display='block';
      q=Quagga;Quagga.start();
      // Добавляем класс для анимации появления
      setTimeout(function(){v.classList.add('scanner-visible')}, 50);
      Quagga.onDetected(function(data){if(data&&data.codeResult&&data.codeResult.code){done(data.codeResult.code)}});
    });
};

if (loading) return <CenterSpinner />;

  return (
    <>
      <style>{`
        .receipt-qty-btn { opacity: 1; }
      `}</style>
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',overflow:'hidden',background:'#f5f5f7',padding:'12px 0 0',boxSizing:'border-box',fontFamily:'Inter,-apple-system,BlinkMacSystemFont,sans-serif'}}>
      {/* Экран блокировки */}
      {pinLocked && (
        <div style={{position:'absolute',inset:0,zIndex:1000,background:'#f5f5f7',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderRadius:'24px'}}>
          <div style={{background:'#fff',borderRadius:'24px',padding:'40px 36px',boxShadow:'0 8px 60px rgba(0,0,0,.08)',textAlign:'center',maxWidth:'340px',width:'100%'}}>
            <div style={{fontSize:'.95rem',fontWeight:700,marginBottom:'4px'}}>Касса заблокирована</div>
            <div style={{fontSize:'.80rem',color:'#777',marginBottom:'24px'}}>Введите пин-код для разблокировки</div>
            <div style={{display:'flex',gap:'10px',justifyContent:'center',marginBottom:'24px'}}>
              <div style={{width:'16px',height:'16px',borderRadius:'50%',background:pinValue.length>0?'#222':'#e0e0e0',transition:'0.15s'}}></div>
              <div style={{width:'16px',height:'16px',borderRadius:'50%',background:pinValue.length>1?'#222':'#e0e0e0',transition:'0.15s'}}></div>
              <div style={{width:'16px',height:'16px',borderRadius:'50%',background:pinValue.length>2?'#222':'#e0e0e0',transition:'0.15s'}}></div>
              <div style={{width:'16px',height:'16px',borderRadius:'50%',background:pinValue.length>3?'#222':'#e0e0e0',transition:'0.15s'}}></div>
            </div>
            {pinError && <div style={{fontSize:'.76rem',color:'#dc2626',marginBottom:'12px'}}>Неверный пин-код</div>}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',maxWidth:'240px',margin:'0 auto'}}>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'1');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>1</button>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'2');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>2</button>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'3');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>3</button>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'4');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>4</button>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'5');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>5</button>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'6');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>6</button>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'7');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>7</button>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'8');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>8</button>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'9');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>9</button>
              <div></div>
              <button onClick={()=>{if(pinValue.length<4){setPinValue(pinValue+'0');setPinError(false)}}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#222'}}>0</button>
              <button onClick={()=>{setPinValue(pinValue.slice(0,-1));setPinError(false)}} style={{padding:'14px',border:'none',borderRadius:'12px',background:'#f5f5f5',fontSize:'.80rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',color:'#777'}}>⌫</button>
            </div>
          </div>
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,width:'100%'}}>
      {/* Подтверждение скидки ниже минимальной цены (пин руководителя) */}
      {minPriceConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setMinPriceConfirm(false)}>
          <div style={{background:'#fff',borderRadius:16,padding:20,maxWidth:340,width:'100%'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:'1rem',fontWeight:700,marginBottom:4}}>Скидка ниже минимальной цены</div>
            <div style={{fontSize:'.8rem',color:'var(--muted)',marginBottom:14,lineHeight:1.5}}>Итог чека ниже суммы минимальных цен. Для подтверждения введите пин руководителя:</div>
            <input type="password" inputMode="numeric" maxLength={4} value={minPricePin} autoFocus
              onChange={e=>{
                setMinPricePin(e.target.value); setMinPriceError(false);
                if (e.target.value.length === 4) {
                  // Пин руководителя: мастер-пин 8888 или пин сотрудника с правом «Настройки»
                  const isAdminPin = e.target.value === PIN_MASTER || (employees || []).some(emp => emp.pin === e.target.value && emp.permissions && emp.permissions.includes('settings'));
                  if (isAdminPin) {
                    minPriceApprovedRef.current = true;
                    setMinPriceConfirm(false); setMinPricePin('');
                    processPay();
                  } else {
                    setMinPriceError(true);
                    setTimeout(() => setMinPricePin(''), 700);
                  }
                }
              }}
              style={{width:'100%',padding:'.55rem',border:'1.5px solid '+(minPriceError?'#dc2626':'var(--border)'),borderRadius:10,fontSize:'1.1rem',textAlign:'center',letterSpacing:8,fontFamily:'inherit',outline:'none'}} placeholder="••••" />
            {minPriceError && <div style={{color:'#dc2626',fontSize:'.75rem',marginTop:6,textAlign:'center'}}>Неверный пин</div>}
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button type="button" className="btn btn-outline" onClick={()=>setMinPriceConfirm(false)} style={{flex:1}}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Выбор исполнителя/продавца для позиции */}
      {pickEmpFor !== null && (function(){
        const it = cart.find(function(x){return x.id === pickEmpFor;});
        if (!it) return null;
        const avail = employees.filter(function(e){return !(it.sp || []).some(function(y){return y.empId === e.id;});});
        const total = itemTotalPrice(it);
        return (
          <div className="modal-overlay active" onClick={function(e){if(e.target.className==='modal-overlay active')setPickEmpFor(null);}}>
            <div className="modal-box" style={{maxWidth:'400px',maxHeight:'80vh',display:'flex',flexDirection:'column'}}>
              <button className="modal-close" onClick={function(){setPickEmpFor(null);}}>&times;</button>
              <h2 style={{fontSize:'1rem',fontWeight:700,marginBottom:'2px'}}>{it.type === 'service' ? 'Добавить исполнителя' : 'Добавить продавца'}</h2>
              <div style={{fontSize:'.78rem',color:'var(--muted)',marginBottom:'10px'}}>{it.name} · {Math.round(total).toLocaleString()} {cur}</div>
              <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'2px',paddingBottom:'8px'}}>
                {avail.length === 0 ? (
                  <div style={{fontSize:'.8rem',color:'#999',textAlign:'center',padding:'1rem 0'}}>Все сотрудники уже добавлены</div>
                ) : avail.map(function(e){
                  return (
                    <div key={e.id} onClick={function(){addSplit(pickEmpFor, {id: e.id, name: e.name});}}
                      style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',borderRadius:'10px',cursor:'pointer',fontSize:'.84rem'}}
                      onMouseEnter={function(ev){ev.currentTarget.style.background='#f5f5f8';}}
                      onMouseLeave={function(ev){ev.currentTarget.style.background='transparent';}}>
                      <span style={{width:'30px',height:'30px',borderRadius:'50%',background:'#e9e9f2',display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'.72rem',color:'#555',flexShrink:0}}>{e.name.charAt(0)}</span>
                      <span style={{flex:1,fontWeight:600}}>{e.name}</span>
                      <span style={{color:'#bbb',fontSize:'1rem'}}>+</span>
                    </div>
                  );
                })}
              </div>
              <div style={{borderTop:'1px solid #f0f0f0',paddingTop:'10px',display:'flex',justifyContent:'flex-end'}}>
                <button type="button" onClick={function(){setPickEmpFor(null);}} style={{padding:'8px 18px',borderRadius:'100px',border:'none',background:'#111',color:'#fff',fontSize:'.8rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Готово</button>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'1rem 1.5rem',fontSize:'.95rem',color:'#444',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}
        {/* Единая плашка — Фамилия И. 🔒 | Чек № ▼ | ⚙ | 🔍 | +Добавить */}
        <div style={{margin:'0 18px 8px',padding:'8px 14px',background:'#fff',borderRadius:'12px',display:'flex',alignItems:'center',gap:'10px',boxShadow:'0 2px 10px rgba(0,0,0,.08)',position:'relative'}}>
          <span style={{fontSize:'.80rem',fontWeight:600,color:'#444',whiteSpace:'nowrap'}}>{effectiveName}</span>
          <span onClick={()=>setPinLocked(true)} style={{fontSize:'.80rem',cursor:'pointer',color:'#777',userSelect:'none',lineHeight:1}} title="Заблокировать кассу">🔒</span>

          {/* Чек № — переключатель */}
          <div className="receipt-dropdown-wrap" style={{position:'relative',marginRight:'auto'}}>
            <span onClick={async function(){
              setReceiptDropdownOpen(!receiptDropdownOpen);
              if (!receiptDropdownOpen && (!shiftReceipts || shiftReceipts.length === 0) && activeShift?.id) {
                var { data: rData } = await supabase.from('receipts').select('*').eq('user_id', user.id).eq('shift_id', activeShift.id).order('created_at', { ascending: false });
                if (rData) {
                  setShiftReceipts(rData.map(function(r){
                    var rItems = r.items_json || [];
                    var itemsStr = rItems.map(function(it){ return it.qty > 1 ? it.name + ' (' + it.qty + ')' : it.name; }).slice(0, 3).join(', ');
                    return {
                      id: r.id, receipt_number: r.receipt_number,
                      items_str: itemsStr || '—', status: r.status,
                      total_amount: r.total_amount, items_json: r.items_json,
                      client_name: r.client_name, date: r.date,
                    };
                  }));
                }
              }
            }} style={{fontSize:'.80rem',fontWeight:600,color:'#222',cursor:'pointer',whiteSpace:'nowrap',padding:'2px 6px',borderRadius:'6px',background: receiptDropdownOpen ? '#f0f0f0' : 'transparent',userSelect:'none'}}>
              Чек № {currentReceiptNum || 1} <span style={{fontSize:'.68rem',color:'#777'}}>▼</span>
            </span>
            {receiptDropdownOpen && (
              <div style={{position:'absolute',top:'100%',left:0,marginTop:'6px',background:'#fff',borderRadius:'12px',boxShadow:'0 8px 30px rgba(0,0,0,.12)',padding:'6px',minWidth:'280px',maxHeight:'260px',overflowY:'auto',zIndex:100,border:'1px solid #f0f0f0'}}>
                {(!shiftReceipts || shiftReceipts.length === 0) ? (
                  <div style={{padding:'10px 12px',fontSize:'.80rem',color:'#999',textAlign:'center'}}>Нет чеков за смену</div>
                ) : shiftReceipts.map(function(r){
                  var isPaid = r.status === 'paid';
                  return (
                    <div key={r.id} onClick={function(){
                      setReceiptDropdownOpen(false);
                      setCurrentReceiptNum(r.receipt_number);
                      setHeldActiveId(null);
                      if (isPaid) {
                        var items = (r.items_json || []).map(function(it){ return {id: it.id || Math.random(), name: it.name, price: it.price || 0, qty: it.qty || 1, final_price: it.price || 0, type: 'product'}; });
                        setCart(items);
                        setViewingReceipt(r);
                      } else {
                        var items = (r.items_json || []).map(function(it){ return {id: it.id || Math.random(), name: it.name, price: it.price || 0, qty: it.qty || 1, final_price: it.price || 0, type: 'product'}; });
                        setCart(items);
                        setReceiptDiscountPercent(0);setReceiptDiscountFixed(0);
                        
                      }
                    }}
                      style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',borderRadius:'8px',cursor:'pointer',fontSize:'.80rem',color:'#333',borderBottom:'1px solid #f5f5f5',opacity:isPaid?.65:1}}
                      onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <span style={{minWidth:'46px'}}>№ {r.receipt_number}</span>
                      <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.items_str}</span>
                      <span style={{whiteSpace:'nowrap'}}>{Number(r.total_amount||0).toLocaleString()} {cur}</span>
                    </div>
                  );
                })}
                {/* Отложенные чеки */}
                {heldReceipts.length > 0 && <div style={{height:'1px',background:'#eee',margin:'4px 0'}} />}
                {heldReceipts.map(function(r, i){
                  var itemsStr = (r.items || []).map(function(it){ return it.qty > 1 ? it.name + ' (' + it.qty + ')' : it.name; }).slice(0, 3).join(', ');
                  return (
                    <div key={r.id || i} onClick={function(){
                      setReceiptDropdownOpen(false);
                      setHeldActiveId(r.id || i);
                      setCart((r.items || []).map(function(it){ return {id: it.id || Math.random(), name: it.name, price: it.price || 0, qty: it.qty || 1, final_price: it.price || 0, type: 'product'}; }));
                      setReceiptDiscountPercent(0);setReceiptDiscountFixed(0);
                      
                      setViewingReceipt(null);
                    }}
                      style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',borderRadius:'8px',cursor:'pointer',fontSize:'.80rem',color:'#777',borderBottom:'1px solid #f5f5f5',fontStyle:'italic'}}
                      onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <span style={{minWidth:'46px',fontWeight:600}}>📋</span>
                      <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{itemsStr}</span>
                      <span style={{whiteSpace:'nowrap'}}>{Number(r.total||0).toLocaleString()} {cur}</span>
                    </div>
                  );
                })}
                <div onClick={function(){setReceiptDropdownOpen(false);setHeldActiveId(null);setCart([]);setActiveReceiptId(null);setReceiptDiscountPercent(0);setReceiptDiscountFixed(0);setCurrentReceiptNum((currentReceiptNum||1)+1);setViewingReceipt(null)}}
                  style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',borderRadius:'8px',cursor:'pointer',fontSize:'.80rem',color:'#444',borderTop:'1px solid #eee',marginTop:'4px'}}
                  onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span>＋ Создать новый</span>
                </div>
              </div>
            )}
          </div>

          <div style={{flex:1,maxWidth:'240px',position:'relative'}}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск"
              style={{width:'100%',border:'1px solid #e0e0e0',outline:'none',fontSize:'.80rem',fontFamily:'inherit',padding:'8px 10px',color:'#444',background:'#fff',borderRadius:'8px',boxSizing:'border-box'}} />
          </div>
          <button type="button" onClick={function(){scanBarcode(function(bc){
            var found=products.find(function(p){return p.barcode===bc;});
            if(found){addToCart(found);setToast('Найден: '+found.name)}else setToast('Товар со штрихкодом '+bc+' не найден');
          })}} title="Сканировать штрихкод"
            style={{width:'34px',height:'34px',borderRadius:'10px',background:'linear-gradient(135deg,#ffdd2d,#fff9db)',color:'#111',border:'1px solid #ffe98a',boxShadow:'0 1px 5px rgba(255,205,0,.35)',cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'><rect x='3' y='4.5' width='1.5' height='15'/><rect x='5.3' y='4.5' width='2.6' height='15'/><rect x='8.6' y='4.5' width='1.2' height='15'/><rect x='10.4' y='4.5' width='3' height='15'/><rect x='14' y='4.5' width='1.4' height='15'/><rect x='16' y='4.5' width='2.4' height='15'/><rect x='19' y='4.5' width='1.6' height='15'/></svg></button>
          <span onClick={() => { if (activeShift) setShowActions(true); else setShowOpenShift(true); }} title="Настройки смены" style={{width:'34px',height:'34px',borderRadius:'10px',background:'linear-gradient(135deg,#ffdd2d,#fff9db)',color:'#111',border:'1px solid #ffe98a',boxShadow:'0 1px 5px rgba(255,205,0,.35)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,userSelect:'none'}}><svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3.2'/><path d='M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z'/></svg></span>
          <button onClick={() => { setShowAdd(true); setAddName(''); setAddCat(''); setAddPrice(''); setAddUnit(''); setAddType('product'); setAddSku(''); setAddBarcode(''); setAddWeight('0'); setAddWeightUnit('кг'); setAddDesc(''); }} style={{padding:'8px 14px',border:'none',borderRadius:'8px',background:'linear-gradient(135deg,#ffdd2d,#fff9db)',color:'#111',fontSize:'.80rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',flexShrink:0}}>+ Добавить</button>
        </div>

        {/* Две отдельные плашки: каталог слева, чек справа (как в прототипе) */}
        <div style={{display:'flex',flex:1,gap:'14px',minHeight:0,alignItems:'stretch',background:'#f5f5f7',padding:'0 18px 18px'}}>

      {/* Панель товаров — плашка */}
      <div style={{flex:'1 1 0',display:'flex',flexDirection:'column',minWidth:0,height:'100%'}}>
        {/* Категории */}
        <div style={{display:'flex',gap:'4px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px',flexShrink:0}}>
          <button onClick={() => setCatFilter('all')} style={{
            padding:'7px 16px', borderRadius:'100px', border:'none', fontSize:'.78rem',
            fontWeight: catFilter === 'all' ? 600 : 500, cursor:'pointer', whiteSpace:'nowrap',
            background: catFilter === 'all' ? 'linear-gradient(135deg,#ffdd2d,#fff9db)' : '#e8e8ed',
            color: catFilter === 'all' ? '#111' : '#666', fontFamily:'inherit',
          }}>Все</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.name)} style={{
              padding:'7px 16px', borderRadius:'100px', border:'none', fontSize:'.78rem',
              fontWeight: catFilter === c.name ? 600 : 500, cursor:'pointer', whiteSpace:'nowrap',
              background: catFilter === c.name ? 'linear-gradient(135deg,#ffdd2d,#fff9db)' : '#e8e8ed',
              color: catFilter === c.name ? '#111' : '#666', fontFamily:'inherit',
            }}>{c.name}</button>
          ))}
        </div>

        {/* Сетка товаров */}
        <div style={{flex:1,overflowY:'auto',minHeight:0,width:'100%',display:'flex',flexDirection:'column'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'10px',alignContent:'start',height:'max-content'}}>
          {filtered.length === 0 ? (
            <div style={{gridColumn:'1/-1',textAlign:'center',padding:'3rem 0',color:'var(--muted)',fontSize:'.80rem'}}>Нет товаров</div>
          ) : filtered.map(p => {
            var oos = p.type !== 'service' && (stockMap[p.id] || 0) <= 0;
            return (
            <div key={p.id} onClick={function(){if(!oos)addToCart(p)}}
              style={{background: oos ? '#fafafa' : '#fff', borderRadius:'16px', padding:'12px 12px 10px', cursor: oos ? 'default' : 'pointer', transition:'all .15s', display:'flex', flexDirection:'column', border:'1px solid ' + (oos ? '#f0f0f0' : '#eee'), boxShadow:'0 1px 4px rgba(0,0,0,.04)', height:'100%', opacity: oos ? .55 : 1}}
              onMouseEnter={e => { if(!oos){e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 16px rgba(0,0,0,.08)'; e.currentTarget.style.borderColor='#ffdd2d';}} }
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.03)'; e.currentTarget.style.borderColor= oos ? '#f0f0f0' : '#eee'; } }>
              <div style={{fontSize:'20px',lineHeight:1}}>{p.type === 'service' ? '🔧' : '📦'}</div>
              <div style={{fontSize:'13px',fontWeight:600,color: oos ? '#999' : '#222',lineHeight:1.3,margin:'6px 0 2px',minHeight:'34px'}}>{p.name}</div>
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'6px'}}>
                <span style={{fontSize:'12.5px',fontWeight:500,color: oos ? '#ccc' : '#999'}}>{(p.price||0).toLocaleString()} {cur}</span>
                {p.type !== 'service' && (
                  <span style={{fontSize:'10px',fontWeight:600,color: (stockMap[p.id]||0) > 0 ? '#16a34a' : '#bbb'}}>{stockMap[p.id] || 0} шт</span>
                )}
              </div>
              <div style={{marginTop:'6px',display:'flex',alignItems:'center',gap:'5px'}}>
                <span style={{fontSize:'9.5px',fontWeight:700,padding:'2px 10px',borderRadius:'100px',background:'#fff4c2',color:'#8a6a00',whiteSpace:'nowrap'}}>{p.type === 'service' ? 'Услуга' : 'Товар'}</span>
                {p.cat && <span style={{fontSize:'10px',color:'#bbb',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1,minWidth:0}}>{p.cat}</span>}
              </div>
              {p.min_price > 0 && <div style={{fontSize:'10px',fontWeight:600,color:'#b45309',marginTop:'3px'}}>мин. {Number(p.min_price).toLocaleString()} {cur}</div>}
            </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Панель чека — отдельная плашка */}
      <div style={{flex:'0 0 ' + (isWide ? '420px' : '340px'),maxWidth:'46vw',display:'flex',flexDirection:'column',background:'#fff',borderRadius:'20px',boxShadow:'0 4px 24px rgba(0,0,0,.05)',overflow:'hidden'}}>

        {/* Шапка чека: номер + счётчик, тонкая полоса */}
        <div style={{padding:'12px 16px',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:'14px',fontWeight:800,color:'#222',letterSpacing:'-.01em'}}>Чек № {currentReceiptNum || 1}</span>
          <span style={{fontSize:'11.5px',color:'#999',fontWeight:600}}>{cart.length ? cart.reduce(function(a,x){return a+x.qty;},0) + ' поз.' : ''}</span>
        </div>

        {/* Содержимое чека */}
        <div style={{flex:1,overflowY:'auto',padding:'2px 14px'}}>
          {/* Строки товаров */}
          {cart.length === 0 ? (
            <div style={{textAlign:'center',padding:'2rem 1rem',color:'var(--muted)',fontSize:'.80rem',marginTop:'1rem'}}>Выберите товары</div>
          ) : cart.map((item, i) => (
            <div key={item.id} style={{padding:'12px 0',borderBottom:'1px solid #f0f0f0'}}>
              <div style={{display:'flex',alignItems:'center',gap:isWide?'6px':'3px'}}>
                <div style={{flex:1,minWidth:0,paddingRight:"8px"}}>
                  <div style={{fontSize:'.82rem',fontWeight:500,color:'#222',lineHeight:1.3}}>{item.name}</div>
                  {item.combo_items && item.combo_items.length > 0 ? (
                    <div style={{fontSize:'.76rem',color:'var(--muted)',marginTop:'2px'}}>Cocтaв: {item.combo_items.map(function(ci, j){return <span key={ci.id}>{ci.name} x{ci.qty}{j < item.combo_items.length - 1 ? ', ' : ''}</span>;})}</div>
                  ) : null}
                </div>
                <div className="receipt-qty" style={{display:'flex',alignItems:'center',background:'#f4f4f6',borderRadius:'8px',padding:'2px 2px',flexShrink:0}}>
                  <button class="receipt-qty-btn" onClick={function(){updateQty(item.id, -1)}} style={{width:'24px',height:'24px',borderRadius:'6px',border:'none',background:'transparent',fontSize:'.85rem',cursor:'pointer',color:'#444',fontFamily:'inherit',padding:0,lineHeight:1}}>-</button>
                  <span style={{fontWeight:600,minWidth:'18px',textAlign:'center',fontSize:'.82rem'}}>{item.qty}</span>
                  <button class="receipt-qty-btn" onClick={function(){updateQty(item.id, 1)}} style={{width:'24px',height:'24px',borderRadius:'6px',border:'none',background:'transparent',fontSize:'.85rem',cursor:'pointer',color:'#444',fontFamily:'inherit',padding:0,lineHeight:1}}>+</button>
                </div>
                {item.free_price ? (
                  <div style={{display:'flex',alignItems:'center',gap:'4px',flexShrink:0}}>
                    <input type="number" min="0" step="0.01" value={item.price === null || item.price === '' ? '' : item.price} placeholder="0"
                      onChange={function(e){
                        var raw = e.target.value;
                        var v = raw === '' ? null : (parseFloat(raw) || 0);
                        setCart(function(p){return p.map(function(x){return x.id===item.id?{...x, price: v, final_price: v}:x})})
                      }}
                      onFocus={function(e){e.target.select()}}
                      style={{width:'78px',border:'1.5px solid #e8b800',borderRadius:'8px',padding:'4px 5px',fontSize:'.82rem',fontWeight:600,textAlign:'center',fontFamily:'inherit',outline:'none'}} />
                    <span style={{fontSize:'.8rem',color:'#555'}}>{cur}</span>
                  </div>
                ) : (
                  <div style={{fontWeight:700,fontSize:'.85rem',whiteSpace:'nowrap',flexShrink:0}}>{((item.final_price || item.price || 0) * item.qty).toLocaleString()} {cur}</div>
                )}
              </div>
              {/* Мастера/продавец — как в прототипе */}
              {employees.length > 0 && (
                <div style={{marginTop:'9px',border:'1px solid #eee',borderRadius:'12px',background:'#fafbfc',overflow:'hidden'}}>
                  <div onClick={function(){setPickEmpFor(item.id);}}
                    style={{padding:'7px 11px',fontSize:'.74rem',color:'#777',display:'flex',justifyContent:'space-between',cursor:'pointer',fontWeight:600,userSelect:'none'}}>
                    <span>{item.type === 'service' ? 'Мастера' : 'Продавец'}</span>
                    <span style={{color: (item.sp || []).length ? '#222' : '#8a8f9c'}}>{(item.sp || []).length ? Math.round(spSum(item)).toLocaleString() + ' ' + cur : '+ добавить'}</span>
                  </div>
                  {(item.sp || []).length > 0 && (
                    <div style={{padding:'0 10px 9px',borderTop:'1px solid #f2f2f2',display:'flex',flexDirection:'column',gap:'5px',paddingTop:'6px'}}>
                      {(item.sp || []).map(function(spd, si){
                        return (
                          <div key={si} style={{display:'flex',alignItems:'center',gap:'7px',fontSize:'.76rem'}}>
                            <span style={{width:'20px',height:'20px',borderRadius:'50%',background:'#e3e6f0',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'.64rem',fontWeight:700,color:'#555',flexShrink:0}}>{spd.name.charAt(0)}</span>
                            <span style={{flex:1,fontWeight:600,color:'#333',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{spd.name}</span>
                            <input type="number" min="0" placeholder="0" value={spd.amt}
                              onChange={function(e){setSplitAmt(item.id, spd.empId, e.target.value);}}
                              style={{width:'64px',border:'1px solid #e0e0e0',borderRadius:'7px',padding:'3px 5px',fontSize:'.76rem',textAlign:'center',fontFamily:'inherit',outline:'none'}} />
                            <span style={{fontSize:'.68rem',color:'#999'}}>{cur}</span>
                            <span onClick={function(){delSplit(item.id, spd.empId);}} style={{cursor:'pointer',color:'#ccc',fontSize:'.82rem',lineHeight:1}}>✕</span>
                          </div>
                        );
                      })}
                      {spSum(item) > 0 && (
                        <div style={{fontSize:'.7rem',fontWeight:700,color: spOver(item) ? '#dc2626' : '#16a34a'}}>
                          {spOver(item) ? '⚠️ Больше стоимости ' + Math.round(itemTotalPrice(item)).toLocaleString() + ' ' + cur : '✓ Распределено: ' + Math.round(spSum(item)).toLocaleString() + ' ' + cur}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Итого и оплата */}
        <div style={{padding:'14px',borderTop:'1px solid #eee',display:'flex',flexDirection:'column',gap:'10px'}}>
            {cart.reduce(function(s2, x){return s2 + spSum(x);}, 0) > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.78rem',color:'#777'}}>
                <span>Исполнителям:</span>
                <span style={{fontWeight:700}}>{Math.round(cart.reduce(function(s2, x){return s2 + spSum(x);}, 0)).toLocaleString()} {cur}</span>
              </div>
            )}
            {discountTotal > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.80rem',color:'var(--muted)'}}>
                <span>Итого:</span>
                <span style={{textDecoration:'line-through',color:'#777'}}>{totalOriginal.toLocaleString()} {cur}</span>
              </div>
            )}
            {discountTotal > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.80rem',color:'#16a34a'}}>
                <span>Скидка по акциям:</span>
                <span>-{discountTotal.toLocaleString()} {cur}</span>
              </div>
            )}
            {/* Лояльность: автоскидка по программе клиента */}
            {selectedClient && loyaltyDiscountAmount > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.80rem',color:'#8b5cf6'}}>
                <span>Скидка лояльности ({loyaltyPct}%):</span>
                <span>-{loyaltyDiscountAmount.toLocaleString()} {cur}</span>
              </div>
            )}
            {selectedClient && loyaltyPointsAmount > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.80rem',color:'#8b5cf6'}}>
                <span>Скидка баллами:</span>
                <span>-{loyaltyPointsAmount.toLocaleString()} {cur}</span>
              </div>
            )}
            {/* Кнопка списания баллов (бонусная программа: 1 балл = 1 {cur}) */}
            {selectedClient && (() => {
              const bonusProg = (loyaltyPrograms || []).find(p => p.type === 'bonus');
              const points = Number(clients.find(c => c.id === selectedClient)?.points) || 0;
              if (!bonusProg || points <= 0 || cart.length === 0) return null;
              const maxSpend = Math.min(points, total - receiptDiscountAmount - loyaltyDiscountAmount);
              if (maxSpend <= 0) return null;
              const active = loyaltyPointsSpend > 0;
              return (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'.78rem',color:'var(--muted)'}}>🎁 Баллы клиента: {points.toLocaleString()}</span>
                  <button type="button" onClick={() => setLoyaltyPointsSpend(active ? 0 : Math.round(maxSpend))}
                    style={{padding:'4px 12px',borderRadius:'100px',border:active ? '1.5px solid #8b5cf6' : '1.5px solid #ddd',background:active ? '#f3e8ff' : '#fff',color:active ? '#7c3aed' : '#555',fontSize:'.72rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    {active ? '−' + loyaltyPointsAmount.toLocaleString() + ' ₽ ✓' : 'Списать баллы (−' + maxSpend.toLocaleString() + ' ₽)'}
                  </button>
                </div>
              );
            })()}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'.80rem',color:'var(--muted)'}}>К оплате:</span>
              <span style={{fontSize:'.95rem',fontWeight:700,color:receiptDiscountAmount>0?'var(--muted)':'#111',textDecoration:receiptDiscountAmount>0?'line-through':'none'}}>{total.toLocaleString()} {cur}</span>
            </div>
            {/* Плашка «Скидка на чек» — как в прототипе v3-white */}
            {cart.length > 0 && (
              <>
                <div className="kassa-disc">
                  <span className="dl">Скидка на чек</span>
                  <div className="db">
                    {[0,5,10,15,20].map(function(pct){
                      const active = receiptDiscountPercent === pct && receiptDiscountFixed === 0;
                      return (
                        <button key={pct} type="button" className={'dc' + (active ? ' on' : '')} onClick={function(){setReceiptDiscountPercent(pct);setReceiptDiscountFixed(0);setDiscountDropdownOpen(false)}}>{pct === 0 ? '0%' : '−' + pct + '%'}</button>
                      );
                    })}
                    <button type="button" className={'dc own' + ((discountDropdownOpen || receiptDiscountFixed > 0 || (receiptDiscountPercent > 0 && [0,5,10,15,20].indexOf(receiptDiscountPercent) === -1)) ? ' on' : '')} onClick={function(){setDiscountDropdownOpen(!discountDropdownOpen)}}>своя</button>
                    {discountDropdownOpen && (
                      <span className="down">
                        <input type="number" min="0" max="99" value={receiptDiscountPercent || ''} placeholder="%" autoFocus
                          onChange={function(e){var v=parseInt(e.target.value)||0;setReceiptDiscountPercent(Math.min(99,v));setReceiptDiscountFixed(0)}} />
                      </span>
                    )}
                  </div>
                </div>
                {receiptDiscountAmount > 0 && (
                  <div className="kassa-dl2"><span>Скидка:</span><span>−{receiptDiscountAmount.toLocaleString()} {cur}</span></div>
                )}
              </>
            )}
            {/* Итого со скидкой */}
            {receiptDiscountAmount > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid #eee',paddingTop:'8px'}}>
                <span style={{fontSize:'.80rem',color:'var(--muted)',fontWeight:600}}>Итого:</span>
                <span style={{fontSize:'.95rem',fontWeight:700}}>{finalTotal.toLocaleString()} {cur}</span>
              </div>
            )}
            {viewingReceipt ? (
              <>
                {/* Режим просмотра оплаченного чека */}
                <div style={{background:'#f9f9f9',borderRadius:'10px',padding:'10px',fontSize:'.80rem',color:'#777',lineHeight:1.7}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span>Клиент:</span>
                    <span>{viewingReceipt.client_name || '—'}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span>Дата:</span>
                    <span>{((viewingReceipt.date || '').split('T')[0] || viewingReceipt.date || '').split('-').reverse().join('.')}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span>Статус:</span>
                    <span>Оплачен</span>
                  </div>
                </div>
                <button onClick={function(){setViewingReceipt(null);setHeldActiveId(null);setCart([]);setReceiptDiscountPercent(0);setReceiptDiscountFixed(0)}} style={{
                  width:'100%', padding:'13px', borderRadius:'100px', border:'2px solid #eee',
                  background:'#fff', color:'#777', fontSize:'.80rem', fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit',
                }}>✕ Закрыть просмотр</button>
              </>
            ) : (
              <div style={{display:'flex',gap:'8px'}}>
                {cart.length > 0 && (
                  <button onClick={function(){var items=cart.map(function(i){return {id:i.id,name:i.name,price:i.price,qty:i.qty}});var clientName=clients.find(function(c){return c.id===selectedClient;})?.name||'';var isUpdate=heldActiveId!=null&&heldReceipts.some(function(x){return x.id===heldActiveId;});if(isUpdate){setHeldReceipts(function(p){return p.map(function(x){return x.id===heldActiveId?{...x,items:items,total:finalTotal,client:selectedClient,clientName:clientName,updatedAt:Date.now()}:x;});});}else{setHeldReceipts(function(p){return [...p,{items:items,total:finalTotal,client:selectedClient,clientName:clientName,createdAt:Date.now(),id:Date.now()}];});}setHeldActiveId(null);setCart([]);setReceiptDiscountPercent(0);setReceiptDiscountFixed(0);setToast(isUpdate?'Чек обновлён':'Чек отложен')}} style={{
                    flex:1, padding:'13px', borderRadius:'8px', border:'1.5px solid var(--border)',
                    background:'#fff', color:'#444', fontSize:'.80rem', fontWeight:600,
                    cursor:'pointer', fontFamily:'inherit',
                  }}>Отложить</button>
                )}
                <button onClick={function(){setPayAmount(String(Math.round(finalTotal)));setShowPay(true)}} disabled={!cart.length} style={{
                  flex:1, padding:'13px', borderRadius:'8px', border:'none',
                  background: cart.length ? 'linear-gradient(135deg,#ffdd2d,#fff9db)' : '#ddd',
                  color: cart.length ? '#111' : '#fff', fontSize:'.80rem', fontWeight:700,
                  cursor: cart.length ? 'pointer' : 'default', fontFamily:'inherit',
                  boxShadow: cart.length ? '0 2px 10px rgba(255,205,0,.35)' : 'none',
                }}>Продажа</button>
              </div>
            )}
          </div>
      </div>

      </div>

      {/* Модалка добавления товара */}
      {showAdd && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowAdd(false); }}>
          <div className="modal-box" style={{maxWidth:'420px'}}>
            <button className="modal-close" onClick={() => setShowAdd(false)}>&times;</button>
            <h2>Добавить позицию</h2>
            <div className="modal-sub">Новый товар появится в каталоге и разделе «Товары и услуги»</div>
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
                <button type="submit" className="btn btn-dark">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка оплаты */}
            {showPay && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowPay(false); }}>
          <div style={{display:'flex',width:'880px',maxHeight:'80vh',background:'#fff',borderRadius:'24px',boxShadow:'0 24px 80px rgba(0,0,0,.15)',overflow:'hidden',position:'relative'}}>
            <button className="modal-close" onClick={() => setShowPay(false)}>&times;</button>
            
            {/* Левая половина — чек */}
            <div style={{width:'440px',flexShrink:0,display:'flex',flexDirection:'column',borderRight:'1px solid #f0f0f0',padding:'24px 24px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                <span style={{fontSize:'1rem',fontWeight:700,color:'#222'}}>Чек № {currentReceiptNum || 1}</span>
                <span style={{fontSize:'.80rem',fontWeight:500,color:'#777'}}>{effectiveName}</span>
              </div>
              
              {/* Шапка таблицы */}
              <div style={{display:'flex',fontSize:'.76rem',fontWeight:600,color:'#999',textTransform:'uppercase',paddingBottom:'6px',borderBottom:'1px solid #f0f0f0',marginBottom:'6px',gap:'6px'}}>
                <span style={{flex:1,textAlign:'left'}}>Наименование</span>
                <span style={{width:'65px',textAlign:'center'}}>Кол-во</span>
                <span style={{width:'65px',textAlign:'center'}}>Цена</span>
                <span style={{width:'65px',textAlign:'center'}}>Итого</span>
              </div>
              
              {/* Строки товаров */}
              {cart.length === 0 ? (
                <div style={{textAlign:'center',padding:'2rem 0',color:'var(--muted)',fontSize:'.80rem'}}>Нет товаров</div>
              ) : (
                <div style={{flex:1,overflowY:'auto'}}>
                {cart.map(item => (
                  <div key={item.id} style={{display:'flex',padding:'8px 0',alignItems:'center',gap:'6px',borderBottom:'1px solid #f8f8f8'}}>
                    <div style={{flex:1,textAlign:'left',fontSize:'.80rem',fontWeight:500,color:'#222'}}>
                      {item.name}
                      {item.combo_items && item.combo_items.length > 0 && (
                        <div style={{fontSize:'.76rem',color:'#999',marginTop:'1px'}}>Cocтaв: {item.combo_items.map((ci, j) => <span key={ci.id}>{ci.name} x{ci.qty}{j < item.combo_items.length - 1 ? ', ' : ''}</span>)}</div>
                      )}
                    </div>
                    <div style={{width:'65px',textAlign:'center',fontSize:'.80rem',fontWeight:600,color:'#444'}}>{item.qty}</div>
                    <div style={{width:'65px',textAlign:'center',fontSize:'.80rem',fontWeight:500,color:'#555'}}>{(item.price||0).toLocaleString()}</div>
                    <div style={{width:'65px',textAlign:'center',fontSize:'.80rem',fontWeight:700,color:'#222'}}>{((item.final_price || item.price || 0) * item.qty).toLocaleString()}</div>
                  </div>
                ))}
                </div>
              )}
              
              {/* Итого */}
              <div style={{marginTop:'8px',paddingTop:'12px',borderTop:'1px solid #f0f0f0'}}>
                {discountTotal > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'.80rem',marginBottom:'4px'}}>
                    <span style={{color:'#999'}}>Скидка по акциям:</span>
                    <span style={{color:'#444'}}>-{discountTotal.toLocaleString()} {cur}</span>
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'.80rem',marginBottom:'4px'}}>
                  <span style={{color:'#999'}}>Скидка на чек:</span>
                  <span style={{color: receiptDiscountAmount > 0 ? '#16a34a' : '#999',fontWeight: receiptDiscountAmount > 0 ? 700 : 400}}>{receiptDiscountAmount > 0 ? '−' + receiptDiscountAmount.toLocaleString() + ' ' + cur + (receiptDiscountPercent > 0 ? ' (' + receiptDiscountPercent + '%)' : '') : '0%'}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'1.1rem',fontWeight:800,color:'#222',paddingTop:'4px',borderTop:'1px solid #f0f0f0',marginTop:'4px'}}>
                  <span>Итого:</span>
                  <span>{finalTotal.toLocaleString()} {cur}</span>
                </div>
              </div>
            </div>            
            {/* Правая половина — оплата */}
            <div style={{flex:1,padding:'24px 24px 20px',display:'flex',flexDirection:'column',overflowY:'auto'}}>
              
              {/* Способ оплаты */}
              <div style={{marginBottom:'16px'}}>
                <div style={{fontSize:'.76rem',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.3px',marginBottom:'10px'}}>Способ оплаты</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                  {accounts.filter(a => a.type !== 'cash').map(a => (
                    <button key={a.id} onClick={() => {setPayMode(a.id); if (payMode !== a.id) setPayUnpaid(false)}}
                      style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',border:'1.5px solid ' + (payMode === a.id ? '#ddd' : '#eee'),borderRadius:'12px',background: payMode === a.id ? '#f5f5f5' : '#fff',cursor:'pointer',fontFamily:'inherit',fontSize:'.76rem',fontWeight:500,color: payMode === a.id ? '#222' : '#444',textAlign:'left'}}>
                      <span style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                        <span>{a.type === 'cash_register' ? 'Наличные' : a.name}</span>
                        <span style={{fontSize:'.68rem',fontWeight:400,color:'var(--muted)'}}>{Math.round(accBal(a)).toLocaleString()} {cur}</span>
                      </span>
                      <span style={{width:'16px',height:'16px',borderRadius:'50%',border:'2px solid ' + (payMode === a.id ? '#ccc' : '#ddd'),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.45rem',color: payMode === a.id ? '#555' : 'transparent',background: payMode === a.id ? '#e8e8e8' : 'transparent'}}>{payMode === a.id ? '\u2713' : ''}</span>
                    </button>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  <button onClick={() => setPaySplit(!paySplit)}
                    style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',border:'1.5px solid ' + (paySplit ? '#ddd' : '#eee'),borderRadius:'12px',background: paySplit ? '#f5f5f5' : '#fff',cursor:'pointer',fontFamily:'inherit',fontSize:'.76rem',fontWeight:500,color: paySplit ? '#222' : '#444',textAlign:'left'}}>
                    Разделить на счета
                    <span style={{width:'16px',height:'16px',borderRadius:'50%',border:'2px solid ' + (paySplit ? '#ccc' : '#ddd'),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.45rem',color: paySplit ? '#555' : 'transparent',background: paySplit ? '#e8e8e8' : 'transparent'}}>{paySplit ? '\u2713' : ''}</span>
                  </button>
                  <button onClick={() => {setPayUnpaid(!payUnpaid); if (!payUnpaid) {setPaySplit(false); setSplitAmts({}); setPayMode(null);} else {setPayMode(null)}}}
                    style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',border:'1.5px solid ' + (payUnpaid ? '#ddd' : '#eee'),borderRadius:'12px',background: payUnpaid ? '#f5f5f5' : '#fff',cursor:'pointer',fontFamily:'inherit',fontSize:'.76rem',fontWeight:500,color: payUnpaid ? '#222' : '#444',textAlign:'left'}}>
                    В долг
                    <span style={{width:'16px',height:'16px',borderRadius:'50%',border:'2px solid ' + (payUnpaid ? '#ccc' : '#ddd'),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.45rem',color: payUnpaid ? '#555' : 'transparent',background: payUnpaid ? '#e8e8e8' : 'transparent'}}>{payUnpaid ? '\u2713' : ''}</span>
                  </button>
                </div>
              </div>
              
              {/* Разделение */}
              {paySplit && (
                <div style={{background:'#fafafa',border:'1px solid #f0f0f0',borderRadius:'10px',padding:'12px 14px',marginBottom:'14px',width:'calc(50% - 4px)'}}>
                  {accounts.filter(a => a.type !== 'cash').map(a => {
                    const remain = total - Object.entries(splitAmts).filter(e => e[0] !== a.id).reduce((s, e) => s + (parseFloat(e[1]) || 0), 0);
                    return (
                      <div key={a.id} style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:'10px',marginBottom:'6px',fontSize:'.76rem',color:'#444'}}>
                        <span style={{fontWeight:500,color:'#444'}}>{a.type === 'cash_register' ? 'Наличные' : a.name}</span>
                        <input type="number" min="0" step="0.01" placeholder={Math.round(remain).toString()} 
                          value={splitAmts[a.id] || ''} 
                          onChange={e => setSplitAmts({...splitAmts, [a.id]: e.target.value})}
                          style={{width:'72px',padding:'5px 8px',border:'1.5px solid #eee',borderRadius:'6px',fontSize:'.76rem',fontWeight:600,textAlign:'right',outline:'none',fontFamily:'inherit',color:'#444'}} />
                      </div>
                    );
                  })}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:'10px',fontSize:'.76rem',color:'#444'}}>
                    <span style={{fontWeight:500,color:'#444'}}>Остаток</span>
                    <span style={{fontWeight:500,color:'#444',width:'72px',textAlign:'right'}}>{(total - Object.values(splitAmts).reduce((s, v) => s + (parseFloat(v) || 0), 0)).toLocaleString()} {cur}</span>
                  </div>
                </div>
              )}
              
              {/* Сумма */}
              <div style={{marginBottom:'16px'}}>
                <input type="number" min="0" step="0.01" placeholder={total.toString()} 
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)}
                  style={{width:'100%',padding:'10px 14px',border:'1.5px solid #eee',borderRadius:'10px',fontSize:'.95rem',fontWeight:700,textAlign:'center',outline:'none',fontFamily:'inherit',marginBottom:'6px'}} />
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'.76rem',color: payUnpaid ? '#dc2626' : '#16a34a',fontWeight:600}}>
                  {payUnpaid ? (
                    <span>Оплата не производится</span>
                  ) : payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) >= total ? (
                    <span>Оплачено полностью</span>
                  ) : payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) < total ? (
                    <span style={{color:'#92400e'}}>Не оплачено: {(total - parseFloat(payAmount)).toLocaleString()} {cur}</span>
                  ) : null}
                  {payAmount && parseFloat(payAmount) > total && (
                    <span style={{color:'#999',fontWeight:500}}>Сдача: {(parseFloat(payAmount) - total).toLocaleString()} {cur}</span>
                  )}
                </div>
              </div>
              
              {/* Клиент */}
              <div style={{marginBottom:'14px'}}>
                <div style={{fontSize:'.76rem',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.3px',marginBottom:'8px'}}>Клиент</div>
                <div style={{display:'flex',gap:'6px'}}>
                  <div style={{position:'relative',flex:1}}>
                    <input type="text" placeholder="Поиск по имени или телефону..." 
                      value={selectedClient ? (clients.find(c => c.id === selectedClient)?.name || clientSearch) : clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setSelectedClient(''); setLoyaltyPct(0); setLoyaltyPointsSpend(0); setClientDrop(true); }}
                      onFocus={() => setClientDrop(true)}
                      onBlur={() => setTimeout(() => setClientDrop(false), 200)}
                      style={{width:'100%',padding:'9px 10px',border:'1.5px solid #eee',borderRadius:'8px',fontSize:'.76rem',outline:'none',fontFamily:'inherit'}} />
                    {clientDrop && (
                      <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #eee',borderRadius:'8px',boxShadow:'0 4px 12px rgba(0,0,0,.1)',zIndex:10,maxHeight:'180px',overflowY:'auto',marginTop:'2px'}}>
                        {clients.filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)).map(c => (
                          <div key={c.id} onPointerDown={function(e){e.preventDefault(); setSelectedClient(c.id); setClientSearch(c.name + (c.phone ? ' | '+c.phone : '')); setClientDrop(false); applyLoyalty(c.id); }}
                            style={{padding:'8px 10px',cursor:'pointer',fontSize:'.80rem',borderBottom:'1px solid #f5f5f5',background: selectedClient === c.id ? '#f5f5f5' : '#fff'}}
                            onMouseEnter={e => e.currentTarget.style.background='#f9f9f9'}
                            onMouseLeave={e => e.currentTarget.style.background='#fff'}>{c.name}{(()=>{try{const j=JSON.parse(c.comment||'{}');return j.n1?' | '+j.n1:''}catch(e){return ''}})()}{c.phone ? ' | '+c.phone : ''}</div>
                        ))}
                        {clients.filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)).length === 0 && (
                          <div style={{padding:'10px',fontSize:'.80rem',color:'#777',textAlign:'center'}}>Ничего не найдено</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => { setShowAddClient(true); setNewClientName(''); setNewClientPhone(''); setNewClientEmail(''); setNewClientBirthday(''); setNewClientNote1(''); setNewClientNote2(''); setClientSearch(''); }} 
                    style={{padding:'9px 12px',border:'1.5px solid #eee',borderRadius:'12px',background:'#f5f5f5',color:'#444',fontSize:'.76rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>+</button>
                </div>
                {/* Баллы выбранного клиента — видно сразу */}
                {selectedClient && (() => {
                  const sc = clients.find(c => c.id === selectedClient);
                  const pts = Number(sc?.points) || 0;
                  if (pts <= 0) return null;
                  return (
                    <div style={{marginTop:'6px',fontSize:'.74rem',color:'#7c3aed',fontWeight:600}}>
                      Баллы клиента: {pts.toLocaleString()}
                    </div>
                  );
                })()}
              </div>
              
              {/* Комментарий */}
              <div style={{marginBottom:'14px'}}>
                <div style={{fontSize:'.76rem',fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:'.3px',marginBottom:'8px'}}>Комментарий</div>
                <div style={{display:'flex',gap:'6px'}}>
                  <input type="text" value={receiptComment} onChange={e=>setReceiptComment(e.target.value)} placeholder="Примечание..." 
                    style={{flex:1,padding:'9px 10px',border:'1.5px solid #eee',borderRadius:'8px',fontSize:'.76rem',outline:'none',fontFamily:'inherit'}} />
                  <span style={{width:'45px',flexShrink:0}}></span>
                </div>
              </div>
              
              <button type="button" onClick={processPay} disabled={!selectedClient}
                style={{padding:"14px 28px",border:"none",borderRadius:"100px",fontSize:".80rem",fontWeight:700,cursor: selectedClient ? "pointer" : "not-allowed",fontFamily:"inherit",background:"#ffdd2d",color:"#222",alignSelf:"flex-end",marginTop:"auto",opacity: selectedClient ? 1 : 0.4}}>{payUnpaid ? 'Сохранить' : 'Оплатить'}</button>
            </div>
          </div>
        </div>
      )}
      {showAddClient && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowAddClient(false); }}>
          <div className="modal-box" style={{maxWidth:'380px'}}>
            <button className="modal-close" onClick={() => setShowAddClient(false)}>&times;</button>
            <h2>Новый клиент</h2>
            <div className="modal-sub" style={{marginBottom:'12px'}}>Добавьте клиента для привязки к чеку</div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newClientName.trim()) return setToast('⚠️ Введите имя');
              var { data, error } = await supabase.from('clients').insert({
                user_id: user.id, name: newClientName.trim(), phone: newClientPhone.trim(), email: newClientEmail.trim() || null, birthday: newClientBirthday || null, comment: (newClientNote1||newClientNote2) ? JSON.stringify({n1:newClientNote1.trim(), n2:newClientNote2.trim()}) : null,
              }).select();
              if (error) return setToast('' + error.message);
              // Обновляем список клиентов
              var clData = await supabase.from('clients').select('*').eq('user_id', user.id).order('name');
              if (clData.data) setClients(clData.data);
              // Автоматически выбираем нового клиента
              if (data && data.length > 0) { setSelectedClient(data[0].id); applyLoyalty(data[0].id); }
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
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="ivan@mail.ru" />
              </div>
              <div className="form-group">
                <label>Дата рождения</label>
                <input type="date" value={newClientBirthday} onChange={e => setNewClientBirthday(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Примечание 1</label>
                <input type="text" value={newClientNote1} onChange={e => setNewClientNote1(e.target.value)} placeholder="Марка скутера, год и т.д." />
              </div>
              <div className="form-group">
                <label>Примечание 2</label>
                <input type="text" value={newClientNote2} onChange={e => setNewClientNote2(e.target.value)} placeholder="Номер ПТС, Telegram и т.д." />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-dark">Добавить</button>
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
              <div className="modal-sub">Для работы кассы необходимо открыть смену</div>
              <form onSubmit={e => { e.preventDefault(); openShift(); }}>
                <div className="form-group"><label>Кассир</label><input type="text" value={openShiftCashier} onChange={e => setOpenShiftCashier(e.target.value)} /></div>
                <div className="form-group"><label>Остаток денег на начало дня</label>
                  <div style={{display:'flex',gap:'.35rem',alignItems:'center'}}>
                    <input type="number" placeholder="0" min="0" step="0.01" value={openShiftBal} onChange={e => setOpenShiftBal(e.target.value)} autoFocus />
                    {cashRegBal > 0 && <span style={{fontSize:'.80rem',color:'var(--muted)',whiteSpace:'nowrap'}}>Баланс Кассы: {Math.round(cashRegBal).toLocaleString()} {cur}</span>}
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
                const { data } = await supabase.from('receipts').select('*').eq('user_id', user.id).eq('shift_id', activeShift.id);
                setShiftReceipts(data || []);
                loadRefundToday();
                setShowCloseShift(true);
              }} style={{padding:'12px 16px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#222',fontSize:'.80rem',fontWeight:600,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>Закрыть смену</button>
              <button onClick={() => { setShowActions(false); setEditingCashier(true); }} style={{padding:'12px 16px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#222',fontSize:'.80rem',fontWeight:600,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>Сменить кассира</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка смены кассира */}
      {editingCashier && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setEditingCashier(false); }}>
          <div className="modal-box" style={{maxWidth:'380px'}}>
            <button className="modal-close" onClick={() => setEditingCashier(false)}>&times;</button>
            <h2>Сменить кассира</h2>
            <div style={{background:'#f9f9f9',borderRadius:'8px',padding:'10px',marginBottom:'12px',fontSize:'.80rem',lineHeight:1.7}}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#777'}}>Текущий:</span><span style={{fontWeight:600}}>{activeShift?.cashier_name || effectiveName || 'Кассир'}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#777"}}>&#x41E;&#x441;&#x442;&#x430;&#x442;&#x43E;&#x43A; &#x432; &#x43A;&#x430;&#x441;&#x441;&#x435;:</span><span style={{fontWeight:700}}>{(function(){var b=0;var ca=accounts.find(function(a){return a.type==="cash_register"});if(ca){b=parseFloat(ca.balance)||0;(shiftReceipts||[]).forEach(function(r){(r.payments||[]).forEach(function(p){if(p.account_id===ca.id)b+=Number(p.amount||0)});});}return Math.round(b - refundSum).toLocaleString()})()} {cur}</span></div>
            </div>
            <div className="form-group">
              <label>Новый кассир</label>
              <select value={transferEmpId} onChange={e=>setTransferEmpId(e.target.value)} style={{width:'100%',padding:'10px 12px',border:'1px solid #ddd',borderRadius:'8px',fontSize:'.80rem',outline:'none',fontFamily:'inherit',boxSizing:'border-box',background:'#fff'}}>
                <option value="">— выберите сотрудника —</option>
                {employees.map(function(e){return <option key={e.id} value={e.id}>{e.name}</option>})}
              </select>
            </div>
            <div className="form-group">
              <label>Остаток при передаче (?)</label>
              <input type="number" value={transferBalance} onChange={e=>setTransferBalance(e.target.value)} min="0" step="0.01" style={{width:'100%',padding:'10px 12px',border:'1px solid #ddd',borderRadius:'8px',fontSize:'.80rem',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} />
            </div>
            <div style={{marginTop:'12px',display:'flex',gap:'8px'}}>
              <button type="button" className="btn btn-outline" onClick={() => setEditingCashier(false)} style={{flex:1}}>Отмена</button>
              <button onClick={async () => {
                const newEmpId = transferEmpId;
                if (!newEmpId) { showToast('Выберите сотрудника', 'warning'); return; }
                if (!transferBalance && transferBalance !== '0') { showToast('Укажите остаток', 'warning'); return; }
                const newEmp = employees.find(function(e){return e.id === newEmpId});
                const newCashierName = newEmp?.name || 'Кассир';
                const bal = parseFloat(transferBalance) || 0;
                if (activeShift) {
                  const changes = activeShift.cashier_changes || [];
                  changes.push({ from: activeShift.current_cashier_name || activeShift.cashier_name || effectiveName, to: newCashierName, balance: bal, timestamp: new Date().toISOString() });
                  await supabase.from('shifts').update({ current_cashier_name: newCashierName, cashier_changes: changes }).eq('id', activeShift.id).eq('user_id', user.id);
                  setActiveShift({...activeShift, current_cashier_name: newCashierName, cashier_changes: changes});
                }
                setDisplayCashierName(newCashierName);
                setTransferEmpId('');
                setTransferBalance('');
                setEditingCashier(false);
                showToast('Кассир сменён: ' + newCashierName, 'success');
              }} style={{flex:1,padding:'10px',borderRadius:'8px',border:'none',background:'#000',color:'#fff',fontSize:'.80rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Передать смену</button>
            </div>
          </div>
        </div>
      )}

      {/* Чеки за смену */}
      {showReceiptsModal && !showCloseShift && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') { setShowReceiptsModal(false); } }}>
          <div className="modal-box" style={{maxWidth:'520px'}}>
            <button className="modal-close" onClick={() => setShowReceiptsModal(false)}>&times;</button>
            <h2>Чеки за смену</h2>
            <div className="modal-sub" style={{marginBottom:'12px'}}>Чеки, пробитые через кассу</div>
            <div className="product-table" style={{overflowY:'auto',maxHeight:'50vh'}}>
              <table>
                <thead>
                  <tr>
                    <th style={{textAlign:'left'}}>Чек</th>
                    <th style={{textAlign:'left'}}>Товар</th>
                    <th style={{textAlign:'left'}}>Время</th>
                    <th style={{textAlign:'left'}}>Способ</th>
                    <th style={{textAlign:'left'}}>Статус</th>
                    <th style={{textAlign:'left'}}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {registerReceipts.map((r, i) => (
                    <tr key={i}>
                      <td style={{textAlign:'left',fontWeight:600}}>{r.receipt_number}</td>
                      <td style={{textAlign:'left'}}><span className="prod-name">{r.items_str}</span></td>
                      <td style={{textAlign:'left'}}>{r.time_str}</td>
                      <td style={{textAlign:'left'}}>{r.accounts_str}</td>
                      <td style={{textAlign:'left'}}>
                        <span style={{display:'inline-block',padding:'.2rem .6rem',borderRadius:'100px',fontSize:'.76rem',fontWeight:600,background: r.status === 'unpaid' ? '#fff3cd' : '#f0fdf4',color: r.status === 'unpaid' ? '#d97706' : '#16a34a'}}>{r.status === 'unpaid' ? 'Не оплачен' : 'Оплачен'}</span>
                      </td>
                      <td style={{textAlign:'left',fontWeight:600}}><span className="num">{Number(r.total_amount || 0).toLocaleString()} {cur}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{padding:'12px 0',borderTop:'1px solid #eee',marginTop:'12px',display:'flex',alignItems:'baseline',gap:'6px',fontWeight:700,fontSize:'.95rem'}}>
              <span>Итого:</span>
              <span>{registerReceipts.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0).toLocaleString()} {cur}</span>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowReceiptsModal(false)}>Закрыть</button>
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
            <div className="modal-sub" style={{marginBottom:'12px'}}>Проверьте баланс перед закрытием</div>
            
            <div style={{background:'#f9f9f9',borderRadius:'10px',padding:'12px',fontSize:'.80rem',lineHeight:1.8,marginBottom:'12px'}}>
              <div style={{display:'flex'}}>
                <span style={{flex:1}}>Начальный остаток</span>
                <span>{(parseFloat(activeShift.opening_balance) || 0).toLocaleString()} {cur}</span>
              </div>
              <div style={{borderTop:'1px solid #eee',margin:'4px 0'}}></div>
              {(() => {
                const byAc = {};
                (shiftReceipts||[]).forEach(r => {
                  (r.payments||[]).forEach(p => {
                    const key = p.account_id || 'unknown';
                    byAc[key] = (byAc[key] || 0) + (parseFloat(p.amount) || 0);
                  });
                });
                const acMap = {};
                accounts.forEach(a => { acMap[a.id] = a.name; });
                return Object.entries(byAc).map(([acId, amt]) => (
                  <div key={acId} style={{display:'flex',padding:'2px 0'}}>
                    <span style={{flex:1}}>{acMap[acId] || 'Без счёта'}</span>
                    <span>+{amt.toLocaleString()} {cur}</span>
                  </div>
                ));
              })()}
              {(() => {
                const debtSum = (shiftReceipts||[]).reduce((s, r) => s + Math.max(0, (Number(r.total_amount)||0) - (Number(r.paid_amount)||0)), 0);
                return debtSum > 0 ? (
                  <div style={{display:'flex',padding:'2px 0',color:'#d97706'}}>
                    <span style={{flex:1}}>Продажи в долг (не в кассе)</span>
                    <span>+{debtSum.toLocaleString()} {cur}</span>
                  </div>
                ) : null;
              })()}
              {refundSum > 0 && (
                <>
                  <div style={{borderTop:'1px solid #eee',margin:'4px 0'}}></div>
                  <div style={{fontWeight:700,color:'#ea580c',padding:'2px 0'}}>↩ Возвраты наличными за смену</div>
                  {refundToday.map((rf, i) => (
                    <div key={i} style={{display:'flex',padding:'2px 0',color:'#ea580c'}}>
                      <span style={{flex:1}}>Чек №{rf.receipt_number}{rf.date ? ' от ' + String(rf.date).split('T')[0].split('-').reverse().join('.') : ''}{rf.reason ? ' — ' + rf.reason : ''}</span>
                      <span>−{rf.amount.toLocaleString()} {cur}</span>
                    </div>
                  ))}
                  <div style={{fontSize:'.70rem',color:'#c97a3d',padding:'2px 0'}}>Деньги отданы из кассы по возвратам (по чекам прошлых дней) — учтены в расчётном остатке</div>
                </>
              )}
              <div style={{borderTop:'1px solid #eee',margin:'4px 0'}}></div>
              <div style={{display:'flex',fontWeight:700}}>
                <span style={{flex:1}}>Расчётный остаток</span>
                <span>{( (parseFloat(activeShift.opening_balance)||0) + (shiftReceipts||[]).reduce((s, r) => s + (r.payments||[]).reduce((a, p) => a + (parseFloat(p.amount)||0), 0), 0) - refundSum ).toLocaleString()} {cur}</span>
              </div>
            </div>

            <div className="form-group">
              <label>Фактический остаток в кассе (₽)</label>
              <input type="number" min="0" step="0.01" placeholder="0" value={closeFactBal} onChange={e => setCloseFactBal(e.target.value)} autoFocus />
            </div>
            {closeFactBal && (() => {
              const calcBal = (parseFloat(activeShift.opening_balance)||0) + (shiftReceipts||[]).reduce((s, r) => s + (r.payments||[]).reduce((a, p) => a + (parseFloat(p.amount)||0), 0), 0) - refundSum;
              const fact = parseFloat(closeFactBal) || 0;
              const diff = fact - calcBal;
              if (Math.abs(diff) < 0.01) {
                return <div style={{textAlign:'center',padding:'6px',background:'#f0fdf4',borderRadius:'8px',color:'#16a34a',fontWeight:600,fontSize:'.80rem',marginBottom:'8px'}}>✅ Касса сходится</div>;
              } else {
                return <div style={{textAlign:'center',padding:'6px',background:'#fef2f2',borderRadius:'8px',color:'#dc2626',fontWeight:600,fontSize:'.80rem',marginBottom:'8px'}}>⚠️ Расхождение: {diff > 0 ? 'излишек' : 'недостача'} {Math.abs(diff).toLocaleString()} {cur}</div>;
              }
            })()}

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowCloseShift(false)}>Отмена</button>
              <button type="button" className="btn btn-account-select" style={{background:'#dc2626',color:'#fff'}} onClick={async () => {
                const fact = parseFloat(closeFactBal);
                if (isNaN(fact)) return setToast('⚠️ Введите фактический остаток');
                const calcBal = (parseFloat(activeShift.opening_balance)||0) + (shiftReceipts||[]).reduce((s, r) => s + (r.payments||[]).reduce((a, p) => a + (parseFloat(p.amount)||0), 0), 0) - refundSum;
                try {
                  // Номер смены (для описания транзакции): считаем только закрытые + 1.
                  // Внимание: кастомный клиент не поддерживает count/head — берём длину списка закрытых смен.
                  const { data: closedShifts } = await supabase.from('shifts').select('*').eq('user_id', user.id).eq('status', 'closed');
                  const shiftNum = (closedShifts?.length || 0) + 1;
                  // Категория «Доход от продаж»
                  let saleCatId = null;
                  const { data: cats } = await supabase.from('categories').select('id').eq('user_id', user.id).eq('name', 'Доход от продаж').maybeSingle();
                  if (cats) saleCatId = cats.id;
                  // Агрегируем оплаты смены по счетам (только реально оплаченное)
                  const byAc = {};
                  (shiftReceipts||[]).forEach(r => (r.payments||[]).forEach(p => { const k = p.account_id || null; byAc[k] = (byAc[k]||0) + (parseFloat(p.amount)||0); }));
                  const txList = Object.entries(byAc).filter(([, amt]) => amt > 0).map(([acId, amt]) => ({
                    user_id: user.id, type: 'income', amount: Math.round(amt),
                    description: 'Кассовая смена №' + shiftNum,
                    date: tzToday(),
                    account_id: acId, status: 'paid', category_id: saleCatId,
                  }));
                  if (txList.length > 0) await supabase.from('transactions').insert(txList);
                  // Закрываем смену (сохраняем номер — чтобы раздел «Смены» показывал реальный №)
                  const { error } = await supabase.from('shifts').update({
                    closed_at: new Date().toISOString(),
                    closing_balance: fact,
                    status: 'closed',
                    shift_number: shiftNum,
                  }).eq('id', activeShift.id);
                  if (error) return setToast('' + error.message);
                  setShowCloseShift(false); setCloseFactBal(''); setShiftTx([]); setShiftReceipts([]);
                  setActiveShift(null);
                  setShowOpenShift(true);
                  setOpenShiftCashier(userName);
                  setOpenShiftBal('0');
                  setToast('Смена №' + shiftNum + ' закрыта' + (Math.abs(fact - calcBal) > 0.01 ? ' (расхождение ' + (fact - calcBal > 0 ? 'излишек' : 'недостача') + ' ' + Math.abs(fact - calcBal).toLocaleString() + ' ₽)' : ''));
                } catch(err) { return setToast('' + err.message); }
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
                <span style={{fontSize:'.95rem',fontWeight:700,letterSpacing:'-.02em'}}>Чек #{cur.id?.toString().slice(-3) || '—'}</span>
                {cur.clientName ? (
                  <div className="sub" style={{marginBottom:0,fontSize:'.80rem',color:'var(--muted)'}}>
                    {cur.clientName} | {cur.items?.length || 0} товаров | {Number(cur.total||0).toLocaleString()} {cur}
                  </div>
                ) : null}
              </div>

              {/* Серая плашка с товарами */}
              <div style={{background:'#f9f9f9',borderRadius:'12px',padding:'14px',fontSize:'.80rem',lineHeight:2,flex:1,overflowY:'auto'}}>
                {/* Заголовки */}
                <div style={{display:'flex',fontSize:'.76rem',fontWeight:600,color:'#777',padding:'2px 0 4px',borderBottom:'1px solid #e8e8e8',marginBottom:'2px'}}>
                  <span style={{flex:1}}>Товар</span>
                  <span style={{width:'50px',textAlign:'center'}}>Кол-во</span>
                  <span style={{width:'60px',textAlign:'right'}}>Цена</span>
                  <span style={{width:'80px',textAlign:'right'}}>Сумма</span>
                </div>
                {(cur.items||[]).map(function(item,i){
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'4px'}}>
                      <span style={{flex:1,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</span>
                      <span style={{width:'50px',textAlign:'center',color:'#777',fontSize:'.80rem'}}>{item.qty}</span>
                      <span style={{width:'60px',textAlign:'right',color:'#777',fontSize:'.80rem'}}>{Number(item.price).toLocaleString()}</span>
                      <span style={{width:'80px',textAlign:'right',fontWeight:600}}>{Number(item.price*item.qty).toLocaleString()} {cur}</span>
                    </div>
                  );
                })}
                <div style={{borderTop:'1px solid #e8e8e8',margin:'4px 0'}}></div>
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:'.80rem',padding:'2px 0'}}>
                  <span>Итого</span>
                  <span>{Number(cur.total||0).toLocaleString()} {cur}</span>
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
                }} style={{flex:1,padding:'10px',borderRadius:'10px',border:'none',background:'#f5f5f5',color:'#777',fontSize:'.80rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>✕ Удалить</button>
                <button type="button" onClick={function(){
                  setCart(cur.items || []);
                  setSelectedClient(cur.client || '');
                  if (cur.client) applyLoyalty(cur.client);
                  setClientSearch(cur.clientName || '');
                  var newList = heldReceipts.filter(function(_,i){return i!==heldIndex;});
                  setHeldReceipts(newList);
                  setShowHoldModal(false);
                }} style={{flex:1,padding:'10px',borderRadius:'10px',border:'none',background:'#111',color:'#fff',fontSize:'.80rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>→ Продолжить</button>
              </div>

              {/* Точки */}
              <div style={{display:'flex',gap:'5px',justifyContent:'center',alignItems:'center',marginTop:'10px'}}>
                {heldReceipts.map(function(_,i){return <span key={i} style={{height:'4px',borderRadius:'100px',background:i===heldIndex?'#111':'#ddd',width:i===heldIndex?'20px':'6px',transition:'.3s'}}></span>;})}
              </div>

              {/* Навигация */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px',paddingTop:'10px',marginTop:'8px',borderTop:'1px solid #f0f0f0',fontSize:'.76rem',color:'#777'}}>
                <span onClick={function(){if(heldIndex>0)setHeldIndex(heldIndex-1)}} style={{fontSize:'.95rem',color:heldIndex>0?'#111':'#bbb',cursor:heldIndex>0?'pointer':'default',userSelect:'none',lineHeight:1}}>←</span>
                <span>Чек {heldIndex+1} из {heldReceipts.length}</span>
                <span onClick={function(){if(heldIndex<heldReceipts.length-1)setHeldIndex(heldIndex+1)}} style={{fontSize:'.95rem',color:heldIndex<heldReceipts.length-1?'#111':'#bbb',cursor:heldIndex<heldReceipts.length-1?'pointer':'default',userSelect:'none',lineHeight:1}}>→</span>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
    </div>
    </>
  );
}