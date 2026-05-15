import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Salary() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1>Зарплата</h1>
          <div className="sub">Расчёт и выплата заработной платы</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick="openSalaryModal()">+ Начислить</button>
        </div>
      </div>
      <div className="product-table">
        <table>
          <thead>
            <tr>
              <th style={ {width:"18%"} }>Сотрудник</th>
              <th style={ {width:"10%"} }>Период</th>
              <th style={ {width:"12%"} }>Оклад</th>
              <th style={ {width:"12%"} }>% продаж</th>
              <th style={ {width:"10%"} }>Премия</th>
              <th style={ {width:"10%"} }>Вычеты</th>
              <th style={ {width:"12%"} }>Итого</th>
              <th style={ {width:"16%"} }>Статус</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </>
  );
}
