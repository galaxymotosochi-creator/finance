export default function Trash() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Корзина</h1>
          <div className="sub">Скрытые товары — восстановите или удалите навсегда</div>
        </div>
        <button className="btn btn-outline" onClick={function(){navigateTo('products')}} style={{fontSize:".8rem",gap:".3rem"}}>← Назад к товарам и услугам</button>
      </div>
      <div className="product-table" style={{overflowX:"au",WebkitOverflowScrolling:"touch"}}>
        <table>
          <thead><tr></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    
    </>
  );
}
