import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Supplies() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1 style={ {fontSize:"1.2re",fontWeight:"600",margin:"0"} }>Поставки</h1>
          <div className="sub">Оприходование товаров на склад</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick="supTempItems=[];openSupplyModal()">+ Новая поставка</button>
        </div>
      </div>
      <div className="nav-sep" style={ {margin:".25rem 0",width:"100%"} }></div>
      <div className="product-table" style={ {overflowX:"au",WebkitOverflowScrolling:"touch"} }>
        <table>
          <thead>
            <tr>
              <th>№ накладной</th>
              <th>Поставщик</th>
              <th>Сумма</th>
              <th>Поставка</th>
              <th>Оплата</th>
              <th>Дата</th>
              <th style={ {width:"130px"} }></th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      </div>
    </>
  );
}
