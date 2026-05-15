export default function StockCategories() {
  return (
    <>

      
      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Категории товаров и услуг</h1>
          <div className="sub">Управляйте категориями</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={function(){openCatModal()}}>+ Добавить категорию</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>

      <div className="product-table" style={{overflowX:"au",WebkitOverflowScrolling:"touch"}}>
        <table style={{minWidth:"500px"}}>
          <thead>
            <tr>
              <th>Название</th>
              <th>Вид категории</th>
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
