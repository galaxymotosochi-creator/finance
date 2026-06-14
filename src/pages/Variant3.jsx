import { useNavigate } from 'react-router-dom';
export default function Variant3() {
  const n = useNavigate();
  return (
    <div style={{fontFamily:"Inter,sans-serif",color:"#111",minHeight:"100vh"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",maxWidth:1104,margin:"0 auto"}}>
        <span style={{fontWeight:800,fontSize:18,letterSpacing:"-.03em"}}>FINANCE</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"1.5px solid rgba(0,16,36,.12)",background:"transparent",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#111"}}>Войти</button>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Регистрация</button>
        </div>
      </header>
      <section style={{maxWidth:1104,margin:"0 auto",padding:"40px 24px 20px",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:100,background:"#ffdd2d",fontSize:11,fontWeight:700,color:"#000",marginBottom:16}}>
          🔥 Для малого и среднего бизнеса
        </div>
        <h1 style={{fontSize:"clamp(36px,6vw,56px)",fontWeight:800,letterSpacing:"-.03em",lineHeight:1.1,marginBottom:12}}>
          Ваш бизнес<br/>под контролем
        </h1>
        <p style={{fontSize:17,color:"rgba(0,0,0,.54)",maxWidth:480,margin:"0 auto 32px"}}>
          Учитывайте каждую копейку, управляйте складом и платите зарплату — в одной системе.
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button onClick={()=>n('/login')} style={{padding:"14px 32px",borderRadius:100,border:"none",background:"#000",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#fff"}}>Начать бесплатно →</button>
        </div>
      </section>
      {/* Большие карточки-возможности */}
      <section style={{maxWidth:1104,margin:"48px auto",padding:"0 24px",display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))",gap:16}}>
        {[
          {emoji:"📊",title:"Финансы",desc:"Управляйте доходами и расходами, смотрите P&L и движение денег. Все счета и кассы в одном месте.",color:"#fff8d6"},
          {emoji:"📦",title:"Склад и товары",desc:"Полный складской учёт: остатки, поставки, списания, инвентаризация и поставщики.",color:"#e8f0ff"},
          {emoji:"👷",title:"Зарплата и сотрудники",desc:"Автоматический расчёт зарплаты, табель, бонусы, штрафы. Ведите штатное расписание.",color:"#f0fdf4"},
        ].map((c,i)=>(
          <div key={i} style={{
            border:"1px solid rgba(0,0,0,.08)",borderRadius:20,padding:28,
            background:"#fff",display:"flex",flexDirection:"column",gap:12,
            transition:"all .2s",cursor:"default",
            animation:`fadeUp .5s ${i*0.1}s ease both`,
          }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#000";e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,.08)"}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,0,0,.08)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none"}}>
            <div style={{width:48,height:48,borderRadius:14,background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{c.emoji}</div>
            <div style={{fontSize:17,fontWeight:700}}>{c.title}</div>
            <div style={{fontSize:13,color:"rgba(0,0,0,.54)",lineHeight:1.5}}>{c.desc}</div>
            <div style={{fontSize:12,fontWeight:600,color:"rgba(0,0,0,.34)",marginTop:"auto",display:"flex",alignItems:"center",gap:4}}>Подробнее →</div>
          </div>
        ))}
      </section>
      {/* Блок соцдоказательства */}
      <section style={{maxWidth:1104,margin:"60px auto",padding:"0 24px"}}>
        <div style={{background:"#000",borderRadius:20,padding:"40px 32px",textAlign:"center",color:"#fff"}}>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>Готовы начать?</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.6)",marginBottom:24,maxWidth:400,margin:"0 auto 24px"}}>
            Зарегистрируйтесь за 1 минуту и начните управлять финансами вашего бизнеса
          </p>
          <button onClick={()=>n('/login')} style={{padding:"12px 32px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Создать аккаунт</button>
        </div>
      </section>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <footer style={{borderTop:"1px solid rgba(0,0,0,.08)",padding:"20px 24px",maxWidth:1104,margin:"20px auto 0",display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(0,0,0,.34)"}}>
        <span>© 2026 Finance</span>
        <a onClick={()=>n(-1)} style={{cursor:"pointer",textDecoration:"underline",color:"inherit"}}>Назад</a>
      </footer>
    </div>
  );
}
