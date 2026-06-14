import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Landing() {
  const n = useNavigate();
  const { user } = useAuth();
  useEffect(() => { if (user) n('/dashboard', { replace: true }); }, [user, n]);

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

  const MiniAppWindow = ({title, children}) => (
    <div style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
      <div style={{background:"#000",padding:"5px 10px",display:"flex",gap:5,alignItems:"center"}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:"#ff6052"}}/>
        <span style={{width:6,height:6,borderRadius:"50%",background:"#ffbd2e"}}/>
        <span style={{width:6,height:6,borderRadius:"50%",background:"#28c93f"}}/>
        <span style={{fontSize:9,fontWeight:600,color:"rgba(255,255,255,.6)",marginLeft:6}}>{title}</span>
      </div>
      <div style={{padding:10,background:"#fff",fontSize:11,lineHeight:1.5}}>
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
    <div style={{fontFamily:"Inter,sans-serif",color:"#111",minHeight:"100vh",background:"linear-gradient(180deg, #fff 0%, #fafafa 100%)"}}>
      {/* ===== ХЕДЕР ===== */}
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",maxWidth:1104,margin:"0 auto"}}>
        <span style={{fontWeight:800,fontSize:18,letterSpacing:"-.03em",color:"#000"}}>FINANCE</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>n('/login')} style={{padding:"8px 20px",borderRadius:100,border:"1.5px solid #000",background:"transparent",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#000"}}>Войти</button>
        </div>
      </header>

      {/* ===== HERO С ПРЕВЬЮ ДАШБОРДА ===== */}
      <section style={{maxWidth:1104,margin:"0 auto",padding:"40px 24px",display:"grid",gridTemplateColumns:"1fr 1.3fr",gap:40,alignItems:"center"}}>
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
      <section style={{maxWidth:1104,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:"-.02em"}}>Почему выбирают нас</h2>
        <p style={{fontSize:15,color:"rgba(0,0,0,.54)",textAlign:"center",marginBottom:36}}>Четыре причины работать с FINANCE</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:20,alignItems:"center"}}>
        {[
          {num:"01",title:"Простота",desc:"Интерфейс понятен без обучения. Всё интуитивно."},
          {num:"02",title:"Надёжность",desc:"Данные хранятся в Supabase - современная защита."},
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
      </div></section>

      {/* ===== ПРЕВЬЮ ИНТЕРФЕЙСА (6 возможностей) ===== */}
      <section style={{maxWidth:1104,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:"-.02em"}}>Возможности системы</h2>
        <p style={{fontSize:15,color:"rgba(0,0,0,.54)",textAlign:"center",marginBottom:36}}>Посмотрите, как работают разделы</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {/* Панель управления */}
          <MiniAppWindow title="Панель управления">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>
              <MiniStat label="Доходы" value="+284 000" color="#16a34a" />
              <MiniStat label="Расходы" value="−123 000" color="#dc2626" />
              <MiniStat label="Итого" value="+161 000" color="#000" bg="#ffdd2d" />
            </div>
            <MiniLabel text="ПОСЛЕДНИЕ ОПЕРАЦИИ" />
            {[["Продажа скутера","+72 000","#16a34a"],["Запчасти","−8 500","#dc2626"],["Аренда","+15 000","#16a34a"]].map((r,i)=>(
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
                <div style={{fontSize:11,fontWeight:700,color:"#16a34a"}}>1.2M ₽</div>
              </div>
              <div style={{flex:1,background:"#fef2f2",borderRadius:6,padding:6,textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(0,0,0,.54)"}}>Расход</div>
                <div style={{fontSize:11,fontWeight:700,color:"#dc2626"}}>845K ₽</div>
              </div>
            </div>
            <MiniLabel text="P&amp;L" />
            <div style={{fontSize:11,fontWeight:700,color:"#16a34a",textAlign:"center",padding:"4px 0",background:"#f9f9f9",borderRadius:6}}>+355 000 ₽ прибыль</div>
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

      {/* ===== СТАТИСТИКА ===== */}
      <section style={{maxWidth:900,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:"-.02em"}}>FINANCE в цифрах</h2>
        <p style={{fontSize:15,color:"rgba(0,0,0,.54)",textAlign:"center",marginBottom:40}}>Результаты, которые говорят сами за себя</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:0,textAlign:"center"}}>
          {[
            {num:"100+",label:"компаний",desc:"уже используют FINANCE для учёта"},
            {num:"4",label:"сервиса",desc:"заменяет одна система — склад, финансы, зп, клиенты"},
            {num:"70%",label:"экономия",desc:"времени на учёт по сравнению с Excel"},
          ].map((s,i)=>(
            <div key={i} style={{borderRight:i<2?"1px solid rgba(0,0,0,.08)":"none",padding:"0 24px"}}>
              <div style={{fontSize:44,fontWeight:800,lineHeight:1,marginBottom:8,letterSpacing:"-.03em",color:"#111"}}>{s.num}</div>
              <div style={{fontSize:15,fontWeight:600,marginBottom:6,color:"#333"}}>{s.label}</div>
              <div style={{fontSize:13,color:"rgba(0,0,0,.5)",lineHeight:1.4}}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{maxWidth:900,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
        <h2 style={{fontSize:26,fontWeight:700,marginBottom:8,letterSpacing:"-.02em"}}>Для кого подходит</h2>
        <p style={{fontSize:15,color:"rgba(0,0,0,.54)",marginBottom:36}}>FINANCE одинаково полезен разному бизнесу</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {[
            {emoji:"🛵",title:"Мотосалоны",desc:"Учёт продаж, аренды, сервиса и запчастей в одном окне"},
            {emoji:"🏪",title:"Магазины",desc:"Товарный учёт, поставщики, наценки и складские остатки"},
            {emoji:"🍕",title:"Общепит",desc:"Доходы, расходы, зарплата и аналитика прибыли"},
          ].map((t,i)=>(
            <div key={i} style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:16,padding:20,transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#ffdd2d";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,.06)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,0,0,.08)";e.currentTarget.style.boxShadow="none"}}>
              <div style={{fontSize:28,marginBottom:8}}>{t.emoji}</div>
              <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{t.title}</div>
              <div style={{fontSize:13,color:"rgba(0,0,0,.54)",lineHeight:1.4}}>{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== AI-ПОМОЩНИК ===== */}
      <section style={{maxWidth:1104,margin:"80px auto",padding:"0 24px"}}>
        <div style={{background:"#000",borderRadius:24,padding:"48px 40px",color:"#fff"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:100,background:"rgba(255,255,255,.1)",fontSize:12,fontWeight:600,color:"rgba(255,255,255,.8)",marginBottom:16}}>
            AI-аналитика
          </div>
          <h2 style={{fontSize:"clamp(24px,3.5vw,32px)",fontWeight:700,letterSpacing:"-.02em",marginBottom:8}}>
            Искусственный интеллект<br/>в помощь бизнесу
          </h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.6)",lineHeight:1.5,marginBottom:32,maxWidth:500}}>
            AI-помощник анализирует данные, находит закономерности и подсказывает, как увеличить прибыль. Просто задайте вопрос.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:12}}>
            {[
              {icon:"chart",title:"Анализ прибыли",desc:
                "Автоматически считает P&L, показывает какие товары приносят больше всего денег, а какие съедают маржу."},
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
              <div key={i} style={{background:"rgba(255,255,255,.06)",borderRadius:14,padding:18,border:"1px solid rgba(255,255,255,.08)"}}>
                <AIIcon type={f.icon} />
                <div style={{fontSize:14,fontWeight:600,margin:"8px 0 4px"}}>{f.title}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.5)",lineHeight:1.45}}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section style={{maxWidth:700,margin:"80px auto",padding:"0 24px"}}>
        <h2 style={{fontSize:26,fontWeight:700,textAlign:"center",marginBottom:36,letterSpacing:"-.02em"}}>Частые вопросы</h2>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[ 
            {q:"Сколько стоит FINANCE?",a:"Есть бесплатный тариф «Старт» — до 50 операций в месяц. Для активного бизнеса — «Бизнес» за 2 900 ₽/мес или «Профи» за 6 900 ₽/мес без ограничений."},
            {q:"Можно ли попробовать бесплатно?",a:"Да, тариф «Старт» бесплатный навсегда. Для доступа к полному функционалу — первые 14 дней бесплатно."},
            {q:"Нужно ли устанавливать программу?",a:"Нет, всё работает в браузере. Достаточно зарегистрироваться и войти."},
            {q:"Мои данные в безопасности?",a:"Да, используем Supabase. Доступ только по email и паролю."},
            {q:"Можно ли добавить сотрудников?",a:"Да, на тарифе «Бизнес» — до 5 пользователей, на «Профи» — без ограничений."},
          ].map((f,i)=>(
            <FaqItem key={i} question={f.q} answer={f.a} />
          ))}
        </div>
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
