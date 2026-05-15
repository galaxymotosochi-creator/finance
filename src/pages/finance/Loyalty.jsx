import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Loyalty() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1 style={ {fontSize:"1.2re",fontWeight:"600",margin:"0"} }>Программы лояльности</h1>
          <div className="sub">Системы скидок и поощрений для клиентов</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick="openLoyaltyModal()">+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={ {margin:".25rem 0",width:"100%"} }></div>
      <div className="loy-carousel-wrap">
        <button className="loy-arrow loy-arrow-left" onClick="scrollLoyalty(-1)">&lsaquo;</button>
        <div className="loy-carousel"></div>
        <button className="loy-arrow loy-arrow-right" onClick="scrollLoyalty(1)">&rsaquo;</button>
      </div>
      <div className="loy-dots"></div>
      <div className="loy-detail">
        <div className="empty-products" style={ {display:"block"} }>
          <div className="big-icon">&#11088;</div>
          <p>Выберите программу лояльности</p>
        </div>
        <div style={ {display:"none"} }></div>
      </div>
    </>
  );
}
