import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState(null);

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const getDateRange = () => {
    const now = new Date();
    let from, to = now.toISOString().split('T')[0];
    if (period === 'day') { from = new Date(now); from.setHours(0,0,0,0); }
    else if (period === 'week') { from = new Date(now); from.setDate(from.getDate() - from.getDay() + 1); from.setHours(0,0,0,0); }
    else if (period === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (customStart) { from = new Date(customStart); to = customEnd || to; }
    else return { from: now.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    return { from: from.toISOString().split('T')[0], to };
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      try {
        const dr = getDateRange();
        const [{data:txs},{data:accts},{data:clients},{data:prods},{data:supRaw},{data:wo},{data:recs}] = await Promise.all([
          supabase.from('transactions').select('type,amount,category_id,status').eq('user_id',user.id).gte('date',dr.from).lte('date',dr.to),
          supabase.from('accounts').select('name,balance,type').eq('user_id',user.id),
          supabase.from('clients').select('name,debt').eq('user_id',user.id).not('debt','is',null).gt('debt',0).order('debt',{ascending:false}),
          supabase.from('products').select('id,name,type,price,min_qty').eq('user_id',user.id).eq('hidden',false),
          supabase.from('supplies').select('items').eq('user_id',user.id),
          supabase.from('writeoffs').select('items').eq('user_id',user.id),
          supabase.from('receipts').select('id,total_amount').eq('user_id',user.id).gte('date',dr.from).lte('date',dr.to),
        ]);
        const rids = (recs||[]).map(r=>r.id);
        const {data:recItems} = rids.length ? (await supabase.from('receipt_items').select('product_name,quantity,total').in('receipt_id',rids)) : {data:[]};

        let rev=0, exp=0;
        (txs||[]).forEach(t=>{const a=t.amount||0;if(t.type==='income'&&t.status!=='unpaid')rev+=a;else if(t.type==='expense')exp+=a;});
        const cash = (accts||[]).filter(a=>a.type==='cash_register').reduce((s,a)=>s+(a.balance||0),0);
        const bank = (accts||[]).filter(a=>!a.type?.startsWith('cash')).reduce((s,a)=>s+(a.balance||0),0);
        const sm={};
        (supRaw||[]).forEach(sp=>(sp.items||[]).forEach(it=>{if(!sm[it.prodId])sm[it.prodId]={qty:0,cost:0};sm[it.prodId].qty+=it.qty||0;sm[it.prodId].cost+=(it.cost||0)*(it.qty||0);}));
        (wo||[]).forEach(w=>(w.items||[]).forEach(it=>{if(sm[it.prodId])sm[it.prodId].qty-=it.qty||0;}));
        const deficit = (prods||[]).filter(p=>p.type!=='service'&&p.type!=='combo'&&p.min_qty>0).map(p=>({name:p.name,qty:sm[p.id]?.qty||0,min:p.min_qty,need:Math.max(0,p.min_qty-(sm[p.id]?.qty||0))})).filter(p=>p.qty<p.min).sort((a,b)=>(a.qty/a.min)-(b.qty/b.min)).slice(0,5);
        const sc = Object.values(sm).reduce((s,v)=>s+v.cost,0);
        const sr = (prods||[]).reduce((s,p)=>s+((sm[p.id]?.qty||0)*(p.price||0)),0);
        const sold = (recItems||[]).reduce((s,i)=>s+(i.quantity||0),0);
        const tr = (recs||[]).reduce((s,r)=>s+(r.total_amount||0),0);
        const ac = sold>0?Math.round(tr/sold):0;
        const top={};(recItems||[]).forEach(i=>{const n=i.product_name||'Товар';if(!top[n])top[n]={qty:0,rev:0};top[n].qty+=i.quantity||0;top[n].rev+=i.total||0;});
        const tp = Object.entries(top).sort((a,b)=>b[1].rev-a[1].rev).slice(0,3).map(([n,v])=>({name:n,qty:v.qty,rev:v.rev}));
        const ce={};(txs||[]).filter(t=>t.type==='expense').forEach(t=>{const k=t.category_id||'other';if(!ce[k])ce[k]=0;ce[k]+=t.amount||0;});
        const {data:catNames}=await supabase.from('categories').select('id,name').eq('user_id',user.id);
        const cm={};(catNames||[]).forEach(c=>{cm[c.id]=c.name;});
        setData({rev,exp,profit:rev-exp,cash,bank,debt:(clients||[]).reduce((s,c)=>s+(c.debt||0),0),deficit,stockCost:sc,stockRetail:sr,sold,avgCheck:ac,buyers:(recs||[]).length,topProducts:tp,debtors:clients||[],expensesByCat:ce,catMap:cm});
      } catch(e) { console.error('Dashboard error:',e); }
      setLoading(false);
    })();
  }, [user,period,customStart,customEnd]);

  const d = data;
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'300px',color:'#999',fontSize:'.85rem'}}>Загрузка...</div>;
  if (!d) return <div style={{textAlign:'center',padding:'3rem',color:'#999',fontSize:'.85rem'}}>Нет данных</div>;
  try {
    // Check for required data
    if (typeof d.expensesByCat !== 'object') d.expensesByCat = {};
    if (typeof d.topProducts !== 'object') d.topProducts = [];
    if (typeof d.debtors !== 'object') d.debtors = [];
  } catch(e) { return <div style={{textAlign:'center',padding:'3rem',color:'#dc2626',fontSize:'.82rem'}}>Ошибка данных: {e.message}</div>; }

  const Btn = ({p,label}) => (<button onClick={()=>setPeriod(p)} style={{padding:'3px 10px',borderRadius:'100px',border:'1px solid rgba(0,0,0,.12)',background:period===p?'#000':'transparent',color:period===p?'#fff':'#555',fontWeight:600,cursor:'pointer',fontFamily:'inherit',fontSize:'.68rem'}}>{label}</button>);

  const S = (w) => ({fontSize:'.66rem',color:'rgba(0,0,0,.5)',textTransform:'uppercase',marginBottom:'3px',...w});
  const V = (w) => ({fontSize:'1.15rem',fontWeight:800,...w});
  const sec = {background:'#fff',borderRadius:'14px',padding:'14px',marginBottom:'8px',border:'1px solid rgba(0,0,0,.08)',boxShadow:'0 1px 3px rgba(0,0,0,.04)'};
  const st = {fontSize:'.7rem',fontWeight:700,color:'rgba(0,0,0,.5)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:'8px'};

  return (
    <div style={{fontFamily:"'Inter',sans-serif",padding:'0',color:'#111'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px',flexWrap:'wrap',gap:'6px'}}>
        <div><h1 style={{fontSize:'1.1rem',fontWeight:700,marginBottom:'2px'}}>Панель управления</h1><span style={{fontSize:'.65rem',color:'rgba(0,0,0,.4)'}}>{today}</span></div>
        <div style={{display:'flex',gap:'4px',alignItems:'center',flexWrap:'wrap'}}>
          <Btn p="day" label="День"/><Btn p="week" label="Неделя"/><Btn p="month" label="Месяц"/>
          <button onClick={()=>setPeriod('custom')} style={{padding:'3px 8px',borderRadius:'100px',border:'1px solid rgba(0,0,0,.12)',background:period==='custom'?'#000':'transparent',color:period==='custom'?'#fff':'#555',fontWeight:600,cursor:'pointer',fontSize:'.68rem'}}>Свои</button>
          {period==='custom'&&<><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{padding:'2px 4px',fontSize:'.65rem',border:'1px solid rgba(0,0,0,.12)',borderRadius:'4px',fontFamily:'inherit'}}/><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{padding:'2px 4px',fontSize:'.65rem',border:'1px solid rgba(0,0,0,.12)',borderRadius:'4px',fontFamily:'inherit'}}/></>}
        </div>
      </div>

      {/* TOP 3 */}
      <div style={{display:'flex',gap:'10px',marginBottom:'12px'}}>
        <div style={{flex:1,background:'#fff',borderRadius:'14px',padding:'14px',border:'1px solid rgba(0,0,0,.08)'}}>
          <div style={S()}>Выручка</div><div style={V({color:'#000'})}>+{d.rev.toLocaleString()} ₽</div></div>
        <div style={{flex:1,background:'#fff',borderRadius:'14px',padding:'14px',border:'1px solid rgba(0,0,0,.08)'}}>
          <div style={S()}>Расходы</div><div style={V({color:'#dc2626'})}>-{d.exp.toLocaleString()} ₽</div></div>
        <div style={{flex:1,background:'#fff',borderRadius:'14px',padding:'14px',border:'1px solid rgba(0,0,0,.08)'}}>
          <div style={S()}>Прибыль</div><div style={V({color:'#16a34a'})}>{d.profit>=0?'+':''}{d.profit.toLocaleString()} ₽</div></div>
      </div>

      {/* Счета · Долги */}
      <div style={sec}>
        <div style={st}>Счета · Долги</div>
        <div style={{display:'flex',gap:'6px',flexWrap:'wrap',fontSize:'.72rem',color:'rgba(0,0,0,.55)'}}>
          <span>Касса: <b>{d.cash.toLocaleString()} ₽</b></span>
          <span style={{color:'#16a34a'}}>Р/с: <b>{d.bank.toLocaleString()} ₽</b></span>
          <span style={{color:'#dc2626'}}>Долги: <b>{d.debt.toLocaleString()} ₽</b></span>
        </div>
      </div>

      {/* Дефицит склада */}
      {d.deficit.length>0&&<div style={sec}>
        <div style={st}>Склад — дефицит</div>
        <table style={{width:'100%',fontSize:'.74rem',borderCollapse:'collapse'}}>
          <thead><tr>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'4px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'left'}}>Товар</th>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'4px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'center'}}>Ост</th>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'4px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'center'}}>Мин</th>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'4px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'center'}}>Надо</th>
          </tr></thead>
          <tbody>{d.deficit.map((it,i)=>(
            <tr key={i}>
              <td style={{padding:'4px',borderBottom:'1px solid rgba(0,0,0,.04)',fontSize:'.74rem'}}>{it.name}</td>
              <td style={{padding:'4px',borderBottom:'1px solid rgba(0,0,0,.04)',textAlign:'center'}}><span style={{display:'inline-block',background:'#fef2f2',color:'#dc2626',padding:'0 6px',borderRadius:'100px',fontSize:'.58rem',fontWeight:600}}>{it.qty}</span></td>
              <td style={{padding:'4px',borderBottom:'1px solid rgba(0,0,0,.04)',textAlign:'center'}}>{it.min}</td>
              <td style={{padding:'4px',borderBottom:'1px solid rgba(0,0,0,.04)',textAlign:'center',fontWeight:600}}>{it.need}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{display:'flex',gap:'6px',flexWrap:'wrap',fontSize:'.72rem',color:'rgba(0,0,0,.55)',marginTop:'6px'}}>
          <span>По закупке: <b>{d.stockCost.toLocaleString()} ₽</b></span>
          <span>В продаже: <b>{d.stockRetail.toLocaleString()} ₽</b></span>
        </div>
      </div>}

      {/* Продажи */}
      <div style={sec}>
        <div style={st}>Продажи</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Продано</div>
            <div style={{fontSize:'1.1rem',fontWeight:700}}>{d.sold}</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Ср.чек</div>
            <div style={{fontSize:'1.1rem',fontWeight:700}}>{d.avgCheck.toLocaleString()} ₽</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Покуп.</div>
            <div style={{fontSize:'1.1rem',fontWeight:700,color:'#16a34a'}}>{d.buyers}</div></div>
        </div>
        {d.topProducts.length>0&&<table style={{width:'100%',fontSize:'.74rem',borderCollapse:'collapse',marginBottom:'6px'}}>
          <thead><tr>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'3px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'left',width:'30px'}}>#</th>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'3px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'left'}}>Товар</th>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'3px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'center'}}>Шт</th>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'3px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'right'}}>Выручка</th>
          </tr></thead>
          <tbody>{d.topProducts.map((p,i)=>(
            <tr key={i}>
              <td style={{padding:'3px',color:'rgba(0,0,0,.3)',fontWeight:700}}>{i+1}</td>
              <td style={{padding:'3px'}}>{p.name}</td>
              <td style={{padding:'3px',textAlign:'center'}}>{p.qty}</td>
              <td style={{padding:'3px',textAlign:'right',fontWeight:600}}>{p.rev.toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table>}
      </div>

      {/* Клиенты */}
      <div style={sec}>
        <div style={st}>Клиенты</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Всего</div><div style={{fontSize:'1.1rem',fontWeight:700}}>{d.buyers}</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Должники</div><div style={{fontSize:'1.1rem',fontWeight:700,color:'#dc2626'}}>{d.debtors?.length||0}</div></div>
        </div>
        {d.debtors?.length>0&&<table style={{width:'100%',fontSize:'.74rem',borderCollapse:'collapse'}}>
          <thead><tr>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'3px',borderBottom:'1px solid rgba(0,0,0,.08)'}}>Клиент</th>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'3px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'right'}}>Сумма</th>
          </tr></thead>
          <tbody>{d.debtors.slice(0,5).map((c,i)=>(
            <tr key={i}>
              <td style={{padding:'3px'}}>{c.name}</td>
              <td style={{padding:'3px',textAlign:'right',color:'#dc2626',fontWeight:600}}>{c.debt.toLocaleString()} ₽</td>
            </tr>
          ))}</tbody>
        </table>}
      </div>

      {/* Расходы */}
      {expCats.length>0&&<div style={sec}>
        <div style={st}>Расходы по категориям</div>
        <table style={{width:'100%',fontSize:'.74rem',borderCollapse:'collapse'}}>
          <thead><tr>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'3px',borderBottom:'1px solid rgba(0,0,0,.08)'}}>Категория</th>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'3px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'right'}}>Сумма</th>
            <th style={{fontSize:'.58rem',color:'rgba(0,0,0,.5)',padding:'3px',borderBottom:'1px solid rgba(0,0,0,.08)',textAlign:'center'}}>%</th>
          </tr></thead>
          <tbody>{expCats.map(([catId,amt],i)=>{
            const pct = totalExp>0?Math.round(amt/totalExp*100):0;
            return <tr key={i}>
              <td style={{padding:'3px'}}>{d.catMap[catId]||'Прочее'}</td>
              <td style={{padding:'3px',textAlign:'right',color:'#dc2626',fontWeight:600}}>{amt.toLocaleString()} ₽</td>
              <td style={{padding:'3px',textAlign:'center',color:'rgba(0,0,0,.5)'}}>{pct}%</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}

    </div>
  );
}
