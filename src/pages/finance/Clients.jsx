import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Clients() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1 style={ {fontSize:"1.2re",fontWeight:"600",margin:"0"} }>Клиенты</h1>
          <div className="sub">Управляйте базой клиентов</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick="openClientModal()">+ Добавить клиента</button>
        </div>
      </div>
      <div className="nav-sep" style={ {margin:".25rem 0",width:"100%"} }></div>
      <div className="search-row">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input type="text" className="search-field" placeholder="Поиск по имени или телефону..." oninput="renderClientsPage()">
        </div>
        <div className="actions-group">
          <button className="text-btn" onClick="toggleClientPeriod()">📅 Весь период <span className="act-arrow">▼</span></button>
        </div>
      </div>
      <div className="product-table" style={ {overflowX:"au",WebkitOverflowScrolling:"touch"} }>
        <table>
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Телефон</th>
              <th>Покупок</th>
              <th>Сумма</th>
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
