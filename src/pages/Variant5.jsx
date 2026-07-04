import { useNavigate } from 'react-router-dom';
export default function Variant5() {
  const n = useNavigate();
  return (
    <div style={{fontFamily:"Inter,sans-serif",color:"#111",minHeight:"100vh"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",maxWidth:1104,margin:"0 auto"}}>
        <span style={{fontWeight:800,fontSize:18,letterSpacing:"-.03em",background:"#ffdd2d",padding:"4px 12px",borderRadius:8}}>AltasPos</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"1.5px solid rgba(0,16,36,.12)",background:"transparent",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#111"}}>Войти</button>
        </div>
      </header>
      <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",maxWidth:1104,margin:"40px auto",padding:"0 24px",gap:48,alignItems:"center",minHeight:"60vh"}}>
        <div>
          <h1 style={{fontSize:"clamp(30px,5vw,44px)",fontWeight:800,letterSpacing:"-.03em",lineHeight:1.15,marginBottom:12}}>
            Весь бизнес<br/>в цифрах
          </h1>
          <p style={{fontSize:15,color:"rgba(0,0,0,.54)",lineHeight:1.5,marginBottom:28}}>
            AltasPos — это не просто учёт. Это единое окно, где сходятся финансы, склад, клиенты и команда.
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {icon:"✓",text:"Доходы и расходы с детализацией"},
              {icon:"✓",text:"Складские остатки в реальном времени"},
              {icon:"✓",text:"Автоматический расчёт зарплаты"},
              {icon:"✓",text:"Клиентская база с лояльностью"},
            ].map((f,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:14}}>
                <span style={{width:20,height:20,borderRadius:"50%",background:"#ffdd2d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>
          <button onClick={()=>n('/login')} style={{marginTop:28,padding:"12px 32px",borderRadius:100,border:"none",background:"#000",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#fff",display:"inline-flex",alignItems:"center",gap:6}}>
            Начать бесплатно <span style={{fontSize:16}}>→</span>
          </button>
        </div>
        <div style={{
          border:"1px solid rgba(0,0,0,.08)",borderRadius:20,padding:28,
          background:"linear-gradient(135deg, #fff 0%, #fafafa 100%)",
          display:"flex",flexDirection:"column",gap:16,
          boxShadow:"0 4px 16px rgba(0,0,0,.04)",
        }}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>Почему выбирают нас</h3>
          {[
            {num:"01",title:"Простота",desc:"Интерфейс понятен без обучения. Всё интуитивно."},
            {num:"02",title:"Надёжность",desc:"Данные хранятся в Supabase — современная защита."},
            {num:"03",title:"Экономия",desc:"Заменяет 3-4 сервиса. Платите в разы меньше."},
            {num:"04",title:"Поддержка",desc:"Отвечаем быстро, помогаем с настройкой."},
          ].map((f,i)=>(
            <div key={i} style={{display:"flex",gap:14,padding:"12px 0",borderTop:"1px solid rgba(0,0,0,.06)"}}>
              <div style={{fontSize:24,fontWeight:800,color:"rgba(0,0,0,.08)",lineHeight:1}}>{f.num}</div>
              <div>
                <div style={{fontSize:14,fontWeight:600,marginBottom:2}}>{f.title}</div>
                <div style={{fontSize:12,color:"rgba(0,0,0,.54)"}}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <footer style={{borderTop:"1px solid rgba(0,0,0,.08)",padding:"20px 24px",maxWidth:1104,margin:"0 auto",display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(0,0,0,.34)"}}>
        <span>© 2026 AltasPos</span>
        <a onClick={()=>n(-1)} style={{cursor:"pointer",textDecoration:"underline",color:"inherit"}}>Назад</a>
      </footer>
    </div>
  );
}
