export default function Promos() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Акции</h1>
          <div className="sub">Текущие и планируемые акции</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={function(){openPromoModal()}}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>
      <div className="promo-calendar-wrap">
        <div className="promo-cal-header">
          <button className="promo-cal-nav" onClick={function(){switchPromoMonth(-1)}}>&lsaquo;</button>
          <div className="promo-cal-month">Май 2026</div>
          <button className="promo-cal-nav" onClick={function(){switchPromoMonth(1)}}>&rsaquo;</button>
        </div>
        <div className="promo-cal-grid"></div>
        <div className="promo-cal-legend">
          <span><span className="promo-dot active"></span> Активна</span>
          <span><span className="promo-dot planned"></span> Планируется</span>
          <span><span className="promo-dot ended"></span> Завершена</span>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"cente",justifyContent:"space-betwee",margin:".5rem 0 .25re"}}>
        <div style={{fontSize:".7rem",color:"var(--muted)",textTransform:"uppercase",fontWeight:"600"}}>Все акции</div>
      </div>
      <div></div>
      <div className="empty-products">
        <div className="big-icon">🎉</div>
        <p>У вас пока нет акций</p>
      </div>
      <div className="promo-detail" style={{display:"none"}}></div>
    
    </>
  );
}
