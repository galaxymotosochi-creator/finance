import Modal from '../../components/Modal';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { getCurrencySymbol } from '../../lib/currency';
import { tzToday } from '../../lib/dates';
import CenterSpinner from '../../components/CenterSpinner';
import SectionHelp from '../../components/SectionHelp';


const STATUS_LABELS = {pending:'Начислено',accrued:'Начислено',paid:'Выплачено',cancelled:'Отменено'};
const STATUS_COLORS = {accrued:'#2563eb',paid:'#16a34a',cancelled:'#dc2626'};
const SALARY_TYPES = [{value:'fixed',label:'Фиксированный оклад'},{value:'shift',label:'За смену'},{value:'piecework',label:'Сдельная'}];

function daysInMonth(y,m){return new Date(y,m,0).getDate()}

function calcProportionalSalary(monthlySalary, from, to){
  if(!monthlySalary||!from||!to) return 0;
  var f=new Date(from), t=new Date(to);
  if(f>t) return 0;
  var lastDay = new Date(t.getFullYear(), t.getMonth()+1, 0);
  if(f.getDate()===1 && t.getTime()===lastDay.getTime()) return Math.round(monthlySalary);
  if(f.getDate()===t.getDate()){
    var monthsDiff = (t.getFullYear()-f.getFullYear())*12 + t.getMonth()-f.getMonth();
    if(monthsDiff === 1) return Math.round(monthlySalary);
  }
  var total=0;
  var cur=new Date(f);
  while(cur<=t){
    var y=cur.getFullYear(), m=cur.getMonth();
    var last=new Date(y,m+1,0);
    var monthEnd=last<t?last:t;
    var monthStart=(cur.getTime()===f.getTime())?f:new Date(y,m,1);
    var daysInM=daysInMonth(y,m+1);
    var daysWorked=Math.round((monthEnd-monthStart)/(1000*60*60*24))+1;
    if(daysWorked===daysInM) total+=monthlySalary;
    else total+=monthlySalary/daysInM*daysWorked;
    cur=new Date(y,m+1,1);
  }
  return Math.round(total);
}

function calcDays(from,to){
  if(!from||!to) return 0;
  return Math.round((new Date(to)-new Date(from))/(1000*60*60*24))+1;
}

const fmtDate = (ds) => { if(!ds) return ''; var d=String(ds).split('T')[0]; var p=d.split('-'); return p.length===3?p[2]+'.'+p[1]:d; };

// Бонус за позицию по правилам сотрудника (приоритет: позиция → категория → тип)
function calcSalesBonus(rules, row, prods, cats) {
  if (!rules || rules.length === 0) return { rub: 0, pct: 0 };
  const p = prods.find(x => String(x.id) === String(row.product_id));
  const type = p ? p.type : 'product';
  const catName = p ? (p.cat || '') : '';
  const cat = cats.find(c => String(c.name) === String(catName) && String(c.type) === String(type));
  const total = Number(row.total) || 0;
  const qty = Number(row.qty) || 0;
  const order = ['product', 'service', 'product_category', 'service_category', 'all_products', 'all_services'];
  let rule = null;
  order.forEach(sc => {
    if (rule) return;
    const r = rules.find(x => x.scope === sc);
    if (!r) return;
    if (sc === 'product' && type !== 'service' && String(r.ref) === String(row.product_id)) rule = r;
    else if (sc === 'service' && type === 'service' && String(r.ref) === String(row.product_id)) rule = r;
    else if (sc === 'product_category' && type !== 'service' && cat && String(r.ref) === String(cat.id)) rule = r;
    else if (sc === 'service_category' && type === 'service' && cat && String(r.ref) === String(cat.id)) rule = r;
    else if (sc === 'all_products' && type !== 'service') rule = r;
    else if (sc === 'all_services' && type === 'service') rule = r;
  });
  if (!rule) return { rub: 0, pct: 0 };
  const val = Number(rule.val) || 0;
  if (rule.vt === 'fixed') {
    const rub = Math.round(val * qty);
    return { rub, pct: total > 0 ? Math.round(rub / total * 1000) / 10 : 0 };
  }
  const rub = Math.round(total * val / 100);
  return { rub, pct: val };
}

