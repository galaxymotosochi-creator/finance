import { useState, useEffect } from 'react';
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
  const [toastError, setToastError] = useState(false);

  const showToast = (msg, isError = false) => {
    setToastError(isError);
    setToast(msg);
    setTimeout(() => setToast(null), isError ? 4000 : 2500);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [sRes, tRes, aRes, rRes] = await Promise.all([
          supabase.from('shifts').select('*').eq('user_id', user.id).order('opened_at', { ascending: false }),
          supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(500),
          supabase.from('accounts').select('*').order('created_at', { ascending: true }),
          supabase.from('receipts').select('shift_id,paid_amount').eq('user_id', user.id),
        ]);
        if (sRes.error) throw sRes.error;
        setShifts(sRes.data || []);
        setTransactions(tRes.data || []);
        setAccounts(aRes.data || []);
        setReceipts(rRes.data || []);
      } catch (e) {
        showToast('Ошибка загрузки: ' + (e.message || 'неизвестная ошибка'), true);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Выручка смены = сумма оплаченного по чекам смены (только кассовые чеки, быстрые продажи не входят)
  const getShiftIncome = (s) => {
    return (receipts||[]).filter(r => r.shift_id === s.id).reduce((sum, r) => sum + (Number(r.paid_amount)||0), 0);
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <>
      {toast && (
        <div style={{
          position:'fixed', bottom:'24px', right:'24px',
          background: toastError ? '#dc2626' : '#fff',
          color: toastError ? '#fff' : '#333',
          border: toastError ? 'none' : '1px solid #e5e7eb',
          borderRadius:'12px', padding:'.7rem 1.2rem', fontSize:'.85rem',
          boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.15)', zIndex:9999, maxWidth:'320px'
        }}>{toast}</div>
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
            ) : shifts.map((s) => {
              const income = getShiftIncome(s);
              const isOpen = s.status === 'open';
              const opened = s.opened_at ? new Date(s.opened_at) : null;
              const dateStr = opened ? opened.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
              const timeOpen = opened ? opened.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) : '—';
              const timeClose = s.closed_at ? new Date(s.closed_at).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) : '—';
              const sCloseBal = parseFloat(s.closing_balance)||0;
              const cashier = s.current_cashier_name || s.cashier_name;
              return (
                <tr key={s.id}>
                  <td style={{textAlign:'left',color:'#555',paddingLeft:0}}>{dateStr}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{timeOpen}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{s.shift_number ? '#'+s.shift_number : '—'}</td>
                  <td style={{textAlign:'left',color:'#555'}}>{cashier || '—'}</td>
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
