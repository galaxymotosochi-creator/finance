export default function Products() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Товары и услуги</h1>
          <div className="sub">Управляйте — добавляйте, редактируйте, ищите</div>
        </div>
        <div className="page-actions">
          <button className="btn-green" onClick={function(){openProductModal()}}>+ Добавить</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>
      <div className="search-row">
        <div className="stock-search" style={{width:"30%",minWidth:"180px",maxWidth:"400px"}}>
          <span style={{fontSize:".75rem",color:"var(--muted)"}}>🔍</span>
          <input type="text" placeholder="Быстрый поиск" onChange={function(){renderProductsPage()}} />
        </div>
        <div className="stock-filter-links">
          <div style={{position:"relative",display:"inline-flex"}}>
            <span className="stock-filter-link cat-wrapper" onClick={function(){document.getElementById('colsDropdown')?.classList.remove('open');toggleCatDropdown(event)}}>
              Категория
            </span>
            <div className="tx-type-dropdown">
              <div className="pd-title">Тип категории</div>
              <label className="tx-type-item">
                <span className="tx-type-cb" data-type="product" onClick={function(){toggleTypeFilter('product', this)}}>✓</span>
                Товар
              </label>
              <label className="tx-type-item">
                <span className="tx-type-cb" data-type="service" onClick={function(){toggleTypeFilter('service', this)}}>✓</span>
                Услуга
              </label>
            </div>
          </div>
          <span className="stock-filter-link" onClick={function(){closeAllDropdowns();navigateTo('trash')}}>Корзина</span>
          <span className="stock-filter-link" onClick={function(){document.getElementById('catDropdown')?.classList.remove('open');toggleExportDropdown(event)}}>
            Скачать
          </span>
          <span className="stock-filter-link cols-wrapper" onClick={function(){document.getElementById('catDropdown')?.classList.remove('open');document.getElementById('exportDropdown')?.classList.remove('open');toggleColsDropdown(event)}}>
            Столбцы
          </span>
        </div>
        <div className="export-dropdown">
          <div className="export-dd-title">Вы хотите скачать товары в Excel?</div>
          <div className="export-dd-actions">
            <span className="export-dd-btn" onClick={function(){confirmExport()}}>Да</span>
            <span className="export-dd-btn export-dd-cancel" onClick={function(){closeExportDropdown()}}>Нет</span>
          </div>
        </div>
        <div className="cols-dropdown">
          <div className="cols-title">Отображать столбцы</div>
          <div className="cols-list"></div>
          <div className="cols-footer">
            <span className="cols-reset" onClick={function(){resetCols()}}>Вернуть по умолчанию</span>
          </div>
        </div>
    </div>
    
    <div className="product-table" style={{overflowX:"au",WebkitOverflowScrolling:"touch"}}>
      <table>
        <thead>
          <tr></tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>
    </div>
    
    <div className="modal-overlay" onClick={function(){if(event.target===this)closeTrashModal()}}>
      <div className="modal-box">
        <div style={{display:"flex",alignItems:"cente",justifyContent:"space-betwee",marginBottom:".5rem"}}>
          <h2>Корзина</h2>
          <button onClick={function(){closeTrashModal()}} style={{background:"none",border:"none",fontSize:"1.2rem",cursor:"pointe",color:"var(--muted)"}}>✕</button>
        </div>
        <div className="sub" style={{marginBottom:"1.5rem"}}>Товары хранятся в корзине в течение 30 дней после удаления</div>
        <div className="product-table">
          <table>
            <thead>
              <tr>
                <th style={{width:"45%"}}>Товар</th>
                <th style={{width:"20%"}}>Категория</th>
                <th style={{width:"35%"}}></th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="2"><div className="empty-products"><div className="big-icon">🗑️</div><p>В корзине пока ничего нет</p></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    
    </>
  );
}
