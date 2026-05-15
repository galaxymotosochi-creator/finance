export default function Supplies() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Поставки</h1>
          <div className="sub">Оприходование товаров на склад</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={function(){supTempItems=[];openSupplyModal()}}>+ Новая поставка</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>
      <div className="product-table" style={{overflowX:"au",WebkitOverflowScrolling:"touch"}}>
        <table>
          <thead>
            <tr>
              <th>№ накладной</th>
              <th>Поставщик</th>
              <th>Сумма</th>
              <th>Поставка</th>
              <th>Оплата</th>
              <th>Дата</th>
              <th style={{width:"130px"}}></th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      </div>
    
    </>
  );
}
