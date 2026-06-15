import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Subscription() {
  const n = useNavigate();
  const [period, setPeriod] = useState('1m');
  const [autoRenew, setAutoRenew] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDiscountOffer, setShowDiscountOffer] = useState(false);
  const [switchPlan, setSwitchPlan] = useState(null);
  const confirmSwitchPlan = (plan, price) => {
    // Здесь будет интеграция с эквайрингом
    setSwitchPlan(null);
  };
  const [cards, setCards] = useState([
    { id: 1, brand: 'visa', last4: '1234', exp: '12/27', main: true },
  ]);

  const currentPlan = { name: 'Бизнес', price: 2900, period: '1m', until: '15.07.2026' };

  const periodPrices = {"1m":[490,990,2900,6900],"3m":[440,890,2600,6200],"6m":[390,790,2300,5500],"1y":[340,690,1990,4800]};
  const periodSavings = {"3m":[150,300,900,2100],"6m":[600,1200,3600,8400],"1y":[1800,3600,10920,25200]};
  const periodLabels = {"1m":"1 месяц","3m":"3 месяца","6m":"6 месяцев","1y":"1 год"};

  const plans = [
    {name:"Базовый",price:490,desc:"Для самозанятых и микро-бизнеса",features:["Учёт доходов и расходов","База клиентов (CRM)","1 пользователь"],popular:false},
    {name:"Старт",price:990,desc:"Для малого бизнеса и сервисов",features:["Полный учёт кассы","Складской учёт и остатки","Автокатегоризация AI","До 2 пользователей"],popular:false},
    {name:"Бизнес",price:2900,desc:"Для компаний с командой",features:["Тариф «Старт»","Зарплата и табель","До 5 пользователей","Безлимитный AI"],popular:true},
    {name:"Профи",price:6900,desc:"Для сетей и крупных проектов",features:["Тариф «Бизнес»","Мульти-аккаунты","API доступ","∞ пользователей"],popular:false},
  ];

  return (
    <div style={{fontFamily:"'Inter',sans-serif",color:"#111",padding:"0 0 40px"}}>
      <h1 style={{fontSize:"1.3rem",fontWeight:700,marginBottom:4,letterSpacing:"-.02em"}}>Управление подпиской</h1>
      <p style={{fontSize:".82rem",color:"rgba(0,0,0,.54)",marginBottom:24}}>Ваш тариф и способы оплаты</p>

      {/* Статус */}
      <div style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:16,padding:20,marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <div style={{width:44,height:44,borderRadius:12,background:"#fff8d6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>💎</div>
          <div>
            <div style={{fontSize:13,color:"rgba(0,0,0,.54)",marginBottom:2}}>Ваш текущий тариф</div>
            <div style={{fontSize:17,fontWeight:700}}>{currentPlan.name}</div>
          </div>
          <div style={{width:1,height:32,background:"rgba(0,0,0,.08)"}} />
          <div>
            <div style={{fontSize:13,color:"rgba(0,0,0,.54)",marginBottom:2}}>Активен до</div>
            <div style={{fontSize:15,fontWeight:600}}>{currentPlan.until}</div>
          </div>
          {autoRenew && (
            <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"#f0fdf4",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:600,color:"#16a34a"}}>
              Автопродление включено
            </div>
          )}
        </div>
        <button onClick={() => setShowCancelModal(true)} style={{
          padding:"8px 16px",borderRadius:100,border:"1.5px solid rgba(0,0,0,.12)",
          background:"transparent",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#555",
          whiteSpace:"nowrap",transition:"all .15s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#dc2626";e.currentTarget.style.color="#dc2626"}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,0,0,.12)";e.currentTarget.style.color="#555"}}
        >{autoRenew ? 'Отменить автопродление' : 'Включить автопродление'}</button>
      </div>

      {/* Тарифы */}
      <h2 style={{fontSize:"1.1rem",fontWeight:700,marginBottom:4,letterSpacing:"-.02em"}}>Сменить тариф</h2>
      <p style={{fontSize:".82rem",color:"rgba(0,0,0,.54)",marginBottom:16}}>Выберите подходящий план</p>

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {["1m","3m","6m","1y"].map((key) => (
          <button key={key} onClick={()=>setPeriod(key)}
            style={{
              padding:"5px 16px",borderRadius:100,border:"1.5px solid",cursor:"pointer",
              fontFamily:"inherit",fontSize:11,fontWeight:600,transition:"all .15s",
              background:period===key?"#000":"transparent",
              color:period===key?"#fff":"rgba(0,0,0,.54)",
              borderColor:period===key?"#000":"rgba(0,0,0,.12)",
            }}
          >{periodLabels[key]}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:32}}>
        {plans.map((t,i)=>{
          const basePrice = t.price;
          const currentPrice = periodPrices[period][i];
          const saving = period === '1m' ? 0 : periodSavings[period][i];
          const isCurrent = t.name === currentPlan.name;
          return (
          <div key={i} style={{
            border:`1.5px solid ${isCurrent?"#ffdd2d":"rgba(0,0,0,.08)"}`,
            borderRadius:16,padding:"20px 14px",background:"#fff",
            position:"relative",display:"flex",flexDirection:"column",
          }}>
            {isCurrent && <div style={{position:"absolute",top:-9,right:12,padding:"2px 10px",borderRadius:100,background:"#ffdd2d",fontSize:9,fontWeight:700,color:"#000"}}>Текущий</div>}
            <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{t.name}</div>
            <div style={{marginBottom:2}}>
              {period === '1m' ? (
                <span style={{fontSize:20,fontWeight:800}}>{basePrice.toLocaleString()} ₽</span>
              ) : (
                <>
                  <span style={{fontSize:13,fontWeight:600,color:"rgba(0,0,0,.2)",textDecoration:"line-through",textDecorationColor:"rgba(220,38,38,.4)"}}>
                    {basePrice.toLocaleString()} ₽
                  </span>
                  <span style={{fontSize:20,fontWeight:800,marginLeft:4}}>{currentPrice.toLocaleString()} ₽</span>
                </>
              )}
            </div>
            {period !== '1m' && (
              <div style={{display:"inline-flex",background:"#f0fdf4",borderRadius:4,padding:"2px 6px",fontSize:9,fontWeight:600,color:"#16a34a",marginBottom:6,width:"fit-content"}}>
                Выгода {saving.toLocaleString()} ₽
              </div>
            )}
            <div style={{fontSize:10,color:"rgba(0,0,0,.54)",marginBottom:10,lineHeight:1.3}}>{t.desc}</div>
            <div style={{borderTop:"1px solid rgba(0,0,0,.06)",paddingTop:10,marginBottom:10,flex:1}}>
              {t.features.map((f,j)=>(
                <div key={j} style={{display:"flex",alignItems:"flex-start",gap:6,padding:"2px 0",fontSize:11}}>
                  <span style={{color:"#16a34a",fontWeight:700,flexShrink:0,marginTop:1}}>✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>{if(!isCurrent) setSwitchPlan({name:t.name, price:currentPrice, period:period})}} style={{
              width:"100%",padding:"8px",borderRadius:100,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              background:isCurrent?"rgba(0,0,0,.06)":"#000",color:isCurrent?"#555":"#fff",
              transition:"all .15s",
            }}>{isCurrent ? 'Текущий тариф' : 'Подключить'}</button>
          </div>
        )})}
      </div>

      {/* Карты */}
      <div style={{border:"1px solid rgba(0,0,0,.08)",borderRadius:16,padding:20,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 style={{fontSize:"1.1rem",fontWeight:700,letterSpacing:"-.02em"}}>Способы оплаты</h2>
          <button style={{
            padding:"6px 14px",borderRadius:100,border:"none",background:"#000",color:"#fff",
            fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
          }}>+ Добавить карту</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {cards.map((card) => (
            <div key={card.id} style={{
              display:"flex",alignItems:"center",gap:14,padding:"12px 14px",
              border:"1px solid rgba(0,0,0,.08)",borderRadius:12,background:"#fafafa",
            }}>
              {card.brand === 'visa' && (
                <svg width="28" height="20" viewBox="0 0 50 32" fill="none"><path d="M18.5 10.5l-2.5 12h3.5l2.5-12h-3.5zM25 22.5h3.5l2-12H27l-2 12zM33.5 10.5l-2 9.5c-.3 1.5.5 2.5 2 2.5h2c1.5 0 3-1 3.5-2.5l3-9.5h-3.5l-2 8h-2l2-8h-3.5zM12 10.5L9 20l-1-6c-.3-2-2-3-3.5-3.5l3.5 12h4l5.5-12H12z" fill="#1434CB"/></svg>
              )}
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13,fontWeight:600,letterSpacing:1}}>•••• {card.last4}</span>
                  {card.main && <span style={{fontSize:9,color:"rgba(0,0,0,.34)",background:"#f1f3f5",padding:"1px 6px",borderRadius:4}}>Основная</span>}
                </div>
                <div style={{fontSize:11,color:"rgba(0,0,0,.54)"}}>Срок {card.exp}</div>
              </div>
              <button style={{
                background:"none",border:"none",fontSize:11,color:"#dc2626",cursor:"pointer",fontFamily:"inherit",padding:"4px 8px",borderRadius:6,
              }}>Удалить</button>
            </div>
          ))}
        </div>
        <div style={{marginTop:16,fontSize:11,color:"rgba(0,0,0,.34)",lineHeight:1.4}}>
          🔒 Все данные защищены. Оплата проходит через защищённый протокол PCI DSS.
          Автоматические списания происходят согласно{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{color:"inherit",textDecoration:"underline"}}>Пользовательскому соглашению</a>.
        </div>
      </div>

      {/* Платежные системы */}
      <div style={{display:"flex",alignItems:"center",gap:12,fontSize:11,color:"rgba(0,0,0,.34)",flexWrap:"wrap"}}>
        <span>Принимаем к оплате:</span>
        <svg width="36" height="24" viewBox="0 0 50 32" fill="none"><rect x="1" y="1" width="48" height="30" rx="3" fill="#fff" stroke="#ddd"/><circle cx="17" cy="16" r="9" fill="#EB001B" opacity=".6"/><circle cx="27" cy="16" r="9" fill="#F79E1B" opacity=".6"/></svg>
        <svg width="36" height="24" viewBox="0 0 50 32" fill="none"><rect x="1" y="1" width="48" height="30" rx="3" fill="#fff" stroke="#ddd"/><rect x="10" y="10" width="30" height="12" rx="2" fill="#0DB14B" opacity=".15"/><path d="M16 15v5h2v-2h2.5l2.5 2h3l-3-2.5c1.3-.3 2-1.3 2-2.5 0-1.5-1-2.5-2.5-2.5H16zm2 2v-1.5h2c.5 0 1 .2 1 .7s-.5.8-1 .8h-2zm6.5-1c0 2 1.2 3.5 3 3.5s3-1.5 3-3.5-1.2-3.5-3-3.5-3 1.5-3 3.5zm3-1.5c.6 0 1.2.6 1.2 1.5s-.6 1.5-1.2 1.5-1.2-.6-1.2-1.5.6-1.5 1.2-1.5z" fill="#0DB14B"/></svg>
        <span style={{fontSize:10}}>и другие</span>
      </div>

      {/* Modal — отмена */}
      {showCancelModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}
          onClick={()=>setShowCancelModal(false)}>
          <div style={{background:"#fff",borderRadius:20,padding:24,maxWidth:360,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:'2rem',marginBottom:12,textAlign:'center'}}>💔</div>
          <h2 style={{fontSize:"1.1rem",fontWeight:700,textAlign:'center',marginBottom:8}}>Отменить автопродление?</h2>
          <p style={{fontSize:".85rem",color:"rgba(0,0,0,.54)",textAlign:'center',marginBottom:20,lineHeight:1.4}}>
            После отмены ваш тариф «{currentPlan.name}» будет активен до {currentPlan.until}, после чего подписка перейдёт на бесплатный тариф.
          </p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>{setShowCancelModal(false);setShowDiscountOffer(true)}} style={{
              flex:1,padding:"10px",borderRadius:100,border:"none",background:"#ffdd2d",color:"#000",
              fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            }}>Остаться — получить скидку 10%</button>
          </div>
          <div style={{textAlign:'center',marginTop:12}}>
            <button onClick={()=>{setShowCancelModal(false);setAutoRenew(false)}} style={{
              background:'none',border:'none',fontSize:12,color:'rgba(0,0,0,.34)',
              textDecoration:'underline',cursor:'pointer',fontFamily:'inherit',
            }}>Всё равно отменить</button>
          </div>
        </div></div>
      )}

      {/* Modal — скидка */}
      {showDiscountOffer && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:24,maxWidth:360,textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,.12)'}}>
            <div style={{fontSize:'2.5rem',marginBottom:12}}>🎁</div>
            <h2 style={{fontSize:"1.1rem",fontWeight:700,marginBottom:8}}>Мы хотим вас удержать!</h2>
            <p style={{fontSize:".85rem",color:"rgba(0,0,0,.54)",marginBottom:16,lineHeight:1.4}}>
              Дарим вам персональную скидку <strong style={{color:'#16a34a'}}>10%</strong> на текущий тариф на следующие 3 месяца. Остаётесь?
            </p>
            <button onClick={()=>{setAutoRenew(true);setShowDiscountOffer(false)}} style={{
              width:"100%",padding:"10px",borderRadius:100,border:"none",background:"#ffdd2d",color:"#000",
              fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8,
            }}>Да, остаюсь со скидкой 10%</button>
            <button onClick={()=>{setShowDiscountOffer(false);setAutoRenew(false)}} style={{
              background:'none',border:'none',fontSize:12,color:'rgba(0,0,0,.34)',
              textDecoration:'underline',cursor:'pointer',fontFamily:'inherit',padding:'4px 8px',
            }}>Нет, отписаться</button>
          </div>
        </div>
      )}

      {/* Switch plan confirmation */}
      {switchPlan && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}
          onClick={()=>setSwitchPlan(null)}>
          <div style={{background:"#fff",borderRadius:20,padding:24,maxWidth:380,boxShadow:"0 8px 32px rgba(0,0,0,.12)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:"2rem",marginBottom:12,textAlign:"center"}}>🔄</div>
            <h2 style={{fontSize:"1.1rem",fontWeight:700,textAlign:"center",marginBottom:8}}>Смена тарифа</h2>
            <p style={{fontSize:".85rem",color:"rgba(0,0,0,.54)",textAlign:"center",marginBottom:4,lineHeight:1.4}}>
              Вы переходите на тариф <strong>{switchPlan.name}</strong>
            </p>
            <p style={{fontSize:".9rem",fontWeight:700,textAlign:"center",marginBottom:16}}>{switchPlan.price.toLocaleString()} ₽/мес</p>
            <button onClick={()=>{confirmSwitchPlan(switchPlan.name, switchPlan.price);setSwitchPlan(null)}} style={{
              width:"100%",padding:"10px",borderRadius:100,border:"none",background:"#ffdd2d",color:"#000",
              fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8,
            }}>Подтвердить смену тарифа</button>
            <div style={{textAlign:"center"}}>
              <button onClick={()=>setSwitchPlan(null)} style={{
                background:"none",border:"none",fontSize:12,color:"rgba(0,0,0,.34)",
                textDecoration:"underline",cursor:"pointer",fontFamily:"inherit",
              }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}
