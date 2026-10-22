import { useState, useEffect } from 'react';
import SectionHelp from '../../components/SectionHelp';
import IngredientForm from './IngredientForm';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';

export default function Ingredients() {
  const { user } = useAuth();
  const cur = getCurrencySymbol();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [stock, setStock] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    if (!user) return;
    const [i, st, w, ct] = await Promise.all([
      supabase.from('ingredients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('ingredient_stock').select('*'),
      supabase.from('warehouses').select('*').eq('user_id', user.id).order('name'),
      supabase.from('stock_categories').select('*').eq('user_id', user.id),
    ]);
    setRows(i.data || []); setStock(st.data || []); setWarehouses(w.data || []);
    setCats((ct.data || []).filter(function(c){ return c.type === 'ingredient'; }));
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

  const stockOf = (id) => stock.filter(s => String(s.ingredient_id) === String(id))
    .reduce((acc, s) => ({ qty: acc.qty + (Number(s.qty) || 0), sum: acc.sum + (Number(s.total_sum) || 0) }),
      { qty:0, sum:0 });
  const avgPrice = (id) => { const s = stockOf(id); return s.qty > 0 ? s.sum / s.qty : 0; };
  const fmtQty = (qty, unit) => {
    const n = Number(qty) || 0;
    if (!n) return '0 ' + (unit || '');
    const u = String(unit || '').toLowerCase();
    if (u === 'кг' || u === 'л') {
      // целое, если дробная часть не нужна
      const v = Number.isInteger(n) ? n : Number(n.toFixed(3));
      return v + ' ' + unit;
    }
    return Math.round(n) + ' ' + unit;
  };

  const openEdit = (r) => {
    setEditing(r);
    setFormOpen(true);
  };

  const remove = async (r) => {
    if (!confirm('Удалить ингредиент «' + r.name + '»?')) return;
    await supabase.from('ingredient_stock').delete().eq('ingredient_id', r.id);
    await supabase.from('ingredients').delete().eq('id', r.id);
    await load();
  };

  const save = async (f) => {
    const payload = {
      user_id: user.id, name: f.name, category: f.category || '', unit: f.unit || 'кг', barcode: f.barcode || '',
      loss_cleaning: Number(f.loss_cleaning) || 0, loss_boil: Number(f.loss_boil) || 0,
      loss_fry: Number(f.loss_fry) || 0, loss_stew: Number(f.loss_stew) || 0,
      loss_bake: Number(f.loss_bake) || 0, is_water: !!f.is_water, updated_at: new Date().toISOString(),
    };
    let ingId = editing?.id;
    if (editing?.id) {
      await supabase.from('ingredients').update(payload).eq('id', editing.id);
    } else {
      const ins = await supabase.from('ingredients').insert(payload).select('id').single();
      ingId = ins.data?.id;
    }
    const qty = Number(f.qty) || 0;
    const price = Number(f.price) || 0;
    const wid = f.warehouse_id || warehouses[0]?.id;
    if (ingId && qty > 0 && wid) {
      await supabase.from('ingredient_stock').insert({
        user_id: user.id, ingredient_id: ingId, warehouse_id: wid,
        qty, total_sum: qty * price,
      });
    }
    setFormOpen(false);
    setEditing(null);
    setLoading(true);
    await load();
  };

  const list = rows.filter(r => !q.trim() || String(r.name).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0, overflow:'hidden' }}>
      <div style={{ flexShrink:0 }}>
        <div className="sk-bar">
          <div className="grow">
            <div style={{ display:'flex', alignItems:'center' }}>
              <h1>Ингредиенты</h1>
              <SectionHelp
                title="Раздел «Ингредиенты»"
                intro="Сырьё и продукты, из которых готовятся блюда: мука, мясо, масло, специи. Ингредиенты списываются со склада по тех. картам."
                blocks={[
                  { title: 'Чем отличается от товаров', items: [
                    <>Ингредиенты <b>не продаются напрямую</b> — они входят в состав блюд.</>,
                    <>Учитываются в граммах, килограммах, миллилитрах и литрах, а не в штуках.</>,
                    <>Товары для продажи (напитки, снеки) ведутся в разделе «Склад → Товары».</>,
                  ]},
                  { title: 'Что будет в разделе', items: [
                    <>Название ингредиента и категория (мясо, овощи, бакалея).</>,
                    <>Единица измерения: г, кг, мл, л, шт.</>,
                    <>Цена закупки за единицу и остаток на складе.</>,
                    <>Процент отходов при холодной и горячей обработке — для расчёта брутто и нетто.</>,
                  ]},
                ]}
              />
            </div>
            <div className="sub">Сырьё для приготовления блюд</div>
          </div>
          <div className="page-actions">
            <button className="sk-dd-btn" onClick={() => { setEditing(null); setFormOpen(true); }}>Добавить ингредиент</button>
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
          <table className="sk-table stock-table" style={{ minWidth:'720px' }}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th>Ед.</th>
                <th>Остаток</th>
                <th>Цена закупки</th>
                <th>Отходы, %</th>
                <th style={{ width:'48px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding:28, textAlign:'center', color:'#9ca3af' }}>Загружаю…</td></tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={7}>
                    <div style={{ padding:'28px 24px', textAlign:'center', color:'var(--muted)' }}>
                      <p style={{ fontSize:'.85rem', fontWeight:600, color:'var(--body-color)', margin:'0 0 .5rem' }}>Ингредиентов пока нет</p>
                      <div style={{ maxWidth:'420px', margin:'0 auto', textAlign:'left', fontSize:'.8rem', color:'#555', lineHeight:1.6 }}>
                        <b>Как добавить ингредиент:</b><br />
                        • Нажмите «Добавить ингредиент»<br />
                        • Укажите название, единицу измерения и проценты потерь<br />
                        • В блоке «Складской учёт» внесите купленное количество и цену<br />
                        Себестоимость блюд посчитается по средневзвешенной цене.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : list.map(r => {
                const st = stockOf(r.id);
                const avg = avgPrice(r.id);
                const totalLoss = [r.loss_cleaning, r.loss_boil, r.loss_fry, r.loss_stew, r.loss_bake]
                  .map(Number).filter(n => n > 0);
                return (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.category || '—'}</td>
                    <td>{r.unit}</td>
                    <td>{fmtQty(st.qty, r.unit)}</td>
                    <td>{avg ? Math.round(avg).toLocaleString('ru-RU') + ' ' + cur : '—'}</td>
                    <td>{totalLoss.length ? totalLoss.join(' / ') + '%' : '—'}</td>
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

      <IngredientForm open={formOpen} warehouses={warehouses} categories={cats} initial={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSave={save} />
    </div>
  );
}
