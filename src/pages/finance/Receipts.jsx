import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

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
  const [payReceipt, setPayReceipt] = useState(null);
  const [payAc, setPayAc] = useState('');
  const [payAmt, setPayAmt] = useState('');
  const [toast, setToast] = useState(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      setReceipts(data || []);
    } catch (e) {
      // Таблица может ещё не существовать
      setReceipts([]);
      console.warn('Таблица receipts недоступна. Выполните SQL миграцию в Supabase.');
    }
    try {
      const { data: ac } = await supabase.from('accounts').select('id,name,balance,type').eq('user_id', user.id);
      setAccounts(ac || []);
    } catch (e) { setAccounts([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

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
    if (statusFilter && r.status !== statusFilter) return false;
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
      await supabase.from('receipts').update({ status: newStatus, paid_amount: newPaid }).eq('id', payReceipt.id);
      // Транзакция оплаты долга
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'income', amount: amt,
        description: 'Оплата долга по чеку № ' + payReceipt.receipt_number,
        date: new Date().toISOString().split('T')[0],
        account_id: payAc, status: 'paid', category_id: saleCatId,
      });
      // Уменьшаем долг клиента
      if (payReceipt.client_id) {
        const { data: cl } = await supabase.from('clients').select('debt').eq('id', payReceipt.client_id).maybeSingle();
        await supabase.from('clients').update({ debt: (parseFloat(cl?.debt)||0) + amt }).eq('id', payReceipt.client_id);
      }
      setPayReceipt(null); setPayAc(''); setPayAmt('');
      await load();
      setToast('Долг по чеку № ' + payReceipt.receipt_number + ' оплачен: ' + amt.toLocaleString() + ' ₽');
    } catch (err) { alert(err.message); }
  };

  if (loading) {
    return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;
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
          <span className="stock-filter-link" onClick={()=>setStatusFilter(statusFilter==='unpaid'?null:'unpaid')} style={{padding:'.15rem .4rem',fontSize:'.75rem',fontWeight:statusFilter==='unpaid'?600:400,color:'#555',cursor:'pointer',borderRight:'none',lineHeight:1}}>Долги</span>
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
              <th style={{ textAlign: 'left' }}>Статус</th>
              <th style={{ textAlign: 'left' }}>Оплата</th>
              <th style={{ textAlign: 'left' }}>Клиент</th>
              <th style={{ textAlign: 'left' }}>Комментарий</th>
              <th style={{ textAlign: 'left' }}>Кассир</th>
              <th style={{ textAlign: 'left' }}>Откуда</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7"><div className="empty-products" style={{ padding: '1rem' }}><div className="big-icon">🔍</div><p>Ничего не найдено</p></div></td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => openReceipt(r)}
                style={{ cursor: 'pointer', transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ textAlign: 'left', paddingLeft: 0, fontSize: '.82rem' }}>#{r.receipt_number}</td>
                <td style={{ textAlign: 'left' }}>{fmtDate(r.date)}</td>
                <td style={{ textAlign: 'left', fontSize: '.82rem' }}>{Number(r.total_amount).toLocaleString()} ₽</td>
                <td style={{ textAlign: 'left', fontSize: '.78rem', color: '#16a34a' }}>
                  {parseInt(r.receipt_discount) > 0 || parseInt(r.discount_sum) > 0
                    ? '-' + ((parseInt(r.receipt_discount)||0)+(parseInt(r.discount_sum)||0)).toLocaleString() + ' ₽'
                    : '—'}
                </td>
                <td style={{ textAlign: 'left' }}>{STATUS_LABELS[r.status] || r.status}</td>
                <td style={{ textAlign: 'left' }}>
                  {(() => {
                    const remain = receiptRemain(r);
                    const paySt = r.status === 'paid' ? 'Оплачено' : (r.status === 'partially_paid' ? 'Частично (' + remain.toLocaleString() + ' ₽)' : 'Не оплачено (' + remain.toLocaleString() + ' ₽)');
                    const payColor = r.status === 'paid' ? '#16a34a' : (r.status === 'partially_paid' ? '#d97706' : '#dc2626');
                    return (
                      <span onClick={(e) => { e.stopPropagation(); if (r.status !== 'paid') { setPayReceipt(r); setPayAmt(String(remain)); setPayAc(''); } }}
                        style={{ display: 'inline-block', padding: '.25rem .65rem', borderRadius: '100px', fontSize: '.72rem', fontWeight: 600, color: payColor, background: payColor + '18', cursor: r.status !== 'paid' ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{paySt}</span>
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

      {/* Модалка состава чека */}
      <Modal open={!!selectedReceipt} onClose={() => { setSelectedReceipt(null); setReceiptItems([]); }} title={selectedReceipt ? 'Чек #'+selectedReceipt.receipt_number : ''} subtitle={selectedReceipt ? fmtDate(selectedReceipt.date) + (selectedReceipt.cashier_name ? ' • Кассир: '+selectedReceipt.cashier_name : '') + (selectedReceipt.client_name ? ' • Клиент: '+selectedReceipt.client_name : '') : ''} width="medium">
        {selectedReceipt && (<>
        {selectedReceipt.comment ? <div style={{marginBottom:'.75rem',fontSize:'.75rem',color:'#888',background:'#f9f9f9',padding:'4px 8px',borderRadius:'6px'}}>💬 {selectedReceipt.comment}</div> : ''}

            {/* Позиции */}
            {itemsLoading ? (
              <div style={{ textAlign: 'left', padding: '1rem', color: 'var(--muted)', fontSize: '.82rem' }}>Загрузка...</div>
            ) : receiptItems.length === 0 ? (
              <div style={{ textAlign: 'left', padding: '1rem', color: 'var(--muted)', fontSize: '.82rem' }}>Нет позиций</div>
            ) : (
              <div style={{ background: '#f9f9f9', borderRadius: '.5rem', padding: '.5rem 0', marginBottom: '.5rem' }}>
                <div style={{ display: 'flex', padding: '.35rem .75rem', fontSize: '.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.3px' }}>
                  <span style={{ flex: 1 }}>Товар</span>
                  <span style={{ width: '50px', textAlign: 'left' }}>Кол-во</span>
                  <span style={{ width: '70px', textAlign: 'right' }}>Цена</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>Сумма</span>
                </div>
                {receiptItems.map(function(item) {
                  var combo = item.combo_items;
                  return (
                    <div key={item.id}>
                      <div style={{ display: 'flex', padding: '.35rem .75rem', fontSize: '.82rem', borderTop: '1px solid #f0f0f0' }}>
                        <span style={{ flex: 1, fontWeight: 500 }}>{item.product_name}</span>
                        <span style={{ width: '50px', textAlign: 'left', color: 'var(--muted)' }}>{Number(item.quantity).toLocaleString()}</span>
                        <span style={{ width: '70px', textAlign: 'right', color: 'var(--muted)' }}>{Number(item.price).toLocaleString()}</span>
                        <span style={{ width: '80px', textAlign: 'right', fontWeight: 600 }}>{Number(item.total).toLocaleString()} ₽</span>
                      </div>
                      {combo && Array.isArray(combo) && combo.length > 0 && (
                        <div style={{ padding: '0 .75rem .35rem 1.2rem', fontSize: '.72rem', color: '#999' }}>
                          Cocтaв: {combo.map(function(ci, idx) {
                            return <span key={idx}>{ci.name} x{ci.qty}{idx < combo.length - 1 ? ', ' : ''}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })})
                <div style={{ display: 'flex', padding: '.5rem .75rem', borderTop: '1px solid #ddd', fontSize: '.82rem' }}>
                  <span style={{ flex: 1 }}>ИТОГО:</span>
                  <span style={{ width: '50px', textAlign: 'left' }}></span>
                  <span style={{ width: '70px', textAlign: 'right' }}></span>
                  <span style={{ width: '80px', textAlign: 'right' }}>{Number(selectedReceipt.total_amount).toLocaleString()} ₽</span>
                </div>
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
            <button type="button" className="btn btn-primary" onClick={payDebt}>Оплатить</button>
          </div>
        </>)}
      </Modal>
      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.65rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>{toast}</div>
      )}
    </div>
  );
}
