import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';

export default function Landing() {
  const n = useNavigate();
  const { user } = useAuth();
  useEffect(() => { if (user) n('/dashboard', { replace: true }); }, [user, n]);

  return (
    <div style={{fontFamily:"Inter,sans-serif",color:"#111",minHeight:"100vh",background:"linear-gradient(180deg, #fff 0%, #fafafa 100%)"}}>
      {/* ===== ХЕДЕР ===== */}
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",maxWidth:1104,margin:"0 auto"}}>
        <span style={{fontWeight:800,fontSize:18,letterSpacing:"-.03em",color:"#000"}}>FINANCE</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"1.5px solid #000",background:"transparent",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Войти</button>
          <button onClick={()=>n('/register')} style={{padding:"8px 20px",borderRadius:100,border:"none",background:"#000",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#fff"}}>Регистрация</button>
        </div>
      </header>

      {/* ===== HERO С ПРЕВЬЮ ДАШБОРДА ===== */}
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
            <button onClick={()=>n('/register')} style={{padding:"12px 28px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Зарегистрироваться</button>
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

      {/* ===== ПОЧЕМУ ВЫБИРАЮТ НАС (из варианта 5) ===== */}
      <section style={{maxWidth:1104,margin:"80px auto",padding:"0 24px",display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:20,alignItems:"start"}}>
        {[
          {num:"01",title:"Простота",desc:"Интерфейс понятен без обучения. Всё интуитивно."},
          {num:"02",title:"Надёжность",desc:"Данные хранятся в Supabase — современная защита."},
          {num:"03",title:"Экономия",desc:"Заменяет 3-4 сервиса. Платите в разы меньше."},
          {num:"04",title:"Поддержка",desc:"Отвечаем быстро, помогаем с настройкой."},
        ].map((f,i)=>(
          <div key={i} style={{display:"flex",gap:16,padding:"16px 0",borderTop:"1px solid rgba(0,0,0,.06)",alignItems:"flex-start"}}>
            <div style={{fontSize:36,fontWeight:800,color:"rgba(0,0,0,.06)",lineHeight:1,flexShrink:0,minWidth:50}}>{f.num}</div>
            <div>
              <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>{f.title}</div>
              <div style={{fontSize:14,color:"rgba(0,0,0,.54)",lineHeight:1.5}}>{f.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ===== ТАРИФЫ (из варианта 4) ===== */}
      <section style={{maxWidth:900,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:36,letterSpacing:"-.02em"}}>Тарифы</h2>
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
              <button onClick={()=>n('/register')} style={{
                width:"100%",padding:"10px",borderRadius:100,border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                background:t.popular?"#ffdd2d":"rgba(0,0,0,.06)",color:t.popular?"#000":"#111",
              }}>{t.price==="Бесплатно"?"Начать":"Подключить"}</button>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ГОТОВЫ НАЧАТЬ? (из варианта 3) ===== */}
      <section style={{maxWidth:1104,margin:"80px auto",padding:"0 24px"}}>
        <div style={{background:"#000",borderRadius:20,padding:"40px 32px",textAlign:"center",color:"#fff"}}>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>Готовы начать?</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.6)",marginBottom:24,maxWidth:400,margin:"0 auto 24px"}}>
            Зарегистрируйтесь за 1 минуту и начните управлять финансами вашего бизнеса
          </p>
          <button onClick={()=>n('/register')} style={{padding:"12px 32px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Создать аккаунт</button>
        </div>
      </section>

      {/* ===== ФУТЕР ===== */}
      <footer style={{borderTop:"1px solid rgba(0,0,0,.08)",padding:"20px 24px",maxWidth:1104,margin:"20px auto 0",display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(0,0,0,.34)"}}>
        <span>© 2026 Finance</span>
      </footer>
    </div>
  );
}
