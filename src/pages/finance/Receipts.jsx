import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { getCurrencySymbol } from '../../lib/currency';
import { tzToday, tzOffsetDate } from '../../lib/dates';
import CenterSpinner from '../../components/CenterSpinner';


const STATUS_LABELS = {
  paid: 'Оплачен',
  unpaid: 'Не оплачен',
  partially_paid: 'Частично оплачен',
};
const STATUS_COLORS = {
  paid: '#16a34a',
  unpaid: '#dc2626',
  partially_paid: '#ea580c',
};
const STATUS_BG = {
  paid: '#f0fdf4',
  unpaid: '#fef2f2',
  partially_paid: '#fff7ed',
};

export default function Receipts() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState('all');
  const [periodLabel, setPeriodLabel] = useState('Все время');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [payReceipt, setPayReceipt] = useState(null);
  const [payAc, setPayAc] = useState('');
  const [payAmt, setPayAmt] = useState('');
  const [toast, setToast] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Возврат
  const [refundReceipt, setRefundReceipt] = useState(null);
  const [refundQty, setRefundQty] = useState({});
  const [refundMode, setRefundMode] = useState('cash');
  const [refundAc, setRefundAc] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [productTypes, setProductTypes] = useState({});
  const [productNames, setProductNames] = useState({});
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Сколько чеков подгружаем за раз (кнопка «Показать ещё»)
  const PAGE_SIZE = 500;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      setReceipts(data || []);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (e) {
      // Таблица может ещё не существовать
      setReceipts([]);
      setHasMore(false);
      console.warn('Таблица receipts недоступна. Выполните SQL миграцию в Supabase.');
    }
    try {
      const { data: ac } = await supabase.from('accounts').select('id,name,balance,type').eq('user_id', user.id);
      setAccounts(ac || []);
    } catch (e) { setAccounts([]); }
    try {
      // Сотрудники (продавцы/исполнители) — для деталей чека
      const { data: emps } = await supabase.from('employees').select('id,name').eq('user_id', user.id);
      setEmployees(emps || []);
      // Товары (тип, имя) — чтобы при возврате вернуть на склад только товары (не услуги)
      const { data: prods } = await supabase.from('products').select('id,name,type').eq('user_id', user.id);
      const pt = {}, pn = {};
      (prods || []).forEach(pp => { pt[pp.id] = pp.type; pn[pp.id] = pp.name; });
      setProductTypes(pt); setProductNames(pn);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Подгрузка следующих чеков («Показать ещё»): берём старше последнего загруженного
  const loadMore = async () => {
    if (loadingMore || !hasMore || !user) return;
    setLoadingMore(true);
    try {
      const withDate = receipts.filter(r => r.created_at);
      const last = withDate[withDate.length - 1];
      if (!last) { setHasMore(false); return; }
      const { data } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .lt('created_at', last.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      const more = data || [];
      if (more.length > 0) {
        setReceipts(prev => {
          const seen = new Set(prev.map(r => r.id));
          return [...prev, ...more.filter(r => !seen.has(r.id))];
        });
      }
      setHasMore(more.length === PAGE_SIZE);
    } catch (e) {}
    setLoadingMore(false);
  };

  // Оптимистичная синхронизация: офлайн-чеки появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'receipts', setList: setReceipts, onSynced: load });

  // Close period dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.stock-filter-links > div')) setPeriodOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const openReceipt = async (r) => {
    setSelectedReceipt(r);
    setItemsLoading(true);
    try {
      const { data } = await supabase
        .from('receipt_items')
        .select('*')
        .eq('receipt_id', r.id)
        .order('created_at');
      setReceiptItems(data || []);
    } catch (e) {
      setReceiptItems([]);
    }
    setItemsLoading(false);
  };

  const filtered = receipts.filter(r => {
    // «Долги» = не оплачен полностью (включая частично оплаченные)
    if (statusFilter === 'unpaid' && r.status !== 'unpaid' && r.status !== 'partially_paid') return false;
    if (statusFilter === 'refunded' && !((r.refund_amount || 0) > 0)) return false;
    if (statusFilter && statusFilter !== 'unpaid' && statusFilter !== 'refunded' && r.status !== statusFilter) return false;
    // Фильтр по периоду
    const d = (r.date || r.created_at || '').split('T')[0];
    if (period === 'today' && d !== tzToday()) return false;
    if (period === 'yesterday' && d !== tzOffsetDate(1)) return false;
    if (period === 'week' && d < tzOffsetDate(7)) return false;
    if (period === 'custom' && !(d >= periodFrom && d <= periodTo)) return false;
    if (search) {
      const q = search.toLowerCase();
      const numMatch = String(r.receipt_number).includes(q);
      const clientMatch = (r.client_name || '').toLowerCase().includes(q);
      const cashierMatch = (r.cashier_name || '').toLowerCase().includes(q);
      if (!numMatch && !clientMatch && !cashierMatch) return false;
    }
    return true;
  });

  const fmtDate = (d) => {
    if (!d) return '—';
    const p = (d.split('T')[0]||'').split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : d;
  };

  // Дата + время (время создания/закрытия чека)
  const fmtDateTime = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  // Сотрудник коротко: «Фамилия И.» (как в кассе)
  const abbreviateName = (name) => {
    if (!name) return '—';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const surname = parts[0];
    const initials = parts.slice(1).map(p => p.charAt(0) + '.').join(' ');
    return surname + ' ' + initials;
  };
  const empShort = (id) => abbreviateName(employees.find(e => e.id === id)?.name);

  // Сколько уже возвращено по позиции чека (по refund_items)
  const returnedQtyByItem = (r, itemId) => {
    const ri = (r && r.refund_items) || [];
    return ri.filter(x => String(x.item_id) === String(itemId)).reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
  };
  // Остаток к возврату по позиции
  const refundableQty = (r, item) => Math.max(0, (Number(item.quantity) || 0) - returnedQtyByItem(r, item.id));
  // Можно ли ещё оформить возврат по чеку
  const canRefund = (r) => {
    if (!r || r.status === 'unpaid') return false;
    return receiptItems.some(it => refundableQty(r, it) > 0);
  };
  // Цена единицы из чека (уже со скидкой по акции)
  const unitPrice = (item) => {
    const q = Number(item.quantity) || 1;
    return q > 0 ? (Number(item.total) || 0) / q : 0;
  };

  // Сумма долга по чеку (не оплачено)
  const receiptRemain = (r) => Math.max(0, (Number(r.total_amount)||0) - (Number(r.paid_amount)||0));

  // Оплата долга по чеку
  const payDebt = async () => {
    if (!payReceipt) return;
    const remain = receiptRemain(payReceipt);
    const amt = parseFloat(payAmt) || remain;
    if (!amt || amt <= 0) return alert('Введите сумму');
    if (!payAc) return alert('Выберите счёт');
    if (amt > remain) return alert('Сумма больше остатка долга (' + remain.toLocaleString() + ' ₽)');
    try {
      // Категория «Доход от продаж»
      let saleCatId = null;
      const { data: cats } = await supabase.from('categories').select('id').eq('user_id', user.id).eq('name', 'Доход от продаж').maybeSingle();
      if (cats) saleCatId = cats.id;
      // Обновляем чек
      const newPaid = (Number(payReceipt.paid_amount)||0) + amt;
      const newStatus = newPaid >= Number(payReceipt.total_amount) ? 'paid' : 'partially_paid';
      const updRes = await supabase.from('receipts').update({ status: newStatus, paid_amount: newPaid }).eq('id', payReceipt.id);
      if (updRes.error) throw updRes.error;      // Транзакция оплаты долга
      const txRes = await supabase.from('transactions').insert({
        user_id: user.id, type: 'income', amount: amt,
        description: 'Оплата долга по чеку № ' + payReceipt.receipt_number,
        date: tzToday(),
        account_id: payAc, status: 'paid', category_id: saleCatId,
      });
      if (txRes.error) throw txRes.error;
      // Уменьшаем долг клиента
      if (payReceipt.client_id) {
        const { data: cl } = await supabase.from('clients').select('debt').eq('id', payReceipt.client_id).maybeSingle();
        await supabase.from('clients').update({ debt: (parseFloat(cl?.debt)||0) + amt }).eq('id', payReceipt.client_id);
      }
      setPayReceipt(null); setPayAc(''); setPayAmt('');
      if (!updRes.queued) await load();
      setToast('Долг по чеку № ' + payReceipt.receipt_number + ' оплачен: ' + amt.toLocaleString() + ' ₽');
    } catch (err) { alert(err.message); }
  };

  // ===== Оформление возврата по чеку =====
  const doRefund = async () => {
    const r = refundReceipt;
    if (!r) return;
    const reason = (refundReason || '').trim();
    if (!reason) return alert('Укажите причину возврата');
    // Выбранные позиции (сколько возвращаем)
    const rows = [];
    receiptItems.forEach(it => {
      const avail = refundableQty(r, it);
      if (avail <= 0) return;
      const qty = Math.min(Number(refundQty[it.id]) || 0, avail);
      if (qty <= 0) return;
      rows.push({ item_id: it.id, product_id: it.product_id, product_name: it.product_name, qty, total: Math.round(unitPrice(it) * qty) });
    });
    if (rows.length === 0) return alert('Укажите количество для возврата');
    const sumItems = rows.reduce((s2, x) => s2 + x.total, 0);
    if (sumItems <= 0) return alert('Сумма возврата равна нулю');
    // Способ возврата денег
    let acId = null;
    if (refundMode === 'cash') {
      const cashAc = accounts.find(a => a.type === 'cash_register');
      if (!cashAc) return alert('Нет кассового счёта. Выберите способ «На счёт / карту» или «Без денег»');
      acId = cashAc.id;
    } else if (refundMode === 'account') {
      if (!refundAc) return alert('Выберите счёт для возврата');
      acId = refundAc;
    }
    const paidAvail = Math.max(0, (Number(r.paid_amount) || 0) - (Number(r.refund_amount) || 0));
    const money = refundMode === 'none' ? 0 : Math.min(sumItems, paidAvail);
    const diff = refundMode === 'none' ? 0 : (sumItems - money);
    try {
      setRefunding(true);
      // 1) Деньги: если смена ещё открыта — правим payments чека (закроется сменой),
      //    если закрыта/вне смены — создаём транзакцию «Возврат»
      const shiftRes = r.shift_id ? await supabase.from('shifts').select('status').eq('id', r.shift_id).maybeSingle() : { data: null };
      const shiftOpen = !!(shiftRes.data && shiftRes.data.status === 'open');
      const newPayments = Array.isArray(r.payments) ? r.payments.slice() : [];
      const upd = {
        refund_amount: (Number(r.refund_amount) || 0) + sumItems,
        refund_reason: reason,
        refund_date: tzToday(),
        refund_items: [...((r.refund_items) || []), ...rows],
      };
      if (shiftOpen && money > 0 && acId) {
        newPayments.push({ account_id: acId, amount: -money });
        upd.payments = newPayments;
      }
      const updRes = await supabase.from('receipts').update(upd).eq('id', r.id);
      if (updRes.error) throw updRes.error;
      if (!shiftOpen && money > 0 && acId) {
        // Категория «Возврат»
        let catId = null;
        const { data: cat } = await supabase.from('categories').select('id').eq('user_id', user.id).eq('name', 'Возврат').maybeSingle();
        if (cat) catId = cat.id;
        else {
          const { data: newCat } = await supabase.from('categories').insert({ user_id: user.id, name: 'Возврат', type: 'expense' }).select('id').single();
          if (newCat && newCat.id) catId = newCat.id;
        }
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'expense', amount: money,
          description: 'Возврат по чеку № ' + r.receipt_number + ' — ' + reason,
          date: tzToday(), account_id: acId, kind: 'refund', status: 'paid', category_id: catId,
        });
      }
      // 2) Склад: возвращаем товары (отрицательное списание — остатки восстановятся сами)
      const woInserts = [];
      rows.forEach(row => {
        const item = receiptItems.find(it => it.id === row.item_id);
        if (!item) return;
        const combo = item.combo_items;
        if (combo && Array.isArray(combo) && combo.length > 0) {
          combo.forEach(ci => {
            const pid = Object.keys(productTypes).find(pp => productNames[pp] === ci.name && productTypes[pp] !== 'service');
            if (pid != null) {
              const q = Math.round((Number(ci.qty) || 0) * row.qty / ((Number(item.quantity) || 1)));
              if (q > 0) woInserts.push({ id: Date.now() + woInserts.length, user_id: user.id, product_id: parseInt(pid), quantity: -q, cost: 0, reason: 'Возврат по чеку № ' + r.receipt_number, date: tzToday() });
            }
          });
        } else if (row.product_id != null && productTypes[row.product_id] !== 'service') {
          woInserts.push({ id: Date.now() + woInserts.length, user_id: user.id, product_id: parseInt(row.product_id), quantity: -row.qty, cost: 0, reason: 'Возврат по чеку № ' + r.receipt_number, date: tzToday() });
        }
      });
      if (woInserts.length > 0) await supabase.from('writeoffs').insert(woInserts);
      // 3) Долг клиента: часть возврата, купленная в долг, — уменьшаем долг
      if (r.client_id && diff > 0) {
        const { data: cl } = await supabase.from('clients').select('debt').eq('id', r.client_id).maybeSingle();
        await supabase.from('clients').update({ debt: (parseFloat(cl?.debt) || 0) + diff }).eq('id', r.client_id);
      }
      // 4) Баллы лояльности: списываем начисленные за чек (пропорционально возврату)
      if (r.client_id && Number(r.points_earned) > 0 && sumItems > 0) {
        const totalAmt = Number(r.total_amount) || 1;
        const pointsForRefund = Math.round(Number(r.points_earned) * sumItems / totalAmt);
        const alreadySpentRefund = Number(r.refund_points) || 0;
        const pointsNow = Math.max(0, pointsForRefund - alreadySpentRefund);
        if (pointsNow > 0) {
          const { data: cl } = await supabase.from('clients').select('points').eq('id', r.client_id).maybeSingle();
          await supabase.from('clients').update({ points: Math.max(0, (Number(cl?.points) || 0) - pointsNow) }).eq('id', r.client_id);
          await supabase.from('receipts').update({ refund_points: alreadySpentRefund + pointsNow }).eq('id', r.id);
        }
      }
      setRefunding(false);
      setRefundReceipt(null);
      setSelectedReceipt(null);
      setReceiptItems([]);
      if (!updRes.queued) await load();
      setToast('Возврат по чеку № ' + r.receipt_number + ' оформлен: −' + sumItems.toLocaleString() + ' ' + cur + (money > 0 ? ', возвращено денег: ' + money.toLocaleString() + ' ' + cur : ', без возврата денег'));
    } catch (err) { setRefunding(false); alert(err.message); }
  };

  if (loading) {
    return <CenterSpinner />;
  }

  if (!loading && receipts.length === 0 && statusFilter === null && search === '') {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Чеки</h1>
            <div className="sub">Все чеки, пробитые через кассу и быстрые продажи</div>
          </div>
        </div>
        <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />
        <div className="empty-products" style={{ marginTop: '2rem' }}>
          <div className="big-icon">🧾</div>
          <p>Чеки появятся после первой продажи через кассу</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Чеки</h1>
          <div className="sub">Все чеки, пробитые через кассу и быстрые продажи</div>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%', border: 'none', borderTop: '1px solid var(--border)' }} />

      {/* Поиск + фильтры */}
      <div className="search-row" style={{ display: 'flex', alignItems: 'center', marginBottom: '.5rem', width: '100%', flexWrap: 'nowrap' }}>
        <div className="stock-search" style={{ display: 'flex', alignItems: 'center', gap: '.3rem', width: '30%', minWidth: '260px', maxWidth: '500px', border: '1.5px solid var(--border)', borderRadius: '6px', padding: '7px .5rem', background: 'var(--body-bg)' }}>
          <span style={{ fontSize: '.75rem', color: 'var(--muted)', lineHeight: 1 }}>🔍</span>
          <input type="text" placeholder="Номер чека, клиент, кассир..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '.8rem', fontFamily: 'var(--font)', background: 'none', padding: 0 }} />
        </div>
        <div className="stock-filter-links" style={{ display: 'flex', alignItems: 'center', gap: '.15rem', marginLeft: 'auto' }}>
          <div style={{position:'relative',display:'inline-flex',alignItems:'center',lineHeight:1,flexShrink:0}}>
            <span className="stock-filter-link" style={{padding:'.15rem .4rem',fontSize:'.75rem',color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1,whiteSpace:'nowrap'}}
              onClick={e=>{e.stopPropagation();setPeriodOpen(!periodOpen)}}>{periodLabel}</span>
            {periodOpen && (
              <div onClick={e=>e.stopPropagation()} style={{display:'block',position:'absolute',top:'100%',right:0,marginTop:'4px',background:'var(--body-bg)',border:'1px solid var(--border)',borderRadius:'.6rem',boxShadow:'0 .3rem .8rem rgba(0,0,0,.1)',minWidth:'210px',padding:'.35rem',zIndex:100}}>
                {[{key:'all',label:'Все время'},{key:'today',label:'Сегодня'},{key:'yesterday',label:'Вчера'},{key:'week',label:'Эта неделя'}].map(p=>{
                  const isActive = period === p.key;
                  return (
                    <div key={p.key} onClick={()=>{setPeriod(p.key);setPeriodLabel(p.label);setPeriodOpen(false)}}
                      style={{display:'flex',alignItems:'center',gap:'.35rem',padding:'.3rem .5rem',borderRadius:'4px',cursor:'pointer',fontSize:'.78rem',color:'#555',background:'transparent'}}>
                      <input type="checkbox" checked={isActive} onChange={()=>{}} style={{cursor:'pointer',margin:0}} />
                      {p.label}
                    </div>
                  );
                })}
                <div style={{borderTop:'1px solid var(--border)',paddingTop:'.35rem',marginTop:'.15rem'}}>
                  <div style={{fontSize:'.72rem',color:'var(--muted)',padding:'.2rem .5rem',marginBottom:'.25rem'}}>Свой период</div>
                  <div style={{display:'flex',gap:'.25rem',padding:'.25rem .5rem'}}>
                    <input type="date" value={periodFrom} onChange={e=>setPeriodFrom(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px',fontFamily:'var(--font)',outline:'none'}} />
                    <input type="date" value={periodTo} onChange={e=>setPeriodTo(e.target.value)} style={{flex:1,fontSize:'.72rem',padding:'.2rem',border:'1px solid var(--border)',borderRadius:'4px',fontFamily:'var(--font)',outline:'none'}} />
                  </div>
                  <div style={{padding:'.25rem .5rem'}}>
                    <button onClick={()=>{if(!periodFrom||!periodTo)return alert('Выберите обе даты');setPeriod('custom');setPeriodLabel(periodFrom.split('-').reverse().join('.')+' — '+periodTo.split('-').reverse().join('.'));setPeriodOpen(false)}}
                      style={{width:'100%',padding:'.35rem .5rem',fontSize:'.75rem',fontFamily:'var(--font)',background:'var(--secondary)',color:'#fff',border:'none',borderRadius:'4px',cursor:'pointer',fontWeight:600}}>Применить</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <span className="stock-filter-link" onClick={()=>setStatusFilter(statusFilter==='paid'?null:'paid')} style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:statusFilter==='paid'?600:400,color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}>Оплачен</span>
          <span className="stock-filter-link" onClick={()=>setStatusFilter(statusFilter==='partially_paid'?null:'partially_paid')} style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:statusFilter==='partially_paid'?600:400,color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}>Частично</span>
          <span className="stock-filter-link" onClick={()=>setStatusFilter(statusFilter==='unpaid'?null:'unpaid')} style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:statusFilter==='unpaid'?600:400,color:'#555',cursor:'pointer',borderRight:'1px solid var(--border)',lineHeight:1}}>Долги</span>
          <span className="stock-filter-link" onClick={()=>setStatusFilter(statusFilter==='refunded'?null:'refunded')} style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:statusFilter==='refunded'?600:400,color:'#ea580c',cursor:'pointer',borderRight:'none',lineHeight:1}}>Возвраты</span>
        </div>
      </div>

      {/* Таблица чеков */}
      <div className="product-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', overflowY: 'visible' }}>
        <table className="data-table">
          <thead id="colHeaders">
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 0 }}>№ чека</th>
              <th style={{ textAlign: 'left' }}>Дата</th>
              <th style={{ textAlign: 'left' }}>Сумма</th>
              <th style={{ textAlign: 'left' }}>Скидка</th>
              <th style={{ textAlign: 'left' }}>Оплата</th>
              <th style={{ textAlign: 'left' }}>Клиент</th>
              <th style={{ textAlign: 'left' }}>Комментарий</th>
              <th style={{ textAlign: 'left' }}>Кассир</th>
              <th style={{ textAlign: 'left' }}>Откуда</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="9"><div className="empty-products" style={{ padding: '1rem' }}><div className="big-icon">🔍</div><p>Ничего не найдено</p></div></td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => openReceipt(r)}
                style={{ cursor: 'pointer', transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ textAlign: 'left', paddingLeft: 0, fontSize: '.82rem' }}>№{r.receipt_number}{r.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</td>
                <td style={{ textAlign: 'left' }}>{fmtDate(r.date)}</td>
                <td style={{ textAlign: 'left', fontSize: '.82rem' }}>{Number(r.total_amount).toLocaleString()} {cur}</td>
                <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#16a34a' }}>
                  {parseInt(r.discount_sum) > 0
                    ? '-' + parseInt(r.discount_sum).toLocaleString() + ' ' + cur
                    : '—'}
                </td>
                <td style={{ textAlign: 'left' }}>
                  {(() => {
                    const remain = receiptRemain(r);
                    const paySt = r.status === 'paid' ? 'Оплачено' : 'Долг ' + remain.toLocaleString() + ' ₽';
                    const payColor = r.status === 'paid' ? '#16a34a' : (r.status === 'partially_paid' ? '#d97706' : '#dc2626');
                    return (
                      <>
                      <span onClick={(e) => { e.stopPropagation(); if (r.status !== 'paid') { setPayReceipt(r); setPayAmt(String(remain)); setPayAc(''); } }}
                        style={{ display: 'inline-block', padding: '.25rem .65rem', borderRadius: '100px', fontSize: '.72rem', fontWeight: 600, color: payColor, background: payColor + '18', cursor: r.status !== 'paid' ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{paySt}</span>
                      {Number(r.refund_amount) > 0 && (
                        <span style={{ display: 'inline-block', padding: '.25rem .65rem', borderRadius: '100px', fontSize: '.72rem', fontWeight: 600, color: '#ea580c', background: '#ea580c18', fontFamily: 'inherit', whiteSpace: 'nowrap', marginLeft: '4px' }}>↩ −{Number(r.refund_amount).toLocaleString()} {cur}</span>
                      )}
                      </>
                    );
                  })()}
                </td>
                <td style={{ textAlign: 'left' }}>{r.client_name || '—'}</td>
                <td style={{ textAlign: 'left',fontSize:'.75rem',color:'#888',maxWidth:'120px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{r.comment || '—'}</td>
                <td style={{ textAlign: 'left' }}>{r.cashier_name || '—'}</td>
                <td style={{ textAlign: 'left' }}>
                  {r.source === 'quick_sale' ? 'Быстрая' : 'Касса'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Показать ещё (если чеков больше, чем загружено) */}
      {hasMore && (
        <div style={{ textAlign: 'center', padding: '1rem 0 .5rem' }}>
          <button onClick={loadMore} disabled={loadingMore} style={{ padding: '.5rem 1.4rem', borderRadius: '100px', border: '1.5px solid var(--border)', background: '#fff', color: '#444', fontSize: '.8rem', fontWeight: 600, cursor: loadingMore ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {loadingMore ? 'Загрузка...' : 'Показать ещё'}
          </button>
          <div style={{ fontSize: '.72rem', color: '#999', marginTop: '.35rem' }}>Показано чеков: {receipts.length}</div>
        </div>
      )}

      {/* Модалка состава чека */}
      <Modal open={!!selectedReceipt} onClose={() => { setSelectedReceipt(null); setReceiptItems([]); }} title={selectedReceipt ? 'Чек № ' + selectedReceipt.receipt_number : ''} subtitle={selectedReceipt ? (
          <span style={{ display: 'block', lineHeight: 1.8 }}>
            <span style={{ display: 'block' }}>Дата: {fmtDateTime(selectedReceipt.created_at || selectedReceipt.date)}</span>
            <span style={{ display: 'block' }}>Кассир: {selectedReceipt.cashier_name || '—'}</span>
            {selectedReceipt.client_name ? <span style={{ display: 'block' }}>Клиент: {selectedReceipt.client_name}</span> : null}
          </span>
        ) : ''} width={780}>
        {selectedReceipt && (<>
        {selectedReceipt.comment ? <div style={{marginBottom:'.75rem',fontSize:'.75rem',color:'#888',background:'#f9f9f9',padding:'4px 8px',borderRadius:'6px'}}>💬 {selectedReceipt.comment}</div> : ''}

            {/* Баллы лояльности: начислено / списано */}
            {((Number(selectedReceipt.points_earned) || 0) > 0 || (Number(selectedReceipt.points_spent) || 0) > 0) && (
              <div style={{marginBottom:'.75rem',fontSize:'.78rem',color:'#7c3aed',background:'#f3e8ff',padding:'5px 10px',borderRadius:'6px',fontWeight:600}}>
                {Number(selectedReceipt.points_earned) > 0 ? 'Начислено баллов: +' + Number(selectedReceipt.points_earned).toLocaleString() : ''}
                {Number(selectedReceipt.points_earned) > 0 && Number(selectedReceipt.points_spent) > 0 ? ' • ' : ''}
                {Number(selectedReceipt.points_spent) > 0 ? 'Списано баллов: −' + Number(selectedReceipt.points_spent).toLocaleString() : ''}
              </div>
            )}

            {/* Позиции */}
            {itemsLoading ? (
              <div style={{ textAlign: 'left', padding: '1rem', color: 'var(--muted)', fontSize: '.82rem' }}>Загрузка...</div>
            ) : receiptItems.length === 0 ? (
              <div style={{ textAlign: 'left', padding: '1rem', color: 'var(--muted)', fontSize: '.82rem' }}>Нет позиций</div>
            ) : (
                            <div style={{ background: '#f9f9f9', borderRadius: '.5rem', padding: '.5rem .75rem', marginBottom: '.5rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0 14px 6px 0', fontSize: '.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>Товар</th>
                      <th style={{ textAlign: 'left', padding: '0 14px 6px 0', fontSize: '.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>Кол-во</th>
                      <th style={{ textAlign: 'left', padding: '0 14px 6px 0', fontSize: '.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>Цена</th>
                      <th style={{ textAlign: 'left', padding: '0 14px 6px 0', fontSize: '.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>Скидка</th>
                      <th style={{ textAlign: 'left', padding: '0 14px 6px 0', fontSize: '.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>Сумма</th>
                      <th style={{ textAlign: 'left', padding: '0 0 6px 0', fontSize: '.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>Продавец/Исполнитель</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptItems.map(function(item) {
                      var combo = item.combo_items;
                      return (
                        <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                          <td style={{ textAlign: 'left', padding: '7px 14px 7px 0', fontWeight: 500, verticalAlign: 'top' }}>
                            {item.product_name}
                            {combo && Array.isArray(combo) && combo.length > 0 && (
                              <div style={{ paddingTop: '2px', fontSize: '.72rem', color: '#999', fontWeight: 400 }}>
                                Cocтaв: {combo.map(function(ci, idx) {
                                  return <span key={idx}>{ci.name} x{ci.qty}{idx < combo.length - 1 ? ', ' : ''}</span>;
                                })}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'left', padding: '7px 14px 7px 0', color: 'var(--muted)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{Number(item.quantity).toLocaleString()}</td>
                          <td style={{ textAlign: 'left', padding: '7px 14px 7px 0', color: 'var(--muted)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{Number(item.price).toLocaleString()} {cur}</td>
                          <td style={{ textAlign: 'left', padding: '7px 14px 7px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                            {Number(item.discount_amount) > 0
                              ? <span style={{ color: '#16a34a', fontSize: '.78rem', fontWeight: 600 }}>−{Number(item.discount_amount).toLocaleString()} {cur}</span>
                              : <span style={{ color: '#bbb' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'left', padding: '7px 14px 7px 0', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{Number(item.total).toLocaleString()} {cur}</td>
                          <td style={{ textAlign: 'left', padding: '7px 0 7px 0', color: '#555', fontSize: '.76rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                            {item.employee_id ? empShort(item.employee_id) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {Number(selectedReceipt.discount_sum) > 0 && (
                      <tr style={{ color: '#16a34a', fontWeight: 600 }}>
                        <td style={{ textAlign: 'left', padding: '6px 14px 0 0' }}>Скидка:</td>
                        <td style={{ padding: '6px 14px 0 0' }}></td>
                        <td style={{ padding: '6px 14px 0 0' }}></td>
                        <td style={{ padding: '6px 14px 0 0' }}></td>
                        <td style={{ textAlign: 'left', padding: '6px 14px 0 0', whiteSpace: 'nowrap' }}>−{Number(selectedReceipt.discount_sum).toLocaleString()} {cur}</td>
                        <td style={{ padding: 0 }}></td>
                      </tr>
                    )}
                    <tr style={{ fontWeight: 700, borderTop: '1px solid #ddd' }}>
                      <td style={{ textAlign: 'left', padding: '8px 14px 0 0' }}>ИТОГО:</td>
                      <td style={{ padding: '8px 14px 0 0' }}></td>
                      <td style={{ padding: '8px 14px 0 0' }}></td>
                      <td style={{ padding: '8px 14px 0 0' }}></td>
                      <td style={{ textAlign: 'left', padding: '8px 14px 0 0', whiteSpace: 'nowrap' }}>{Number(selectedReceipt.total_amount).toLocaleString()} {cur}</td>
                      <td style={{ padding: 0 }}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Статус */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.82rem' }}>
              <span style={{ color: 'var(--muted)' }}>Статус:</span>
              <span style={{
                fontSize: '.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                background: STATUS_BG[selectedReceipt.status] || '#f5f5f5',
                color: STATUS_COLORS[selectedReceipt.status] || '#999',
              }}>{STATUS_LABELS[selectedReceipt.status] || selectedReceipt.status}</span>
              {Number(selectedReceipt.refund_amount) > 0 && (
                <span style={{ fontSize: '.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: '#fff7ed', color: '#ea580c' }}>
                  Возврат: −{Number(selectedReceipt.refund_amount).toLocaleString()} {cur}
                </span>
              )}
            </div>

            {/* Возврат: детали + кнопка оформления */}
            {(Number(selectedReceipt.refund_amount) > 0 || (selectedReceipt.status !== 'unpaid' && !itemsLoading && receiptItems.length > 0 && canRefund(selectedReceipt))) && (
              <div style={{ marginTop: '.75rem', borderTop: '1px solid #f0f0f0', paddingTop: '.75rem' }}>
                {Number(selectedReceipt.refund_amount) > 0 && (
                  <div style={{ fontSize: '.78rem', color: '#ea580c', background: '#fff7ed', borderRadius: '8px', padding: '8px 10px', marginBottom: '.6rem', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 600 }}>↩ Возврат оформлен: −{Number(selectedReceipt.refund_amount).toLocaleString()} {cur}</div>
                    {selectedReceipt.refund_date && <div>Дата: {fmtDate(selectedReceipt.refund_date)}</div>}
                    {selectedReceipt.refund_reason && <div>Причина: {selectedReceipt.refund_reason}</div>}
                    {(selectedReceipt.refund_items || []).length > 0 && (
                      <div style={{ marginTop: '2px', color: '#9a6a3a' }}>
                        Возвращено: {(selectedReceipt.refund_items || []).map((x, i) => <span key={i}>{x.product_name} x{x.qty}{i < (selectedReceipt.refund_items || []).length - 1 ? ', ' : ''}</span>)}
                      </div>
                    )}
                  </div>
                )}
                {selectedReceipt.status !== 'unpaid' && !itemsLoading && receiptItems.length > 0 && canRefund(selectedReceipt) && (
                  <button type="button" onClick={() => {
                    setRefundReceipt(selectedReceipt);
                    const q = {};
                    receiptItems.forEach(it => { q[it.id] = refundableQty(selectedReceipt, it); });
                    setRefundQty(q);
                    setRefundMode('cash'); setRefundAc(''); setRefundReason('');
                  }} style={{ width: '100%', padding: '11px', borderRadius: '100px', border: '1.5px solid #ea580c', background: '#fff', color: '#ea580c', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ↩ Оформить возврат
                  </button>
                )}
              </div>
            )}
        </>)}
      </Modal>

      {/* Модалка возврата по чеку */}
      <Modal open={!!refundReceipt} onClose={() => setRefundReceipt(null)} title={refundReceipt ? 'Возврат по чеку № ' + refundReceipt.receipt_number : ''} subtitle="Укажите количество, причину и способ возврата" width={640}>
        {refundReceipt && (<>
          <div style={{ border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden', marginBottom: '.7rem' }}>
            <div style={{ display: 'flex', padding: '6px 10px', fontSize: '.7rem', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.3px', background: '#fafafa', borderBottom: '1px solid #eee' }}>
              <span style={{ width: '70px' }}>Кол-во</span>
              <span style={{ flex: 1 }}>Товар</span>
              <span style={{ width: '110px', textAlign: 'right' }}>Сумма</span>
            </div>
            {receiptItems.map(it => {
              const avail = refundableQty(refundReceipt, it);
              if (avail <= 0) return null;
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderBottom: '1px solid #f5f5f5', fontSize: '.82rem' }}>
                  <input type="number" min="0" max={avail} value={refundQty[it.id] || 0}
                    onChange={e => { const v = Math.min(avail, Math.max(0, parseInt(e.target.value) || 0)); setRefundQty(q => ({ ...q, [it.id]: v })); }}
                    style={{ width: '58px', padding: '4px 6px', border: '1.5px solid var(--border)', borderRadius: '6px', textAlign: 'center', fontFamily: 'inherit', fontSize: '.82rem', outline: 'none' }} />
                  <span style={{ flex: 1, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.product_name}</span>
                  <span style={{ fontSize: '.72rem', color: '#999', width: '110px', textAlign: 'right' }}>
                    {avail < (Number(it.quantity) || 1) ? 'осталось ' : ''}{Math.round(unitPrice(it) * (Number(refundQty[it.id]) || 0)).toLocaleString()} {cur}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="form-group">
            <label>Причина возврата *</label>
            <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} rows="2" placeholder="Например: не подошёл размер, брак, передумал..." style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '.82rem', padding: '8px', border: '1.5px solid var(--border)', borderRadius: '8px', outline: 'none', resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label>Как возвращаем деньги</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[{ k: 'cash', l: '💵 Наличными' }, { k: 'account', l: '🏦 На счёт / карту' }, { k: 'none', l: '🔄 Без денег (обмен)' }].map(m => (
                <button key={m.k} type="button" onClick={() => setRefundMode(m.k)}
                  style={{ padding: '6px 12px', borderRadius: '100px', border: '1.5px solid ' + (refundMode === m.k ? '#111' : 'var(--border)'), background: refundMode === m.k ? '#111' : '#fff', color: refundMode === m.k ? '#fff' : '#444', fontSize: '.76rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{m.l}</button>
              ))}
            </div>
            {refundMode === 'account' && (
              <select value={refundAc} onChange={e => setRefundAc(e.target.value)} style={{ marginTop: '6px', width: '100%', padding: '8px', border: '1.5px solid var(--border)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '.82rem', outline: 'none', background: '#fff' }}>
                <option value="">— выберите счёт —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            {refundMode === 'cash' && <div style={{ fontSize: '.72rem', color: '#999', marginTop: '4px' }}>Деньги вернутся из кассы (учтётся при закрытии смены)</div>}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setRefundReceipt(null)}>Отмена</button>
            <button type="button" className="btn btn-dark" onClick={doRefund} disabled={refunding} style={{ background: '#ea580c' }}>{refunding ? 'Оформляем...' : '↩ Оформить возврат'}</button>
          </div>
        </>)}
      </Modal>

      {/* Модалка оплаты долга по чеку */}
      <Modal open={!!payReceipt} onClose={() => setPayReceipt(null)} title={payReceipt ? 'Оплата долга по чеку №' + payReceipt.receipt_number : ''} subtitle={payReceipt ? 'Клиент: ' + (payReceipt.client_name || '—') + ' • Остаток долга: ' + receiptRemain(payReceipt).toLocaleString() + ' ₽' : ''} width="medium">
        {payReceipt && (<>
          <div className="form-group">
            <label>Сумма (₽)</label>
            <input type="number" min="0" step="0.01" value={payAmt} onChange={e => setPayAmt(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Счёт зачисления</label>
            <select value={payAc} onChange={e => setPayAc(e.target.value)}>
              <option value="">— выберите счёт —</option>
              {accounts.filter(a => a.type !== 'cash').map(a => <option key={a.id} value={a.id}>{a.type === 'cash_register' ? 'Наличные' : a.name}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setPayReceipt(null)}>Отмена</button>
            <button type="button" className="btn btn-dark" onClick={payDebt}>Оплатить</button>
          </div>
        </>)}
      </Modal>
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.65rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>{toast}</div>
      )}
    </div>
  );
}
