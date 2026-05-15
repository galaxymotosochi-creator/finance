import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Positions() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1>Должности</h1>
          <div className="sub">Настройте роли и права доступа</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick="openPositionModal()">+ Добавить должность</button>
        </div>
      </div>
      <div className="product-table">
        <table><thead><tr><th style={ {width:"35%"} }>Название</th><th style={ {width:"40%"} }>Права доступа</th><th style={ {width:"25%"} }></th></tr></thead><tbody></tbody></table>
      </div>
    </>
  );
}
