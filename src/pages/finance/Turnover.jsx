export default function Turnover() {
  return (
    <>

      <div className="page-header">
        <div>
          <h1 style={{fontSize:"1.2rem",fontWeight:"600",margin:"0"}}>Оборачиваемость</h1>
          <div className="sub">Анализ эффективности склада</div>
        </div>
        <div className="analytics-period">
          <button className="ap-btn active" onClick={function(){setTurnoverPeriod(7,this)}}>7 дней</button>
          <button className="ap-btn" onClick={function(){setTurnoverPeriod(30,this)}}>30 дней</button>
          <button className="ap-btn" onClick={function(){setTurnoverPeriod(90,this)}}>90 дней</button>
        </div>
      </div>
      <div className="am-grid">
        <div className="am-card"><div className="am-icon">&#128337;</div><div className="am-label">Средний цикл оборота</div><div className="am-value">—</div><div className="am-sub">дней от закупки до продажи</div></div>
        <div className="am-card"><div className="am-icon">&#128257;</div><div className="am-label">Коэфф. оборачиваемости</div><div className="am-value">—</div><div className="am-sub">раз за период</div></div>
        <div className="am-card"><div className="am-icon">&#10060;</div><div className="am-label">Замороженный капитал</div><div className="am-value">0₽</div><div className="am-sub">товары без движения >30 дней</div></div>
        <div className="am-card"><div className="am-icon">&#128200;</div><div className="am-label">Индекс здоровья склада</div><div className="am-value">—</div><div className="am-sub">активных товаров</div></div>
      </div>
      <div className="ac-grid">
        <div className="ac-card">
          <div className="ac-title">ABC-анализ</div>
          <div className="ac-desc">Распределение товаров по вкладу в выручку</div>
          <div className="donut-wrap">
            <div style={{width:"130px",height:"130px",flexShrink:"0"}}></div>
            <div className="donut-legend">
              <div className="dl-row"><span className="dl-dot" style={{background:"#4CAF50"}}></span> A (80% выручки) — <span>0%</span></div>
              <div className="dl-row"><span className="dl-dot" style={{background:"#FF9800"}}></span> B (15% выручки) — <span>0%</span></div>
              <div className="dl-row"><span className="dl-dot" style={{background:"#F44336"}}></span> C (5% выручки) — <span>0%</span></div>
            </div>
          </div>
        </div>
        <div className="ac-card">
          <div className="ac-title">Скорость vs Маржа</div>
          <div className="ac-desc">Каждый товар — точка. X: скорость продажи, Y: маржинальность</div>
          <div className="scatter-wrap"><canvas width="400" height="200"></canvas></div>
        </div>
      </div>
      <div className="at-grid">
        <div className="at-card">
          <div className="at-title">&#128640; Топ-ракеты</div>
          <div className="ac-desc">Самые быстро продаваемые товары</div>
          <table className="at-table">
            <thead><tr><th>#</th><th>Товар</th><th>Продано</th><th>Дней на складе</th><th>Выручка</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div className="at-card">
          <div className="at-title">&#9875; Якоря (неликвиды)</div>
          <div className="ac-desc">Товары без движения более 45 дней</div>
          <table className="at-table">
            <thead><tr><th>#</th><th>Товар</th><th>Дней на складе</th><th>Себестоимость</th><th>Убыток от хранения</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    
    </>
  );
}
