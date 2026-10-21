import { useState, useEffect } from 'react';
import SectionHelp from '../../components/SectionHelp';
import SemifinishedForm from './SemifinishedForm';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';

export default function Semifinished() {
  const { user } = useAuth();
  const cur = getCurrencySymbol();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    if (!user) return;
    const [sf, it] = await Promise.all([
      supabase.from('semifinished').select('*').eq('user_id', user.id).order('name'),
      supabase.from('semifinished_items').select('*').eq('user_id', user.id),
    ]);
    setRows(sf.data || []);
    setItems(it.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest('.prod-more-wrap') && !e.target.closest('.prod-dropdown')) {
        document.querySelectorAll('.prod-dropdown.open').forEach(d => {
          d.classList.remove('open'); d.classList.remove('up'); d.style.cssText = '';
        });
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const costOf = (id) => items.filter(i => String(i.semifinished_id) === String(id))
    .reduce((s, i) => s + (Number(i.netto) || 0) * (Number(i.price_per_unit) || 0), 0);

  const openEdit = (r) => { setEditing(r); setFormOpen(true); };

  const remove = async (r) => {
    if (!confirm('Удалить полуфабрикат «' + r.name + '»?')) return;
    await supabase.from('semifinished_items').delete().eq('semifinished_id', r.id);
    await supabase.from('semifinished').delete().eq('id', r.id);
    await load();
  };

  const save = async (f, comp) => {
    const payload = {
      user_id: user.id,
      name: f.name,
      recipe: f.recipe || '',
      output_weight: Number(f.output_weight) || 0,
      output_unit: f.output_unit || 'г',
      price_per_unit: 0,
      updated_at: new Date().toISOString(),
    };
    let sfId = editing?.id;
    if (editing?.id) await supabase.from('semifinished').update(payload).eq('id', editing.id);
    else {
      const ins = await supabase.from('semifinished').insert(payload).select('id').single();
      sfId = ins.data?.id;
    }
    if (sfId) {
      await supabase.from('semifinished_items').delete().eq('semifinished_id', sfId);
      const compRows = (comp || []).filter(c => c.name && Number(c.netto) > 0).map(c => ({
        user_id: user.id, semifinished_id: sfId, product_id: c.product_id || null,
        name: c.name || '', netto: Number(c.netto) || 0,
        waste_percent: Number(c.waste_percent) || 0,
        price_per_unit: Number(c.price_per_unit) || 0,
        unit: c.unit || 'г',
      }));
      if (compRows.length) await supabase.from('semifinished_items').insert(compRows);
      // цена за грамм готового полуфабриката
      const total = compRows.reduce((s, c) => s + c.netto * c.price_per_unit, 0);
      if (total > 0 && payload.output_weight > 0) {
        await supabase.from('semifinished').update({ price_per_unit: total / payload.output_weight }).eq('id', sfId);
      }
    }
    setFormOpen(false); setEditing(null); setLoading(true); await load();
  };

  const list = rows.filter(r => !q.trim() || String(r.name).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0, overflow:'hidden' }}>
      <div style={{ flexShrink:0 }}>
        <div className="sk-bar">
          <div className="grow">
            <div style={{ display:'flex', alignItems:'center' }}>
              <h1>Полуфабрикаты</h1>
              <SectionHelp
                title="Раздел «Полуфабрикаты»"
                intro="Полуфабрикаты — это заготовки для блюд. Они состоят из ингредиентов. Добавьте полуфабрикаты, чтобы быстрее создавать тех. карты."
                blocks={[
                  { title: 'Зачем нужны', items: [
                    <>Например, муку, яйца и дрожжи объедините в полуфабрикат <b>«Тесто»</b> и добавляйте его в тех. карты булочек или круассанов.</>,
                    <>Не нужно расписывать состав теста в каждой тех. карте — достаточно выбрать готовый полуфабрикат.</>,
                  ]},
                  { title: 'Как создать', items: [
                    <>Нажмите <b>«Добавить полуфабрикат»</b>.</>,
                    <>Укажите название и опишите рецепт приготовления.</>,
                    <>Добавьте ингредиенты с граммовками — как в тех. карте.</>,
                    <>Себестоимость и выход посчитаются сами.</>,
                  ]},
                ]}
              />
            </div>
            <div className="sub">Заготовки из ингредиентов для тех. карт</div>
          </div>
          <div className="page-actions">
            <button className="sk-dd-btn" onClick={() => { setEditing(null); setFormOpen(true); }}>Добавить полуфабрикат</button>
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

      <div className="stock-table-wrap" style={{ flex:1, minHeight:0 }}>
        <div className="sk-card" style={{ position:'relative', flex:1, overflowY:'auto', overflowX:'auto', WebkitOverflowScrolling:'touch', minHeight:0 }}>
          <table className="sk-table stock-table" style={{ minWidth:'680px' }}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Выход</th>
                <th>Себестоимость</th>
                <th>Ингредиентов</th>
                <th style={{ width:'48px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding:28, textAlign:'center', color:'#9ca3af' }}>Загружаю…</td></tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={5}>
                    <div style={{ padding:'28px 24px', textAlign:'center', color:'var(--muted)' }}>
                      <p style={{ fontSize:'.85rem', fontWeight:600, color:'var(--body-color)', margin:'0 0 .5rem' }}>Полуфабрикатов пока нет</p>
                      <div style={{ maxWidth:'460px', margin:'0 auto', textAlign:'left', fontSize:'.8rem', color:'#555', lineHeight:1.6 }}>
                        <b>Как добавить полуфабрикат:</b><br />
                        • Нажмите «Добавить полуфабрикат»<br />
                        • Укажите название и рецепт приготовления<br />
                        • Добавьте ингредиенты с граммовками<br />
                        • Полуфабрикат появится в тех. картах как готовый компонент
                      </div>
                    </div>
                  </td>
                </tr>
              ) : list.map(r => {
                const cnt = items.filter(i => String(i.semifinished_id) === String(r.id)).length;
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight:600 }}>{r.name}</td>
                    <td>{Number(r.output_weight) ? Number(r.output_weight) + ' ' + (r.output_unit || 'г') : '—'}</td>
                    <td>{Math.round(costOf(r.id)).toLocaleString('ru-RU') + ' ' + cur}</td>
                    <td style={{ color:'#6b7280' }}>{cnt}</td>
                    <td>
                      <div style={{ display:'inline-block', position:'relative' }} className="prod-more-wrap">
                        <button className="sk-more" onClick={(e) => {
                          e.stopPropagation();
                          const dd = e.currentTarget.nextElementSibling;
                          document.querySelectorAll('.prod-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                          dd.classList.toggle('open');
                          var _r = dd.getBoundingClientRect();
                          if (_r.bottom > window.innerHeight) dd.classList.add('up'); else dd.classList.remove('up');
                        }}>⋯</button>
                        <div className="prod-dropdown">
                          <button onClick={() => openEdit(r)}>Редактировать</button>
                          <button onClick={() => remove(r)} style={{ color:'#dc3545' }}>Удалить</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SemifinishedForm open={formOpen} initial={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSave={save} />
    </div>
  );
}
