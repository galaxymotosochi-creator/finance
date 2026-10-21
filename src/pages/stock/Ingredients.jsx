import { useState } from 'react';
import SectionHelp from '../../components/SectionHelp';

export default function Ingredients() {
  const [q, setQ] = useState('');

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
            <button className="sk-dd-btn">Добавить ингредиент</button>
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
              <tr>
                <td colSpan={6}>
                  <div style={{ padding:'28px 24px', textAlign:'center', color:'var(--muted)' }}>
                    <p style={{ fontSize:'.85rem', fontWeight:600, color:'var(--body-color)', margin:'0 0 .5rem' }}>Ингредиентов пока нет</p>
                    <div style={{ maxWidth:'420px', margin:'0 auto', textAlign:'left', fontSize:'.8rem', color:'#555', lineHeight:1.6 }}>
                      Раздел подготовлен под ингредиенты: единицы измерения (г, кг, мл, л), цена закупки
                      и процент отходов для расчёта брутто и нетто.<br /><br />
                      Логику добавления и состав полей обсудим отдельно.
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
