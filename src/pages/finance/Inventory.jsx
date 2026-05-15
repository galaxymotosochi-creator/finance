export default function Inventory() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Инвентаризация</h1>
          <div className="sub">Сверка фактических остатков с учётными</div>
        </div>
        <div>
          <button className="btn-green" onClick={function(){startInventory()}}>+ Новая инвентаризация</button>
          <button className="btn btn-outline" onClick={function(){cancelInventoryEdit()}} style={{display:"none",fontSize:".8rem"}}>← Назад</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>
      <div className="product-table" style={{overflowX:"au",WebkitOverflowScrolling:"touch"}}>
        <table>
          <thead>
            <tr>
              <th>Товар</th>
              <th>Учтено</th>
              <th>Факт</th>
              <th>Разница</th>
              <th style={{width:"130px"}}></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    
    </>
  );
}
