import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function CashRegisters() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1 style={ {fontSize:"1.2re",fontWeight:"600",margin:"0"} }>Касса</h1>
          <div className="sub">Приём платежей и управление продажами</div>
        </div>
      </div>
      <div className="nav-sep" style={ {margin:".25rem 0",width:"100%"} }></div>
      <div style={ {display:"flex",gap:"1.5re",padding:"2rem 0",flexWrap:"w",justifyContent:"cente"} }>
        <div onClick="openShiftNow()" style={ {flex:"1",minWidth:"280px",maxWidth:"400px",background:"var(--white)",border:"1px solid var(--border)",borderRadius:"12px",padding:"2re",textAlign:"cente",cursor:"pointe",transition:"all .15s",boxShadow:"var(--shadow)"} } onmouseover="this.style.borderColor='var(--primary)';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform=''">
          <div style={ {fontSize:"2.5re",marginBottom:".75re"} }>🔓</div>
          <div style={ {fontSize:"1.1re",fontWeight:"600",marginBottom:".25re"} }>Открыть кассу</div>
          <div style={ {fontSize:".85re",color:"var(--muted)"} }>Полноценный режим кассира со сменой, ПИН-кодом и печатью чека</div>
        </div>
        <div onClick="openQuickSale()" style={ {flex:"1",minWidth:"280px",maxWidth:"400px",background:"var(--white)",border:"1px solid var(--border)",borderRadius:"12px",padding:"2re",textAlign:"cente",cursor:"pointe",transition:"all .15s",boxShadow:"var(--shadow)"} } onmouseover="this.style.borderColor='#16a34a';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform=''">
          <div style={ {fontSize:"2.5re",marginBottom:".75re"} }>⚡</div>
          <div style={ {fontSize:"1.1re",fontWeight:"600",marginBottom:".25re"} }>Быстрая продажа</div>
          <div style={ {fontSize:".85re",color:"var(--muted)"} }>Быстро выбить чек без открытия смены — для админа и менеджеров</div>
        </div>
      </div>
    </>
  );
}
