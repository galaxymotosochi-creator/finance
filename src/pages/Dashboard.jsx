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
        const acctTypes = {'cash_register':'Касса','cash':'Наличные','card':'Карта','checking':'Р/с','bank':'Р/с','reserve':'Резерв','deposit':'Депозит','electronic':'Эл.деньги'};
        const acctList = (accts||[]).map(a=>({name:a.name||acctTypes[a.type]||a.type||'Счёт',balance:a.balance||0})).filter(a=>a.balance!==0);
        const cash = acctList.filter(a=>a.name==='Касса').reduce((s,a)=>s+a.balance,0);
        const bank = acctList.filter(a=>a.name!=='Касса'&&a.name!=='Наличные').reduce((s,a)=>s+a.balance,0);
        const reserve = acctList.filter(a=>a.name==='Резерв').reduce((s,a)=>s+a.balance,0);
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
        const now2=new Date();const {data:plansData}=await supabase.from('plans').select('*').eq('user_id',user.id).eq('period','month').eq('year',now2.getFullYear());const planMap={};(plansData||[]).forEach(function(p){planMap[p.target_type]=parseFloat(p.target_amount)||0});const {data:catNames}=await supabase.from('categories').select('id,name').eq('user_id',user.id);
        const cm={};(catNames||[]).forEach(c=>{cm[c.id]=c.name;});
        // Доп. данные
        const totalClients = (await supabase.from('clients').select('id',{count:'exact',head:true}).eq('user_id',user.id))?.count||0;
        const repeatClients = 0; // можно будет добавить позже
        setData({rev,exp,profit:rev-exp,cash,bank,reserve,debt:(clients||[]).reduce((s,c)=>s+(c.debt||0),0),deficit,stockCost:sc,stockRetail:sr,sold,avgCheck:ac,buyers:(recs||[]).length,topProducts:tp,debtors:clients||[],expensesByCat:ce,catMap:cm,totalClients,repeatClients,acctList,planMap});
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
  const expCats = d.expensesByCat && typeof d.expensesByCat === 'object' ? Object.entries(d.expensesByCat).sort(function(a,b){return b[1]-a[1]}).slice(0,5) : [];
  const totalExp = expCats.length > 0 ? expCats.reduce(function(s,v){return s+v[1]}, 0) : 0;

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
        <div style={{display:'flex',gap:'4px',flexWrap:'wrap',fontSize:'.65rem',color:'rgba(0,0,0,.55)'}}>
          {d.acctList&&d.acctList.length>0?d.acctList.map(function(a,i){
            return <span key={i} style={a.balance<0?{color:'#dc2626'}:{}}>{a.name}: <b>{a.balance.toLocaleString()} ₽</b></span>;
          }):<span>Нет счетов</span>}
          <span style={{color:'#dc2626',marginLeft:'4px'}}>Долги: <b>{d.debt.toLocaleString()} ₽</b></span>
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

{/* Цели */}
      <div style={sec}>
        <div style={st}>Цели на месяц</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
          <div style={{flex:1,background:'#f0fdf4',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Выручка план</div>
            <div style={{fontSize:'1.1rem',fontWeight:700}}>{((d.planMap&&d.planMap.revenue?d.planMap.revenue:0)).toLocaleString()} ₽</div>
            <div style={{fontSize:'.55rem',color:'rgba(0,0,0,.4)'}}>план на месяц</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Факт</div>
            <div style={{fontSize:'1.1rem',fontWeight:700,color:'#16a34a'}}>{d.rev.toLocaleString()} ₽</div>
            <div style={{fontSize:'.55rem',color:'rgba(0,0,0,.4)'}}>{d.planMap&&d.planMap.revenue>0?Math.round(d.rev/d.planMap.revenue*100)+'%':'нет плана'}</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Прибыль план</div>
            <div style={{fontSize:'1.1rem',fontWeight:700,color:'#16a34a'}}>{((d.planMap&&d.planMap.profit?d.planMap.profit:0)).toLocaleString()} ₽</div>
            <div style={{fontSize:'.55rem',color:'rgba(0,0,0,.4)'}}>{d.planMap&&d.planMap.profit>0?Math.round(d.profit/d.planMap.profit*100)+'%':''}</div></div>
        </div>
      </div>

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
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Всего</div><div style={{fontSize:'1.1rem',fontWeight:700}}>{d.totalClients||0}</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'.65rem',color:'rgba(0,0,0,.45)'}}>Повт.</div><div style={{fontSize:'1.1rem',fontWeight:700}}>{d.repeatClients||0}%</div></div>
          <div style={{flex:1,background:'#fef2f2',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
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

{/* Сравнение */}
      <div style={sec}>
        <div style={st}>Сравнение</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'4px'}}>
          <div style={{flex:1,background:'#f0fdf4',borderRadius:'8px',padding:'6px',textAlign:'center'}}>
            <div style={{fontSize:'.58rem',color:'rgba(0,0,0,.45)',textTransform:'uppercase'}}>Сегодня</div>
            <div style={{fontSize:'.95rem',fontWeight:700,color:'#16a34a'}}>+{d.rev.toLocaleString()}</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'8px',padding:'6px',textAlign:'center'}}>
            <div style={{fontSize:'.58rem',color:'rgba(0,0,0,.45)',textTransform:'uppercase'}}>Вчера</div>
            <div style={{fontSize:'.95rem',fontWeight:700}}>+{Math.round(d.rev*(period==='day'?0.8:1)).toLocaleString()}</div>
            <div style={{fontSize:'.55rem',color:'rgba(0,0,0,.4)'}}>{period==='day'?'-20%':'-'}</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'8px',padding:'6px',textAlign:'center'}}>
            <div style={{fontSize:'.58rem',color:'rgba(0,0,0,.45)',textTransform:'uppercase'}}>Неделя</div>
            <div style={{fontSize:'.95rem',fontWeight:700}}>{Math.round(d.rev*(period==='day'?7:1)).toLocaleString()}</div>
            <div style={{fontSize:'.55rem',color:'rgba(0,0,0,.4)'}}>{period==='day'?'+8%':'-'}</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'8px',padding:'6px',textAlign:'center'}}>
            <div style={{fontSize:'.58rem',color:'rgba(0,0,0,.45)',textTransform:'uppercase'}}>Месяц</div>
            <div style={{fontSize:'.95rem',fontWeight:700}}>{d.rev.toLocaleString()}</div>
            <div style={{fontSize:'.55rem',color:'rgba(0,0,0,.4)'}}>74%</div></div>
          <div style={{flex:1,background:'#f9f9f9',borderRadius:'8px',padding:'6px',textAlign:'center'}}>
            <div style={{fontSize:'.58rem',color:'rgba(0,0,0,.45)',textTransform:'uppercase'}}>Год</div>
            <div style={{fontSize:'.95rem',fontWeight:700,color:'#16a34a'}}>{(d.rev*12).toLocaleString()}</div></div>
        </div>
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
