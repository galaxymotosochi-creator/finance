import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Landing() {
  const n = useNavigate();
  const { user } = useAuth();
  useEffect(() => { if (user) n('/dashboard', { replace: true }); }, [user, n]);

    const [period, setPeriod] = useState("1m");

  // Prices for each period
  const periodPrices = {
    "1m": [490, 990, 2900, 6900],
    "3m": [440, 890, 2600, 6200],
    "6m": [390, 790, 2300, 5500],
    "1y": [340, 690, 1990, 4800],
  };
  const periodSavings = {
    "3m": [150, 300, 900, 2100],
    "6m": [600, 1200, 3600, 8400],
    "1y": [1800, 3600, 10920, 25200],
  };
  const periodLabels = {
    "1m": "1 месяц",
    "3m": "3 месяца",
    "6m": "6 месяцев",
    "1y": "1 год",
  };

  const periodMultiplier = {
    "1m": 1,
    "3m": 3,
    "6m": 6,
    "1y": 12,
  };
  const FaqItem = ({question,answer}) => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:12,overflow:"hidden"}}>
        <div onClick={()=>setOpen(!open)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",cursor:"pointer",fontSize:14,fontWeight:600,userSelect:"none",transition:"background .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="#fafafa"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <span>{question}</span>
          <span style={{fontSize:12,color:"rgba(0,0,0,.34)",transition:"transform .2s",transform:open?"rotate(180deg)":"rotate(0)"}}>▼</span>
        </div>
        {open && <div style={{padding:"0 16px 14px",fontSize:13,color:"rgba(0,0,0,.54)",lineHeight:1.5}}>{answer}</div>}
      </div>
    );
  };

  
  const AIIcon = ({type}) => {
    const svgs = {
      chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.8"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
      search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      trend: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
      bulb: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.8"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 008.91 14"/></svg>',
      help: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      refresh: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.8"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
    };
    return <span dangerouslySetInnerHTML={{__html: svgs[type]}} style={{display:"inline-flex"}} />;
  };

  const CompareItem = ({type,text}) => {
    const isGood = type === 'good';
    const bg = isGood ? '#f0fdf4' : '#fef2f2';
    const color = isGood ? '#16a34a' : '#dc2626';
    // Split text at first colon — bold the label
    const colonIdx = text.indexOf(':');
    const label = colonIdx > -1 ? text.slice(0, colonIdx + 1) : '';
    const rest = colonIdx > -1 ? text.slice(colonIdx + 1) : text;
    return (
      <div style={{display:"flex",gap:10,alignItems:"flex-start",fontSize:12,lineHeight:1.45,color:"rgba(0,0,0,.65)"}}>
        <span style={{flexShrink:0,width:18,height:18,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>
          {isGood ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </span>
        <span><span style={{fontWeight:700}}>{label}</span>{rest}</span>
      </div>
    );
  };

  const MiniAppWindow = ({title, children}) => (
    <div style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.04)",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#000",padding:"5px 10px",display:"flex",gap:5,alignItems:"center"}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:"#ff6052"}}/>
        <span style={{width:6,height:6,borderRadius:"50%",background:"#ffbd2e"}}/>
        <span style={{width:6,height:6,borderRadius:"50%",background:"#28c93f"}}/>
        <span style={{fontSize:9,fontWeight:600,color:"rgba(255,255,255,.6)",marginLeft:6}}>{title}</span>
      </div>
      <div style={{padding:10,background:"#fff",fontSize:11,lineHeight:1.5,flex:1}}>
        {children}
      </div>
    </div>
  );
  const MiniStat = ({label,value,color,bg}) => (
    <div style={{background:bg||"#f9f9f9",borderRadius:6,padding:"4px 4px",textAlign:"center"}}>
      <div style={{fontSize:9,color:"rgba(0,0,0,.54)",marginBottom:1}}>{label}</div>
      <div style={{fontSize:11,fontWeight:700,color:color||"#111",whiteSpace:"nowrap"}}>{value}</div>
    </div>
  );
  const MiniLabel = ({text}) => (
    <div style={{fontSize:9,color:"rgba(0,0,0,.34)",marginBottom:4}}>{text}</div>
  );
  const MiniRow = ({label,value,color}) => (
    <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderTop:"1px solid #f0f0f0"}}>
      <span style={{fontWeight:500,fontSize:10}}>{label}</span>
      <span style={{fontWeight:600,color:color||"#111",fontSize:10}}>{value}</span>
    </div>
  );

  return (
    <div style={{fontFamily:"Inter,sans-serif",color:"#111",minHeight:"100vh",display:"block",width:"100%",background:"linear-gradient(180deg, #fff 0%, #fafafa 100%)"}}>
      {/* ===== ХЕДЕР ===== */}
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",maxWidth:1280,margin:"0 auto"}}>
        <span style={{fontWeight:800,fontSize:18,letterSpacing:"-.03em",color:"#000"}}>AtlasPos</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"1.5px solid #000",background:"transparent",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Войти</button>
        </div>
      </header>

      {/* ===== HERO С ПРЕВЬЮ ДАШБОРДА ===== */}
      <section style={{maxWidth:1280,margin:"0 auto",padding:"40px 24px",display:"grid",gridTemplateColumns:"1fr 1.3fr",gap:40,alignItems:"center"}}>
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 16px",borderRadius:100,background:"#000",fontSize:13,fontWeight:700,color:"#ffdd2d",marginBottom:20}}>
            Первая программа с AI аналитикой
          </div>
          <h1 style={{fontSize:"clamp(31px,5vw,47px)",fontWeight:800,letterSpacing:"-.03em",lineHeight:1.1,marginBottom:16}}>
            Учёт бизнеса без рутины
          </h1>
          <p style={{fontSize:15,color:"rgba(0,0,0,.54)",lineHeight:1.55,marginBottom:28}}>
            Умный учёт для современного бизнеса. Объедините кассу, склад, финансы, команду и маркетинг в единый автоматизированный контур. AI-аналитика избавит от таблиц и покажет реальные точки роста вашей прибыли.
          </p>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
            <button onClick={()=>n('/register')} style={{padding:"12px 32px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>Начать бесплатно</button>
            <span onClick={()=>n('/variant/1')} style={{fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit",color:"rgba(0,0,0,.4)",display:"inline-flex",alignItems:"center",gap:6,padding:"4px 0",border:"none",background:"transparent",transition:"color .15s"}}
              onMouseEnter={e=>e.currentTarget.style.color="#000"}
              onMouseLeave={e=>e.currentTarget.style.color="rgba(0,0,0,.4)"}>Посмотреть демо-версию <span style={{fontSize:16,transition:"transform .15s"}}>→</span></span>
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
              {[["Продажа скутера","+72 000 ₽","#16a34a"],["Запчасти","−8 500 ₽","#dc2626"],["Аренда","+15 000 ₽","#16a34a"]].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"1px solid #f0f0f0"}}>
                  <span style={{fontWeight:500}}>{r[0]}</span>
                  <span style={{fontWeight:600,color:r[2]}}>{r[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== ПОЧЕМУ ВЫБИРАЮТ НАС (из варианта 5) ===== */}
      <section style={{maxWidth:1280,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:"-.02em"}}>Порядок в учёте с первых минут</h2>
        <p style={{fontSize:15,color:"rgba(0,0,0,.54)",textAlign:"center",marginBottom:36}}>Четыре причины автоматизировать учёт в AtlasPos</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:20,alignItems:"stretch"}}>
        {[
          {num:"01",title:"Простота",desc:"Интерфейс понятен без обучения с первых секунд. Начните работу сразу, без долгого внедрения и инструкций."},
          {num:"02",title:"Надёжность",desc:"Безопасное облачное хранение данных с автоматическим резервным копированием. Полная защита вашей коммерческой тайны."},
          {num:"03",title:"Выгода",desc:"Заменяет кассовый софт, складской учёт и CRM-систему. Вы получаете всё в одной вкладке и не переплачиваете за разные сервисы."},
          {num:"04",title:"Забота и помощь",desc:"Бесплатно перенесём ваши текущие базы данных и таблицы Excel в систему. Живая поддержка поможет настроить процессы под ваш бизнес."},
        ].map((f,i)=>(
          <div key={i} style={{display:"flex",gap:16,padding:20,border:"1px solid rgba(0,0,0,.08)",borderRadius:14,alignItems:"flex-start",transition:"all .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#ffdd2d";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.04)"}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,0,0,.08)";e.currentTarget.style.boxShadow="none"}}>
            <div style={{fontSize:36,fontWeight:800,color:"rgba(0,0,0,.06)",lineHeight:1,flexShrink:0,minWidth:50}}>{f.num}</div>
            <div style={{display:"flex",flexDirection:"column",justifyContent:"center",flex:1}}>
              <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>{f.title}</div>
              <div style={{fontSize:14,color:"rgba(0,0,0,.54)",lineHeight:1.5}}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div></section>

      {/* ===== ПРЕВЬЮ ИНТЕРФЕЙСА (6 возможностей) ===== */}
      <section style={{maxWidth:1280,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:"-.02em"}}>Внутри AtlasPos: от кассы до чистой прибыли</h2>
        <p style={{fontSize:14,color:"rgba(0,0,0,.54)",textAlign:"center",maxWidth:560,margin:"0 auto 36px"}}>Реальные скриншоты интерфейса — всё работает так, как вы видите</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,alignItems:"stretch"}}>
          {/* Панель управления */}
          <MiniAppWindow title="Панель управления">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>
              <MiniStat label="Доходы" value="+284 000 ₽" color="#16a34a" />
              <MiniStat label="Расходы" value="−123 000 ₽" color="#dc2626" />
              <MiniStat label="Итого" value="+161 000 ₽" color="#000" bg="#ffdd2d" />
            </div>
            <MiniLabel text="ПОСЛЕДНИЕ ОПЕРАЦИИ" />
            {[["Продажа скутера","+72 000 ₽","#16a34a"],["Запчасти","−8 500 ₽","#dc2626"],["Аренда","+15 000 ₽","#16a34a"]].map((r,i)=>(
              <MiniRow key={i} label={r[0]} value={r[1]} color={r[2]} />
            ))}
          </MiniAppWindow>
          {/* Склад */}
          <MiniAppWindow title="Склад и товары">
            <MiniLabel text="ОСТАТКИ" />
            {[["Скутер Tank Next","5 шт","#111"],["Масло моторное","12 шт","#111"],["Тормозные колодки","3 шт","#dc2626"],["Аккумулятор","8 шт","#111"]].map((r,i)=>(
              <MiniRow key={i} label={r[0]} value={r[1]} color={r[2]} />
            ))}
          </MiniAppWindow>
          {/* Клиенты */}
          <MiniAppWindow title="Клиентская база">
            <MiniLabel text="ПОСЛЕДНИЕ КЛИЕНТЫ" />
            {[["Иван Петров","+7 918 123-45-67"],["Анна Смирнова","+7 988 765-43-21"],["Сергей Иванов","+7 962 555-33-22"]].map((r,i)=>(
              <MiniRow key={i} label={r[0]} value={r[1]} color="rgba(0,0,0,.54)" />
            ))}
          </MiniAppWindow>
          {/* Сотрудники */}
          <MiniAppWindow title="Сотрудники и зарплата">
            <MiniLabel text="ТАБЕЛЬ" />
            {[["Алексей М.","160 ч / 45 000 ₽"],["Мария К.","152 ч / 38 000 ₽"],["Дмитрий С.","168 ч / 52 000 ₽"]].map((r,i)=>(
              <MiniRow key={i} label={r[0]} value={r[1]} color="rgba(0,0,0,.54)" />
            ))}
          </MiniAppWindow>
          {/* Финансы */}
          <MiniAppWindow title="Движение денег">
            <MiniLabel text="ДОХОДЫ / РАСХОДЫ" />
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <div style={{flex:1,background:"#f0fdf4",borderRadius:6,padding:6,textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(0,0,0,.54)"}}>Приход</div>
                <div style={{fontSize:11,fontWeight:700,color:"#16a34a"}}>284K ₽</div>
              </div>
              <div style={{flex:1,background:"#fef2f2",borderRadius:6,padding:6,textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(0,0,0,.54)"}}>Расход</div>
                <div style={{fontSize:11,fontWeight:700,color:"#dc2626"}}>123K ₽</div>
              </div>
            </div>
            <MiniLabel text="P&amp;L" />
            <div style={{fontSize:11,fontWeight:700,color:"#16a34a",textAlign:"center",padding:"4px 0",background:"#f9f9f9",borderRadius:6}}>+161 000 ₽ прибыль</div>
          </MiniAppWindow>
          {/* Касса */}
          <MiniAppWindow title="Кассовые смены">
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:9,color:"rgba(0,0,0,.54)"}}>Смена #245</span>
              <span style={{fontSize:9,fontWeight:600,color:"#16a34a"}}>открыта</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <div style={{flex:1,background:"#f9f9f9",borderRadius:6,padding:6,textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(0,0,0,.54)"}}>Наличные</div>
                <div style={{fontSize:10,fontWeight:600}}>34 500 ₽</div>
              </div>
              <div style={{flex:1,background:"#f9f9f9",borderRadius:6,padding:6,textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(0,0,0,.54)"}}>Безнал</div>
                <div style={{fontSize:10,fontWeight:600}}>128 000 ₽</div>
              </div>
            </div>
          </MiniAppWindow>
        </div>
      </section>

      {/* ===== КОНТРАСТ СИСТЕМ ===== */}
      <section style={{maxWidth:1280,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:"-.02em"}}>Забудьте о сложных настройках других программ и путанице в Excel</h2>
        <p style={{fontSize:15,color:"rgba(0,0,0,.54)",textAlign:"center",marginBottom:40}}>Сравните, как работают привычные методы и наша умная платформа</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20,alignItems:"start"}}>
          {/* Карточка 1 — ERP */}
          <div style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:16,padding:24,background:"#fafafa"}}>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:16,color:"#555"}}>Тяжёлые программы<br/>(1С и аналоги)</h3>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <CompareItem type="bad" text="Сложное внедрение: требуются недели обучения персонала и платные услуги программистов для любой настройки." />
              <CompareItem type="bad" text="Перегруженный интерфейс: сотни скрытых меню, вкладок и кнопок, в которых постоянно путаются сотрудники." />
              <CompareItem type="bad" text="Высокая стоимость: дорогие лицензии, привязка к серверам и постоянная плата за каждое мелкое обновление." />
            </div>
          </div>
          {/* Карточка 2 — Excel */}
          <div style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:16,padding:24,background:"#fafafa"}}>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:16,color:"#555"}}>Таблицы и блокноты<br/>(Excel / Sheets)</h3>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <CompareItem type="bad" text="Хаос в данных: формулы постоянно ломаются от случайного клика, а текущая касса не бьётся с реальными остатками на складе." />
              <CompareItem type="bad" text="Человеческий фактор: сотрудники регулярно забывают вовремя вносить продажи, путают позиции товара или теряют чеки." />
              <CompareItem type="bad" text="Нулевая аналитика: вы не видите чистую, очищенную от расходов прибыль за месяц и постоянно ловите кассовые разрывы." />
            </div>
          </div>
          {/* Карточка 3 — AtlasPos */}
          <div style={{border:"2px solid #ffdd2d",borderRadius:16,padding:"24px 28px 28px",background:"#fff",boxShadow:"0 8px 24px rgba(0,0,0,.08)",position:"relative",top:-4}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:100,background:"#ffdd2d",fontSize:10,fontWeight:700,color:"#000",marginBottom:12}}>Рекомендуем</div>
            <h3 style={{fontSize:17,fontWeight:800,marginBottom:16}}>Умная платформа AtlasPos</h3>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
              <CompareItem type="good" text="Старт за 15 минут: интуитивно понятный и чистый интерфейс, в котором можно работать сразу без долгих инструкций." />
              <CompareItem type="good" text="Всё в одной вкладке: живая касса, складской учёт, база клиентов и финансы команды работают в единой связке." />
              <CompareItem type="good" text="Автоматический AI-анализ: система сама собирает P&L, рассчитывает зарплаты, видит прибыль и предупреждает о рисках." />
            </div>
            <button onClick={()=>n('/register')} style={{width:"100%",padding:"10px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000",transition:"all .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#f5d100"}
              onMouseLeave={e=>e.currentTarget.style.background="#ffdd2d"}>Попробовать бесплатно</button>
          </div>
        </div>
      </section>
      <section style={{maxWidth:900,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
        <h2 style={{fontSize:26,fontWeight:700,marginBottom:8,letterSpacing:"-.02em"}}>Для какого бизнеса создана платформа?</h2>
        <p style={{fontSize:15,color:"rgba(0,0,0,.54)",marginBottom:36,maxWidth:560,margin:"0 auto 36px"}}>AtlasPos адаптируется под ваши задачи, вне зависимости от масштаба и направления компании</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {[
            {
              svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
              title:"Товарный бизнес и ритейл",
              desc:"Умный учёт остатков на складе, контроль поставщиков, инвентаризация и автоматический расчёт маржинальности товаров."
            },
            {
              svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
              title:"Услуги, сервис и аренда",
              desc:"Контроль кассовых смен, ведение клиентской базы (CRM), учёт загрузки мастеров и прозрачный расчёт сдельной зарплаты команды."
            },
            {
              svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
              title:"Смешанный и проектный бизнес",
              desc:"Идеально, если вы одновременно продаёте товары, оказываете услуги и сдаёте оборудование в прокат. Система объединит все направления в один P&L отчёт."
            },
          ].map((t,i)=>(
            <div key={i} style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:16,padding:24,transition:"all .2s",textAlign:"center"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#ffdd2d";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,.06)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,0,0,.08)";e.currentTarget.style.boxShadow="none"}}>
              <div style={{width:52,height:52,borderRadius:14,background:"#fff8d6",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}} dangerouslySetInnerHTML={{__html:t.svg}} />
              <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{t.title}</div>
              <div style={{fontSize:13,color:"rgba(0,0,0,.54)",lineHeight:1.45}}>{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== AI-ПОМОЩНИК ===== */}
      <section style={{maxWidth:1280,margin:"80px auto",padding:"0 24px"}}>
        <div style={{background:"#000",borderRadius:24,padding:"48px 40px",color:"#fff"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:100,background:"rgba(255,255,255,.1)",fontSize:12,fontWeight:600,color:"rgba(255,255,255,.8)",marginBottom:16}}>
            AI-аналитика
          </div>
          <h2 style={{fontSize:"clamp(24px,3.5vw,32px)",fontWeight:700,letterSpacing:"-.02em",marginBottom:8}}>
            AI-помощник<br/>для вашего бизнеса
          </h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.6)",lineHeight:1.5,marginBottom:40,maxWidth:500}}>
            AI-помощник анализирует данные, находит закономерности и подсказывает, как увеличить прибыль. Просто задайте вопрос.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,alignItems:"stretch"}}>
            {[
              {icon:"chart",title:"Анализ прибыли",desc:
                "Автоматически считает P&L, показывает, какие товары приносят больше всего денег, а какие съедают маржу."},
              {icon:"search",title:"Поиск аномалий",desc:
                "Замечает необычные расходы, резкие скачки продаж или подозрительные операции и сразу сообщает."},
              {icon:"trend",title:"Прогноз кассы",desc:
                "Предсказывает остаток денег на конец месяца на основе истории доходов и расходов."},
              {icon:"bulb",title:"Рекомендации",desc:
                "Подсказывает, какие товары пора дозаказать, на что поднять цену, а что уценить."},
              {icon:"help",title:"Ответы на вопросы",desc:
                "Спросите «Сколько заработали в марте?» или «Какой сотрудник принёс больше всего прибыли?»."},
              {icon:"refresh",title:"Автокатегоризация",desc:
                "Сама распределяет операции по категориям — не нужно вручную разносить каждую трату."},
            ].map((f,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,.06)",borderRadius:14,padding:18,border:"1px solid rgba(255,255,255,.08)",display:"flex",flexDirection:"column"}}>
                <AIIcon type={f.icon} />
                <div style={{fontSize:14,fontWeight:600,margin:"8px 0 4px"}}>{f.title}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.5)",lineHeight:1.45,flex:1}}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section style={{maxWidth:700,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:"-.02em"}}>Остались вопросы? Отвечаем</h2>
        <p style={{fontSize:15,color:"rgba(0,0,0,.54)",textAlign:"center",marginBottom:36}}>Всё, что нужно знать о старте, безопасности и возможностях платформы AtlasPos</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[ 
            {q:"Сколько стоит AtlasPos?",a:"Мы гибко подходим к ценообразованию в зависимости от масштаба вашей компании. Есть прозрачные тарифы для небольших команд и крупных сетей, а начать можно абсолютно бесплатно."},
            {q:"Можно ли попробовать бесплатно?",a:"Да! Мы предоставляем полноценный тестовый доступ на 14 дней. Вам не нужно привязывать банковскую карту — просто зарегистрируйтесь за 1 минуту и сразу тестируйте все возможности системы."},
            {q:"Нужно ли устанавливать программу?",a:"Нет, ничего скачивать не нужно. AtlasPos — это облачная платформа. Вы можете работать из любого браузера на компьютере, планшете или смартфоне, а данные обновляются в реальном времени."},
            {q:"Мои данные в безопасности?",a:"Абсолютно. Мы используем передовые протоколы шифрования, регулярное резервное копирование и строгую систему разграничения прав доступа. Ваши показатели защищены надежнее, чем в Excel."},
            {q:"Можно ли добавить сотрудников?",a:"Да, вы можете подключать всю команду и гибко настраивать права доступа для каждого. Например, кладовщик будет видеть только склад, но не получит доступ к отчётам о чистой прибыли."},
          ].map((f,i)=>(
            <FaqItem key={i} question={f.q} answer={f.a} />
          ))}
        </div>
      </section>

      {/* ===== ТАРИФЫ ===== */}
      <section style={{maxWidth:1280,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:"-.02em"}}>Тарифы</h2>
        <p style={{fontSize:15,color:"rgba(0,0,0,.54)",textAlign:"center",marginBottom:24}}>Прозрачные цены для бизнеса любого масштаба</p>

        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:32}}>
          {["1m","3m","6m","1y"].map((key) => (
            <button key={key} onClick={()=>setPeriod(key)}
              style={{
                padding:"6px 18px",borderRadius:100,border:"1.5px solid",cursor:"pointer",
                fontFamily:"inherit",fontSize:12,fontWeight:600,transition:"all .15s",
                background:period===key?"#000":"transparent",
                color:period===key?"#fff":"rgba(0,0,0,.54)",
                borderColor:period===key?"#000":"rgba(0,0,0,.12)",
              }}
            >{periodLabels[key]}</button>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,alignItems:"stretch"}}>
          {[
            {name:"Базовый",price:490,desc:"Для самозанятых и микро-бизнеса",features:["Учёт доходов и расходов","База клиентов (CRM)","1 пользователь"],popular:false,btn:"Подключить"},
            {name:"Старт",price:990,desc:"Для малого бизнеса и сервисов",features:["Полный учёт кассы","Складской учёт и остатки","Автокатегоризация AI","До 2 пользователей"],popular:false,btn:"Подключить"},
            {name:"Бизнес",price:2900,desc:"Для компаний с командой",features:["Все функции тарифа «Старт»","Зарплата и табель сотрудников","Управление ролями и доступом","Безлимитный AI-помощник","До 5 пользователей"],popular:true,btn:"Подключить"},
            {name:"Профи",price:6900,desc:"Для сетей и крупных проектов",features:["Все функции тарифа «Бизнес»","Мульти-аккаунты (несколько точек)","Интеграции и доступ к API","ИИ-мониторинг аномалий","Безлимитные пользователи"],popular:false,btn:"Подключить"},
          ].map((t,i)=>{
            const basePrice = t.price;
            const currentPrice = periodPrices[period][i];
            const saving = period === '1m' ? 0 : periodSavings[period][i];
            const periodText = period === '1y' ? 'год' : period === '6m' ? '6 мес' : period === '3m' ? '3 мес' : 'мес';
            return (
            <div key={i} style={{
              border: t.popular ? "1.5px solid #ffdd2d" : "1.5px solid rgba(0,0,0,.08)",
              borderRadius:20,padding:"24px 14px",background:"#fff",
              position:"relative",boxShadow:t.popular?"0 8px 24px rgba(0,0,0,.08)":"none",
              display:"flex",flexDirection:"column",
            }}>
              {t.popular && <div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",padding:"3px 14px",borderRadius:100,background:"#ffdd2d",fontSize:10,fontWeight:700,color:"#000",whiteSpace:"nowrap"}}>Популярный</div>}
              <div style={{fontSize:15,fontWeight:700,marginBottom:2}}>{t.name}</div>
              <div style={{marginBottom:2}}>
                {period === '1m' ? (
                  <>
                    <span style={{fontSize:22,fontWeight:800}}>{basePrice.toLocaleString()} ₽</span>
                  </>
                ) : (
                  <>
                    <span style={{fontSize:15,fontWeight:600,color:"rgba(0,0,0,.2)",textDecoration:"line-through",textDecorationColor:"rgba(220,38,38,.4)",textDecorationThickness:2}}>
                      {basePrice.toLocaleString()} ₽
                    </span>
                    <span style={{fontSize:22,fontWeight:800,marginLeft:6}}>{currentPrice.toLocaleString()} ₽</span>
                  </>
                )}
              </div>
              {period !== '1m' && (
                <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"#f0fdf4",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,color:"#16a34a",marginBottom:6,width:"fit-content"}}>
                  Выгода {saving.toLocaleString()} ₽
                </div>
              )}
              <div style={{fontSize:11,color:"rgba(0,0,0,.54)",marginBottom:12,lineHeight:1.3}}>{t.desc}</div>
              <div style={{borderTop:"1px solid rgba(0,0,0,.06)",paddingTop:12,marginBottom:12,flex:1}}>
                {t.features.map((f,j)=>(
                  <div key={j} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"3px 0",fontSize:12}}>
                    <span style={{color:"#16a34a",fontWeight:700,flexShrink:0,marginTop:2}}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>n('/register')} style={{
                width:"100%",padding:"9px",borderRadius:100,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                background:t.popular?"#ffdd2d":"rgba(0,0,0,.06)",color:t.popular?"#000":"#111",
                transition:"all .15s",
              }}
                onMouseEnter={e=>{if(t.popular)e.currentTarget.style.background="#f5d100"}}
                onMouseLeave={e=>{if(t.popular)e.currentTarget.style.background="#ffdd2d"}}>{t.btn}</button>
            </div>
          )})}
        </div>
      </section>{/* ===== ГОТОВЫ НАЧАТЬ? (из варианта 3) ===== */}
      <section style={{maxWidth:1280,margin:"80px auto",padding:"0 24px"}}>
        <div style={{background:"#000",borderRadius:20,padding:"40px 32px",textAlign:"center",color:"#fff"}}>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>Готовы начать?</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.6)",marginBottom:24,maxWidth:400,margin:"0 auto 24px"}}>
            Зарегистрируйтесь за 1 минуту и начните<br/>управлять финансами вашего бизнеса.
          </p>
          <button onClick={()=>n('/register')} style={{padding:"12px 32px",borderRadius:100,border:"none",background:"#ffdd2d",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Создать аккаунт</button>
        </div>
      </section>

      {/* ===== ФУТЕР ===== */}
      <footer style={{borderTop:"1px solid rgba(0,0,0,.08)",padding:"20px 24px",maxWidth:1280,margin:"20px auto 0",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,color:"rgba(0,0,0,.34)",flexWrap:"wrap",gap:12}}>
        <span>© 2026 AtlasPos</span>
        <div style={{display:"flex",gap:16}}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{color:"inherit",textDecoration:"underline",cursor:"pointer"}}>Политика конфиденциальности</a>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{color:"inherit",textDecoration:"underline",cursor:"pointer"}}>Пользовательское соглашение</a>
        </div>
      </footer>
    </div>
  );
}
