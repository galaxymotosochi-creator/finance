export default function CashRegisters() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Касса</h1>
          <div className="sub">Приём платежей и управление продажами</div>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>
      <div style={{display:"flex",gap:"1.5rem",padding:"2rem 0",flexWrap:"w",justifyContent:"cente"}}>
        <div onClick={function(){openShiftNow()}} style={{flex:"1",minWidth:"280px",maxWidth:"400px",background:"var(--white)",border:"1px solid var(--border)",borderRadius:"12px",padding:"2rem",textAlign:"cente",cursor:"pointe",transition:"all .15s",boxShadow:"var(--shadow)"}} onmouseover="this.style.borderColor='var(--primary)';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform=''">
          <div style={{fontSize:"2.5rem",marginBottom:".75rem"}}>🔓</div>
          <div style={{fontSize:"1.1rem",fontWeight:"600",marginBottom:".25rem"}}>Открыть кассу</div>
          <div style={{fontSize:".85rem",color:"var(--muted)"}}>Полноценный режим кассира со сменой, ПИН-кодом и печатью чека</div>
        </div>
        <div onClick={function(){openQuickSale()}} style={{flex:"1",minWidth:"280px",maxWidth:"400px",background:"var(--white)",border:"1px solid var(--border)",borderRadius:"12px",padding:"2rem",textAlign:"cente",cursor:"pointe",transition:"all .15s",boxShadow:"var(--shadow)"}} onmouseover="this.style.borderColor='#16a34a';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform=''">
          <div style={{fontSize:"2.5rem",marginBottom:".75rem"}}>⚡</div>
          <div style={{fontSize:"1.1rem",fontWeight:"600",marginBottom:".25rem"}}>Быстрая продажа</div>
          <div style={{fontSize:".85rem",color:"var(--muted)"}}>Быстро выбить чек без открытия смены — для админа и менеджеров</div>
        </div>
      </div>
    
    </>
  );
}
