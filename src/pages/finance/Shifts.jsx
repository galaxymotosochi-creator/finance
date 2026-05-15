import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Shifts() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1 style={ {fontSize:"1.2re",fontWeight:"600",margin:"0"} }>Кассовые смены</h1>
          <div className="sub">История работы кассиров и продаж</div>
        </div>
      </div>
      <div className="nav-sep" style={ {margin:".25rem 0",width:"100%"} }></div>
      <div className="search-row">
        <div className="stock-filter-links">
          <span className="stock-filter-link" onClick="toggleShiftEmpFilter()">Сотрудник</span>
          <span className="stock-filter-link" onClick="toggleShiftDateFilter()">Дата</span>
        </div>
      </div>
      <div className="shift-metrics">
        <div className="shift-metric"><div className="sm-lbl">Открыто</div><div className="sm-val"></div></div>
        <div className="shift-metric"><div className="sm-lbl">Закрыто</div><div className="sm-val">0</div></div>
        <div className="shift-metric"><div className="sm-lbl">Выручка</div><div className="sm-val">0₽</div></div>
        <div className="shift-metric"><div className="sm-lbl">Сред. чек</div><div className="sm-val">0₽</div></div>
      </div>
      <div className="shift-carousel-wrap">
        <div className="shift-carousel"></div>
      </div>

      <div className="empty-products">
        <div className="big-icon">📊</div>
        <p>Смен пока нет. Откройте кассу!</p>
      </div>
    </>
  );
}
