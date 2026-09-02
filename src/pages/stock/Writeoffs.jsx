import Modal from '../../components/Modal';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import useOptimisticSync from '../../hooks/useOptimisticSync';
import { fmtDate } from '../../lib/dates';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';


const REASONS = ['Списание','Брак','Потеря','Порча','Окончание срока','Инвентаризация','Прочее'];

export default function Writeoffs() {
  const cur = getCurrencySymbol();
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
    try {
      const [wRes, pRes] = await Promise.all([
        supabase.from('writeoffs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);
      if (wRes.error) throw wRes.error;
      if (wRes.data) setList(wRes.data);
      if (pRes.data) setProducts(pRes.data);
    } catch (e) {
      alert('Ошибка загрузки списаний: ' + (e.message || 'неизвестная ошибка'));
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  // Оптимистичная синхронизация: офлайн-записи появляются сразу (с красной точкой)
  useOptimisticSync({ table: 'writeoffs', setList: setList, onSynced: load });

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

  const getStockData = async (prodId) => {
    const [supRes, woRes, initRes] = await Promise.all([
      supabase.from('supplies').select('items').eq('user_id', user.id),
      supabase.from('writeoffs').select('quantity,product_id').eq('user_id', user.id),
      supabase.from('initial_stocks').select('*').eq('user_id', user.id).single()
    ]);
    let inQty = 0, inCost = 0;
    (supRes.data || []).forEach(s => (s.items || []).forEach(it => {
      if (it.prodId == prodId) { inQty += it.qty || 0; inCost += (it.cost || 0) * (it.qty || 0); }
    }));
    // Начальные остатки тоже учитываем (иначе товар только из них — «на складе 0»)
    const initial = initRes.data;
    if (initial && initial.done && initial.items && initial.items[prodId]) {
      const q = parseInt(initial.items[prodId]) || 0;
      const c = (initial.costs && parseInt(initial.costs[prodId])) || 0;
      inQty += q; inCost += c * q;
    }
    let outQty = 0;
    // quantity из БД приходит строкой (numeric) — без Number будет конкатенация («3»+«2»=«32»)
    (woRes.data || []).forEach(w => { if (w.product_id == prodId) outQty += Number(w.quantity) || 0; });
    return { stock: inQty - outQty, avgCost: inQty > 0 ? Math.round(inCost / inQty) : 0 };
  };

  const save = async (e) => {
    e.preventDefault();
    const prodId = parseInt(fProd);
    if (!prodId) return alert('Выберите товар');
    const qty = parseInt(fQty) || 1;
    if (qty <= 0) return alert('Введите количество');
    const prod = products.find(p => p.id === prodId);

    // Проверяем остаток (с учётом текущего списания при редактировании)
    const data = await getStockData(prodId);
    const curQty = editId ? (Number(list.find(x => x.id === editId)?.quantity) || 0) : 0;
    const stock = data.stock + curQty;
    if (stock < qty) {
      setToast('На складе ' + Math.max(0, data.stock) + ' шт. Не удастся списать больше, чем есть на складе!');
      return;
    }

    // Себестоимость — средняя из поставок/начальных остатков (раньше бралась розничная цена!)
    const cost = data.avgCost || 0;

    let queued = false;
    if (editId) {
      const res = await supabase.from('writeoffs').update({ product_id: prodId, quantity: qty, cost, reason: fReason, date: fDate }).eq('id', editId);
      if (res.error) return alert('Ошибка: ' + res.error.message);
      queued = res.queued;
    } else {
      const res = await supabase.from('writeoffs').insert({ id: Date.now(), user_id: user.id, product_id: prodId, quantity: qty, cost, reason: fReason, date: fDate });
      if (res.error) return alert('Ошибка: ' + res.error.message);
      queued = res.queued;
    }
    if (!queued) await load(); setShow(false);
  };

  const remove = async (id) => {
    if (!confirm('Удалить списание?')) return;
    const { error, queued } = await supabase.from('writeoffs').delete().eq('id', id);
    if (error) return alert('Ошибка удаления: ' + error.message);
    if (!queued) await load();
  };

  if (loading) return <CenterSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Списания</h1>
          <div className="sub">Учет брака, порчи и потерь товаров на складе</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-dark" onClick={openAdd} style={{padding:'.5rem .9rem',fontWeight:600}}>+ Добавить</button>
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
                <td style={{whiteSpace:'nowrap'}}><div className="prod-name">{w.name || products.find(p=>p.id===w.product_id)?.name || '—'}{w.pending && <span title="Ожидает синхронизации" style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,.6)',marginLeft:'6px',verticalAlign:'middle'}} />}</div></td>
                <td style={{whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}>{w.quantity}</td>
                <td style={{whiteSpace:'nowrap',color:'#222',fontSize:'.78rem'}}><span className="num">{(w.quantity * (w.cost||0)).toLocaleString()} {cur}</span></td>
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
            <button type="submit" className="btn btn-dark">{editId?'Сохранить':'Списать'}</button>
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
