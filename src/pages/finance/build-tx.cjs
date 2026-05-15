const fs = require('fs');
let code = fs.readFileSync('src/pages/finance/Transactions.jsx', 'utf8');

// 1. Replace the incomeTotal line with safe calculations (using function, not arrow)
const oldCalc = `const incomeTotal = filtered.filter(t => t.type === 'income').reduce((s, t) => s + +t.amount, 0);`;
const newCalc = `const txs = transactions || [];
  const incomeTotal = txs.filter(function(t) { return t && t.type === 'income'; }).reduce(function(s, t) { return s + (Number(t.amount) || 0); }, 0);
  const expenseTotal = txs.filter(function(t) { return t && t.type !== 'income'; }).reduce(function(s, t) { return s + (Number(t.amount) || 0); }, 0);
  const profit = incomeTotal - expenseTotal;
  const sales = txs.filter(function(t) { return t && t.type === 'sale'; });
  const avgCheck = sales.length ? Math.round(sales.reduce(function(s, t) { return s + (Number(t.amount) || 0); }, 0) / sales.length) : 0;`;

code = code.replace(oldCalc, newCalc);

// 2. Add metric cards after the nav-sep div (replace placeholder line)
const oldPlaceholder = `<div style={{ marginTop:"1rem", fontSize:".85rem", color:"var(--muted)" }}>
        Доходы: <strong>0₽</strong> | Расходы: <strong>0₽</strong> | Прибыль: <strong>0₽</strong>
      </div>`;

const cards = `<div style={{ display:"flex", gap:".5rem", flexWrap:"wrap", margin:".75rem 0" }}>
        <div style={{ flex:1, minWidth:"120px", background:"#dcfce7", border:"1px solid #86efac", borderRadius:"10px", padding:".65rem .75rem" }}>
          <div style={{ fontSize:".65rem", color:"#166534", fontWeight:600, textTransform:"uppercase" }}>ВЫРУЧКА</div>
          <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#14532d", marginTop:".1rem" }}>{incomeTotal.toLocaleString()}</div>
        </div>
        <div style={{ flex:1, minWidth:"120px", background:"#fce7f3", border:"1px solid #f9a8d4", borderRadius:"10px", padding:".65rem .75rem" }}>
          <div style={{ fontSize:".65rem", color:"#9d174d", fontWeight:600, textTransform:"uppercase" }}>РАСХОДЫ</div>
          <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#831843", marginTop:".1rem" }}>{expenseTotal.toLocaleString()}</div>
        </div>
        <div style={{ flex:1, minWidth:"120px", background:"#dbeafe", border:"1px solid #93c5fd", borderRadius:"10px", padding:".65rem .75rem" }}>
          <div style={{ fontSize:".65rem", color:"#1e40af", fontWeight:600, textTransform:"uppercase" }}>ПРИБЫЛЬ</div>
          <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#1e3a8a", marginTop:".1rem" }}>{profit.toLocaleString()}</div>
        </div>
        <div style={{ flex:1, minWidth:"120px", background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:"10px", padding:".65rem .75rem" }}>
          <div style={{ fontSize:".65rem", color:"#92400e", fontWeight:600, textTransform:"uppercase" }}>СРЕДНИЙ ЧЕК</div>
          <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#78350f", marginTop:".1rem" }}>{avgCheck.toLocaleString()}</div>
        </div>
      </div>`;

code = code.replace(oldPlaceholder, cards);

// 3. Change .toLocaleString() to add ₽ 
code = code.replace(/\.toLocaleString\(\)}/g, ".toLocaleString()}₽");

fs.writeFileSync('src/pages/finance/Transactions.jsx', code);
console.log('Done');
