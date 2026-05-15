export default function Warehouses() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1>Склады</h1>
          <div className="sub">Управляйте точками хранения</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={function(){openWarehouseModal()}}>+ Добавить склад</button>
        </div>
      </div>
      <div className="product-table">
        <table><thead><tr><th style={{width:"35%"}}>Название</th><th style={{width:"40%"}}>Адрес</th><th style={{width:"25%"}}></th></tr></thead><tbody></tbody></table>
      </div>
    
    </>
  );
}
