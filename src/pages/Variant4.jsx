import { useNavigate } from 'react-router-dom';
export default function Variant4() {
  const n = useNavigate();
  return (
    <div style={{fontFamily:"Inter,sans-serif",color:"#111",minHeight:"100vh",background:"#fafafa"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",maxWidth:1104,margin:"0 auto"}}>
        <span style={{fontWeight:800,fontSize:18,letterSpacing:"-.03em"}}>FINANCE</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"none",background:"#000",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#fff"}}>Войти</button>
        </div>
      </header>
      <section style={{maxWidth:1104,margin:"0 auto",padding:"60px 24px",textAlign:"center"}}>
        <h1 style={{fontSize:"clamp(28px,4.5vw,42px)",fontWeight:800,letterSpacing:"-.03em",lineHeight:1.15,marginBottom:12}}>
          Бухгалтерия, склад и зарплата<br/>в одной экосистеме
        </h1>
        <p style={{fontSize:16,color:"rgba(0,0,0,.54)",maxWidth:500,margin:"0 auto 28px"}}>
          Более 100 компаний уже используют FINANCE для учёта своего бизнеса
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button onClick={()=>n('/login')} style={{padding:"12px 28px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Попробовать бесплатно</button>
          <button onClick={()=>n('/login')} style={{padding:"12px 28px",borderRadius:100,border:"1.5px solid #000",background:"transparent",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Узнать больше</button>
        </div>
      </section>
      {/* Сетка с тарифами */}
      <section style={{maxWidth:1104,margin:"0 auto 60px",padding:"0 24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {[
            {name:"Базовый",price:"Бесплатно",desc:"Для одного пользователя",features:["Учёт доходов/расходов","База клиентов","Базовая аналитика"],popular:false},
            {name:"Бизнес",price:"2 900 ₽",desc:"Для команды до 5 человек",features:["Всё из Базового","Складской учёт","Зарплата и табель","5 пользователей"],popular:true},
            {name:"Профи",price:"6 900 ₽",desc:"Без ограничений",features:["Всё из Бизнес","Неограниченно пользователей","API","Поддержка 24/7"],popular:false},
          ].map((t,i)=>(
            <div key={i} style={{
              border:`1.5px solid ${t.popular?"#ffdd2d":"rgba(0,0,0,.08)"}`,
              borderRadius:20,padding:28,background:t.popular?"#fff":"#fff",
              position:"relative",boxShadow:t.popular?"0 8px 24px rgba(0,0,0,.06)":"none",
            }}>
              {t.popular && <div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",padding:"3px 14px",borderRadius:100,background:"#ffdd2d",fontSize:10,fontWeight:700,color:"#000"}}>Популярный</div>}
              <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>{t.name}</div>
              <div style={{fontSize:24,fontWeight:800,marginBottom:4}}>{t.price}</div>
              <div style={{fontSize:12,color:"rgba(0,0,0,.54)",marginBottom:16}}>{t.desc}</div>
              <div style={{borderTop:"1px solid rgba(0,0,0,.06)",paddingTop:16,marginBottom:20}}>
                {t.features.map((f,j)=>(
                  <div key={j} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:13}}>
                    <span style={{color:"#16a34a",fontWeight:700}}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button onClick={()=>n('/login')} style={{
                width:"100%",padding:"10px",borderRadius:100,border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                background:t.popular?"#ffdd2d":"rgba(0,0,0,.06)",color:t.popular?"#000":"#111",
              }}>{t.price==="Бесплатно"?"Начать":"Подключить"}</button>
            </div>
          ))}
        </div>
      </section>
      <footer style={{borderTop:"1px solid rgba(0,0,0,.08)",padding:"20px 24px",maxWidth:1104,margin:"0 auto",display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(0,0,0,.34)"}}>
        <span>© 2026 Finance</span>
        <a onClick={()=>n(-1)} style={{cursor:"pointer",textDecoration:"underline",color:"inherit"}}>Назад</a>
      </footer>
    </div>
  );
}
