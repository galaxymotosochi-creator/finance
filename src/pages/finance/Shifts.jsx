import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function Shifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  var getCashRegisterBalance = function() {
    var ac = (accounts||[]).find(function(a){return a.type === 'cash_register';});
    if (!ac) return 0;
    var bal = parseFloat(ac.balance) || 0;
    (transactions||[]).forEach(function(t){if (t.account_id === ac.id) bal += Number(t.amount||0) * (t.type === 'income' ? 1 : -1);});
    return bal;
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [sRes, tRes, aRes, rRes] = await Promise.all([
        supabase.from('shifts').select('*').eq('user_id', user.id).order('opened_at', { ascending: false }),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(500),
        supabase.from('accounts').select('*').order('created_at', { ascending: true }),
        supabase.from('receipts').select('shift_id,paid_amount').eq('user_id', user.id),
      ]);
      setShifts(sRes.data || []);
      setTransactions(tRes.data || []);
      setAccounts(aRes.data || []);
      setReceipts(rRes.data || []);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
  }, [toast]);

  const activeShift = useMemo(() => shifts.find(s => s.status === 'open'), [shifts]);

  // Выручка смены = сумма оплаченного по чекам смены (только кассовые чеки, быстрые продажи не входят)
  const getShiftIncome = (s) => {
    return (receipts||[]).filter(r => r.shift_id === s.id).reduce((sum, r) => sum + (Number(r.paid_amount)||0), 0);
  };
  const getShiftExpense = (s) => { return 0; };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <>
      {toast && (
        <div style={{position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', border:'1px solid #e5e7eb', borderRadius:'.75rem', padding:'.75rem 1.2rem', fontSize:'.85rem', color:'#333', boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)', zIndex:9999 }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Смены</h1>
          <div className="sub">Контроль работы касс и выручки</div>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      {/* Таблица */}
      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch',overflowY:'visible'}}>
        <table className="data-table">
          <thead id="colHeaders">
            <tr>
              <th style={{textAlign:'left',paddingLeft:0}}>Дата</th>
              <th style={{textAlign:'left'}}>Время открытия</th>
              <th style={{textAlign:'left'}}>Смена №</th>
              <th style={{textAlign:'left'}}>Кассир</th>
              <th style={{textAlign:'left'}}>Начальный остаток</th>
              <th style={{textAlign:'left'}}>Выручка</th>
              <th style={{textAlign:'left'}}>Конечный остаток</th>
              <th style={{textAlign:'left'}}>Время закрытия</th>
              <th style={{textAlign:'left'}}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr><td colSpan="9"><div className="empty-products"><div className="big-icon">📊</div><p>Нет кассовых смен</p></div></td></tr>
            ) : shifts.map((s, idx) => {
              const income = getShiftIncome(s);
              const expense = getShiftExpense(s);
              const isOpen = s.status === 'open';
              const d = new Date(s.opened_at);
              const dateStr = d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' });
              const timeOpen = d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
              const timeClose = s.closed_at ? new Date(s.closed_at).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) : '—';
              const sCloseBal = parseFloat(s.closing_balance)||0;
              return (
                <tr key={s.id}>
                  <td style={{textAlign:'left',color:'#555',paddingLeft:0}}>{dateStr}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{timeOpen}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{'#'+(shifts.length - idx)}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{s.cashier_name || '—'}</td>
                  <td style={{textAlign:'left'}}>{(parseFloat(s.opening_balance)||0).toLocaleString()} ₽</td>
                  <td style={{textAlign:'left',fontWeight:600}}>{income > 0 ? '+'+income.toLocaleString()+' ₽' : '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{sCloseBal > 0 ? sCloseBal.toLocaleString() + ' ₽' : '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{timeClose}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{isOpen ? 'Открыта' : 'Закрыта'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
