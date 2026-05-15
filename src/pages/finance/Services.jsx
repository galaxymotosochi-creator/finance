export default function Services() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1>Услуги</h1>
          <div className="sub">Управляйте услугами — добавляйте цены и описания</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={function(){openServiceModal()}}>+ Добавить услугу</button>
        </div>
      </div>
      <div className="search-bar">
        <input type="text" placeholder="Поиск по названию..." onChange={function(){renderServicesPage()}} />
      </div>
      <div className="filter-tabs">
        <span className="filter-tab active" data-filter="all" onClick={function(){setServiceFilter('all')}}>Все</span>
        <span className="filter-tab" data-filter="repair" onClick={function(){setServiceFilter('repair')}}>Ремонт</span>
        <span className="filter-tab" data-filter="cleaning" onClick={function(){setServiceFilter('cleaning')}}>Клининг</span>
        <span className="filter-tab" data-filter="delivery" onClick={function(){setServiceFilter('delivery')}}>Доставка</span>
        <span className="filter-tab" data-filter="consult" onClick={function(){setServiceFilter('consult')}}>Консультация</span>
        <span className="filter-tab" data-filter="install" onClick={function(){setServiceFilter('install')}}>Монтаж</span>
        <span className="filter-tab" data-filter="other" onClick={function(){setServiceFilter('other')}}>Прочее</span>
      </div>
      <div className="product-table">
        <table>
          <thead>
            <tr>
              <th style={{width:"35%"}}>Название</th>
              <th style={{width:"15%"}}>Категория</th>
              <th style={{width:"15%"}}>Цена</th>
              <th style={{width:"12%"}}>Длит.</th>
              <th style={{width:"23%"}}></th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      </div>
    
    </>
  );
}
