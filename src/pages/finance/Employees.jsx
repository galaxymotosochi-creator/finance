export default function Employees() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Сотрудники</h1>
          <div className="sub">Управляйте своим персоналом</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={function(){openEmployeeModal()}}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>
      <div className="emp-grid"></div>
      <div className="emp-calendar-wrap">
        <div className="emp-cal-header">
          <button className="emp-cal-nav" onClick={function(){switchEmpMonth(-1)}}>&lsaquo;</button>
          <div className="emp-cal-month">Май 2026</div>
          <button className="emp-cal-nav" onClick={function(){switchEmpMonth(1)}}>&rsaquo;</button>
        </div>
        <div className="emp-cal-grid"></div>
      </div>
      <div className="empty-products">
        <div className="big-icon">👥</div>
        <p>Сотрудников пока нет</p>
      </div>
    
    </>
  );
}