export default function Salary() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [accs, setAccs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showAcc, setShowAcc] = useState(false);
  const [pendingPayId, setPendingPayId] = useState(null);
  const [payAcctId, setPayAcctId] = useState(''); // выбранный счет в модалке выплаты
  const [payAmount, setPayAmount] = useState(''); // сумма к выплате (можно выплатить часть)
  // Фильтры (как в разделе «Чеки»)
  const [salStatus, setSalStatus] = useState(null);
  const [salSearch, setSalSearch] = useState('');
  const [salPeriodOpen, setSalPeriodOpen] = useState(false);
  const [salTypeOpen, setSalTypeOpen] = useState(false);
  const [salPeriod, setSalPeriod] = useState('all');
  const [salSearchFocus, setSalSearchFocus] = useState(false);
  const [salPeriodLabel, setSalPeriodLabel] = useState('Все время');
  const [salPeriodFrom, setSalPeriodFrom] = useState('');
  const [salPeriodTo, setSalPeriodTo] = useState('');
  // Подсказка скролла таблицы (как в «Сменах» и «Счетах»)
  // Подсказка скролла: показывается ТОЛЬКО когда реально есть что прокрутить
  const [tblPos, setTblPos] = useState({left:false, right:false});
  const tblElRef = useRef(null);
  // Подсказка скролла вложенных таблиц: гаснет, когда прокрутили до конца
  const [salesPos, setSalesPos] = useState({left:false, right:true});
  const [rewardPos, setRewardPos] = useState({left:false, right:true});
  const salesWrapRef = useRef(null);
  const rewardWrapRef = useRef(null);
  const mkScroll = (setter) => (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setter({ left:false, right:false }); return; }
    setter({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const onSalesScroll = mkScroll(setSalesPos);
  const onRewardScroll = mkScroll(setRewardPos);
  const checkInner = () => {
    [ [salesWrapRef, setSalesPos], [rewardWrapRef, setRewardPos] ].forEach(([ref, setter]) => {
      const el = ref.current; if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) { setter({ left:false, right:false }); return; }
      setter({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
    });
  };
  const onTblScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left:false, right:false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const checkTbl = () => {
    const el = tblElRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { setTblPos({ left:false, right:false }); return; }
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  useEffect(() => {
    const run = () => { checkTbl(); checkInner(); };
    const t = setTimeout(run, 120);
    window.addEventListener('resize', run);
    return () => { clearTimeout(t); window.removeEventListener('resize', run); };
  });

  // Form
  const [fEmpId, setFEmpId] = useState('');
  const [fPeriodFrom, setFPeriodFrom] = useState('');
  const [fPeriodTo, setFPeriodTo] = useState('');
  const [fBaseSalary, setFBaseSalary] = useState(0);
  const [fSalaryType, setFSalaryType] = useState('fixed');
  const [fSalaryTotal, setFSalaryTotal] = useState(0);
  const [fDays, setFDays] = useState(0);
  const [fPayType, setFPayType] = useState('salary');
  const [existingDebt, setExistingDebt] = useState(0);
  const [fStatus, setFStatus] = useState('pending');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);

  // Timesheet data
  const [tsEntries, setTsEntries] = useState([]);
  const [bonusChecks, setBonusChecks] = useState({});
  const [deductChecks, setDeductChecks] = useState({});
  const [empDebts, setEmpDebts] = useState([]); // долги сотрудника (недостачи по инвентаризации)
  const [debtChecks, setDebtChecks] = useState({});
  const [tsLoaded, setTsLoaded] = useState(false);
  const [salarySplitMode, setSalarySplitMode] = useState(false);
  const [salesOn, setSalesOn] = useState(true);
  const [storeOn, setStoreOn] = useState(true);
  const [rewardOn, setRewardOn] = useState(true);
  const [bonusOpen, setBonusOpen] = useState(true);
  const [fineOpen, setFineOpen] = useState(true);
  const [debtOpen, setDebtOpen] = useState(true);
  const [debtInclude, setDebtInclude] = useState(true);
  const [salarySplitAmounts, setSalarySplitAmounts] = useState({});
  const [dupSalary, setDupSalary] = useState(null); // уже есть начисление за этот период (защита от дублей)
  // Транзакции по счетам — чтобы проверять реальный баланс при выплате (начальный остаток + движения)
  const [accTxs, setAccTxs] = useState([]);
  // Продажи сотрудника (бонусы с продаж)
  const [salesRows, setSalesRows] = useState([]);
  const [rewardRows, setRewardRows] = useState([]); // вознаграждение исполнителю из чеков (employee_splits)
  const [rewardEdit, setRewardEdit] = useState({}); // ручные правки сумм вознаграждения
  const [salesBonus, setSalesBonus] = useState({});
  const [salesLoaded, setSalesLoaded] = useState(false);
  const [prodRef, setProdRef] = useState([]);
  const [catRef, setCatRef] = useState([]);
  const [storeInfo, setStoreInfo] = useState(null); // {revenue, bonus, stack} — бонус от всей выручки

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }
    try {
      const [salRes, empRes, accRes, txRes] = await Promise.all([
        supabase.from('salary').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('employees').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        user ? supabase.from('accounts').select('*') : Promise.resolve({data:[]}),
        user ? supabase.from('transactions').select('account_id,type,amount').eq('user_id', user.id) : Promise.resolve({data:[]}),
      ]);
      if (salRes.error) { alert('Ошибка загрузки: ' + salRes.error.message); setLoading(false); return; }
      if (salRes.data) setList(salRes.data);
      if (empRes.data) {
        setEmployees(empRes.data);
        setFEmpId(prev => prev || (empRes.data[0] ? empRes.data[0].id : ''));
      }
      if (accRes.data) setAccs(accRes.data);
      if (txRes.data) setAccTxs(txRes.data);
    } catch (e) { alert('Ошибка загрузки: ' + e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'salary', setList: setList, onSynced: load });

  // Загрузка табеля при выборе сотрудника + периода
  useEffect(() => {
    if (!fEmpId || !fPeriodFrom || !fPeriodTo) { setTsEntries([]); setBonusChecks({}); setDeductChecks({}); setTsLoaded(false); return; }
    (async () => {
      setTsLoaded(false);
      try {
        const { data } = await supabase
          .from('timesheet_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('employee_id', fEmpId)
          .gte('date', fPeriodFrom)
          .lte('date', fPeriodTo);
        const entries = data || [];
        setTsEntries(entries);
        const bc = {}; const dc = {};
        entries.forEach(e => {
          if ((e.bonus_amount||0) > 0) bc[e.id] = true;
          if ((e.deduct_amount||0) > 0) dc[e.id] = true;
        });
        setBonusChecks(bc);
        setDeductChecks(dc);
        setTsLoaded(true);
      } catch(e) { setTsLoaded(true); }
    })();
  }, [fEmpId, fPeriodFrom, fPeriodTo, user]);

  // Загрузка долгов сотрудника (недостачи по инвентаризации) — для удержания
  useEffect(() => {
    if (!fEmpId) { setEmpDebts([]); setDebtChecks({}); return; }
    (async () => {
      const { data } = await supabase
        .from('employee_debts')
        .select('*')
        .eq('user_id', user.id)
        .eq('employee_id', fEmpId)
        .eq('status', 'pending');
      setEmpDebts(data || []);
      const dc = {};
      (data || []).forEach(d => { dc[d.id] = true; }); // по умолчанию все отмечены
      setDebtChecks(dc);
    })();
  }, [fEmpId, user, show]);

  // Подтянуть оклад из сотрудника (только в новом начислении и если оклад ещё не начислялся за период)
  useEffect(() => {
    if (!fEmpId) return;
    const emp = employees.find(e => e.id === fEmpId);
    if (!emp) return;
    // Если за этот период уже есть начисление с окладом — не подставляем оклад повторно
    const alreadyBase = (list || []).some(s2 =>
      s2.employee_id === fEmpId &&
      String(s2.period_from || '').slice(0, 10) === fPeriodFrom &&
      String(s2.period_to || '').slice(0, 10) === fPeriodTo &&
      s2.status !== 'cancelled' && s2.id !== editId &&
      Number(s2.base_salary) > 0
    );
    if (alreadyBase && !editId) { setFBaseSalary(0); return; }
    setFBaseSalary(emp.base_salary || 0);
  }, [fEmpId, employees, fPeriodFrom, fPeriodTo, list, editId]);

  // Продажи и услуги сотрудника за период (для авто-бонусов)
  useEffect(() => {
    if (!fEmpId || !fPeriodFrom || !fPeriodTo) { setSalesRows([]); setSalesBonus({}); setStoreInfo(null); setRewardRows([]); setRewardEdit({}); setSalesLoaded(false); return; }
    (async () => {
      setSalesLoaded(false);
      try {
        let pr = prodRef, cr = catRef;
        if (pr.length === 0) {
          const prRes = await supabase.from('products').select('id,name,type,cat').eq('user_id', user.id);
          const crRes = await supabase.from('stock_categories').select('id,name,type').eq('user_id', user.id);
          pr = prRes.data || []; cr = crRes.data || [];
          setProdRef(pr); setCatRef(cr);
        }
        const { data: recs } = await supabase.from('receipts').select('*').eq('user_id', user.id).gte('date', fPeriodFrom).lte('date', fPeriodTo).order('created_at', { ascending: false });
        const rlist = recs || [];
        if (rlist.length === 0) { setSalesRows([]); setSalesBonus({}); setRewardRows([]); setRewardEdit({}); setSalesLoaded(true); return; }
        const { data: items } = await supabase.from('receipt_items').select('*').in('receipt_id', rlist.map(r => r.id));
        const isService = (pid) => {
          const p = pr.find(x => String(x.id) === String(pid));
          return !!(p && p.type === 'service');
        };
        const rows = [];
        (items || []).forEach(it => {
          if (String(it.employee_id || '') !== String(fEmpId)) return;
          if (isService(it.product_id)) return;   // услуги → в «Вознаграждение», не в продажи
          const r = rlist.find(x => x.id === it.receipt_id);
          if (!r) return;
          const qty = Number(it.quantity) || 1;
          let retQty = 0;
          ((r.refund_items) || []).forEach(rf => { if (String(rf.item_id) === String(it.id)) retQty += Number(rf.qty) || 0; });
          const availQty = Math.max(0, qty - retQty);
          if (availQty <= 0) return;
          const unit = qty > 0 ? (Number(it.total) || 0) / qty : 0;
          // Ручной бонус из кассы (доля сотрудника в чеке) — приоритетнее правил
          const sps = it.employee_splits || [];
          const mineSplit = sps
            .filter(sp => String(sp.employee_id || '') === String(fEmpId))
            .reduce((s2, sp) => s2 + (parseFloat(sp.amount) || 0), 0);
          const splitBonus = Math.round(mineSplit * (availQty / qty));
          rows.push({ itemId: it.id, created: it.created_at || r.created_at || r.date || '', date: String(r.date || '').split('T')[0], name: it.product_name, product_id: it.product_id, qty: availQty, total: Math.round(unit * availQty),
            splitRub: splitBonus > 0 ? splitBonus : null });
        });
        // Новые продажи — первыми (по времени создания позиции/чека)
        rows.sort((a, b) => String(b.created).localeCompare(String(a.created)));
        // Вознаграждение исполнителю: суммы из employee_splits чеков (сколько указано мастеру в кассе)
        const rewRows = [];
        (items || []).forEach(it => {
          // ТОЛЬКО УСЛУГИ — товары сюда не попадают никогда
          if (!isService(it.product_id)) return;
          const sps = it.employee_splits || [];
          const mine = sps.filter(function(s){ return String(s.employee_id || '') === String(fEmpId); });
          const isMine = String(it.employee_id || '') === String(fEmpId);
          // Берём: либо есть доля мастера в чеке, либо он исполнитель услуги
          if (!mine.length && !isMine) return;
          const r = rlist.find(x => x.id === it.receipt_id);
          if (!r) return;
          const qty = Number(it.quantity) || 1;
          let retQty = 0;
          ((r.refund_items) || []).forEach(rf => { if (String(rf.item_id) === String(it.id)) retQty += Number(rf.qty) || 0; });
          const availQty = Math.max(0, qty - retQty);
          if (availQty <= 0) return;
          const factor = qty > 0 ? availQty / qty : 1;
          const amt = Math.round(mine.reduce(function(s2, sp){ return s2 + (parseFloat(sp.amount) || 0); }, 0) * factor);
          rewRows.push({
            itemId: it.id,
            date: String(r.date || '').split('T')[0],
            name: it.product_name,
            amount: amt,
            fromReceipt: amt > 0 ? amt : null,   // «Из чека»: доля мастера из чека, иначе «—»
          });
        });
        setSalesRows(rows);
        setRewardRows(rewRows);
        setRewardEdit({});
        const emp = employees.find(e => e.id === fEmpId);
        const rules = (emp && emp.bonus_rules) || [];
        const bonus = {};
        rows.forEach(row => {
          if (row.splitRub) {
            // Бонус указан в кассе вручную → источник «вписано вручную» (оранжевый)
            bonus[row.itemId] = { rub: row.splitRub, pct: row.total > 0 ? Math.round(row.splitRub / row.total * 1000) / 10 : 0, manual: true };
          } else {
            const c = calcSalesBonus(rules, row, pr, cr);
            bonus[row.itemId] = { rub: c.rub, pct: c.pct };
          }
        });
        // Сохраняем ручные правки — не затираем то, что менеджер вписал руками
        setSalesBonus(prev => {
          const next = { ...bonus };
          Object.keys(prev || {}).forEach(k => {
            if (prev[k] && prev[k].manual) next[k] = prev[k];
          });
          return next;
        });
        // Бонус от всей выручки (управленческий процент): выручка = сумма чеков периода − возвраты
        const revenue = rlist.reduce((sum, r) => sum + Math.max(0, (Number(r.total_amount) || 0) - (Number(r.refund_amount) || 0)), 0);
        const st = rules.find(r => r.scope === 'store_sales');
        if (st) {
          const v = Number(st.val) || 0;
          setStoreInfo({ revenue, pct: st.vt === 'fixed' ? null : v, fixed: st.vt === 'fixed' ? v : null, stack: st.stack !== false });
        } else {
          setStoreInfo(null);
        }
      } catch (e) {}
      setSalesLoaded(true);
      setTimeout(() => { try { checkInner(); } catch (e) {} }, 80);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fEmpId, fPeriodFrom, fPeriodTo]);

  // Пересчет
  useEffect(() => {
    if (fSalaryType === 'fixed') {
      const sal = calcProportionalSalary(fBaseSalary, fPeriodFrom, fPeriodTo);
      setFSalaryTotal(sal);
    } else if (fSalaryType === 'shift') {
      const days = calcDays(fPeriodFrom, fPeriodTo);
      setFSalaryTotal(fBaseSalary * days);
    } else {
      setFSalaryTotal(fBaseSalary || 0);
    }
    setFDays(calcDays(fPeriodFrom, fPeriodTo));
  }, [fBaseSalary, fPeriodFrom, fPeriodTo, fSalaryType]);

  // Долг
  useEffect(() => {
    if (!fEmpId) return;
    let debt = list
      .filter(s => s.employee_id === fEmpId && s.status !== 'cancelled' && s.pay_type !== 'bonus')
      .reduce((sum, s) => {
        const amt = Number(s.amount) || 0;
        // Выданное — закрытый расчёт (0). Аванс без выплаты — его долг нам.
        if (s.status === 'paid') return sum;
        return s.pay_type === 'advance' ? sum + amt : sum;
      }, 0);
    setExistingDebt(debt);
  }, [fEmpId, list]);

  // Защита от дублей: если за выбранный период сотруднику уже начислено — предупреждаем и не даем сохранить
  useEffect(() => {
    if (!fEmpId || !fPeriodFrom || !fPeriodTo) { setDupSalary(null); return; }
    const d = (list || []).find(s =>
      s.employee_id === fEmpId &&
      String(s.period_from || '').slice(0, 10) === fPeriodFrom &&
      String(s.period_to || '').slice(0, 10) === fPeriodTo &&
      s.status !== 'cancelled' &&
      s.id !== editId
    ) || null;
    setDupSalary(d);
  }, [fEmpId, fPeriodFrom, fPeriodTo, list, editId]);

  // Что уже погашено прошлым начислением за этот период (блоки становятся неактивными)
  const dup = dupSalary;
  // Выручка — по маркеру store в sales_items; продажи — по строчным бонусам (не путать!)
  const doneStore = !!(dup && dup.sales_items && Array.isArray(dup.sales_items) && dup.sales_items.some(i => i && i.store === true));
  const doneSales = !!(dup && dup.sales_items && Array.isArray(dup.sales_items) && dup.sales_items.some(i => i && !i.store && Number(i.bonus) > 0));
  const doneReward = !!(dup && dup.reward_items && Array.isArray(dup.reward_items) && dup.reward_items.length > 0);
  const doneBonus = !!(dup && Number(dup.bonus_amount) > 0);
  const doneDeduct = !!(dup && Number(dup.deduct_amount) > 0);

  const tsBonuses = tsEntries.filter(e => (e.bonus_amount||0) > 0);
  const tsDeducts = tsEntries.filter(e => (e.deduct_amount||0) > 0);
  const checkedBonusTotal = tsBonuses.filter(e => bonusChecks[e.id]).reduce((s,e) => s + Number(e.bonus_amount||0), 0);
  const checkedDeductTotal = tsDeducts.filter(e => deductChecks[e.id]).reduce((s,e) => s + Number(e.deduct_amount||0), 0);
  const checkedDebtTotal = empDebts.filter(d => debtChecks[d.id]).reduce((s,d) => s + Number(d.amount||0), 0);
  const salesBonusTotal = Object.values(salesBonus).reduce((s2, b) => s2 + (Number(b.rub) || 0), 0);
  const rewardTotal = rewardRows.reduce((s2, x) => {
    const edited = rewardEdit[x.itemId];
    const v = edited !== undefined && edited !== '' ? (parseFloat(edited) || 0) : (Number(x.amount) || 0);
    return s2 + v;
  }, 0);
  // Если включен «% от всей выручки» без суммирования — позиционные бонусы не учитываются
  const itemsBonusTotal = (storeInfo && storeInfo.stack === false) ? 0 : salesBonusTotal;
  // Бонус от выручки пропорционален отработанным дням (по табелю): если табель за период заполнен —
  // умножаем на (рабочие дни / дни периода), если нет — полный процент
  const tsWorked = tsEntries.filter(en => en.status === 'present' || en.status === 'remote').length;
  const hasTs = tsEntries.length > 0;
  const periodDays = Math.max(1, calcDays(fPeriodFrom, fPeriodTo) || 1);
  const dayFactor = hasTs ? Math.min(1, tsWorked / periodDays) : 1;
  const storeBonus = storeInfo ? (storeInfo.pct != null
    ? Math.round(storeInfo.revenue * storeInfo.pct / 100 * dayFactor)
    : Math.round((storeInfo.fixed || 0) * dayFactor)) : 0;
  const storeNote = (storeInfo && hasTs && dayFactor < 1) ? ' × ' + tsWorked + '/' + periodDays + ' дн.' : '';
  // Галочки блоков влияют на итог: снял галочку → сумма не входит в начисление
  const storeBonusOn = storeOn ? storeBonus : 0;
  const salesBonusOn = (salesOn && !doneSales) ? itemsBonusTotal : 0;
  const storeBonusOnFinal = (storeOn && !doneStore) ? storeBonusOn : 0;
  const rewardOnTotal = (rewardOn && !doneReward) ? rewardTotal : 0;
  const bonusOnTotal = (bonusOpen && !doneBonus) ? checkedBonusTotal : 0;
  const deductOnTotal = (fineOpen && !doneDeduct) ? checkedDeductTotal : 0;
  const debtOnTotal = debtOpen ? checkedDebtTotal : 0;
  const debtIncludeTotal = debtInclude ? existingDebt : 0;
  // Итог = только то, что отмечено галочками И ещё не начислено прошлым начислением за период
  const grandTotal = fSalaryTotal + salesBonusOn + storeBonusOnFinal + rewardOnTotal + bonusOnTotal - deductOnTotal - debtOnTotal - debtIncludeTotal;

  const openAdd = () => {
    // Период по умолчанию: сегодня → тот же день следующего месяца (в поясе программы)
    const _from = tzToday();
    const _d = new Date(_from + 'T12:00:00');
    _d.setMonth(_d.getMonth() + 1);
    const _to = _d.toLocaleDateString('en-CA');
    setEditId(null); setFEmpId(''); setFPeriodFrom(_from); setFPeriodTo(_to);
    setFBaseSalary(0); setFSalaryType('fixed'); setFSalaryTotal(0); setFDays(0);
    setFPayType('salary'); setFStatus('pending'); setFDate(new Date().toISOString().split('T')[0]);
    setExistingDebt(0); setTsEntries([]); setBonusChecks({}); setDeductChecks({});
    setEmpDebts([]); setDebtChecks({});
    // Новое начисление — это доначисление: сбрасываем галочки и данные прошлого расчёта,
    // чтобы в итог попало только то, что ещё НЕ начислено за период
    setSalesOn(true); setStoreOn(true); setRewardOn(true); setBonusOpen(true);
    setFineOpen(true); setDebtOpen(true); setDebtInclude(true);
    setSalesRows([]); setSalesBonus({}); setStoreInfo(null);
    setRewardRows([]); setRewardEdit({}); setSalesLoaded(false);
    setShow(true);
  };

  const openEdit = (s) => {
    if (s.status === 'paid') return alert('Выплаченное начисление нельзя редактировать. Создайте новое начисление или отмените выплату.');
    setEditId(s.id); setFEmpId(s.employee_id||'');
    setFPeriodFrom(String(s.period_from || '').slice(0, 10) || ''); setFPeriodTo(String(s.period_to || '').slice(0, 10) || '');
    setFBaseSalary(s.base_salary||0); setFSalaryType('fixed');
    setFSalaryTotal(s.base_salary||0); setFDays(s.days_worked||0);
    setFPayType(s.pay_type||'salary'); setFStatus(s.status||'pending');
    setFDate(s.date||new Date().toISOString().split('T')[0]);
    // Восстанавливаем checked из bonus_items/deduct_items
    const bc = {}; const dc = {};
    if (s.bonus_items && Array.isArray(s.bonus_items)) s.bonus_items.forEach(i => { if (i.tsEntryId) bc[i.tsEntryId] = true; });
    if (s.deduct_items && Array.isArray(s.deduct_items)) s.deduct_items.forEach(i => { if (i.tsEntryId) dc[i.tsEntryId] = true; });
    setBonusChecks(bc); setDeductChecks(dc);
    // Восстанавливаем ручные бонусы с продаж и выплаты исполнителю
    const sb = {};
    if (s.sales_items && Array.isArray(s.sales_items)) s.sales_items.forEach(i => { if (i.itemId) sb[i.itemId] = { rub: Number(i.bonus) || 0, pct: i.total > 0 ? Math.round((Number(i.bonus)||0) / i.total * 1000) / 10 : 0, manual: true }; });
    setSalesBonus(sb);
    const re = {};
    if (s.reward_items && Array.isArray(s.reward_items)) s.reward_items.forEach(i => { if (i.itemId) re[i.itemId] = i.amount; });
    setRewardEdit(re);
    setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fEmpId) return alert('Выберите сотрудника');
    if (!fPeriodFrom || !fPeriodTo) return alert('Выберите период');
    // Доначисление разрешено: за тот же период может быть второе начисление (остаток бонусов и т.п.)
    if (!user) return alert('Ошибка: пользователь не авторизован');
    const emp = employees.find(e => e.id === fEmpId);
    try {
      let saveQueued = false;
      const takeBonus = tsBonuses.filter(e => bonusChecks[e.id]);
      const takeDeduct = tsDeducts.filter(e => deductChecks[e.id]);
      const takeDebts = empDebts.filter(d => debtChecks[d.id]);
      const debtItems = takeDebts.map(d => ({ debtId: d.id, amount: d.amount, comment: d.comment || 'Недостача' }));
      const obj = {
        user_id: user.id, employee_id: fEmpId, employee_name: emp ? emp.name : 'Сотрудник',
        period_from: fPeriodFrom, period_to: fPeriodTo, period_start: fPeriodFrom, period_end: fPeriodTo,
        base_salary: fBaseSalary, days_worked: fDays,
        // Статус всегда «Начислено» — выплата выполняется только через кнопку «Выплатить» с выбором счета,
        // иначе зарплата помечалась выплаченной без создания расходной операции
        amount: grandTotal, status: 'pending', pay_type: 'salary',
        bonus_amount: bonusOnTotal, bonus_items: bonusOpen ? takeBonus.map(e => ({ tsEntryId: e.id, date: e.date, amount: e.bonus_amount, comment: e.bonus_comment||'' })) : [],
        sales_bonus: salesBonusOn + storeBonusOn,
        sales_items: ((salesOn || storeOn) ? salesRows.map(row => ({ itemId: row.itemId, date: row.date, name: row.name, total: row.total, bonus: salesOn ? (Number(salesBonus[row.itemId]?.rub) || 0) : 0 })) : [])
          .concat(storeOn ? [{ store: true, amount: storeBonusOn }] : []),   // маркер: бонус от выручки начислен
        reward_amount: rewardOnTotal, reward_items: rewardOn ? rewardRows.map(row => { const ed = rewardEdit[row.itemId]; const amt = ed !== undefined && ed !== '' ? (parseFloat(ed) || 0) : row.amount; return { date: row.date, name: row.name, amount: amt }; }) : [],
        deduct_amount: deductOnTotal + debtOnTotal, deduct_items: (fineOpen ? takeDeduct.map(e => ({ tsEntryId: e.id, date: e.date, amount: e.deduct_amount, comment: e.deduct_comment||'' })) : []).concat(debtOpen ? debtItems : []),
        paid_at: null,
      };
      if (editId) { const { error, queued } = await supabase.from('salary').update(obj).eq('id', editId); if (error) throw error; saveQueued = queued; }
      else { const { error, queued } = await supabase.from('salary').insert(obj); if (error) throw error; saveQueued = queued; }
      // Помечаем удержанные долги (статус deducted)
      if (takeDebts.length) {
        const debtRes = await Promise.all(takeDebts.map(d => supabase.from('employee_debts').update({ status: 'deducted', deducted_at: new Date().toISOString() }).eq('id', d.id)));
        if (debtRes.some(r => r && r.queued)) saveQueued = true;
      }
      if (!saveQueued) await load(); setShow(false);
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Удалить начисление?')) return;
    try {
      // Возвращаем списанные долги по недостачам обратно в статус «висит»
      const row = list.find(s => s.id === id);
      const its = (row && Array.isArray(row.deduct_items)) ? row.deduct_items.filter(i => i.debtId) : [];
      if (its.length) {
        await Promise.all(its.map(i => supabase.from('employee_debts').update({ status: 'pending', deducted_at: null }).eq('id', i.debtId)));
      }
      const res = await supabase.from('salary').delete().eq('id', id);
      if (!res.queued) await load();
    }
    catch (err) { alert('Ошибка удаления: ' + err.message); }
  };

  // Реальный баланс счета: начальный остаток + все движения (доходы минус расходы)
  const getAccountBalance = (a) => {
    var b = parseFloat(a.balance || a.initial_balance || 0);
    (accTxs || []).forEach(t => { if (t.account_id === a.id) b += Number(t.amount || 0) * (t.type === 'income' ? 1 : -1); });
    return b;
  };

  const confirmPay = async (accId, splitAmts, customAmount) => {
    try {
      const { data: rows } = await supabase.from('salary').select('*').eq('id', pendingPayId);
      if (!rows || !rows.length) return;
      const s = rows[0];
      // Частичная выплата: сколько уже отдано и сколько платим сейчас
      const alreadyPaid = Number(s.paid_from) || 0;
      const payNow = (customAmount != null && customAmount > 0) ? Number(customAmount) : (Number(s.amount) || 0);

      // Найти или создать категорию «Зарплата»
      var salaryCatId = null;
      var { data: foundCats } = await supabase.from('categories').select('id').eq('user_id', user.id).eq('name', 'Зарплата').maybeSingle();
      if (foundCats) {
        salaryCatId = foundCats.id;
      } else {
        var { data: newCat } = await supabase.from('categories').insert({
          user_id: user.id, name: 'Зарплата', type: 'expense'
        }).select('id').maybeSingle();
        if (newCat) salaryCatId = newCat.id;
      }

      // Проверка баланса — по фактической сумме к выплате
      const payDate = new Date().toISOString().split('T')[0]; // дата выплаты — сегодня
      if (splitAmts && Object.keys(splitAmts).length > 0) {
        let totalSplit = 0;
        for (const [aid, amt] of Object.entries(splitAmts)) {
          if (amt <= 0) continue;
          totalSplit += amt;
          const acct = accs.find(a => a.id === aid);
          const balance = acct ? getAccountBalance(acct) : 0;
          if (balance < amt) {
            return alert('Недостаточно средств на счету ' + (acct?.name || 'счет') + '. Доступно: ' + Math.round(balance).toLocaleString() + ' ' + cur + ', нужно: ' + amt.toLocaleString() + ' ' + cur + '. Разделите выплату на несколько счетов или выберите другой счет.');
          }
        }
      } else {
        const acct = accs.find(a => a.id === accId);
        const balance = acct ? getAccountBalance(acct) : 0;
        if (balance < payNow) {
          return alert('Недостаточно средств на счету ' + (acct?.name || 'счет') + '. Доступно: ' + Math.round(balance).toLocaleString() + ' ' + cur + ', нужно: ' + payNow.toLocaleString() + ' ' + cur + '. Разделите выплату на несколько счетов (кнопка «+ Разделить») или выберите другой счет.');
        }
      }

      if (splitAmts && Object.keys(splitAmts).length > 0) {
        for (const [aid, amt] of Object.entries(splitAmts)) {
          if (amt <= 0) continue;
          const { error } = await supabase.from('transactions').insert({
            user_id: user.id, account_id: aid,
            type: 'expense', amount: amt,
            description: 'Зарплата: ' + (s.employee_name || 'Сотрудник') + ' — ' + fmtD(s.period_from) + ' / ' + fmtD(s.period_to),
            date: payDate, category_id: salaryCatId,
          });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('transactions').insert({
          user_id: user.id, account_id: accId,
          type: 'expense', amount: payNow,
          description: 'Зарплата: ' + (s.employee_name || 'Сотрудник') + ' — ' + fmtD(s.period_from) + ' / ' + fmtD(s.period_to),
          date: payDate, category_id: salaryCatId,
        });
        if (error) throw error;
      }
      // Частичная выплата: считаем итог по факту. Оплачено полностью → статус «paid», иначе остаётся «pending» с накопленным paid_from
      const splitTotal = (splitAmts && Object.keys(splitAmts).length > 0)
        ? Object.values(splitAmts).reduce((a,b)=>a+(parseFloat(b)||0),0)
        : payNow;
      const paidTotal = alreadyPaid + splitTotal;
      const fullyPaid = paidTotal >= (Number(s.amount) || 0) - 0.01;
      const { error: updErr, queued: payQueued } = await supabase.from('salary')
        .update({ paid_from: paidTotal, status: fullyPaid ? 'paid' : 'pending', paid_at: fullyPaid ? payDate : (s.paid_at || null) })
        .eq('id', pendingPayId);
      if (updErr) throw updErr;
      if (!payQueued) await load(); setShowAcc(false); setPendingPayId(null); setPayAcctId(''); setSalarySplitMode(false); setSalarySplitAmounts({}); setPayAmount('');
    } catch (err) { alert('Ошибка выплаты: ' + err.message); }
  };

  const toggleBonus = (id) => setBonusChecks(prev => ({...prev, [id]: !prev[id]}));
  const toggleDeduct = (id) => setDeductChecks(prev => ({...prev, [id]: !prev[id]}));

  const abbreviateName = (name) => {
    if (!name) return '—';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const surname = parts[0];
    const initials = parts.slice(1).map(p => p.charAt(0) + '.').join(' ');
    return surname + ' ' + initials;
  };

  const fmtD = (d) => { if(!d) return '—'; var d0=String(d).split('T')[0]; var p=d0.split('-'); return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:d0; };

  // Итоги по зарплате: общая сумма начислений, выплачено, не выплачено
  const salTotal = (list || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  // Выплачено — по факту: накопленное paid_from, а для старых записей со статусом paid — вся сумма
  const salPaid = (list || []).reduce((sum, s) => {
    const paid = Number(s.paid_from) || 0;
    if (paid > 0) return sum + paid;
    return s.status === 'paid' ? sum + (Number(s.amount) || 0) : sum;
  }, 0);
  const salDue = salTotal - salPaid;

  // Закрытие выпадающих списков зарплаты по клику в любом месте
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.sal-period-wrap')) setSalPeriodOpen(false);
      if (!e.target.closest('.sk-dd-wrap')) {
        document.querySelectorAll('.sk-dd-wrap.open').forEach(w => w.classList.remove('open'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Фильтры списка: статус, поиск, период (как в «Чеках»)
  const salFiltered = (list || []).filter(s => {
    if (salStatus === 'pending' && s.status !== 'pending' && s.status !== 'accrued') return false;
    if (salStatus && salStatus !== 'pending' && s.status !== salStatus) return false;
    if (salSearch) {
      const q = salSearch.toLowerCase();
      const nm = (s.employee_name || '').toLowerCase();
      const note = (s.note || '').toLowerCase();
      if (!nm.includes(q) && !note.includes(q)) return false;
    }
    if (salPeriod !== 'all') {
      const d = s.paid_at || s.period_from || s.created_at;
      if (!d) return false;
      const dt = new Date(d);
      const now = new Date();
      const day = 86400000;
      if (salPeriod === 'today' && dt.toDateString() !== now.toDateString()) return false;
      if (salPeriod === 'yesterday' && dt.toDateString() !== new Date(now.getTime() - day).toDateString()) return false;
      if (salPeriod === 'week' && (now - dt) > 7 * day) return false;
      if (salPeriod === 'month' && (dt.getMonth() !== now.getMonth() || dt.getFullYear() !== now.getFullYear())) return false;
      if (salPeriod === 'custom') {
        const d0 = salPeriodFrom ? new Date(salPeriodFrom) : null;
        const d1 = salPeriodTo ? new Date(salPeriodTo + 'T23:59:59') : null;
        if (d0 && dt < d0) return false;
        if (d1 && dt > d1) return false;
      }
    }
    return true;
  });

  // Сводка по сотрудникам для колец: начислено / выплачено / процент
  const salByEmp = Object.values((list || []).reduce((acc, s) => {
    const key = s.employee_name || 'Сотрудник';
    if (!acc[key]) acc[key] = { name: key, total: 0, paid: 0 };
    const amt = Number(s.amount) || 0;
    acc[key].total += amt;
    if (s.status === 'paid') acc[key].paid += amt;
    return acc;
  }, {})).map(e => ({ ...e, pct: e.total > 0 ? Math.round(e.paid / e.total * 100) : 0 }))
     .sort((a, b) => b.total - a.total);

  return (
    <>
      <div className="sk-bar">
        <div className="grow">
          <div style={{display:'flex',alignItems:'center'}}>
            <h1>Зарплата</h1>
            <SectionHelp
              title="Раздел «Зарплата»"
              intro="Начисления и выплаты сотрудникам. Видно, сколько всего начислено, сколько уже выплачено и сколько осталось."
              faq={[
                { q: 'С чего начать работу?', a: (
                  <ol style={{paddingLeft:'1.15rem',margin:0}}>
                    <li style={{marginBottom:'.5rem'}}>Сначала <b>начислите</b> зарплату — нажмите <b>«Начислить зарплату»</b> в шапке.</li>
                    <li style={{marginBottom:'.5rem'}}>Потом, когда выдадите деньги, отметьте <b>выплату</b> — нажмите на статус в строке.</li>
                    <li>Кольца и цифры сверху посчитаются сами.</li>
                  </ol>
                ) },
                { q: 'Что значит «начислить» и «выплатить»?', a: (
                  <ul>
                    <li style={{marginBottom:'.5rem'}}><b>Начислить</b> — записать, что сотруднику <b>положено</b> за период. Деньги при этом еще не выданы. Статус: <b>«Начислено»</b>.</li>
                    <li style={{marginBottom:'.5rem'}}><b>Выплатить</b> — зафиксировать, что деньги <b>фактически выданы</b> и со счета ушла сумма. Статус: <b>«Выплачено»</b>.</li>
                    <li>Сначала всегда начисление, потом выплата. Выплатить можно только то, что начислено.</li>
                  </ul>
                ) },
                { q: 'Как начислить зарплату?', a: (
                  <ol style={{paddingLeft:'1.15rem',margin:0}}>
                    <li style={{marginBottom:'.5rem'}}>Нажмите <b>«Начислить зарплату»</b> в шапке.</li>
                    <li style={{marginBottom:'.5rem'}}>Выберите <b>сотрудника</b>.</li>
                    <li style={{marginBottom:'.5rem'}}>Укажите <b>период</b> (за какой месяц или срок).</li>
                    <li style={{marginBottom:'.5rem'}}>Введите <b>оклад</b>, при необходимости — <b>премию</b> и <b>вычеты</b>.</li>
                    <li>Нажмите <b>«Сохранить»</b>. Строка появится в таблице, цифры сверху обновятся.</li>
                  </ol>
                ) },
                { q: 'Как выплатить зарплату?', a: (
                  <ol style={{paddingLeft:'1.15rem',margin:0}}>
                    <li style={{marginBottom:'.5rem'}}>Найдите строку со статусом <b>«Начислено»</b>.</li>
                    <li style={{marginBottom:'.5rem'}}>Нажмите на <b>статус</b> в строке.</li>
                    <li style={{marginBottom:'.5rem'}}>Выберите <b>счет</b>, с которого выдаете деньги, и дату.</li>
                    <li>Подтвердите. Статус станет <b>«Выплачено»</b>, сумма уйдет со счета, кольцо заполнится.</li>
                  </ol>
                ) },
                { q: 'Что означают кольца сотрудников?', a: (
                  <ul>
                    <li style={{marginBottom:'.5rem'}}>Кольцо — это <b>прогресс выплат</b> по сотруднику за все время.</li>
                    <li style={{marginBottom:'.5rem'}}><b>Процент в центре</b> — сколько выплачено от начисленного. Например 40% — из 100 000 ₽ выдано 40 000 ₽.</li>
                    <li style={{marginBottom:'.5rem'}}>Под кольцом — <b>«выплачено из начислено»</b>, чтобы видеть суммы.</li>
                    <li>Кольцо полностью закрашено — сотрудник рассчитан. Пустое — начислено, но еще не платили.</li>
                  </ul>
                ) },
                { q: 'Как работают фильтры и поиск?', a: (
                  <ul>
                    <li style={{marginBottom:'.5rem'}}><b>Поиск</b> — найдите сотрудника или текст комментария.</li>
                    <li style={{marginBottom:'.5rem'}}><b>«Статус ▾»</b> — покажите только нужное: «Все», «Начислено» или «Выплачено».</li>
                    <li style={{marginBottom:'.5rem'}}><b>«Все время ▾»</b> — выберите период: все время, сегодня, вчера, эта неделя, этот месяц.</li>
                    <li>Фильтры работают вместе — например, «Выплачено» + «Этот месяц» покажет выплаты за месяц.</li>
                  </ul>
                ) },
                { q: 'Что показывают цифры сверху?', a: (
                  <ul>
                    <li><b>Общая сумма зарплат</b> — сколько всего начислено всем сотрудникам.</li>
                    <li><b>Выплачено</b> — сколько уже выдано.</li>
                    <li><b>Не выплачено</b> — разница: сколько осталось выдать.</li>
                  </ul>
                ) },
                { q: 'Где взять сотрудников?', a: (
                  <p>Сотрудники добавляются в разделе <b>«Сотрудники»</b>. Если нужного человека нет в списке при начислении — сначала добавьте его там.</p>
                ) },
              ]}
            />
          </div>
          <div className="sub" style={{maxWidth:'210px'}}>Расчет начислений с привязкой к табелю</div>
        </div>
        <div className="sk-bar-acts">
          <button className="sk-dd-btn" style={{animation:'skpulse 2s ease-in-out infinite'}} onClick={openAdd}>Начислить</button>
        </div>
      </div>

      {/* Фильтры: поиск, «Статус ▾», «Все время ▾» — как в разделе «Чеки» */}
      <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'.5rem',width:'100%',flexWrap:'nowrap',border:'1px solid '+(salSearchFocus?'#111':'#e2e2e6'),borderRadius:'999px',padding:'5px 6px 5px 14px',background:'#fff',boxShadow:salSearchFocus?'0 2px 10px rgba(0,0,0,.12)':'0 1px 3px rgba(0,0,0,.05)',transition:'border-color .15s, box-shadow .15s'}}>
          <span style={{display:'flex',color:salSearchFocus?'#111':'#999',transition:'color .15s'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input type="text" placeholder="Поиск…" value={salSearch} onChange={e => setSalSearch(e.target.value)}
            onFocus={()=>setSalSearchFocus(true)} onBlur={()=>setSalSearchFocus(false)}
            style={{border:'none',outline:'none',flex:'1 1 60px',minWidth:0,fontSize:'.78rem',fontFamily:'var(--font)',background:'none',padding:0}} />
        <span style={{width:'1px',height:'20px',background:'#eef1f6',flexShrink:0}}></span>
        <div className="sk-dd-wrap">
          <button type="button" style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={e=>{e.stopPropagation();setSalPeriodOpen(false);const w=e.currentTarget.parentElement;w.classList.toggle('open')}}>{salStatus === 'pending' ? 'Начислено' : salStatus === 'paid' ? 'Выплачено' : 'Все'} <span className="car-tri">▾</span></button>
          <div className="sk-dd-menu">
            {[
              { v:null, label:'Все' },
              { v:'pending', label:'Начислено' },
              { v:'paid', label:'Выплачено' },
            ].map(o => (
              <button key={String(o.v)} type="button"
                style={salStatus===o.v?{background:'#E6F0FF',color:'#0d4ea8',fontWeight:700}:undefined}
                onClick={e=>{e.currentTarget.closest('.sk-dd-wrap').classList.remove('open');setSalStatus(o.v)}}>{o.label}</button>
            ))}
          </div>
        </div>
        <div className="sal-period-wrap" style={{position:'relative',display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <button style={{display:'inline-flex',alignItems:'center',gap:'4px',border:'none',borderRadius:'9999px',padding:'6px 6px',fontSize:'.76rem',fontWeight:600,lineHeight:'18px',color:'#5b6472',background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={e=>{e.stopPropagation();document.querySelectorAll('.sk-dd-wrap.open').forEach(w=>w.classList.remove('open'));setSalPeriodOpen(!salPeriodOpen)}}>
            {salPeriodLabel}
            <span className="car-tri">▾</span>
          </button>
          {salPeriodOpen && (
            <div onClick={e=>e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'210px',padding:'.4rem',zIndex:100}}>
              {[{key:'all',label:'Все время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Эта неделя'},{key:'month',label:'Этот месяц'}].map(p2=>{
                const isActive = salPeriod === p2.key;
                return (
                  <div key={p2.key} onClick={()=>{setSalPeriod(p2.key);setSalPeriodLabel(p2.label);setSalPeriodOpen(false)}}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.5rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:isActive?'#1F75FF':'#dfe6f2',flexShrink:0}}></span>
                    {p2.label}
                  </div>
                );
              })}
              <div style={{borderTop:'1px solid rgba(29,120,252,.14)',paddingTop:'.4rem',marginTop:'.25rem'}}>
                <div style={{fontSize:'.72rem',color:'#5b6472',padding:'.2rem .55rem',marginBottom:'.3rem',fontWeight:600}}>Свой период</div>
                <div style={{display:'flex',gap:'.3rem',padding:'.2rem .55rem'}}>
                  <input type="date" value={salPeriodFrom} onChange={e=>setSalPeriodFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                  <input type="date" value={salPeriodTo} onChange={e=>setSalPeriodTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.3rem',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.5rem',fontFamily:'inherit',outline:'none'}} />
                </div>
                <div style={{padding:'.3rem .55rem 0',textAlign:'center'}}>
                  <button type="button" onClick={()=>{if(!salPeriodFrom||!salPeriodTo)return alert('Выберите обе даты');setSalPeriod('custom');setSalPeriodLabel(salPeriodFrom.split('-').reverse().join('.')+' — '+salPeriodTo.split('-').reverse().join('.'));setSalPeriodOpen(false)}}
                    className="sk-dd-btn" style={{padding:'.5rem 1.1rem'}}>Применить</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Итоги: общая сумма зарплат / выплачено / не выплачено */}
      <div className="sk-tiles">
        <div className="sk-tile sk-primary"><div className="sk-t">Общая сумма зарплат</div><div className="sk-v">{salTotal.toLocaleString()} {cur}</div></div>
        <div className="sk-tile"><div className="sk-t">Выплачено</div><div className="sk-v">{salPaid.toLocaleString()} {cur}</div></div>
        <div className="sk-tile sk-gold"><div className="sk-t">Не выплачено</div><div className="sk-v">{salDue.toLocaleString()} {cur}</div></div>
      </div>

      {/* Кольца сотрудников: прогресс выплат по каждому */}
      {salByEmp.length > 0 && (
        <div className="sal-rings">
          {salByEmp.map(e => (
            <div className="sal-ring-card" key={e.name}>
              <div className="sal-ring" style={{background:'conic-gradient(#1F75FF 0 '+e.pct+'%, #eef4ff '+e.pct+'% 100%)'}}>
                <span className="rv">{e.pct}%</span>
              </div>
              <div className="rn">{abbreviateName(e.name)}</div>
              <div className="rs">{e.paid.toLocaleString()} из {e.total.toLocaleString()} {cur}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <CenterSpinner />
      ) : (
      <div className="sk-tablewrap">
          <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
          <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}} data-arrow="top"></div>
        <div className="sk-card" style={{position:'relative',flex:1,overflowX:'auto',overflowY:'auto',WebkitOverflowScrolling:'touch',minHeight:0}} ref={tblElRef} onScroll={onTblScroll}>
        <table className="sk-table sal-table">
          <thead id="salaryColHeaders"><tr>
            <th style={{ textAlign: 'left' }}>Сотрудник</th><th style={{ textAlign: 'left' }}>Период</th><th style={{ textAlign: 'left' }}>Оклад</th><th style={{ textAlign: 'left' }}>Премия</th>
            <th style={{ textAlign: 'left' }}>Вычеты</th><th style={{ textAlign: 'left' }}>Итого</th><th style={{ textAlign: 'left' }}>Статус</th><th></th>
          </tr></thead>
          <tbody id="salaryTableBody">
            {salFiltered.length === 0 ? (
              <tr><td colSpan="8" style={{padding:"40px 20px",textAlign:"center",color:"#5b6472",fontSize:"13px"}}>Начислений не найдено</td></tr>
            ) : salFiltered.map(s => (
              <tr key={s.id}>
                <td><span style={{whiteSpace:'nowrap'}}>{abbreviateName(s.employee_name)||'—'}{s.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</span></td>
                <td>{s.period_from?fmtD(s.period_from)+' – '+fmtD(s.period_to):'—'}</td>
                <td>{s.base_salary?s.base_salary.toLocaleString()+' ₽':'—'}</td>
                <td>{s.bonus_amount?s.bonus_amount.toLocaleString()+' ₽':'—'}</td>
                <td>{s.deduct_amount?s.deduct_amount.toLocaleString()+' ₽':'—'}</td>
                <td>{Number(s.amount).toLocaleString()} {cur}</td>
                <td>{(()=>{
                  const paid = Number(s.paid_from) || 0;
                  const total = Number(s.amount) || 0;
                  const partial = paid > 0 && paid < total - 0.01;
                  if (s.status === 'paid') return <span className="sk-tag sk-tag-ok" title={paid.toLocaleString()+' из '+total.toLocaleString()+' '+cur}>Выплачено</span>;
                  if (s.status !== 'pending' && s.status !== 'accrued') return <span className="sk-tag">{STATUS_LABELS[s.status]||s.status}</span>;
                  return <span className="sk-tag sk-tag-pay" onClick={()=>{var first=accs.find(a=>a.type!=='credit');setPendingPayId(s.id);setPayAcctId(first?first.id:'');setPayAmount('');setShowAcc(true)}}>
                    {partial ? 'Выплачено ' + paid.toLocaleString() + ' из ' + total.toLocaleString() : 'Выплатить'}
                  </span>;
                })()}</td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="sk-more" onClick={e=>{e.stopPropagation();var dd=e.currentTarget.nextElementSibling;document.querySelectorAll('.prod-dropdown.open').forEach(d=>{if(d!==dd)d.classList.remove('open')});dd.classList.toggle('open')}}>⋯</button>
                    <div className="prod-dropdown">
                      <button onClick={()=>openEdit(s)}>Редактировать</button>
                      <button onClick={()=>remove(s.id)} style={{color:'#dc3545'}}>Удалить</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      )}

      {/* МОДАЛКА НАЧИСЛЕНИЯ */}
      <Modal open={show} onClose={()=>setShow(false)} width={660} hideHead className="modal-salary">
        <div className="sal-head">
          <h1 className="modal-title">{editId?'Редактировать':'Начислить зарплату'}</h1>
          <p className="modal-sub">Выберите сотрудника и период</p>
        </div>
        <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>

              {/* Сотрудник + период */}
              <div className="sal-seclab">Сотрудник и период</div>
              <div className="sal-row">
                <select value={fEmpId} onChange={e=>setFEmpId(e.target.value)} required className="sal-input sal-select">
                  <option value="">Выберите сотрудника</option>
                  {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="sal-row2">
                <div className="sal-field">
                  <span className="sal-cap">Начало периода</span>
                  <input type="date" value={fPeriodFrom} onChange={e=>setFPeriodFrom(e.target.value)} required className="sal-input"
                    onFocus={e=>e.target.showPicker&&e.target.showPicker()} />
                </div>
                <div className="sal-field">
                  <span className="sal-cap">Конец периода</span>
                  <input type="date" value={fPeriodTo} onChange={e=>setFPeriodTo(e.target.value)} required className="sal-input"
                    onFocus={e=>e.target.showPicker&&e.target.showPicker()} />
                </div>
              </div>

              {dupSalary && (
                <div style={{ background:'#E6F0FF', border:'1px solid #c7ddff', borderRadius: 10, padding:'.55rem .75rem', fontSize:'.76rem', color:'#0b1220' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap' }}>
                    <span style={{ flex:1, minWidth:'200px' }}>
                      За период {fmtDate(fPeriodFrom)} – {fmtDate(fPeriodTo)} уже начислено: <b>{Number(dupSalary.amount || 0).toLocaleString()} {cur}</b>
                    </span>
                    {dupSalary.status !== 'paid' && (
                      <button type="button" className="sk-dd-btn sal-open-btn" onClick={() => openEdit(dupSalary)}>Открыть</button>
                    )}
                  </div>
                  {(() => {
                    // Что ещё НЕ вошло в уже сохранённое начисление
                    const items = [];
                    const hasStoreRate = !!(storeInfo && storeInfo.pct != null);
                    if (hasStoreRate && storeOn && !doneStore) items.push({ n:'Бонус от выручки', v: storeBonus });
                    if (salesOn && salesBonusTotal > 0 && !doneSales) items.push({ n:'Продажи сотрудника', v: itemsBonusTotal });
                    if (rewardOn && rewardTotal > 0 && !doneReward) items.push({ n:'Вознаграждение исполнителю', v: rewardTotal });
                    if (bonusOpen && checkedBonusTotal > 0 && !doneBonus) items.push({ n:'Премии', v: checkedBonusTotal });
                    if (!items.length) return null;
                    return (
                      <div style={{ marginTop:'.35rem', fontSize:'.72rem', color:'var(--muted)' }}>
                        Не вошло: {items.map((x, i) => <span key={i}>{i > 0 ? ', ' : ''}<b style={{ color:'#0b1220' }}>{x.n} {x.v.toLocaleString()} {cur}</b></span>)}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Расчет */}
              <div className="sal-seclab">Расчёт</div>
              <div className="sk-dd-wrap sal-dd-wrap" style={{marginBottom:'.5rem'}}>
                <button type="button" className={'f-pill'+(fSalaryType ? ' on' : '')}
                  onClick={e=>{e.stopPropagation();setSalTypeOpen(!salTypeOpen)}}>
                  {(SALARY_TYPES.find(t=>t.value===fSalaryType)||SALARY_TYPES[0]).label} <span className="car-tri">▾</span>
                </button>
                {salTypeOpen && (
                  <div className="f-menu">
                    <div className="f-list">
                      {SALARY_TYPES.map(t => {
                        const sel = fSalaryType === t.value;
                        return (
                          <div key={t.value} onClick={()=>{setFSalaryType(t.value);setSalTypeOpen(false)}}
                            className={'f-opt'+(sel?' sel':'')}>
                            <span className="dot"></span>{t.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="form-row" style={{marginBottom:'1rem'}}>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>{fSalaryType === 'shift' ? 'Ставка за смену' : fSalaryType === 'piecework' ? 'Сумма за сделанное' : 'Оклад (мес.)'}</label>
                  <input type="number" value={fBaseSalary||""} onChange={e=>setFBaseSalary(e.target.value?parseFloat(e.target.value):0)} />
                </div>
                {fSalaryType !== 'piecework' && (
                  <div className="form-group" style={{marginBottom:0}}>
                    <label>Отработано</label>
                    <input type="text" value={fDays + ' дн. / ' + (calcDays(fPeriodFrom,fPeriodTo)||'?') + ' дн.'} disabled />
                  </div>
                )}
              </div>

              {/* Продажи и услуги сотрудника — бонусы с продаж */}
              <div className="sal-seclab">Включить в начисление</div>
              {(()=>{
                const hasStoreRate = !!(storeInfo && storeInfo.pct != null);
                const blocked = doneStore;
                const on = storeOn && hasStoreRate && !blocked;
                return (
                  <div className={'sal-pick'+(on?' on':'')}
                    title={blocked ? 'Уже начислено за этот период' : (hasStoreRate ? '' : 'У сотрудника не задан процент от выручки в карточке')}
                    style={(hasStoreRate && !blocked) ? {} : {opacity:.5, cursor:'not-allowed'}}
                    onClick={()=>{ if (!hasStoreRate || blocked) return; setStoreOn(!storeOn); }}>
                    <span className="cb">{on ? '✓' : ''}</span>
                    <span className="nm">Бонус от выручки магазина</span>
                    <span className="vl">{blocked ? 'уже начислено' : (hasStoreRate ? '+' + storeBonus.toLocaleString() + ' ' + cur : 'нет ставки')}</span>
                  </div>
                );
              })()}
              <div className="sal-sub" style={{display: (storeOn && storeInfo && storeInfo.pct != null) ? 'block' : 'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:'.4rem',fontSize:'.78rem',color:'var(--muted)',padding:'.55rem .5rem .5rem',flexWrap:'wrap'}}>
                  <span><b style={{color:'#111'}}>{storeInfo ? storeInfo.pct : 0}%</b> от выручки магазина за период</span>
                  <span><b style={{color:'#111'}}>{storeInfo ? storeInfo.revenue.toLocaleString() : 0} {cur}</b>{storeNote} =</span>
                  <b style={{color:'#111'}}>{storeBonus.toLocaleString()} {cur}</b>
                </div>
              </div>
              <div className={'sal-pick'+((salesOn && !doneSales)?' on':'')}
                title={doneSales ? 'Уже начислено за этот период' : ''}
                style={doneSales ? {opacity:.5, cursor:'not-allowed'} : {}}
                onClick={()=>{ if (doneSales) return; setSalesOn(!salesOn); }}>
                <span className="cb">{(salesOn && !doneSales) ? '✓' : ''}</span>
                <span className="nm">Продажи сотрудника (он продавец)</span>
                <span className="vl">{doneSales ? 'уже начислено' : '+' + itemsBonusTotal.toLocaleString() + ' ' + cur}</span>
              </div>
              <div className="sal-sub" style={{display: salesOn ? 'block' : 'none'}}>
                <div style={{padding:'.5rem .65rem'}}>
                  {!fEmpId ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>Выберите сотрудника</div>
                  ) : !salesLoaded ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>Загрузка...</div>
                  ) : storeInfo && storeInfo.bonus > 0 ? (
                    <div style={{display:'flex',alignItems:'center',gap:'.4rem',fontSize:'.78rem',color:'var(--muted)',padding:'.1rem .5rem .45rem'}}>
                      <span><b style={{color:'#111'}}>{storeInfo.pct != null ? storeInfo.pct + '%' : ''}</b> от <b style={{color:'#111'}}>{storeInfo.revenue.toLocaleString()} {cur}</b>{storeNote} =</span>
                      <b style={{color:'#111'}}>{storeBonus.toLocaleString()} {cur}</b>
                    </div>
                  ) : null}
                  {storeInfo && storeInfo.stack === false && salesRows.length > 0 && (
                    <div style={{fontSize:'.7rem',color:'#d97706',marginBottom:'6px'}}>⚠️ Включен процент от всей выручки без суммирования — бонусы за свои продажи ниже не начисляются</div>
                  )}
                  {salesRows.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fPeriodFrom || !fPeriodTo ? 'Заполните даты периода — продажи сотрудника появятся здесь' : 'Нет продаж/услуг за этот период'}</div>
                  ) : (
                    <>
                      <div className="sal-tblwrap">
                        <div className="sal-scrollhint" style={{opacity: salesPos.right?1:0}}></div>
                        <div className="sal-tblscroll" ref={salesWrapRef} onScroll={onSalesScroll}>
                      <table className="sal-tbl">
                        <colgroup><col style={{width:'20%'}} /><col style={{width:'26%'}} /><col style={{width:'18%'}} /><col style={{width:'13%'}} /><col style={{width:'23%'}} /></colgroup>
                        <thead><tr>
                          <th>Дата</th>
                          <th>Наименование</th>
                          <th className="num">Сумма</th>
                          <th className="ctr">%</th>
                          <th className="ctr">Бонус</th>
                        </tr></thead>
                        <tbody>
                          {salesRows.map(row => {
                            const b = salesBonus[row.itemId] || { rub: 0, pct: 0 };
                            const src = b.pct > 0 ? (b.manual ? 'manual' : 'card') : 'none';
                            return (
                              <tr key={row.itemId}>
                                <td className="date">{fmtDate(row.date)}</td>
                                <td className="name">{row.name}{row.qty > 1 ? ' x' + row.qty : ''}</td>
                                <td className="num mut">{row.total.toLocaleString()} {cur}</td>
                                <td className="ctr">
                                  <span className="sal-cell">
                                    <input type="number" min="0" className={'sal-rin '+(src === 'card' ? 'auto' : src === 'manual' ? 'manual' : 'empty')}
                                      value={b.pct || ''} placeholder="—"
                                      onChange={e => { const pct = Math.max(0, parseFloat(e.target.value) || 0); const rub = row.total > 0 ? Math.round(row.total * pct / 100) : 0; setSalesBonus(prev => ({ ...prev, [row.itemId]: { rub, pct, manual: true } })); }} />
                                    <span className="sal-unit">%</span>
                                  </span>
                                </td>
                                <td className="ctr">
                                  <span className="sal-cell">
                                    <input type="number" min="0" className={'sal-rin '+(src === 'card' ? 'auto' : src === 'manual' ? 'manual' : 'empty')}
                                      value={b.rub || ''} placeholder="0"
                                      onChange={e => { const v = Math.max(0, parseFloat(e.target.value) || 0); setSalesBonus(prev => ({ ...prev, [row.itemId]: { rub: v, pct: row.total > 0 ? Math.round(v / row.total * 1000) / 10 : 0, manual: true } })); }} />
                                    <span className="sal-unit">₽</span>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div></div>
                      <div className="sal-foot"><span className="l">Итого за продажи: {itemsBonusTotal.toLocaleString()} {cur}</span><span className="r"></span></div>
                      <div className="sal-legend">
                        <span><i style={{background:'#428bf9'}}></i>ставка из карточки</span>
                        <span><i style={{background:'#f59e0b'}}></i>вписано вручную</span>
                        <span><i style={{background:'#fff',border:'1.5px dashed #c3ccd8'}}></i>ставки нет</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Вознаграждение исполнителю из чеков */}
              <div className={'sal-pick'+((rewardOn && !doneReward)?' on':'')}
                title={doneReward ? 'Уже начислено за этот период' : ''}
                style={doneReward ? {opacity:.5, cursor:'not-allowed'} : {}}
                onClick={()=>{ if (doneReward) return; setRewardOn(!rewardOn); }}>
                <span className="cb">{(rewardOn && !doneReward) ? '✓' : ''}</span>
                <span className="nm">Вознаграждение исполнителю (он мастер)</span>
                <span className="vl">{doneReward ? 'уже начислено' : '+' + rewardTotal.toLocaleString() + ' ' + cur}</span>
              </div>
              <div className="sal-sub" style={{display: rewardOn ? 'block' : 'none'}}>
                <div style={{padding:'.5rem .65rem'}}>
                  {!fEmpId ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>Выберите сотрудника</div>
                  ) : !salesLoaded ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>Загрузка...</div>
                  ) : rewardRows.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fPeriodFrom || !fPeriodTo ? 'Заполните даты периода' : 'Нет выплат исполнителю из чеков за этот период'}</div>
                  ) : (
                    <>
                      <div className="sal-tblwrap">
                        <div className="sal-scrollhint" style={{opacity: rewardPos.right?1:0}}></div>
                        <div className="sal-tblscroll" ref={rewardWrapRef} onScroll={onRewardScroll}>
                      <table className="sal-tbl">
                        <colgroup><col style={{width:'20%'}} /><col style={{width:'26%'}} /><col style={{width:'18%'}} /><col style={{width:'13%'}} /><col style={{width:'23%'}} /></colgroup>
                        <thead><tr>
                          <th>Дата</th>
                          <th>Наименование</th>
                          <th className="num">Сумма</th>
                          <th className="ctr">%</th>
                          <th className="ctr">Бонус</th>
                        </tr></thead>
                        <tbody>
                          {rewardRows.map(row => {
                            const val = (rewardEdit[row.itemId] !== undefined ? rewardEdit[row.itemId] : row.amount) || 0;
                            const sum = Number(row.fromReceipt) || 0;
                            const pct = sum > 0 ? Math.round(Number(val) / sum * 1000) / 10 : 0;
                            // Вознаграждение не берётся из карточки: сумма либо из чека (доля мастера), либо вписана вручную.
                            // Обе — «вписано вручную» (оранжевый). «Ставка из карточки» тут не бывает.
                            const edited = rewardEdit[row.itemId] !== undefined && rewardEdit[row.itemId] !== '';
                            const src = (edited || sum > 0 || Number(val) > 0) ? 'manual' : 'none';
                            return (
                              <tr key={row.itemId}>
                                <td className="date">{fmtDate(row.date)}</td>
                                <td className="name">{row.name}</td>
                                <td className="num mut">{sum > 0 ? sum.toLocaleString() + ' ' + cur : '—'}</td>
                                <td className="ctr">
                                  <span className="sal-cell">
                                    <input type="number" min="0" className={'sal-rin '+(src === 'card' ? 'auto' : src === 'manual' ? 'manual' : 'empty')}
                                      value={pct || ''} placeholder="—"
                                      onChange={e => { const np = Math.max(0, parseFloat(e.target.value) || 0); const nv = sum > 0 ? Math.round(sum * np / 100) : 0; setRewardEdit(prev => ({ ...prev, [row.itemId]: nv })); }} />
                                    <span className="sal-unit">%</span>
                                  </span>
                                </td>
                                <td className="ctr">
                                  <span className="sal-cell">
                                    <input type="number" min="0"
                                      className={'sal-rin '+(src === 'card' ? 'auto' : src === 'manual' ? 'manual' : 'empty')}
                                      value={val || ''} placeholder="0"
                                      onChange={e => setRewardEdit(prev => ({ ...prev, [row.itemId]: e.target.value }))} />
                                    <span className="sal-unit">₽</span>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div></div>
                      <div className="sal-foot"><span className="l">Итого исполнителю: {rewardTotal.toLocaleString()} {cur}</span><span className="r"></span></div>
                      <div className="sal-legend">
                        <span><i style={{background:'#428bf9'}}></i>ставка из карточки</span>
                        <span><i style={{background:'#f59e0b'}}></i>вписано вручную</span>
                        <span><i style={{background:'#fff',border:'1.5px dashed #c3ccd8'}}></i>ставки нет</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Премии из табеля */}
              <div className={'sal-pick'+(bonusOpen?' on':'')} onClick={()=>setBonusOpen(!bonusOpen)}>
                <span className="cb">{bonusOpen ? '✓' : ''}</span>
                <span className="nm">Премии из табеля</span>
                <span className="vl">+{checkedBonusTotal.toLocaleString()} {cur}</span>
              </div>
              <div className="sal-sub" style={{display: bonusOpen ? 'block' : 'none'}}>
                <div style={{padding:'.5rem .65rem'}}>
                  {tsBonuses.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fEmpId ? 'Выберите сотрудника' : !tsLoaded ? 'Загрузка...' : 'Нет премий за этот период'}</div>
                  ) : (
                    <>
                      <table className="sal-tbl">
                        <colgroup><col style={{width:'22%'}} /><col style={{width:'50%'}} /><col style={{width:'28%'}} /></colgroup>
                        <thead><tr>
                          <th>Дата</th>
                          <th>За что</th>
                          <th className="num">Сумма</th>
                        </tr></thead>
                        <tbody>
                          {tsBonuses.map(e => (
                            <tr key={e.id} onClick={()=>toggleBonus(e.id)} style={{cursor:'pointer',opacity:bonusChecks[e.id]?1:.45}}>
                              <td className="date">{fmtDate(e.date)}</td>
                              <td className="name">{e.bonus_comment||'—'}</td>
                              <td className="num">{Number(e.bonus_amount).toLocaleString()} {cur}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{fontSize:'.65rem',color:'var(--muted)',marginTop:'4px'}}>Снимите галочку — премия останется на будущее</div>
                    </>
                  )}
                </div>
              </div>

              {/* Штрафы из табеля */}
              <div className={'sal-pick'+(fineOpen?' on':'')} onClick={()=>setFineOpen(!fineOpen)}>
                <span className="cb">{fineOpen ? '✓' : ''}</span>
                <span className="nm">Штрафы из табеля</span>
                <span className="vl">−{checkedDeductTotal.toLocaleString()} {cur}</span>
              </div>
              <div className="sal-sub" style={{display: fineOpen ? 'block' : 'none'}}>
                <div style={{padding:'.5rem .65rem'}}>
                  {tsDeducts.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fEmpId ? 'Выберите сотрудника' : !tsLoaded ? 'Загрузка...' : 'Нет штрафов за этот период'}</div>
                  ) : (
                    <>
                      <table className="sal-tbl">
                        <colgroup><col style={{width:'22%'}} /><col style={{width:'50%'}} /><col style={{width:'28%'}} /></colgroup>
                        <thead><tr>
                          <th>Дата</th>
                          <th>За что</th>
                          <th className="num">Сумма</th>
                        </tr></thead>
                        <tbody>
                          {tsDeducts.map(e => (
                            <tr key={e.id} onClick={()=>toggleDeduct(e.id)} style={{cursor:'pointer',opacity:deductChecks[e.id]?1:.45}}>
                              <td className="date">{fmtDate(e.date)}</td>
                              <td className="name">{e.deduct_comment||'—'}</td>
                              <td className="num">{Number(e.deduct_amount).toLocaleString()} {cur}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              </div>

              {/* Долги по недостачам (инвентаризация) */}
              <>
                <div className={'sal-pick'+(debtOpen?' on':'')} onClick={()=>setDebtOpen(!debtOpen)}>
                <span className="cb">{debtOpen ? '✓' : ''}</span>
                <span className="nm">Долги по недостачам</span>
                <span className="vl">−{checkedDebtTotal.toLocaleString()} {cur}</span>
              </div>
              <div className="sal-sub" style={{display: (debtOpen && empDebts.length > 0) ? 'block' : 'none'}}>
                  <div style={{padding:'.5rem .65rem'}}>
                    <table className="sal-tbl">
                      <thead><tr><th style={{width:'30px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}></th>
                        <th style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>Сумма</th>
                        <th style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>За что</th>
                      </tr></thead>
                      <tbody>
                        {empDebts.map(d => (
                          <tr key={d.id}>
                            <td style={{textAlign:'left',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',fontSize:'.72rem'}}>
                              <span onClick={()=>setDebtChecks(prev => ({...prev, [d.id]: !prev[d.id]}))}
                                style={{width:'16px',height:'16px',border:'1.5px solid '+(debtChecks[d.id]?'#ea580c':'var(--border)'),borderRadius:'4px',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'.6rem',cursor:'pointer',background:debtChecks[d.id]?'#ea580c':'transparent',color:'#fff'}}>
                                {debtChecks[d.id] ? '✓' : ''}
                              </span>
                            </td>
                            <td style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'#ea580c',fontWeight:600,fontSize:'.72rem',textAlign:'left'}}>-{Number(d.amount).toLocaleString()} {cur}</td>
                            <td style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:400,fontSize:'.72rem',textAlign:'left'}}>{d.comment||'Недостача'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{fontSize:'.65rem',color:'var(--muted)',marginTop:'4px'}}>Отмеченные долги вычтутся из зарплаты. Снимите галочку — долг останется висеть</div>
                  </div>
                </div>
              </>

              {/* Учесть долг перед сотрудником — только если долг реально есть */}
              {existingDebt > 0 && (
                <div className={'sal-pick'+(debtInclude?' on':'')} onClick={()=>setDebtInclude(!debtInclude)}>
                  <span className="cb">{debtInclude ? '✓' : ''}</span>
                  <span className="nm">Учесть долг перед сотрудником</span>
                  <span className="vl">{existingDebt.toLocaleString()} {cur}</span>
                </div>
              )}

              {/* Итого */}
              <div className="sal-total">
                <div className="cap">К начислению</div>
                <div className="big">{grandTotal.toLocaleString()} {cur}</div>
              </div>

              {/* Кнопки */}
              <div className="modal-actions">
                <button type="submit" className="sk-dd-btn">
                  {editId ? 'Сохранить' : 'Начислить'} {grandTotal.toLocaleString()} {cur}
                </button>
              </div>

            </form>
      </Modal>

      {/* МОДАЛКА ВЫБОРА СЧЕТА */}
      <Modal open={showAcc} onClose={()=>{setShowAcc(false);setPendingPayId(null);setPayAcctId('');setPayAmount('')}} title="Выплата зарплаты" subtitle="Можно выплатить всю сумму или часть" width="medium">
        {(()=>{
        const accsList = accs.filter(a => a.type !== 'credit');
        const ps = list.find(x => String(x.id) === String(pendingPayId));
        const payTotal = ps ? Number(ps.amount || 0) : 0;
        const paidBefore = ps ? (Number(ps.paid_from) || 0) : 0;
        const leftToPay = Math.max(0, payTotal - paidBefore);
        const amountToPay = payAmount === '' ? leftToPay : (parseFloat(payAmount) || 0);
        return (<>
              {paidBefore > 0 && (
                <div style={{background:'#f8f9fa',borderRadius:'10px',padding:'.55rem .7rem',marginBottom:'.6rem',fontSize:'.78rem',lineHeight:1.9}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Начислено:</span><span style={{color:'#111'}}>{payTotal.toLocaleString()} {cur}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Уже выплачено:</span><span style={{color:'#111'}}>{paidBefore.toLocaleString()} {cur}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #e8e8e8',paddingTop:'2px',marginTop:'2px'}}><span style={{color:'#111',fontWeight:600}}>Остаток:</span><span style={{color:'#111',fontWeight:700}}>{leftToPay.toLocaleString()} {cur}</span></div>
                </div>
              )}
              <div className="form-group">
                <label style={{fontSize:'.78rem',color:'#222'}}>Сумма к выплате</label>
                <input type="number" min="0" step="0.01" value={payAmount === '' ? (leftToPay || '') : payAmount}
                  onChange={e=>setPayAmount(e.target.value)} placeholder="0" />
                {amountToPay > 0 && amountToPay < leftToPay - 0.01 && (
                  <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:'.3rem'}}>Частичная выплата — останется {Math.round((leftToPay - amountToPay)).toLocaleString()} {cur}</div>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
                {accsList.length === 0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет доступных счетов</div>}
                {!salarySplitMode ? accsList.map(a => {
                  const sel = String(a.id) === String(payAcctId);
                  return (
                  <div key={a.id} onClick={()=>setPayAcctId(a.id)}
                    style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#E6F0FF':'#fff',border:'1.5px solid '+(sel?'#1F75FF':'rgba(0,0,0,.26)')}}>
                    <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(sel?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:sel?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                    <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                    <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(getAccountBalance(a)).toLocaleString()} {cur}</span>
                  </div>
                  );
                }) : accsList.map(a => {
                  const amt = parseFloat(salarySplitAmounts[a.id]) || 0;
                  const filled = amt > 0;
                  return (
                  <div key={a.id} style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',borderRadius:'.6rem',background:filled?'#E6F0FF':'#fff',border:'1.5px solid '+(filled?'#1F75FF':'rgba(0,0,0,.26)')}}>
                    <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(filled?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:filled?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                    <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                    <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(getAccountBalance(a)).toLocaleString()} {cur}</span>
                    <input type="number" value={salarySplitAmounts[a.id]||''} onChange={e=>{var v=parseFloat(e.target.value)||0;setSalarySplitAmounts(prev=>({...prev,[a.id]:v}))}}
                      style={{width:'100px',padding:'.35rem .5rem',fontSize:'.78rem',border:'none',borderRadius:'8px',outline:'none',textAlign:'right',fontFamily:'var(--font)',background:'#fff'}} />
                  </div>
                  );
                })}
                {accsList.length > 1 && (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'.35rem',padding:'.5rem .75rem',cursor:'pointer',borderRadius:'.6rem',border:'1.5px dashed #cfcfd6',fontSize:'.78rem',color:'#888',fontWeight:600,transition:'background .12s',marginTop:'.15rem'}}
                    onClick={()=>{if(!salarySplitMode){var amt=Math.round((payTotal||0)/accsList.length);var total=payTotal||0;var sa={};accsList.forEach(function(a,i){sa[a.id]=i<accsList.length-1?amt:total-amt*(accsList.length-1)});setSalarySplitAmounts(sa)};setSalarySplitMode(!salarySplitMode);setPayAcctId('')}}>{salarySplitMode ? '− Не разделять' : '+ Разделить на несколько счетов'}</div>
                )}
              </div>
              <div className="modal-actions">
                {salarySplitMode ? (
                  <button type="button" className="sk-dd-btn" onClick={()=>confirmPay(null, salarySplitAmounts)}>Подтвердить разделение</button>
                ) : (
                  <button type="button" className="sk-dd-btn" onClick={()=>{if(!payAcctId) return alert('Выберите счет для выплаты'); if(!(amountToPay > 0)) return alert('Введите сумму к выплате'); confirmPay(payAcctId, null, amountToPay)}}>Выплатить{amountToPay ? ' ' + amountToPay.toLocaleString() + ' ' + cur : ''}</button>
                )}
              </div>
        </>
        );
      })()}
      </Modal>
    </>
  );
}
