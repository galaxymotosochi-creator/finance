import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Products() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header">
        <div>
          <h1 style={ {fontSize:"1.2re",fontWeight:"600",margin:"0"} }>Товары и услуги</h1>
          <div className="sub">Управляйте — добавляйте, редактируйте, ищите</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick="openProductModal()">+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={ {margin:".25rem 0",width:"100%"} }></div>
      <div className="search-row">
        <div className="stock-search" style={ {width:"30%",minWidth:"180px",maxWidth:"400px"} }>
          <span style={ {fontSize:".75re",color:"var(--muted)"} }>🔍</span>
          <input type="text" placeholder="Быстрый поиск" oninput="renderProductsPage()">
        </div>
        <div className="stock-filter-links">
          <div style={ {position:"relative",display:"inline-flex"} }>
            <span className="stock-filter-link cat-wrapper" onClick="document.getElementById('colsDropdown')?.classList.remove('open');toggleCatDropdown(event)">
              Категория
            </span>
            <div className="tx-type-dropdown">
              <div className="pd-title">Тип категории</div>
              <label className="tx-type-item">
                <span className="tx-type-cb" data-type="product" onClick="toggleTypeFilter('product', this)">✓</span>
                Товар
              </label>
              <label className="tx-type-item">
                <span className="tx-type-cb" data-type="service" onClick="toggleTypeFilter('service', this)">✓</span>
                Услуга
              </label>
            </div>
          </div>
          <span className="stock-filter-link" onClick="closeAllDropdowns();navigateTo('trash')">Корзина</span>
          <span className="stock-filter-link" onClick="document.getElementById('catDropdown')?.classList.remove('open');toggleExportDropdown(event)">
            Скачать
          </span>
          <span className="stock-filter-link cols-wrapper" onClick="document.getElementById('catDropdown')?.classList.remove('open');document.getElementById('exportDropdown')?.classList.remove('open');toggleColsDropdown(event)">
            Столбцы
          </span>
        </div>
        <div className="export-dropdown">
          <div className="export-dd-title">Вы хотите скачать товары в Excel?</div>
          <div className="export-dd-actions">
            <span className="export-dd-btn" onClick="confirmExport()">Да</span>
            <span className="export-dd-btn export-dd-cancel" onClick="closeExportDropdown()">Нет</span>
          </div>
        </div>
        <div className="cols-dropdown">
          <div className="cols-title">Отображать столбцы</div>
          <div className="cols-list"></div>
          <div className="cols-footer">
            <span className="cols-reset" onClick="resetCols()">Вернуть по умолчанию</span>
          </div>
        </div>
    </>
  );
}
