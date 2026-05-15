export default function Transactions() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Транзакции</h1>
          <div className="sub">Все приходы и расходы в одном месте</div>
        </div>
        <div className="page-actions">
          <button className="btn-red" onClick={function(){openExpenseModal()}}>+ Расход</button>
          <button className="btn-green" onClick={function(){openIncomeModal()}}>+ Доход</button>
        </div>
      </div>
      <div className="nav-sep" style={{margin:".25rem 0",width:"100%"}}></div>
      <div className="search-row">
        <div className="stock-search" style={{width:"30%",minWidth:"180px",maxWidth:"400px"}}>
          <span style={{fontSize:".75rem",color:"var(--muted)"}}>🔍</span>
          <input type="text" placeholder="Быстрый поиск" onChange={function(){renderTransactionsPage()}} />
        </div>
        <div className="stock-filter-links">
          <div className="tx-period-wrapper" style={{position:"relative",display:"inline-flex"}}>
            <span className="stock-filter-link tx-period-wrapper" onClick={function(){togglePeriodDropdownTx()}}>📅 Период</span>
            <div className="tx-period-dropdown">
              <div className="pd-title">Период</div>
              <button className="period-preset active" onClick={function(){setPeriodTx('today', 'Сегодня', this)}}>Сегодня</button>
              <button className="period-preset" onClick={function(){setPeriodTx('yesterday', 'Вчера', this)}}>Вчера</button>
              <button className="period-preset" onClick={function(){setPeriodTx('week', 'Эта неделя', this)}}>Эта неделя</button>
              <button className="period-preset" onClick={function(){setPeriodTx('month', 'Этот месяц', this)}}>Этот месяц</button>
              <button className="period-preset" onClick={function(){setPeriodTx('all', 'Всё время', this)}}>Всё время</button>
              <div className="period-custom">
                <div className="pd-title">Свой период</div>
                <div className="period-custom-row">
                  <label>с</label><input type="date" />
                </div>
                <div className="period-custom-row">
                  <label>по</label><input type="date" />
                </div>
                <button className="period-apply" onClick={function(){applyCustomPeriodTx()}}>Применить</button>
              </div>
            </div>
          </div>
          <span className="stock-filter-link export-wrapper" onClick={function(){toggleExportTxDropdown()}}>Скачать</span>
          <span className="stock-filter-link" onClick={function(){openFilterModal()}} style={{fontSize:".9rem"}}>⚙️</span>
          <span className="stock-filter-link" onClick={function(){toggleTxFilter('expense')}}>Расходы</span>
          <span className="stock-filter-link" onClick={function(){toggleTxFilter('income')}}>Доходы</span>
        </div>
        <div className="export-dropdown">
          <div className="export-dd-title">Вы хотите скачать товары в Excel?</div>
          <div className="export-dd-actions">
            <span className="export-dd-btn" onClick={function(){confirmExportTx()}}>Да</span>
            <span className="export-dd-btn export-dd-cancel" onClick={function(){closeExportTxDropdown()}}>Нет</span>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:".5rem",flexWrap:"w",margin:".75rem 0"}}>
        <div style={{flex:"1",minWidth:"120px",background:"linear-gradient(135deg,#dcfce7,#bbf7d0)",border:"1px solid #86efac",borderRadius:"10px",padding:".65rem .75re"}}>
          <div style={{fontSize:".65rem",color:"#166534",fontWeight:"600",textTransform:"uppercase"}}>Выручка</div>
          <div style={{fontSize:"1.1rem",fontWeight:"700",color:"#14532d",marginTop:".1rem"}}>0₽</div>
        </div>
        <div style={{flex:"1",minWidth:"120px",background:"linear-gradient(135deg,#fce7f3,#fbcfe8)",border:"1px solid #f9a8d4",borderRadius:"10px",padding:".65rem .75re"}}>
          <div style={{fontSize:".65rem",color:"#9d174d",fontWeight:"600",textTransform:"uppercase"}}>Расходы</div>
          <div style={{fontSize:"1.1rem",fontWeight:"700",color:"#831843",marginTop:".1rem"}}>0₽</div>
        </div>
        <div style={{flex:"1",minWidth:"120px",background:"linear-gradient(135deg,#dbeafe,#bfdbfe)",border:"1px solid #93c5fd",borderRadius:"10px",padding:".65rem .75re"}}>
          <div style={{fontSize:".65rem",color:"#1e40af",fontWeight:"600",textTransform:"uppercase"}}>Прибыль</div>
          <div style={{fontSize:"1.1rem",fontWeight:"700",color:"#1e3a8",marginTop:".1rem"}}>0₽</div>
        </div>
        <div style={{flex:"1",minWidth:"120px",background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #fcd34d",borderRadius:"10px",padding:".65rem .75re"}}>
          <div style={{fontSize:".65rem",color:"#92400e",fontWeight:"600",textTransform:"uppercase"}}>Средний чек</div>
          <div style={{fontSize:"1.1rem",fontWeight:"700",color:"#78350f",marginTop:".1rem"}}>0₽</div>
        </div>
      </div>

      <div className="product-table" style={{marginTop:".5rem"}}>
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Название</th>
              <th>Сумма</th>
              <th>Категория</th>
              <th className="actions"></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    
    </>
  );
}
