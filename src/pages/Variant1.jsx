import { useNavigate } from 'react-router-dom';
export default function Variant1() {
  const n = useNavigate();
  return (
    <div style={{fontFamily:"Inter,sans-serif",color:"#111",minHeight:"100vh",overflow:"hidden"}}>
      {/* Хедер */}
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",maxWidth:1104,margin:"0 auto"}}>
        <span style={{fontWeight:800,fontSize:18,letterSpacing:"-.03em"}}>AltasPos</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"1.5px solid rgba(0,16,36,.12)",background:"transparent",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#111"}}>Войти</button>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Регистрация</button>
        </div>
      </header>
      {/* Hero с анимированным градиентным фоном */}
      <section style={{position:"relative",overflow:"hidden",textAlign:"center",padding:"80px 24px 60px"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg, #fff8d6 0%, #ffe082 50%, #ffdd2d 100%)",opacity:.15,animation:"none"}}/>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 30% 50%, #ffdd2d 0%, transparent 50%)",opacity:.08}}/>
        <div style={{position:"relative",zIndex:1,maxWidth:700,margin:"0 auto"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 14px",borderRadius:100,background:"#fff8d6",fontSize:12,fontWeight:600,color:"#92400e",marginBottom:16,border:"1px solid #ffe082"}}>
            <span>✨</span> Финансовый учёт нового поколения
          </div>
          <h1 style={{fontSize:"clamp(34px,6vw,56px)",fontWeight:800,letterSpacing:"-.03em",lineHeight:1.1,marginBottom:16}}>
            Вся финансовая<br/>картина бизнеса
          </h1>
          <p style={{fontSize:17,color:"rgba(0,0,0,.54)",lineHeight:1.5,maxWidth:480,margin:"0 auto 28px"}}>
            Доходы, расходы, склад, зарплата, клиенты — одна система вместо пяти.
          </p>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={()=>n('/login')} style={{padding:"14px 32px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Начать бесплатно</button>
            <button onClick={()=>n('/login')} style={{padding:"14px 32px",borderRadius:100,border:"1.5px solid rgba(0,16,36,.12)",background:"transparent",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#111"}}>Как это работает</button>
          </div>
        </div>
        {/* Анимированные "всплывающие" карточки */}
        <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:48,flexWrap:"wrap"}}>
          {[
            {label:"Доходы",val:"+2 847 000",color:"#16a34a"},
            {label:"Расходы",val:"−1 234 000",color:"#dc2626"},
            {label:"Прибыль",val:"+1 613 000",color:"#16a34a"},
          ].map((c,i)=>(
            <div key={i} style={{
              border:"1px solid rgba(0,16,36,.12)",borderRadius:16,padding:"20px 28px",
              background:"#fff",minWidth:180,textAlign:"left",
              animation:`slideUp .5s ${i*0.15}s ease both`,
            }}>
              <div style={{fontSize:12,color:"rgba(0,0,0,.54)",fontWeight:500,marginBottom:4}}>{c.label}</div>
              <div style={{fontSize:20,fontWeight:700,color:c.color}}>{c.val}</div>
            </div>
          ))}
        </div>
      </section>
      <style>{`
        @keyframes slideUp {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn {from{opacity:0}to{opacity:1}}
      `}</style>
      {/* Возможности */}
      <section style={{maxWidth:1104,margin:"60px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:36,letterSpacing:"-.02em"}}>Всё, что нужно для управления</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",gap:16}}>
          {[
            ["📊","Аналитика","Реальные отчёты о прибыли, убытках и оборотах с возможностью детализации"],
            ["📦","Склад","Учёт товаров, постаки, списания, инвентаризация и наценки"],
            ["👥","Клиенты","База клиентов, программы лояльности и автоматические акции"],
            ["👷","Сотрудники","Расчёт зарплаты, табель, бонусы и штрафы"],
            ["💰","Касса","Операции, смены, пробитие чеков — полный кассовый учёт"],
            ["📱","Всё в одном","Единое окно для всех бизнес-процессов компании"],
          ].map((f,i)=>(
            <div key={i} style={{border:"1px solid rgba(0,16,36,.12)",borderRadius:16,padding:24,transition:"all .2s",animation:`slideUp .5s ${i*0.08+.3}s ease both`}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#ffdd2d";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,.06)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,16,36,.12)";e.currentTarget.style.boxShadow="none"}}>
              <div style={{fontSize:24,marginBottom:8}}>{f[0]}</div>
              <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{f[1]}</div>
              <div style={{fontSize:13,color:"rgba(0,0,0,.54)",lineHeight:"1.45"}}>{f[2]}</div>
            </div>
          ))}
        </div>
      </section>
      <footer style={{borderTop:"1px solid rgba(0,16,36,.12)",padding:"20px 24px",maxWidth:1104,margin:"60px auto 0",display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(0,0,0,.34)"}}>
        <span>© 2026 AltasPos</span>
        <span style={{display:"flex",gap:16}}>
          <a onClick={()=>n(-1)} style={{cursor:"pointer",textDecoration:"underline",color:"inherit"}}>Назад</a>
        </span>
      </footer>
    </div>
  );
}
