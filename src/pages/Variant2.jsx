import { useNavigate } from 'react-router-dom';
export default function Variant2() {
  const n = useNavigate();
  return (
    <div style={{fontFamily:"Inter,sans-serif",color:"#111",minHeight:"100vh",background:"linear-gradient(180deg, #fff 0%, #fafafa 100%)"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",maxWidth:1104,margin:"0 auto"}}>
        <span style={{fontWeight:800,fontSize:18,letterSpacing:"-.03em",color:"#000"}}>FINANCE</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"1.5px solid #000",background:"transparent",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Войти</button>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"none",background:"#000",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#fff"}}>Регистрация</button>
        </div>
      </header>
      <section style={{maxWidth:1104,margin:"0 auto",padding:"40px 24px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,alignItems:"center"}}>
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:100,background:"#000",fontSize:11,fontWeight:600,color:"#ffdd2d",marginBottom:16}}>
            ⚡ Новый релиз
          </div>
          <h1 style={{fontSize:"clamp(32px,5vw,48px)",fontWeight:800,letterSpacing:"-.03em",lineHeight:1.1,marginBottom:16}}>
            Управляйте бизнесом<br/>с умом
          </h1>
          <p style={{fontSize:16,color:"rgba(0,0,0,.54)",lineHeight:1.5,marginBottom:28}}>
            Единая платформа для учёта доходов, расходов, склада, зарплаты и клиентов. Без сложных настроек и лишних кнопок.
          </p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>n('/login')} style={{padding:"12px 28px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Зарегистрироваться</button>
            <button onClick={()=>n('/login')} style={{padding:"12px 28px",borderRadius:100,border:"1.5px solid rgba(0,0,0,.12)",background:"transparent",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#111"}}>Войти</button>
          </div>
        </div>
        <div>
          <div style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:20,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,.06)"}}>
            <div style={{background:"#000",padding:"8px 14px",display:"flex",gap:6,alignItems:"center"}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:"#ff6052"}}/>
              <span style={{width:8,height:8,borderRadius:"50%",background:"#ffbd2e"}}/>
              <span style={{width:8,height:8,borderRadius:"50%",background:"#28c93f"}}/>
            </div>
            <div style={{padding:20,background:"#fff",fontSize:13,lineHeight:1.6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <span style={{fontWeight:700}}>Панель управления</span>
                <span style={{color:"rgba(0,0,0,.34)"}}>сегодня</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <div style={{background:"#f9f9f9",borderRadius:10,padding:10}}>
                  <div style={{fontSize:10,color:"rgba(0,0,0,.54)",marginBottom:2}}>Доходы</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#16a34a"}}>+284 000 ₽</div>
                </div>
                <div style={{background:"#f9f9f9",borderRadius:10,padding:10}}>
                  <div style={{fontSize:10,color:"rgba(0,0,0,.54)",marginBottom:2}}>Расходы</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#dc2626"}}>−123 000 ₽</div>
                </div>
                <div style={{background:"#ffdd2d",borderRadius:10,padding:10}}>
                  <div style={{fontSize:10,color:"rgba(0,0,0,.54)",marginBottom:2}}>Итого</div>
                  <div style={{fontSize:14,fontWeight:800}}>+161 000 ₽</div>
                </div>
              </div>
              <div style={{fontSize:11,color:"rgba(0,0,0,.34)",marginBottom:6}}>ПОСЛЕДНИЕ ОПЕРАЦИИ</div>
              {[["Продажа скутера","+72 000","#16a34a"],["Запчасти","−8 500","#dc2626"],["Аренда","+15 000","#16a34a"]].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"1px solid #f0f0f0"}}>
                  <span style={{fontWeight:500}}>{r[0]}</span>
                  <span style={{fontWeight:600,color:r[2]}}>{r[1]} ₽</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section style={{maxWidth:1104,margin:"60px auto",padding:"0 24px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
        {[["📊","Реальные цифры","Все доходы и расходы в одном месте с детализацией","#fff8d6"],["🎯","Простой учёт","Интуитивный интерфейс без сложных настроек","#e8f0ff"],["🔒","Безопасно","Данные защищены, авторизация по email","#f0fdf4"]].map((f,i)=>(
          <div key={i} style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:16,padding:24,background:f[3],textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>{f[0]}</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{f[1]}</div>
            <div style={{fontSize:13,color:"rgba(0,0,0,.54)"}}>{f[2]}</div>
          </div>
        ))}
      </section>
      <footer style={{borderTop:"1px solid rgba(0,0,0,.08)",padding:"20px 24px",maxWidth:1104,margin:"60px auto 0",display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(0,0,0,.34)"}}>
        <span>© 2026 Finance</span>
        <a onClick={()=>n(-1)} style={{cursor:"pointer",textDecoration:"underline",color:"inherit"}}>Назад</a>
      </footer>
    </div>
  );
}
