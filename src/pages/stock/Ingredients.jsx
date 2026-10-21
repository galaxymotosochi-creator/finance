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
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const [i, st, w] = await Promise.all([
      supabase.from('ingredients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('ingredient_stock').select('*').eq('user_id', user.id),
      supabase.from('warehouses').select('*').eq('user_id', user.id).order('name'),
    ]);
    setRows(i.data || []); setStock(st.data || []); setWarehouses(w.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const stockOf = (id) => stock.filter(s => String(s.ingredient_id) === String(id))
    .reduce((acc, s) => ({ qty: acc.qty + (Number(s.qty) || 0), sum: acc.sum + (Number(s.total_sum) || 0) }),
      { qty:0, sum:0 });
  const avgPrice = (id) => { const s = stockOf(id); return s.qty > 0 ? s.sum / s.qty : 0; };

  const save = async (f) => {
    const payload = {
      user_id: user.id, name: f.name, unit: f.unit || 'кг', barcode: f.barcode || '',
      loss_cleaning: Number(f.loss_cleaning) || 0, loss_boil: Number(f.loss_boil) || 0,
      loss_fry: Number(f.loss_fry) || 0, loss_stew: Number(f.loss_stew) || 0,
      loss_bake: Number(f.loss_bake) || 0, updated_at: new Date().toISOString(),
    };
    const ins = await supabase.from('ingredients').insert(payload).select('id').single();
    const ingId = ins.data?.id;
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
    load();
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
            <button className="sk-dd-btn" onClick={() => setFormOpen(true)}>Добавить ингредиент</button>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding:28, textAlign:'center', color:'#9ca3af' }}>Загружаю…</td></tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={6}>
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
                    <td style={{ fontWeight:600 }}>{r.name}</td>
                    <td style={{ color:'#6b7280' }}>{r.category || '—'}</td>
                    <td>{r.unit}</td>
                    <td>{st.qty ? Number(st.qty).toFixed(2) : '0'}</td>
                    <td>{avg ? Math.round(avg).toLocaleString('ru-RU') + ' ' + cur : '—'}</td>
                    <td style={{ color:'#6b7280' }}>{totalLoss.length ? totalLoss.join(' / ') + '%' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <IngredientForm open={formOpen} warehouses={warehouses}
        onClose={() => setFormOpen(false)} onSave={save} />
    </div>
  );
}
