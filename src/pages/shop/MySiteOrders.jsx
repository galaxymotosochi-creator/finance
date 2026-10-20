const ST = {
  new:        { t:'Новая',        c:'#1F75FF', bg:'rgba(31,117,255,.10)' },
  confirmed:  { t:'Принята',      c:'#0d9a5a', bg:'rgba(13,154,90,.10)' },
  done:       { t:'Выполнена',    c:'#6b7280', bg:'rgba(107,114,128,.12)' },
  canceled:   { t:'Отменена',     c:'#dc2626', bg:'rgba(220,38,38,.10)' },
};

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));

export default function MySiteOrders({ orders, loading, onChangeStatus, onMakeReceipt }) {
  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Загружаю…</div>;
  if (!orders.length) return (
    <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:16, padding:40, textAlign:'center', color:'#9ca3af' }}>
      Заявок пока нет. Как только покупатель оформит заказ на витрине — он появится здесь.
    </div>
  );

  return (
    <div style={{ display:'grid', gap:10 }}>
      {orders.map(o => {
        const st = ST[o.status] || ST.new;
        return (
          <div key={o.id} style={{ background:'#fff', border:'1px solid #eee', borderRadius:14, padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:'0.92rem' }}>№{o.order_number}</span>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, color:st.c, background:st.bg,
                    padding:'2px 8px', borderRadius:20 }}>{st.t}</span>
                </div>
                <div style={{ fontSize:'0.86rem', color:'#111', fontWeight:600 }}>{o.customer_name}</div>
                <div style={{ fontSize:'0.82rem', color:'#6b7280' }}>{o.customer_phone}</div>
                {o.comment && <div style={{ fontSize:'0.8rem', color:'#9ca3af', marginTop:4 }}>{o.comment}</div>}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'1.05rem', fontWeight:800 }}>{fmt(o.total)} ₽</div>
                <div style={{ fontSize:'0.72rem', color:'#9ca3af' }}>{new Date(o.created_at).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
              {o.status === 'new' && (
                <button className="btn btn-dark" style={{ fontSize:'0.76rem' }} onClick={() => onChangeStatus(o, 'confirmed')}>Принять</button>
              )}
              {o.status === 'confirmed' && (
                <button className="btn btn-dark" style={{ fontSize:'0.76rem' }} onClick={() => onMakeReceipt(o)}>Пробить чек</button>
              )}
              {(o.status === 'new' || o.status === 'confirmed') && (
                <button className="btn btn-outline" style={{ fontSize:'0.76rem' }} onClick={() => onChangeStatus(o, 'canceled')}>Отменить</button>
              )}
              {o.status === 'done' && <span style={{ fontSize:'0.76rem', color:'#0d9a5a', fontWeight:600, alignSelf:'center' }}>Чек пробит ✓</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
