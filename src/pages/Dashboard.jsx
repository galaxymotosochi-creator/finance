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
        const {data:catNames}=await supabase.from('categories').select('id,name').eq('user_id',user.id);
        const cm={};(catNames||[]).forEach(c=>{cm[c.id]=c.name;});
        // Доп. данные
        const totalClients = (await supabase.from('clients').select('id',{count:'exact',head:true}).eq('user_id',user.id))?.count||0;
        const repeatClients = 0; // можно будет добавить позже
        setData({rev,exp,profit:rev-exp,cash,bank,reserve,debt:(clients||[]).reduce((s,c)=>s+(c.debt||0),0),deficit,stockCost:sc,stockRetail:sr,sold,avgCheck:ac,buyers:(recs||[]).length,topProducts:tp,debtors:clients||[],expensesByCat:ce,catMap:cm,totalClients,repeatClients,acctList});
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
          <button onClick={()=>setPeriod('custom')} style={{padding:'3px 8px',borderRadius:'100px',border:'1px solid rgba(0,0,0,.12)',background:period==='custom'?'#000':'transparent',color:period==='custom'?'#fff':'#555',fontWeight:600,cursor:'pointer',fontSize:'.68rem'}>Период</button>{period==='custom'&&<><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{padding:'2px 6px',fontSize:'.65rem',border:'1px solid rgba(0,0,0,.12)',borderRadius:'6px',fontFamily:'inherit'}}/><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{padding:'2px 6px',fontSize:'.65rem',border:'1px solid rgba(0,0,0,.12)',borderRadius:'6px',fontFamily:'inherit'}}/></>}