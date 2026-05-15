export default function Suppliers() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Поставщики</h1>
          <div className="sub">Управляйте списком поставщиков</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={function(){openSupplierModal()}}>+ Добавить поставщика</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>
      <div className="product-table" style={{overflowX:"au",WebkitOverflowScrolling:"touch"}}>
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Контакт</th>
              <th>Телефон</th>
              <th>Способ связи</th>
              <th>Поставок</th>
              <th>Сумма</th>
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
