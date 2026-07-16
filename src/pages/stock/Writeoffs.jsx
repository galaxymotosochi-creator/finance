import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { fmtDate } from '../../lib/dates';

const REASONS = ['Списание','Брак','Потеря','Порча','Окончание срока','Инвентаризация','Прочее'];

export default function Writeoffs() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fProd, setFProd] = useState('');
  const [fQty, setFQty] = useState('1');
  const [fReason, setFReason] = useState('Списание');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const load = async () => {
    setLoading(true);
    const [wRes, pRes] = await Promise.all([
      supabase.from('writeoffs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);
    if (wRes.data) setList(wRes.data);
    if (pRes.data) setProducts(pRes.data);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  useEffect(() => {
    if (!user || list.length > 0) return;
    const old = JSON.parse(localStorage.getItem('writeoffs88') || '[]');
    if (old.length > 0) {
      old.forEach(async (w) => {
        await supabase.from('writeoffs').insert({ id: w.id, user_id: user.id, product_id: w.prodId || 0, quantity: w.qty || 1, reason: w.reason || 'Списание', date: w.date || new Date().toISOString().split('T')[0] });
      });
      localStorage.removeItem('writeoffs88');
      load();
    }
  }, [user, list.length]);

  const openAdd = () => {
    setEditId(null); setFProd(''); setFQty('1'); setFReason('Списание');
    setFDate(new Date().toISOString().split('T')[0]); setShow(true);
  };

  const getStock = async (prodId) => {
    const { data: supplies } = await supabase.from('supplies').select('items').eq('user_id', user.id);
    const { data: writeoffs } = await supabase.from('writeoffs').select('quantity,product_id').eq('user_id', user.id);
    let inQty = 0; (supplies||[]).forEach(s => (s.items||[]).forEach(it => { if (it.prodId == prodId) inQty += it.qty||0; }));
    let outQty = 0; (writeoffs||[]).forEach(w => { if (w.product_id == prodId) outQty += w.quantity||0; });
    return inQty - outQty;
  };

  const save = async (e) => {
    e.preventDefault();
    const prodId = parseInt(fProd);
    if (!prodId) return alert('Выберите товар');
    const qty = parseInt(fQty) || 1;
    if (qty <= 0) return alert('Введите количество');
    const prod = products.find(p => p.id === prodId);
    const cost = prod ? (prod.price || 0) : 0;

    // Проверяем остаток
    const stock = await getStock(prodId);
    if (stock < qty) {
      setToast('На складе ' + stock + ' шт. Не удастся списать больше, чем есть на складе!');
      return;
    }

    if (editId) {
      await supabase.from('writeoffs').update({ product_id: prodId, quantity: qty, cost, reason: fReason, date: fDate }).eq('id', editId);
    } else {
      await supabase.from('writeoffs').insert({ id: Date.now(), user_id: user.id, product_id: prodId, quantity: qty, cost, reason: fReason, date: fDate });
    }
    await load(); setShow(false);
  };

  const remove = async (id) => {
    if (!confirm('Удалить списание?')) return;
    await supabase.from('writeoffs').delete().eq('id', id); await load();
  };

  if (loading) return <div className="empty-products"><div className="big-icon">⏳</div><p>Загрузка...</p></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Списания</h1>
          <div className="sub">Учет брака, порчи и потерь товаров на складе</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={openAdd}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:'.25rem 0',width:'100%'}} />

      <div className="product-table" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table className="data-table">
          <thead id="woColHeaders">
            <tr>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Товар</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Кол-во</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Сумма</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Причина</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left'}}>Дата</th>
              <th style={{color:'#222',fontWeight:400,fontSize:'.78rem',textAlign:'left',width:'130px'}}></th>
            </tr>
          </thead>
          <tbody id="writeoffTableBody">
            {list.length === 0 ? (
              <tr><td colSpan="6"><div className="empty-products"><div className="big-icon">📝</div><p>Список списаний пуст</p>
                    <p style={{color:'#555',margin:'.5rem 0 0'}}>Зафиксируйте первый факт брака, порчи или потери товаров</p></div></td></tr>
            ) : list.map(w => (
              <tr key={w.id}>
                <td style={{whiteSpace:'nowrap'}}><div className="prod-name">{w.name || products.find(p=>p.id===w.product_id)?.name || '—'}</div></td>
                <td style={{whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}>{w.quantity}</td>
                <td style={{whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}><span className="num">{(w.quantity * (w.cost||0)).toLocaleString()} ₽</span></td>
                <td style={{whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}><span className="prod-cat">{w.reason||'—'}</span></td>
                <td style={{color:'#222',fontSize:'.78rem'}}>{fmtDate(w.date)}</td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <div style={{display:'inline-block',position:'relative'}} className="prod-more-wrap">
                    <button className="act-btn prod-more-btn" onClick={(e) => {
                      e.stopPropagation();
                      const dd = e.currentTarget.nextElementSibling;
                      document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                      dd.classList.toggle('open');
                    }}>⋯</button>
                    <div className="prod-dropdown">
                      <button onClick={() => {
                        setEditId(w.id); setFProd(String(w.product_id)); setFQty(String(w.quantity));
                        setFReason(w.reason||'Списание'); setFDate(w.date||new Date().toISOString().split('T')[0]);
                        setShow(true);
                      }}>Редактировать</button>
                      <button onClick={() => remove(w.id)} style={{color:'#dc3545'}}>Удалить</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модалка */}
      <Modal open={show} onClose={()=>setShow(false)} title={editId?'Редактировать списание':'Списать товар'} subtitle="Оформление брака, порчи или утери" width="medium">
        <form onSubmit={save}>
          <div className="form-group">
            <label>Товар</label>
            <select value={fProd} onChange={e=>setFProd(e.target.value)} required>
              <option value="">— выберите товар —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Количество</label>
              <input type="number" value={fQty} onChange={e=>setFQty(e.target.value)} min="1" required />
            </div>
            <div className="form-group">
              <label>Дата</label>
              <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Причина</label>
            <select value={fReason} onChange={e=>setFReason(e.target.value)}>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">{editId?'Сохранить':'Списать'}</button>
          </div>
        </form>
      </Modal>
    {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'.75rem',padding:'.65rem 1.2rem',fontSize:'.85rem',color:'#333',boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)',zIndex:9999}}>
          {toast}
        </div>
      )}
    </>
  );
}
