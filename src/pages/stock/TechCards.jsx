import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));

export default function TechCards() {
  const { user } = useAuth();
  const cur = getCurrencySymbol();
  const [cards, setCards] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const c = await supabase.from('tech_cards').select('*').eq('user_id', user.id).order('name');
      const i = await supabase.from('tech_card_items').select('*').eq('user_id', user.id);
      setCards(c.data || []);
      setItems(i.data || []);
      setLoading(false);
    })();
  }, [user?.id]);

  const costOf = (cardId) => items
    .filter(i => String(i.tech_card_id) === String(cardId))
    .reduce((s, i) => s + (Number(i.netto) || 0) * (Number(i.price_per_unit) || 0), 0);

  const list = cards.filter(c => !q.trim() || String(c.name).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div style={{ padding:'0 0 40px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:16 }}>
        <div>
          <h1 style={{ margin:0, fontSize:'1.5rem', fontWeight:800, letterSpacing:'-.02em' }}>Тех. карты</h1>
          <div style={{ fontSize:'.82rem', color:'#9ca3af', marginTop:4 }}>
            Блюда с составом и себестоимостью
          </div>
        </div>
        <button className="sk-dd-btn">Добавить тех. карту</button>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по названию"
        style={{ width:'100%', maxWidth:360, padding:'10px 16px', border:'1px solid #e5e7eb',
          borderRadius:22, fontSize:'.88rem', outline:'none', marginBottom:16, boxSizing:'border-box' }} />

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Загружаю…</div>
      ) : !list.length ? (
        <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:14, padding:40,
          textAlign:'center', color:'#9ca3af', fontSize:'.88rem' }}>
          Тех. карт пока нет. Нажмите «Добавить тех. карту».
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:14, overflow:'hidden' }}>
          <table className="sk-table" style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'12px 16px', fontSize:'.74rem', color:'#6b7280', fontWeight:600 }}>Название</th>
                <th style={{ textAlign:'left', padding:'12px 16px', fontSize:'.74rem', color:'#6b7280', fontWeight:600 }}>Категория</th>
                <th style={{ textAlign:'right', padding:'12px 16px', fontSize:'.74rem', color:'#6b7280', fontWeight:600 }}>Выход</th>
                <th style={{ textAlign:'right', padding:'12px 16px', fontSize:'.74rem', color:'#6b7280', fontWeight:600 }}>Себестоимость</th>
                <th style={{ textAlign:'right', padding:'12px 16px', fontSize:'.74rem', color:'#6b7280', fontWeight:600 }}>Цена</th>
                <th style={{ textAlign:'right', padding:'12px 16px', fontSize:'.74rem', color:'#6b7280', fontWeight:600 }}>Наценка</th>
              </tr>
            </thead>
            <tbody>
              {list.map(c => {
                const cost = costOf(c.id);
                const price = Number(c.price) || 0;
                const markup = cost > 0 ? Math.round(((price - cost) / cost) * 100) : 0;
                return (
                  <tr key={c.id} style={{ borderTop:'1px solid #f5f5f5' }}>
                    <td style={{ padding:'12px 16px', fontSize:'.86rem', fontWeight:600 }}>{c.name}</td>
                    <td style={{ padding:'12px 16px', fontSize:'.82rem', color:'#6b7280' }}>{c.category || '—'}</td>
                    <td style={{ padding:'12px 16px', fontSize:'.82rem', textAlign:'right', color:'#6b7280' }}>
                      {Number(c.output_weight) ? Number(c.output_weight) + ' ' + (c.output_unit || 'г') : '—'}
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:'.82rem', textAlign:'right', color:'#6b7280' }}>{fmt(cost)} {cur}</td>
                    <td style={{ padding:'12px 16px', fontSize:'.86rem', textAlign:'right', fontWeight:700 }}>{fmt(price)} {cur}</td>
                    <td style={{ padding:'12px 16px', fontSize:'.82rem', textAlign:'right',
                      color: cost > 0 ? (markup >= 0 ? '#16a34a' : '#dc2626') : '#9ca3af', fontWeight:600 }}>
                      {cost > 0 ? markup + '%' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
