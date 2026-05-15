export default function Stock() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Остатки</h1>
          <div className="sub">Управление складом</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={function(){openStockEntryModal()}}>+ Ввести остатки</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>
      <div className="stock-filterbar">
        <div className="stock-search">
          <span style={{fontSize:".75rem",color:"var(--muted)"}}>🔍</span>
          <input type="text" placeholder="Быстрый поиск" onChange={function(){renderStockPage()}} />
        </div>
        <div className="stock-filter-links">
          <span className="stock-filter-link">Поставщик</span>
          <span className="stock-filter-link">Счет</span>
          <span className="stock-filter-link">Категории</span>
          <span className="stock-filter-link stock-filter-add">+ Фильтр</span>
        </div>
      </div>
      <div className="product-table" style={{overflowX:"au",WebkitOverflowScrolling:"touch"}}>
        <table>
          <thead>
            <tr>
              <th data-col="name">Товар</th>
              <th data-col="sku">Артикул</th>
              <th data-col="barcode">Штрихкод</th>
              <th data-col="category">Категория</th>
              <th data-col="remain">Остаток</th>
              <th data-col="cost">Закуп</th>
              <th data-col="price">Продажа</th>
              <th data-col="margin">Наценка</th>
              <th data-col="total">Сумма</th>
              <th style={{width:"140px",textAlign:"righ"}}></th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      </div>
    
    </>
  );
}
