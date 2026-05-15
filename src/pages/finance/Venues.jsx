export default function Venues() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1>Заведения</h1>
          <div className="sub">Точки вашего бизнеса</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={function(){openVenueModal()}}>+ Добавить заведение</button>
        </div>
      </div>
      <div className="product-table">
        <table><thead><tr><th style={{width:"30%"}}>Название</th><th style={{width:"35%"}}>Адрес</th><th style={{width:"20%"}}>Телефон</th><th style={{width:"15%"}}></th></tr></thead><tbody></tbody></table>
      </div>
    
    </>
  );
}
