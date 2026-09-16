import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { getCurrencySymbol } from '../../lib/currency';
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
  // Фильтры (как в разделе «Чеки»)
  const [salStatus, setSalStatus] = useState(null);
  const [salSearch, setSalSearch] = useState('');
  const [salPeriodOpen, setSalPeriodOpen] = useState(false);
  const [salPeriod, setSalPeriod] = useState('all');
  const [salPeriodLabel, setSalPeriodLabel] = useState('Все время');
  const [salPeriodFrom, setSalPeriodFrom] = useState('');
  const [salPeriodTo, setSalPeriodTo] = useState('');
  // Подсказка скролла таблицы (как в «Сменах» и «Счетах»)
  const [tblPos, setTblPos] = useState({left:true, right:true});
  const onTblScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };

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
      if (empRes.data) setEmployees(empRes.data);
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

  // Подтянуть оклад из сотрудника
  useEffect(() => {
    if (!fEmpId) return;
    const emp = employees.find(e => e.id === fEmpId);
    if (emp) setFBaseSalary(emp.base_salary || 0);
  }, [fEmpId, employees]);

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
        const rows = [];
        (items || []).forEach(it => {
          if (String(it.employee_id || '') !== String(fEmpId)) return;
          const r = rlist.find(x => x.id === it.receipt_id);
          if (!r) return;
          const qty = Number(it.quantity) || 1;
          let retQty = 0;
          ((r.refund_items) || []).forEach(rf => { if (String(rf.item_id) === String(it.id)) retQty += Number(rf.qty) || 0; });
          const availQty = Math.max(0, qty - retQty);
          if (availQty <= 0) return;
          const unit = qty > 0 ? (Number(it.total) || 0) / qty : 0;
          rows.push({ itemId: it.id, created: it.created_at || r.created_at || r.date || '', date: String(r.date || '').split('T')[0], name: it.product_name, product_id: it.product_id, qty: availQty, total: Math.round(unit * availQty) });
        });
        // Новые продажи — первыми (по времени создания позиции/чека)
        rows.sort((a, b) => String(b.created).localeCompare(String(a.created)));
        // Вознаграждение исполнителю: суммы из employee_splits чеков (сколько указано мастеру в кассе)
        const rewRows = [];
        (items || []).forEach(it => {
          const sps = it.employee_splits || [];
          if (!sps.length) return;
          const mine = sps.filter(function(s){ return String(s.employee_id || '') === String(fEmpId); });
          if (!mine.length) return;
          const r = rlist.find(x => x.id === it.receipt_id);
          if (!r) return;
          const qty = Number(it.quantity) || 1;
          let retQty = 0;
          ((r.refund_items) || []).forEach(rf => { if (String(rf.item_id) === String(it.id)) retQty += Number(rf.qty) || 0; });
          const availQty = Math.max(0, qty - retQty);
          if (availQty <= 0) return;
          const factor = qty > 0 ? availQty / qty : 1;
          const amt = Math.round(mine.reduce(function(s2, sp){ return s2 + (parseFloat(sp.amount) || 0); }, 0) * factor);
          if (amt <= 0) return;
          rewRows.push({ itemId: it.id, date: String(r.date || '').split('T')[0], name: it.product_name, amount: amt });
        });
        setSalesRows(rows);
        setRewardRows(rewRows);
        setRewardEdit({});
        const emp = employees.find(e => e.id === fEmpId);
        const rules = (emp && emp.bonus_rules) || [];
        const bonus = {};
        rows.forEach(row => { const c = calcSalesBonus(rules, row, pr, cr); bonus[row.itemId] = { rub: c.rub, pct: c.pct }; });
        setSalesBonus(bonus);
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
    const debt = list
      .filter(s => s.employee_id === fEmpId && s.status !== 'cancelled' && s.pay_type !== 'bonus')
      .reduce((sum, s) => {
        const amt = Number(s.amount) || 0;
        return s.status === 'paid' ? sum - amt :
          s.pay_type === 'advance' ? sum - amt : sum + amt;
      }, 0);
    setExistingDebt(debt);
  }, [fEmpId, list]);

  // Защита от дублей: если за выбранный период сотруднику уже начислено — предупреждаем и не даём сохранить
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
  // Если включён «% от всей выручки» без суммирования — позиционные бонусы не учитываются
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
  const grandTotal = fSalaryTotal + itemsBonusTotal + storeBonus + rewardTotal + checkedBonusTotal - checkedDeductTotal - checkedDebtTotal;

  const openAdd = () => {
    setEditId(null); setFEmpId(''); setFPeriodFrom(''); setFPeriodTo('');
    setFBaseSalary(0); setFSalaryType('fixed'); setFSalaryTotal(0); setFDays(0);
    setFPayType('salary'); setFStatus('pending'); setFDate(new Date().toISOString().split('T')[0]);
    setExistingDebt(0); setTsEntries([]); setBonusChecks({}); setDeductChecks({});
    setEmpDebts([]); setDebtChecks({});
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
    setShow(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!fEmpId) return alert('Выберите сотрудника');
    if (!fPeriodFrom || !fPeriodTo) return alert('Выберите период');
    if (dupSalary) return alert('За период ' + fPeriodFrom + ' – ' + fPeriodTo + ' начисление уже есть (' + Number(dupSalary.amount || 0).toLocaleString() + ' ' + cur + '). Откройте его кнопкой «Редактировать», чтобы изменить.');
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
        // Статус всегда «Начислено» — выплата выполняется только через кнопку «Выплатить» с выбором счёта,
        // иначе зарплата помечалась выплаченной без создания расходной операции
        amount: grandTotal, status: 'pending', pay_type: fPayType,
        bonus_amount: checkedBonusTotal, bonus_items: takeBonus.map(e => ({ tsEntryId: e.id, date: e.date, amount: e.bonus_amount, comment: e.bonus_comment||'' })),
        sales_bonus: salesBonusTotal, sales_items: salesRows.map(row => ({ itemId: row.itemId, date: row.date, name: row.name, total: row.total, bonus: Number(salesBonus[row.itemId]?.rub) || 0 })),
        reward_amount: rewardTotal, reward_items: rewardRows.map(row => { const ed = rewardEdit[row.itemId]; const amt = ed !== undefined && ed !== '' ? (parseFloat(ed) || 0) : row.amount; return { date: row.date, name: row.name, amount: amt }; }),
        deduct_amount: checkedDeductTotal + checkedDebtTotal, deduct_items: takeDeduct.map(e => ({ tsEntryId: e.id, date: e.date, amount: e.deduct_amount, comment: e.deduct_comment||'' })).concat(debtItems),
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
    try { const res = await supabase.from('salary').delete().eq('id', id); if (!res.queued) await load(); }
    catch (err) { alert('Ошибка удаления: ' + err.message); }
  };

  // Реальный баланс счёта: начальный остаток + все движения (доходы минус расходы)
  const getAccountBalance = (a) => {
    var b = parseFloat(a.balance || a.initial_balance || 0);
    (accTxs || []).forEach(t => { if (t.account_id === a.id) b += Number(t.amount || 0) * (t.type === 'income' ? 1 : -1); });
    return b;
  };

  const confirmPay = async (accId, splitAmts) => {
    try {
      const { data: rows } = await supabase.from('salary').select('*').eq('id', pendingPayId);
      if (!rows || !rows.length) return;
      const s = rows[0];

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

      // Проверка баланса
      const payDate = new Date().toISOString().split('T')[0]; // дата выплаты — сегодня
      if (splitAmts && Object.keys(splitAmts).length > 0) {
        let totalSplit = 0;
        for (const [aid, amt] of Object.entries(splitAmts)) {
          if (amt <= 0) continue;
          totalSplit += amt;
          const acct = accs.find(a => a.id === aid);
          const balance = acct ? getAccountBalance(acct) : 0;
          if (balance < amt) {
            return alert('Недостаточно средств на счету ' + (acct?.name || 'счёт') + '. Доступно: ' + Math.round(balance).toLocaleString() + ' ' + cur + ', нужно: ' + amt.toLocaleString() + ' ' + cur + '. Разделите выплату на несколько счетов или выберите другой счёт.');
          }
        }
        if (Math.abs(totalSplit - Number(s.amount)) > 0.01) {
          return alert('Сумма разделения (' + Math.round(totalSplit).toLocaleString() + ' ₽) не совпадает с суммой начисления (' + Number(s.amount).toLocaleString() + ' ₽)');
        }
      } else {
        const acct = accs.find(a => a.id === accId);
        const balance = acct ? getAccountBalance(acct) : 0;
        if (balance < s.amount) {
          return alert('Недостаточно средств на счету ' + (acct?.name || 'счёт') + '. Доступно: ' + Math.round(balance).toLocaleString() + ' ' + cur + '. Разделите выплату на несколько счетов (кнопка «+ Разделить») или выберите другой счёт.');
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
          type: 'expense', amount: s.amount,
          description: 'Зарплата: ' + (s.employee_name || 'Сотрудник') + ' — ' + fmtD(s.period_from) + ' / ' + fmtD(s.period_to),
          date: payDate, category_id: salaryCatId,
        });
        if (error) throw error;
      }
      const { error: updErr, queued: payQueued } = await supabase.from('salary').update({ status: 'paid', paid_at: payDate }).eq('id', pendingPayId);
      if (updErr) throw updErr;
      if (!payQueued) await load(); setShowAcc(false); setPendingPayId(null); setPayAcctId(''); setSalarySplitMode(false); setSalarySplitAmounts({});
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
  const salPaid = (list || []).filter(s => s.status === 'paid').reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
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
                    <li style={{marginBottom:'.5rem'}}><b>Начислить</b> — записать, что сотруднику <b>положено</b> за период. Деньги при этом ещё не выданы. Статус: <b>«Начислено»</b>.</li>
                    <li style={{marginBottom:'.5rem'}}><b>Выплатить</b> — зафиксировать, что деньги <b>фактически выданы</b> и со счёта ушла сумма. Статус: <b>«Выплачено»</b>.</li>
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
                    <li style={{marginBottom:'.5rem'}}>Выберите <b>счёт</b>, с которого выдаёте деньги, и дату.</li>
                    <li>Подтвердите. Статус станет <b>«Выплачено»</b>, сумма уйдёт со счёта, кольцо заполнится.</li>
                  </ol>
                ) },
                { q: 'Что означают кольца сотрудников?', a: (
                  <ul>
                    <li style={{marginBottom:'.5rem'}}>Кольцо — это <b>прогресс выплат</b> по сотруднику за всё время.</li>
                    <li style={{marginBottom:'.5rem'}}><b>Процент в центре</b> — сколько выплачено от начисленного. Например 40% — из 100 000 ₽ выдано 40 000 ₽.</li>
                    <li style={{marginBottom:'.5rem'}}>Под кольцом — <b>«выплачено из начислено»</b>, чтобы видеть суммы.</li>
                    <li>Кольцо полностью закрашено — сотрудник рассчитан. Пустое — начислено, но ещё не платили.</li>
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
          <div className="sub">Расчёт начислений с привязкой к табелю</div>
        </div>
        <button className="sk-dd-btn" style={{animation:'skpulse 2s ease-in-out infinite'}} onClick={openAdd}>Начислить зарплату</button>
      </div>

      {/* Фильтры: поиск, «Статус ▾», «Все время ▾» — как в разделе «Чеки» */}
      <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap',marginBottom:'12px'}}>
        <div className="sk-search">
          <span style={{display:'flex',color:'#9aa3b2'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input type="text" placeholder="Поиск…" value={salSearch} onChange={e => setSalSearch(e.target.value)} style={{width:'150px'}} />
        </div>
        <span style={{flex:1}}></span>
        <div className="sk-dd-wrap">
          <button type="button" className="sk-dd-btn" onClick={e=>{e.stopPropagation();setSalPeriodOpen(false);const w=e.currentTarget.parentElement;w.classList.toggle('open')}}>Статус <span className="car">▾</span></button>
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
          <button className="sk-period" onClick={e=>{e.stopPropagation();document.querySelectorAll('.sk-dd-wrap.open').forEach(w=>w.classList.remove('open'));setSalPeriodOpen(!salPeriodOpen)}}>
            {salPeriodLabel}
            <span style={{fontSize:'10px'}}>▾</span>
          </button>
          {salPeriodOpen && (
            <div onClick={e=>e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'#fff',border:'1px solid rgba(29,120,252,.18)',borderRadius:'.85rem',boxShadow:'0 16px 40px -14px rgba(11,18,32,.3)',minWidth:'210px',padding:'.4rem',zIndex:100}}>
              {[{key:'all',label:'Все время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Эта неделя'},{key:'month',label:'Этот месяц'}].map(p2=>{
                const isActive = salPeriod === p2.key;
                return (
                  <div key={p2.key} onClick={()=>{setSalPeriod(p2.key);setSalPeriodLabel(p2.label);setSalPeriodOpen(false)}}
                    style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.35rem .55rem',borderRadius:'.5rem',cursor:'pointer',fontSize:'.8rem',color:isActive?'#0d4ea8':'#5b6472',fontWeight:isActive?700:500,background:isActive?'#E6F0FF':'transparent'}}>
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
      <div className="sal-tbl">
        <div className="sk-card" style={{position:'relative',overflowX:'auto',overflowY:'auto',WebkitOverflowScrolling:'touch'}} onScroll={onTblScroll}>
          <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
          <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}}></div>
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
                <td>{(s.status==='pending'||s.status==='accrued')
                  ? <span className="sk-tag sk-tag-pay" onClick={()=>{var first=accs.find(a=>a.type!=='credit');setPendingPayId(s.id);setPayAcctId(first?first.id:'');setShowAcc(true)}}>Выплатить</span>
                  : s.status==='paid'
                    ? <span className="sk-tag sk-tag-ok">Выплачено</span>
                    : <span className="sk-tag">{STATUS_LABELS[s.status]||s.status}</span>}</td>
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
      <Modal open={show} onClose={()=>setShow(false)} title={editId?'Редактировать':'Начислить зарплату'} subtitle="Выберите сотрудника и период" width="wide">
        <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>

              {/* Сотрудник + период */}
              <div style={{fontSize:'.72rem',fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.04em'}}>Сотрудник и период</div>
              <div style={{display:'flex',gap:'.35rem',alignItems:'center'}}>
                <select value={fEmpId} onChange={e=>setFEmpId(e.target.value)} required
                  style={{flex:3,minWidth:'180px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',lineHeight:'1.3',boxSizing:'border-box',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',background:'var(--white)',color:'#111'}}>
                  <option value="">— выберите —</option>
                  {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <input type="date" value={fPeriodFrom} onChange={e=>setFPeriodFrom(e.target.value)} required
                  style={{flex:1,minWidth:'115px',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',lineHeight:'1.3',boxSizing:'border-box',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none'}} />
                <input type="date" value={fPeriodTo} onChange={e=>setFPeriodTo(e.target.value)} required
                  style={{flex:1,minWidth:'115px',padding:'.3rem .4rem',fontSize:'.72rem',fontFamily:'var(--font)',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none'}} />
              </div>

              {dupSalary && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '.5rem .65rem', fontSize: '.76rem', color: '#b91c1c', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: '200px' }}>⚠️ За период {fmtDate(fPeriodFrom)} – {fmtDate(fPeriodTo)} уже есть начисление: <b>{Number(dupSalary.amount || 0).toLocaleString()} {cur}</b> ({dupSalary.status === 'paid' ? 'выплачено' : 'начислено'})</span>
                  {dupSalary.status !== 'paid' && (
                    <button type="button" onClick={() => openEdit(dupSalary)}
                      style={{ padding: '.3rem .8rem', borderRadius: 100, border: 'none', background: '#b91c1c', color: '#fff', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Открыть его</button>
                  )}
                </div>
              )}

              {/* Расчет */}
              <div style={{background:'#f8f9fa',borderRadius:'12px',padding:'.75rem'}}>
                <div style={{fontSize:'.72rem',fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:'.5rem'}}>Расчет</div>
                <div style={{display:'flex',gap:'.35rem',flexWrap:'wrap',marginBottom:'.65rem'}}>
                  {SALARY_TYPES.map(t => (
                    <span key={t.value} onClick={()=>setFSalaryType(t.value)}
                      style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'.2rem .5rem',fontSize:'.72rem',borderRadius:'100px',cursor:'pointer',fontWeight:500,
                        background:fSalaryType===t.value?'var(--primary)':'#f1f3f5',color:fSalaryType===t.value?'#000':'var(--muted)'}}>{t.label}</span>
                  ))}
                </div>
                <div style={{display:'flex',gap:'.35rem',alignItems:'flex-start'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'.68rem',color:'var(--muted)',marginBottom:'4px'}}>{fSalaryType === 'shift' ? 'Ставка за смену (₽)' : 'Оклад (мес.)'}</div>
                    <input type="number" value={fBaseSalary||""} onChange={e=>setFBaseSalary(e.target.value?parseFloat(e.target.value):0)}
                      style={{width:'100%',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',lineHeight:'1.3',boxSizing:'border-box',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none'}} />
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'.68rem',color:'var(--muted)',marginBottom:'4px'}}>Отработано</div>
                    <div style={{padding:'.35rem .5rem',fontSize:'.78rem',fontWeight:600,lineHeight:'1.3',boxSizing:'border-box',background:'#f8f9fa',borderRadius:'8px',border:'1.5px solid var(--border)'}}>
                      {fDays} дн. / {calcDays(fPeriodFrom,fPeriodTo)||'?'} дн.
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'.68rem',color:'var(--muted)',marginBottom:'4px'}}>За период</div>
                    <input type="text" value={fSalaryTotal.toLocaleString()+' ₽'} disabled
                      style={{width:'100%',padding:'.35rem .5rem',fontSize:'.78rem',fontFamily:'var(--font)',lineHeight:'1.3',boxSizing:'border-box',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',background:'#f8f9fa'}} />
                  </div>
                </div>
              {salarySplitMode && (
                <button onClick={()=>confirmPay(null, salarySplitAmounts)}
                  style={{width:'100%',padding:'.45rem 1rem',fontSize:'.8rem',fontWeight:600,borderRadius:'100px',border:'none',cursor:'pointer',background:'var(--secondary)',color:'#fff',fontFamily:'var(--font)',marginTop:'.35rem'}}>Подтвердить разделение</button>
              )}
              </div>

              {/* Продажи и услуги сотрудника — бонусы с продаж */}
              <div style={{border:'1px solid #bfdbfe',borderRadius:'12px',overflow:'hidden',marginTop:'.65rem'}}>
                <div style={{padding:'.5rem .65rem',background:'#eff6ff',borderBottom:'1px solid #bfdbfe',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:'.78rem',fontWeight:600,color:'#2563eb'}}>Продажи и услуги сотрудника</span>
                  <span style={{fontSize:'.68rem',color:'#2563eb',fontWeight:600}}>+{(itemsBonusTotal + storeBonus).toLocaleString()} {cur}</span>
                </div>
                <div style={{padding:'.5rem .65rem'}}>
                  {!fEmpId ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>Выберите сотрудника</div>
                  ) : !salesLoaded ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>Загрузка...</div>
                  ) : storeInfo && storeInfo.bonus > 0 ? (
                    <div style={{background:'#fff',border:'1px solid #bfdbfe',borderRadius:'10px',padding:'8px 10px',marginBottom:'8px',fontSize:'.76rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{color:'#2563eb',fontWeight:600}}>🏪 От всей выручки</span>
                      <span style={{color:'#555'}}>{storeInfo.pct != null ? storeInfo.pct + '% от ' : ''}{storeInfo.revenue.toLocaleString()} {cur}{storeNote} = <b style={{color:'#2563eb'}}>+{storeBonus.toLocaleString()} {cur}</b></span>
                    </div>
                  ) : null}
                  {storeInfo && storeInfo.stack === false && salesRows.length > 0 && (
                    <div style={{fontSize:'.7rem',color:'#d97706',marginBottom:'6px'}}>⚠️ Включён процент от всей выручки без суммирования — бонусы за свои продажи ниже не начисляются</div>
                  )}
                  {salesRows.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fPeriodFrom || !fPeriodTo ? 'Заполните даты периода — продажи сотрудника появятся здесь' : 'Нет продаж/услуг за этот период'}</div>
                  ) : (
                    <>
                      <div style={{fontSize:'.7rem',color:'#2563eb',marginBottom:'.3rem'}}>Бонус рассчитан по правилам сотрудника — суммы и % можно поправить вручную</div>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.74rem',tableLayout:'fixed'}}>
                        <thead><tr>
                          <th style={{width:'52px',padding:'.25rem .3rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.7rem',textAlign:'left'}}>Дата</th>
                          <th style={{padding:'.25rem .3rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.7rem',textAlign:'left'}}>Позиция</th>
                          <th style={{width:'58px',padding:'.25rem .3rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.7rem',textAlign:'right'}}>Сумма</th>
                          <th style={{width:'70px',padding:'.25rem .3rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.7rem',textAlign:'center'}}>₽</th>
                          <th style={{width:'52px',padding:'.25rem .3rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.7rem',textAlign:'center'}}>%</th>
                        </tr></thead>
                        <tbody>
                          {salesRows.map(row => {
                            const b = salesBonus[row.itemId] || { rub: 0, pct: 0 };
                            return (
                              <tr key={row.itemId}>
                                <td style={{padding:'.25rem .3rem',borderBottom:'1px solid #f0f0f0',color:'var(--muted)',fontSize:'.7rem',textAlign:'left'}}>{fmtDate(row.date)}</td>
                                <td style={{padding:'.25rem .3rem',borderBottom:'1px solid #f0f0f0',color:'var(--body-color)',fontSize:'.72rem',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.name}{row.qty > 1 ? ' x' + row.qty : ''}</td>
                                <td style={{padding:'.25rem .3rem',borderBottom:'1px solid #f0f0f0',color:'var(--muted)',fontSize:'.7rem',textAlign:'right'}}>{row.total.toLocaleString()}</td>
                                <td style={{padding:'.25rem .2rem',borderBottom:'1px solid #f0f0f0',textAlign:'center'}}>
                                  <input type="number" min="0" value={b.rub} onChange={e => { const v = Math.max(0, parseFloat(e.target.value) || 0); setSalesBonus(prev => ({ ...prev, [row.itemId]: { rub: v, pct: row.total > 0 ? Math.round(v / row.total * 1000) / 10 : 0 } })); }}
                                    style={{width:'58px',padding:'.2rem .25rem',fontSize:'.7rem',textAlign:'center',fontFamily:'inherit',border:'1px solid #bfdbfe',borderRadius:'5px',outline:'none'}} />
                                </td>
                                <td style={{padding:'.25rem .2rem',borderBottom:'1px solid #f0f0f0',textAlign:'center'}}>
                                  <input type="number" min="0" value={b.pct} onChange={e => { const pct = Math.max(0, parseFloat(e.target.value) || 0); const rub = row.total > 0 ? Math.round(row.total * pct / 100) : 0; setSalesBonus(prev => ({ ...prev, [row.itemId]: { rub, pct } })); }}
                                    style={{width:'42px',padding:'.2rem .25rem',fontSize:'.7rem',textAlign:'center',fontFamily:'inherit',border:'1px solid #bfdbfe',borderRadius:'5px',outline:'none'}} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'.75rem',fontWeight:600,color:'#2563eb',paddingTop:'.4rem'}}>
                        <span>Бонус с продаж за период</span>
                        <span>+{(itemsBonusTotal + storeBonus).toLocaleString()} {cur}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Вознаграждение исполнителю из чеков */}
              <div style={{border:'1px solid #fde68a',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'.5rem .65rem',background:'#fffbeb',borderBottom:'1px solid #fde68a',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:'.78rem',fontWeight:600,color:'#b45309'}}>Вознаграждение исполнителю (из чеков)</span>
                  <span style={{fontSize:'.68rem',color:'#b45309',fontWeight:600}}>+{rewardTotal.toLocaleString()} {cur}</span>
                </div>
                <div style={{padding:'.5rem .65rem'}}>
                  {!fEmpId ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>Выберите сотрудника</div>
                  ) : !salesLoaded ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>Загрузка...</div>
                  ) : rewardRows.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fPeriodFrom || !fPeriodTo ? 'Заполните даты периода' : 'Нет выплат исполнителю из чеков за этот период'}</div>
                  ) : (
                    <>
                      <div style={{fontSize:'.7rem',color:'#b45309',marginBottom:'.3rem'}}>Суммы из чеков кассы (раздел «Мастера») — можно поправить вручную</div>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.74rem',tableLayout:'fixed'}}>
                        <tbody>
                          {rewardRows.map(row => (
                            <tr key={row.itemId}>
                              <td style={{width:'52px',padding:'.25rem .3rem',borderBottom:'1px solid #f5f5f0',color:'var(--muted)',fontSize:'.7rem',textAlign:'left'}}>{fmtDate(row.date)}</td>
                              <td style={{padding:'.25rem .3rem',borderBottom:'1px solid #f5f5f0',color:'var(--body-color)',fontSize:'.72rem',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.name}</td>
                              <td style={{width:'100px',padding:'.25rem .3rem',borderBottom:'1px solid #f5f5f0',textAlign:'right'}}>
                                <input type="number" min="0" value={rewardEdit[row.itemId] !== undefined ? rewardEdit[row.itemId] : row.amount}
                                  onChange={e => setRewardEdit(prev => ({ ...prev, [row.itemId]: e.target.value }))}
                                  style={{width:'72px',padding:'.2rem .25rem',fontSize:'.72rem',textAlign:'center',fontFamily:'inherit',border:'1px solid #fde68a',borderRadius:'5px',outline:'none',color:'#b45309',fontWeight:600}} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'.75rem',fontWeight:600,color:'#b45309',paddingTop:'.4rem'}}>
                        <span>Исполнителю за период</span>
                        <span>+{rewardTotal.toLocaleString()} {cur}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Премии из табеля */}
              <div style={{border:'1px solid #bbf7d0',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'.5rem .65rem',background:'#f0fdf4',borderBottom:'1px solid #bbf7d0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:'.78rem',fontWeight:600,color:'#16a34a'}}>Премии из табеля</span>
                  <span style={{fontSize:'.68rem',color:'#16a34a'}}>{checkedBonusTotal.toLocaleString()} {cur}</span>
                </div>
                <div style={{padding:'.5rem .65rem'}}>
                  {tsBonuses.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fEmpId ? 'Выберите сотрудника' : !tsLoaded ? 'Загрузка...' : 'Нет премий за этот период'}</div>
                  ) : (
                    <>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.75rem',tableLayout:'fixed'}}>
                        <thead><tr><th style={{width:'30px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}></th>
                          <th style={{width:'65px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>Дата</th>
                          <th style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>Сумма</th>
                          <th style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>За что</th>
                        </tr></thead>
                        <tbody>
                          {tsBonuses.map(e => (
                            <tr key={e.id}>
                              <td style={{textAlign:'left',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',fontSize:'.72rem'}}>
                                <span onClick={()=>toggleBonus(e.id)}
                                  style={{width:'16px',height:'16px',border:'1.5px solid '+(bonusChecks[e.id]?'#16a34a':'var(--border)'),borderRadius:'4px',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'.6rem',cursor:'pointer',background:bonusChecks[e.id]?'#16a34a':'transparent',color:'#fff'}}>
                                  {bonusChecks[e.id] ? '✓' : ''}
                                </span>
                              </td>
                              <td style={{width:'65px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--body-color)',fontWeight:400,fontSize:'.72rem',textAlign:'left'}}>{fmtDate(e.date)}</td>
                              <td style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'#16a34a',fontWeight:600,fontSize:'.72rem',textAlign:'left'}}>+{Number(e.bonus_amount).toLocaleString()} {cur}</td>
                              <td style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:400,fontSize:'.72rem',textAlign:'left'}}>{e.bonus_comment||'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{fontSize:'.65rem',color:'var(--muted)',marginTop:'4px'}}>Снимите галочку — премия останется на будущее</div>
                    </>
                  )}
                </div>
              {salarySplitMode && (
                <button onClick={()=>confirmPay(null, salarySplitAmounts)}
                  style={{width:'100%',padding:'.45rem 1rem',fontSize:'.8rem',fontWeight:600,borderRadius:'100px',border:'none',cursor:'pointer',background:'var(--secondary)',color:'#fff',fontFamily:'var(--font)',marginTop:'.35rem'}}>Подтвердить разделение</button>
              )}
              </div>

              {/* Штрафы из табеля */}
              <div style={{border:'1px solid #fecaca',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'.5rem .65rem',background:'#fef2f2',borderBottom:'1px solid #fecaca',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:'.78rem',fontWeight:600,color:'#dc2626'}}>Штрафы из табеля</span>
                  <span style={{fontSize:'.68rem',color:'#dc2626'}}>-{checkedDeductTotal.toLocaleString()} {cur}</span>
                </div>
                <div style={{padding:'.5rem .65rem'}}>
                  {tsDeducts.length === 0 ? (
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{!fEmpId ? 'Выберите сотрудника' : !tsLoaded ? 'Загрузка...' : 'Нет штрафов за этот период'}</div>
                  ) : (
                    <>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.75rem',tableLayout:'fixed'}}>
                        <thead><tr><th style={{width:'30px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}></th>
                          <th style={{width:'65px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>Дата</th>
                          <th style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>Сумма</th>
                          <th style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:500,fontSize:'.72rem',textAlign:'left'}}>За что</th>
                        </tr></thead>
                        <tbody>
                          {tsDeducts.map(e => (
                            <tr key={e.id}>
                              <td style={{textAlign:'left',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',fontSize:'.72rem'}}>
                                <span onClick={()=>toggleDeduct(e.id)}
                                  style={{width:'16px',height:'16px',border:'1.5px solid '+(deductChecks[e.id]?'#dc2626':'var(--border)'),borderRadius:'4px',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'.6rem',cursor:'pointer',background:deductChecks[e.id]?'#dc2626':'transparent',color:'#fff'}}>
                                  {deductChecks[e.id] ? '✓' : ''}
                                </span>
                              </td>
                              <td style={{width:'65px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--body-color)',fontWeight:400,fontSize:'.72rem',textAlign:'left'}}>{fmtDate(e.date)}</td>
                              <td style={{width:'80px',padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'#dc2626',fontWeight:600,fontSize:'.72rem',textAlign:'left'}}>-{Number(e.deduct_amount).toLocaleString()} {cur}</td>
                              <td style={{padding:'.3rem .35rem',borderBottom:'1px solid var(--border)',color:'var(--muted)',fontWeight:400,fontSize:'.72rem',textAlign:'left'}}>{e.deduct_comment||'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{fontSize:'.65rem',color:'var(--muted)',marginTop:'4px'}}>Снимите галочку — штраф останется на будущее</div>
                    </>
                  )}
                </div>
              {salarySplitMode && (
                <button onClick={()=>confirmPay(null, salarySplitAmounts)}
                  style={{width:'100%',padding:'.45rem 1rem',fontSize:'.8rem',fontWeight:600,borderRadius:'100px',border:'none',cursor:'pointer',background:'var(--secondary)',color:'#fff',fontFamily:'var(--font)',marginTop:'.35rem'}}>Подтвердить разделение</button>
              )}
              </div>

              {/* Долги по недостачам (инвентаризация) */}
              {empDebts.length > 0 && (
                <div style={{border:'1px solid #fed7aa',borderRadius:'12px',overflow:'hidden'}}>
                  <div style={{padding:'.5rem .65rem',background:'#fff7ed',borderBottom:'1px solid #fed7aa',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontSize:'.78rem',fontWeight:600,color:'#ea580c'}}>Долги по недостачам</span>
                    <span style={{fontSize:'.68rem',color:'#ea580c'}}>-{checkedDebtTotal.toLocaleString()} {cur}</span>
                  </div>
                  <div style={{padding:'.5rem .65rem'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.75rem',tableLayout:'fixed'}}>
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
              )}

              {/* Долг */}
              {existingDebt !== 0 && (
                <div style={{background:'#fffbeb',border:'1px solid #f59e0b',borderRadius:'10px',padding:'.5rem .65rem',fontSize:'.78rem',display:'flex',gap:'.5rem',alignItems:'center'}}>
                  <span style={{color:'#f59e0b',fontWeight:700}}>⚠</span>
                  <span>Невыплаченных: <b>{Math.abs(existingDebt).toLocaleString()} {cur}</b>
                    <span style={{fontSize:'.72rem',color:'var(--muted)',marginLeft:'.35rem'}}>после начисления будет {(existingDebt+grandTotal).toLocaleString()} {cur}</span>
                  </span>
                </div>
              )}

              {/* Итого */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.65rem .75rem',background:'#f8f9fa',borderRadius:'10px'}}>
                <div style={{fontSize:'.72rem',color:'var(--muted)'}}>
                  {(()=>{const parts=[];if(fSalaryTotal>0)parts.push((fSalaryType==='shift'?'За смену ':'Оклад ')+fSalaryTotal.toLocaleString()+' ₽');if(storeBonus>0)parts.push('С выручки +'+storeBonus.toLocaleString()+' ₽');if(itemsBonusTotal>0)parts.push('С продаж +'+itemsBonusTotal.toLocaleString()+' ₽');if(rewardTotal>0)parts.push('Исполнителю +'+rewardTotal.toLocaleString()+' ₽');if(checkedBonusTotal>0)parts.push('Премии '+checkedBonusTotal.toLocaleString()+' ₽');if(checkedDeductTotal>0)parts.push('Штрафы '+checkedDeductTotal.toLocaleString()+' ₽');if(checkedDebtTotal>0)parts.push('Долги '+checkedDebtTotal.toLocaleString()+' ₽');return parts.join(' − ');})()}
                </div>
                <div style={{fontSize:'1.15rem',fontWeight:700}}>{grandTotal.toLocaleString()} {cur}</div>
              </div>

              {/* Кнопки */}
              <div style={{display:'flex',justifyContent:'flex-end',gap:'.5rem',alignItems:'center'}}>
                <span style={{fontSize:'.72rem',color:'var(--muted)'}}>Статус: Начислено (выплата — через кнопку «Выплатить» со счёта)</span>
                <button type="submit"
                  style={{padding:'.4rem 1.2rem',fontSize:'.8rem',fontWeight:600,borderRadius:'100px',border:'none',cursor:'pointer',fontFamily:'var(--font)',background:'var(--primary)',color:'var(--primary-text)',display:'inline-flex',alignItems:'center',gap:'.3rem',width:'auto'}}>
                  {editId ? 'Сохранить' : 'Начислить'} {grandTotal.toLocaleString()} {cur}
                </button>
              </div>

            </form>
      </Modal>

      {/* МОДАЛКА ВЫБОРА СЧЕТА */}
      <Modal open={showAcc} onClose={()=>{setShowAcc(false);setPendingPayId(null);setPayAcctId('')}} title="Выплата зарплаты" subtitle="Выберите счет для выплаты" width="medium">
        {(()=>{
        const accsList = accs.filter(a => a.type !== 'credit');
        const ps = list.find(x => String(x.id) === String(pendingPayId));
        const payTotal = ps ? Number(ps.amount || 0) : 0;
        return (<>
              <div style={{display:'flex',flexDirection:'column',gap:'.35rem',margin:'.25rem 0 .5rem'}}>
                {accsList.length === 0 && <div style={{padding:'.4rem .25rem',fontSize:'.8rem',color:'var(--muted)'}}>Нет доступных счетов</div>}
                {!salarySplitMode ? accsList.map(a => {
                  const sel = String(a.id) === String(payAcctId);
                  return (
                  <div key={a.id} onClick={()=>setPayAcctId(a.id)}
                    style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.6rem .75rem',cursor:'pointer',borderRadius:'.6rem',background:sel?'#fff9db':'#fff',border:'1.5px solid '+(sel?'#ffdd2d':'rgba(0,0,0,.26)')}}>
                    <span style={{width:'18px',height:'18px',flexShrink:0,border:'2px solid '+(sel?'#111':'#cfcfd6'),borderRadius:'50%',borderWidth:sel?'6px':'2px',boxSizing:'border-box',display:'inline-block'}} />
                    <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                    <span style={{fontSize:'.875rem',fontWeight:700,color:'#111',whiteSpace:'nowrap'}}>{Math.round(getAccountBalance(a)).toLocaleString()} {cur}</span>
                  </div>
                  );
                }) : accsList.map(a => (
                  <div key={a.id} style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.35rem 0'}}>
                    <span style={{flex:1,fontSize:'.875rem',fontWeight:500,color:'#222'}}>{a.name}</span>
                    <span style={{fontSize:'.75rem',color:'#888'}}>{Math.round(getAccountBalance(a)).toLocaleString()} {cur}</span>
                    <input type="number" value={salarySplitAmounts[a.id]||''} onChange={e=>{var v=parseFloat(e.target.value)||0;setSalarySplitAmounts(prev=>({...prev,[a.id]:v}))}}
                      style={{width:'100px',padding:'.35rem .5rem',fontSize:'.78rem',border:'1.5px solid rgba(0,0,0,.26)',borderRadius:'8px',outline:'none',textAlign:'right',fontFamily:'var(--font)'}} />
                  </div>
                ))}
                {accsList.length > 1 && (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'.35rem',padding:'.5rem .75rem',cursor:'pointer',borderRadius:'.6rem',border:'1.5px dashed #cfcfd6',fontSize:'.78rem',color:'#888',fontWeight:600,transition:'background .12s',marginTop:'.15rem'}}
                    onClick={()=>{if(!salarySplitMode){var amt=Math.round((payTotal||0)/accsList.length);var total=payTotal||0;var sa={};accsList.forEach(function(a,i){sa[a.id]=i<accsList.length-1?amt:total-amt*(accsList.length-1)});setSalarySplitAmounts(sa)};setSalarySplitMode(!salarySplitMode);setPayAcctId('')}}>{salarySplitMode ? '− Не разделять' : '+ Разделить на несколько счетов'}</div>
                )}
              </div>
              <div className="modal-actions">
                {salarySplitMode ? (
                  <button onClick={()=>confirmPay(null, salarySplitAmounts)}
                    style={{display:'block',margin:'0 auto',padding:'12px 34px',border:'none',borderRadius:'10px',background:'#111',color:'#fff',fontFamily:'inherit',fontSize:'14px',fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.15)',transition:'all .12s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#000'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='#111'}}>Подтвердить разделение</button>
                ) : (
                  <button onClick={()=>{if(!payAcctId) return alert('Выберите счет для выплаты'); confirmPay(payAcctId)}}
                    style={{display:'block',margin:'0 auto',padding:'12px 34px',border:'none',borderRadius:'10px',background:'#111',color:'#fff',fontFamily:'inherit',fontSize:'14px',fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.15)',transition:'all .12s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#000'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='#111'}}>Выплатить {payTotal ? payTotal.toLocaleString() + ' ' + cur : ''}</button>
                )}
              </div>
        </>
        );
      })()}
      </Modal>
    </>
  );
}
