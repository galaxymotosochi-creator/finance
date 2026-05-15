import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Writeoffs() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1 style={ {fontSize:"1.2re",fontWeight:"600",margin:"0"} }>Списания</h1>
          <div className="sub">Списание товаров со склада (брак, потеря)</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick="openWriteoffModal()">+ Списать товар</button>
        </div>
      </div>
      <div className="nav-sep" style={ {margin:".25rem 0",width:"100%"} }></div>
      <div className="product-table" style={ {overflowX:"au",WebkitOverflowScrolling:"touch"} }>
        <table>
          <thead>
            <tr>
              <th>Товар</th>
              <th>Кол-во</th>
              <th>Сумма</th>
              <th>Причина</th>
              <th>Дата</th>
              <th style={ {width:"130px"} }></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </>
  );
}
