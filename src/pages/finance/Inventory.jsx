import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Inventory() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1 style={ {fontSize:"1.2re",fontWeight:"600",margin:"0"} }>Инвентаризация</h1>
          <div className="sub">Сверка фактических остатков с учётными</div>
        </div>
        <div>
          <button className="btn-green" onClick="startInventory()">+ Новая инвентаризация</button>
          <button className="btn btn-outline" onClick="cancelInventoryEdit()" style={ {display:"none",fontSize:".8re"} }>← Назад</button>
        </div>
      </div>
      <div className="nav-sep" style={ {margin:".25rem 0",width:"100%"} }></div>
      <div className="product-table" style={ {overflowX:"au",WebkitOverflowScrolling:"touch"} }>
        <table>
          <thead>
            <tr>
              <th>Товар</th>
              <th>Учтено</th>
              <th>Факт</th>
              <th>Разница</th>
              <th style={ {width:"130px"} }></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </>
  );
}
