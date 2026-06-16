import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function Shifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [openBal, setOpenBal] = useState('0');
  const [cashierName, setCashierName] = useState('');
  const [showClose, setShowClose] = useState(null);
  const [closeBal, setCloseBal] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [sRes, tRes] = await Promise.all([
        supabase.from('shifts').select('*').eq('user_id', user.id).order('opened_at', { ascending: false }),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(500),
      ]);
      setShifts(sRes.data || []);
      setTransactions(tRes.data || []);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
  }, [toast]);

  const activeShift = useMemo(() => shifts.find(s => s.status === 'open'), [shifts]);

  const getShiftIncome = (s) => {
    const start = new Date(s.opened_at);
    const end = s.closed_at ? new Date(s.closed_at) : new Date();
    return transactions.filter(t =>
      t.date && new Date(t.date) >= start && new Date(t.date) <= end && t.type === 'income'
    ).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  };
  const getShiftExpense = (s) => {
    const start = new Date(s.opened_at);
    const end = s.closed_at ? new Date(s.closed_at) : new Date();
    return transactions.filter(t =>
      t.date && new Date(t.date) >= start && new Date(t.date) <= end && t.type !== 'income'
    ).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  };

  const openShift = async () => {
    const bal = parseFloat(openBal) || 0;
    const { error } = await supabase.from('shifts').insert({
      user_id: user.id, opening_balance: bal, status: 'open', cashier_name: cashierName.trim() || null,
    });
    if (error) return showToast('❌ ' + error.message);
    setShowOpen(false); setOpenBal('0'); setCashierName('');
    const { data } = await supabase.from('shifts').select('*').eq('user_id', user.id).order('opened_at', { ascending: false });
    if (data) setShifts(data);
    showToast('✅ Смена открыта');
  };

  const closeShift = async () => {
    if (!showClose) return;
    const bal = parseFloat(closeBal);
    if (isNaN(bal)) return showToast('⚠️ Введите фактический остаток');
    const { error } = await supabase.from('shifts').update({
      closed_at: new Date().toISOString(), closing_balance: bal, status: 'closed',
    }).eq('id', showClose.id);
    if (error) return showToast('❌ ' + error.message);
    setShowClose(null); setCloseBal(''); setCloseNote('');
    const { data } = await supabase.from('shifts').select('*').eq('user_id', user.id).order('opened_at', { ascending: false });
    if (data) setShifts(data);
    showToast('✅ Смена закрыта');
  };

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
          <h1>Кассовые смены</h1>
          <div className="sub">Контроль работы касс и выручки</div>
        </div>

      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />



      {/* Таблица */}
      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch',overflowY:'visible'}}>
        <table>
          <thead id="colHeaders">
            <tr>
              <th style={{textAlign:'left',paddingLeft:0}}>Дата</th>
              <th style={{textAlign:'left'}}>Время открытия</th>
              <th>Смена №</th>
              <th style={{textAlign:'left'}}>Кассир</th>
              <th>Начальный остаток</th>
              <th style={{textAlign:'left'}}>Касса</th>
              <th>Конечный остаток</th>
              <th>Время закрытия</th>
              <th>Статус</th>
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
                  <td style={{textAlign:'left',fontSize:'.82rem'}}>{dateStr}</td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'var(--muted)'}}>{timeOpen}</td>
                  <td style={{fontSize:'.82rem'}}>{'#'+(idx+1)}</td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'var(--muted)'}}>{s.cashier_name || '—'}</td>
                  <td>{(parseFloat(s.opening_balance)||0).toLocaleString()} ₽</td>
                  <td style={{textAlign:'left',fontSize:'.78rem',color:'var(--muted)'}}>Основная</td>
                  <td style={{fontWeight:600}}>{sCloseBal > 0 ? sCloseBal.toLocaleString() + ' ₽' : '—'}</td>
                  <td style={{fontSize:'.78rem',color:'var(--muted)'}}>{timeClose}</td>
                  <td><span style={{fontSize:'.72rem',fontWeight:600,padding:'2px 8px',borderRadius:'100px',background:isOpen?'#f0fdf4':'#f5f5f5',color:isOpen?'#16a34a':'#999'}}>{isOpen ? 'Открыта' : 'Закрыта'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Модалка открытия */}
      {showOpen && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowOpen(false); }}>
          <div className="modal-box" style={{maxWidth:'380px'}}>
            <button className="modal-close" onClick={() => setShowOpen(false)}>&times;</button>
            <h2>Открыть смену</h2>
            <div className="sub">Укажите остаток в кассе на момент открытия</div>
            <form onSubmit={e => { e.preventDefault(); openShift(); }}>
              <div className="form-group">
                <label>Имя кассира</label>
                <input type="text" placeholder="Иван Иванов" value={cashierName} onChange={e => setCashierName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Остаток в кассе (₽)</label>
                <input type="number" placeholder="0" min="0" step="0.01" value={openBal} onChange={e => setOpenBal(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-account-select">Открыть смену</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка закрытия */}
      {showClose && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') setShowClose(null); }}>
          <div className="modal-box" style={{maxWidth:'380px'}}>
            <button className="modal-close" onClick={() => setShowClose(null)}>&times;</button>
            <h2>Закрыть смену</h2>
            <div className="sub">Сверьте фактический остаток с расчётным</div>
            <div style={{background:'#f9f9f9',borderRadius:'8px',padding:'.6rem .8rem',marginBottom:'1rem',fontSize:'.82rem',lineHeight:1.7}}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Расчётный остаток</span><b>{( (parseFloat(showClose.opening_balance)||0) + getShiftIncome(showClose) - getShiftExpense(showClose) ).toLocaleString()} ₽</b></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Открытие</span><b>{(parseFloat(showClose.opening_balance)||0).toLocaleString()} ₽</b></div>
              <div style={{display:'flex',justifyContent:'space-between',color:'#16a34a'}}><span>Доходы</span><b>+{getShiftIncome(showClose).toLocaleString()} ₽</b></div>
              <div style={{display:'flex',justifyContent:'space-between',color:'#dc2626'}}><span>Расходы</span><b>−{getShiftExpense(showClose).toLocaleString()} ₽</b></div>
            </div>
            <form onSubmit={e => { e.preventDefault(); closeShift(); }}>
              <div className="form-group">
                <label>Фактический остаток (₽)</label>
                <input type="number" placeholder="0" step="0.01" value={closeBal} onChange={e => setCloseBal(e.target.value)} autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowClose(null)}>Отмена</button>
                <button type="submit" className="btn btn-account-select" style={{background:'#dc2626',color:'#fff'}}>Закрыть смену</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
