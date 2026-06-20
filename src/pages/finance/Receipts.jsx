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
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

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

  const formatDate = (d) => {
    if (!d) return '—';
    const p = d.split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : d;
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
          <span className="stock-filter-link"
            onClick={() => setStatusFilter(null)} style={{ cursor: 'pointer', fontSize: '.78rem', padding: '.25rem .35rem', borderRight: '1px solid var(--border)', color: statusFilter === null ? '#111' : 'var(--muted)', fontWeight: statusFilter === null ? 600 : 400 }}>
            Все
          </span>
          <span className="stock-filter-link"
            onClick={() => setStatusFilter('paid')} style={{ cursor: 'pointer', fontSize: '.78rem', padding: '.25rem .35rem', borderRight: '1px solid var(--border)', color: statusFilter === 'paid' ? '#16a34a' : 'var(--muted)', fontWeight: statusFilter === 'paid' ? 600 : 400 }}>
            Оплачен
          </span>
          <span className="stock-filter-link"
            onClick={() => setStatusFilter('partially_paid')} style={{ cursor: 'pointer', fontSize: '.78rem', padding: '.25rem .35rem', borderRight: '1px solid var(--border)', color: statusFilter === 'partially_paid' ? '#ea580c' : 'var(--muted)', fontWeight: statusFilter === 'partially_paid' ? 600 : 400 }}>
            Частично
          </span>
          <span className="stock-filter-link"
            onClick={() => setStatusFilter('unpaid')} style={{ cursor: 'pointer', fontSize: '.78rem', padding: '.25rem .35rem', borderRight: 'none', color: statusFilter === 'unpaid' ? '#dc2626' : 'var(--muted)', fontWeight: statusFilter === 'unpaid' ? 600 : 400 }}>
            Долги
          </span>
        </div>
      </div>

      {/* Таблица чеков */}
      <div className="product-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', overflowY: 'visible' }}>
        <table>
          <thead id="colHeaders">
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 0 }}>№ чека</th>
              <th style={{ textAlign: 'center' }}>Дата</th>
              <th style={{ textAlign: 'center' }}>Сумма</th>
              <th style={{ textAlign: 'center' }}>Статус</th>
              <th style={{ textAlign: 'center' }}>Клиент</th>
              <th style={{ textAlign: 'center' }}>Кассир</th>
              <th style={{ textAlign: 'center' }}>Откуда</th>
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
                <td style={{ textAlign: 'center' }}>{formatDate(r.date)}</td>
                <td style={{ textAlign: 'center', fontSize: '.82rem' }}>{Number(r.total_amount).toLocaleString()} ₽</td>
                <td style={{ textAlign: 'center' }}>{STATUS_LABELS[r.status] || r.status}</td>
                <td style={{ textAlign: 'center' }}>{r.client_name || '—'}</td>
                <td style={{ textAlign: 'center' }}>{r.cashier_name || '—'}</td>
                <td style={{ textAlign: 'center' }}>
                  {r.source === 'quick_sale' ? 'Быстрая' : 'Касса'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модалка состава чека */}
      {selectedReceipt && (
        <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') { setSelectedReceipt(null); setReceiptItems([]); } }}>
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <button className="modal-close" onClick={() => { setSelectedReceipt(null); setReceiptItems([]); }}>&times;</button>
            <h2>Чек #{selectedReceipt.receipt_number}</h2>
            <div className="sub" style={{ marginBottom: '.5rem' }}>
              {formatDate(selectedReceipt.date)}
              {selectedReceipt.cashier_name ? ' · ' + selectedReceipt.cashier_name : ''}
              {selectedReceipt.client_name ? ' · ' + selectedReceipt.client_name : ''}
            </div>

            {/* Позиции */}
            {itemsLoading ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: '.82rem' }}>Загрузка...</div>
            ) : receiptItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: '.82rem' }}>Нет позиций</div>
            ) : (
              <div style={{ background: '#f9f9f9', borderRadius: '.5rem', padding: '.5rem 0', marginBottom: '.5rem' }}>
                <div style={{ display: 'flex', padding: '.35rem .75rem', fontSize: '.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.3px' }}>
                  <span style={{ flex: 1 }}>Товар</span>
                  <span style={{ width: '50px', textAlign: 'center' }}>Кол-во</span>
                  <span style={{ width: '70px', textAlign: 'right' }}>Цена</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>Сумма</span>
                </div>
                {receiptItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', padding: '.35rem .75rem', fontSize: '.82rem', borderTop: '1px solid #f0f0f0' }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>{item.product_name}</span>
                    <span style={{ width: '50px', textAlign: 'center', color: 'var(--muted)' }}>{Number(item.quantity).toLocaleString()}</span>
                    <span style={{ width: '70px', textAlign: 'right', color: 'var(--muted)' }}>{Number(item.price).toLocaleString()}</span>
                    <span style={{ width: '80px', textAlign: 'right', fontWeight: 600 }}>{Number(item.total).toLocaleString()} ₽</span>
                  </div>
                ))}
                <div style={{ display: 'flex', padding: '.5rem .75rem', borderTop: '1px solid #ddd', fontSize: '.82rem' }}>
                  <span style={{ flex: 1 }}>ИТОГО:</span>
                  <span style={{ width: '50px', textAlign: 'center' }}></span>
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

            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => { setSelectedReceipt(null); setReceiptItems([]); }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
