import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import SectionHelp from '../../components/SectionHelp';
import TechCardForm from './TechCardForm';

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));

export default function TechCards() {
  const { user } = useAuth();
  const cur = getCurrencySymbol();
  const [cards, setCards] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

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

  const saveCard = async (f, items) => {
    const payload = {
      user_id: user.id,
      name: f.name,
      category: f.category || '',
      price: Number(f.price) || 0,
      output_weight: Number(f.output_weight) || 0,
      output_unit: f.output_unit || 'г',
      photo_url: f.photo_url || '',
      description: f.description || '',
      is_weight: !!f.is_weight,
      price_per_kg: Number(f.price_per_kg) || 0,
      updated_at: new Date().toISOString(),
    };
    let cardId = f.id;
    if (f.id) {
      await supabase.from('tech_cards').update(payload).eq('id', f.id);
    } else {
      const ins = await supabase.from('tech_cards').insert(payload).select('id').single();
      cardId = ins.data?.id;
    }
    if (cardId) {
      await supabase.from('tech_card_items').delete().eq('tech_card_id', cardId);
      const rows = (items || []).filter(r => r.product_id || r.name).map(r => ({
        user_id: user.id,
        tech_card_id: cardId,
        product_id: r.product_id ? String(r.product_id) : null,
        name: r.name || '',
        netto: Number(r.netto) || 0,
        waste_percent: Number(r.waste_percent) || 0,
        price_per_unit: Number(r.price_per_unit) || 0,
        unit: r.unit || 'г',
      }));
      if (rows.length) await supabase.from('tech_card_items').insert(rows);
    }
    setFormOpen(false); setEditing(null);
    const c = await supabase.from('tech_cards').select('*').eq('user_id', user.id).order('name');
    const i = await supabase.from('tech_card_items').select('*').eq('user_id', user.id);
    setCards(c.data || []);
    setItems(i.data || []);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      <div style={{ flexShrink:0 }}>
        <div className="sk-bar">
          <div className="grow">
            <div style={{ display:'flex', alignItems:'center' }}>
              <h1>Тех. карты</h1>
              <SectionHelp
                title="Раздел «Тех. карты»"
                intro="Технологические карты блюд: состав, граммовки и себестоимость. Тех. карта — это и есть блюдо: создали карту — оно продаётся в кассе."
                blocks={[
                  { title: 'Как создать блюдо', items: [
                    <>Нажмите «Добавить тех. карту» — откроется форма.</>,
                    <>Укажите <b>название</b>, <b>категорию</b>, <b>цену продажи</b> и <b>выход порции</b> (вес или объём).</>,
                    <>Добавьте <b>состав</b>: ингредиенты и количество нетто в граммах.</>,
                  ]},
                  { title: 'Себестоимость и наценка', items: [
                    <><b>Себестоимость</b> считается сама: сумма (нетто × цена за грамм) по всем ингредиентам.</>,
                    <><b>Цена продажи</b> задаётся вручную — это то, за сколько продаёте.</>,
                    <><b>Наценка</b> считается сама: разница между ценой и себестоимостью в процентах.</>,
                  ]},
                  { title: 'Столбцы таблицы', items: [
                    <><b>Название</b> — название блюда.</>,
                    <><b>Категория</b> — группа меню: супы, салаты, напитки.</>,
                    <><b>Выход</b> — вес или объём одной порции.</>,
                    <><b>Себестоимость</b> — во сколько обходится порция.</>,
                    <><b>Цена</b> — цена продажи.</>,
                    <><b>Наценка</b> — прибыль в процентах от себестоимости.</>,
                  ]},
                ]}
              />
            </div>
            <div className="sub">Блюда с составом и себестоимостью</div>
          </div>
          <div className="page-actions">
            <button className="sk-dd-btn" onClick={() => { setEditing(null); setFormOpen(true); }}>Добавить тех. карту</button>
          </div>
        </div>
        <div className="sk-search" style={{ display:'flex', marginBottom:'.5rem', width:'100%', flexWrap:'nowrap' }}>
          <span style={{ display:'flex', color:'#999', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input type="text" placeholder="Поиск…" value={q} onChange={e => setQ(e.target.value)} autoComplete="off"
            style={{ border:'none', outline:'none', flex:'1 1 60px', minWidth:0, width:'100%', fontSize:'.78rem', fontFamily:'var(--font)', background:'none', padding:0 }} />
        </div>
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Загружаю…</div>
      ) : !list.length ? (
        <div className="empty-products">
          <div className="big-icon">📋</div>
          <p>Тех. карт пока нет</p>
          <div style={{ maxWidth:'420px', margin:'0 auto', fontSize:'.8rem', color:'#555', lineHeight:1.6, marginTop:'.5rem' }}>
            Нажмите «Добавить тех. карту» — укажите название, цену продажи и состав.
            Себестоимость и наценка посчитаются сами.
          </div>
        </div>
      ) : (
        <div className="stock-table-wrap" style={{ flex:1, minHeight:0 }}>
        <div className="sk-card" style={{ position:'relative', flex:1, overflowY:'auto', overflowX:'auto', minHeight:0 }}>
          <table className="sk-table stock-table" style={{ minWidth:'760px' }}>
            <thead>
              <tr>
                <th style={{ minWidth:'200px', textAlign:'left' }}>Название</th>
                <th style={{ textAlign:'left' }}>Категория</th>
                <th style={{ textAlign:'left' }}>Выход</th>
                <th style={{ textAlign:'left' }}>Себестоимость</th>
                <th style={{ textAlign:'left' }}>Цена</th>
                <th style={{ textAlign:'left' }}>Наценка</th>
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
        </div>
      )}

      <TechCardForm open={formOpen} initial={editing}
        categories={Array.from(new Set(cards.map(c => c.category).filter(Boolean)))}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={saveCard} />
    </div>
  );
}
