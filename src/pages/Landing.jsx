import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getCurrencySymbol } from '../lib/currency';


export default function Landing() {
  const cur = getCurrencySymbol();
  const n = useNavigate();
  const { user } = useAuth();
  useEffect(() => { if (user) n('/dashboard', { replace: true }); }, [user, n]);

  // Отключаем авто-восстановление прокрутки браузером на главной
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
  }, []);

  const [mobile, setMobile] = useState(window.innerWidth < 700);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 700);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

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


  /* ══ Изогнутая лента со скринами (порт tilted-grid-hero) ══ */
  const ScreenBand = ({height = 330}) => {
    const boxRef = React.useRef(null);
    const bandRef = React.useRef(null);
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
      const SLICES = 12, CAMERA = 1.6, MAX_WIDTH = 80;
      const SPEED = 4, TILE_HEIGHT = 52, ASPECT = 1919 / 896;
      const GAP = 6, AXIS = 50, CURVE = 62, FADE = 12;
      const IMAGES = [
        '/screen1.jpg','/screen1.jpg','/screen1.jpg','/screen1.jpg','/screen1.jpg'
      ];

      const arc = b => (CAMERA - 1 + Math.cos(b)) / (2 * CAMERA * Math.sin(b));

      const measure = (width, height, tile, aspect, gap, bend) => {
        const h = Math.min((tile / 100) * height, ((MAX_WIDTH / 100) * width) / aspect);
        const radius = width * arc(bend);
        if (!(h > 0) || !(radius > 0)) return {columns:2, sweep:0, unit:0, limit:0};
        const deg = rad => rad * 180 / Math.PI;
        const unit = deg(h / radius);
        const pitch = (aspect + gap / 100) * unit;
        const limit = deg(bend) + (aspect * unit) / 2;
        const columns = Math.min(60, Math.max(2, Math.ceil((2 * limit) / pitch)));
        const round = n => +n.toFixed(4);
        const sweep = round((columns * pitch) / 2);
        return {columns, sweep, unit: round(unit), limit: round(Math.min(sweep, limit))};
      };

      const box = boxRef.current, band = bandRef.current;
      if (!box || !band) return;

      let cleanup = null;

      const build = () => {
        const width = box.clientWidth, height2 = box.clientHeight;
        if (!width || !height2) return;
        const bend = Math.min(85, Math.max(5, CURVE)) * Math.PI / 180;
        const {columns, sweep, unit, limit} = measure(width, height2, TILE_HEIGHT, ASPECT, GAP, bend);

        const r = 100 * arc(bend);
        const radius = r.toFixed(3) + 'cqw';
        const turn = d => `translateZ(${radius}) rotateY(${(+d).toFixed(4)}deg) translateZ(-${radius})`;
        const hide = +(((sweep - limit) / (2 * sweep || 1)) * 100).toFixed(4);
        const orbitName = 'tgh-orbit';

        const css = `@keyframes ${orbitName}{from{transform:${turn(-sweep)}}to{transform:${turn(sweep)}}` +
          `0%,${hide}%,${100-hide}%,100%{visibility:hidden}` +
          `${hide+0.001}%,${100-hide-0.001}%{visibility:visible}}` +
          `@media(prefers-reduced-motion:reduce){.tgh-tile{animation-play-state:paused}}`;

        let st = document.getElementById('tgh-style');
        if (!st) { st = document.createElement('style'); st.id = 'tgh-style'; document.head.appendChild(st); }
        st.textContent = css +
          `.tgh-tile{position:absolute;transform-style:preserve-3d;will-change:transform;border-radius:10px;` +
          `box-shadow:0 6px 16px -6px rgba(16,40,90,.22), 0 18px 40px -16px rgba(16,40,90,.26)}` +
          `.tgh-band{opacity:0;transition:opacity .5s}` +
          `.tgh-band.on{opacity:1}` +
          `@media(prefers-reduced-motion:reduce){.tgh-tile{animation-play-state:paused}}`;

        const share = ASPECT / SLICES;
        const duration = columns * SPEED;
        const mask = `linear-gradient(90deg,transparent,#000 ${FADE}%,#000 ${100-FADE}%,transparent)`;
        const u = n => `calc(${(+n).toFixed(4)} * min(${TILE_HEIGHT}cqh, ${(MAX_WIDTH/ASPECT).toFixed(4)}cqw))`;

        band.style.perspective = (r * CAMERA).toFixed(3) + 'cqw';
        band.style.perspectiveOrigin = `50% ${AXIS}%`;
        band.style.maskImage = mask;
        band.style.webkitMaskImage = mask;
        band.innerHTML = '';

        for (let t = 0; t < columns; t++) {
          const first = columns - 1 - t;
          const img = IMAGES[first % IMAGES.length];
          const tile = document.createElement('div');
          tile.className = 'tgh-tile';
          tile.dataset.img = String(first % IMAGES.length);
          tile.style.left = `calc(50% - ${u(ASPECT/2)})`;
          tile.style.top  = `calc(${AXIS}% - ${u(0.5)})`;
          tile.style.width = u(ASPECT);
          tile.style.height = u(1);
          tile.style.transformStyle = 'preserve-3d';
          tile.style.animation = `${orbitName} ${duration}s linear ${-t * SPEED}s infinite`;

          for (let k = 0; k < SLICES; k++) {
            const sl = document.createElement('div');
            sl.style.position = 'absolute';
            sl.style.top = '0';
            sl.style.overflow = 'hidden';
            sl.style.background = '#fff';

            sl.style.left = u((ASPECT - share) / 2);
            sl.style.width = (k === SLICES - 1) ? u(share) : `calc(${u(share)} + 1px)`;
            sl.style.height = u(1);
            sl.style.transform = turn((ASPECT/2 - (k + 0.5) * share) * unit);
            if (k === 0) sl.style.borderRadius = '10px 0 0 10px';
            if (k === SLICES - 1) sl.style.borderRadius = '0 10px 10px 0';

            const im = document.createElement('div');
            im.style.position = 'absolute';
            im.style.top = '0';
            im.style.left = u(-k * share);
            im.style.width = u(ASPECT);
            im.style.height = u(1);
            im.style.background = '#000';
            sl.appendChild(im);
            tile.appendChild(sl);
          }
          band.appendChild(tile);
        }

        requestAnimationFrame(() => band.classList.add('on'));
        cleanup = null;
      };

      build();
      setReady(true);

      let rt;
      const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (cleanup) cleanup(); build(); }, 250); };
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        clearTimeout(rt);
        if (cleanup) cleanup();
      };
    }, []);

    return (
      <div ref={boxRef} style={{position:'relative',width:'100%',height:mobile?230:height,background:'transparent',overflow:'hidden',containerType:'size'}}>
        <div ref={bandRef} className="tgh-band" aria-hidden="true"
          style={{position:'absolute',inset:0,pointerEvents:'none',opacity:ready?1:0,transition:'opacity .5s'}} />
      </div>
    );
  };


  /* ══ 4 причины: карточки веером (порт stagger) ══ */
  const WhyStack = () => {
    const ITEMS = [
      {num:"01",title:"Простота",desc:"Интерфейс понятен без обучения с первых секунд. Начните работу сразу, без долгого внедрения и инструкций."},
      {num:"02",title:"Надежность",desc:"Безопасное облачное хранение данных с автоматическим резервным копированием. Полная защита вашей коммерческой тайны."},
      {num:"03",title:"Выгода",desc:"Заменяет кассовый софт, складской учет и CRM-систему. Вы получаете все в одной вкладке и не переплачиваете за разные сервисы."},
      {num:"04",title:"Забота и помощь",desc:"Бесплатно перенесем ваши текущие базы данных и таблицы Excel в систему. Живая поддержка поможет настроить процессы под ваш бизнес."},
    ];
    const n = ITEMS.length;
    const [active, setActive] = React.useState(0);

    // Автолистание — раз в 1 секунду
    React.useEffect(() => {
      const id = setInterval(() => setActive(a => (a + 1) % n), 3000);
      return () => clearInterval(id);
    }, [n]);

    const tx = (i) => {
      let d = i - active;
      if (d > n/2) d -= n;
      if (d < -n/2) d += n;
      const abs = Math.abs(d), dir = Math.sign(d);
      if (abs === 0) return {t:'translate(-50%,-50%) translateZ(120px) scale(1)', o:1, z:100};
      const x = dir * (118 + (abs-1) * 46);
      const y = abs * 14;
      const ry = dir * -16, rz = dir * 2.2;
      const sc = Math.max(0.70, 1 - abs * 0.10);
      return {
        t:`translate(-50%,-50%) translateX(${x}px) translateY(${y}px) translateZ(${-abs*70}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`,
        o: Math.max(0.4, 1 - abs*0.15),
        z: 100 - abs
      };
    };

    return (
      <div style={{position:'relative',width:'100%',height:mobile?380:470,display:'flex',justifyContent:'center',perspective:1500}}>
        {ITEMS.map((it,i)=>{
          const c = tx(i);
          const isC = i === active;
          return (
            <div key={i} onClick={()=>setActive(i)}
              style={{
                position:'absolute',left:'50%',top:'50%',cursor:'pointer',
                width:mobile?230:270,height:mobile?300:360,
                borderRadius:20,border:'2px solid rgba(16,40,90,.10)',
                background:'#fff',overflow:'hidden',
                boxShadow:'0 20px 50px -30px rgba(16,40,90,.6)',
                transform:c.t,opacity:c.o,zIndex:c.z,
                transition:'transform .5s cubic-bezier(.4,0,.2,1), opacity .5s cubic-bezier(.4,0,.2,1)',
                willChange:'transform,opacity',backfaceVisibility:'hidden',backfaceVisibility:'hidden'
              }}>
              <div style={{
                position:'absolute',inset:0,pointerEvents:'none',
                background:'linear-gradient(165deg,#0d4ea8,#1F75FF 60%,#4a92ff)',
                opacity:isC?1:0,transition:'opacity .35s ease'
              }}/>
              <div style={{position:'relative',zIndex:1,padding:mobile?'20px 18px':'24px 22px',height:'100%',display:'flex',flexDirection:'column'}}>
                <div style={{fontSize:mobile?34:40,fontWeight:800,lineHeight:1,letterSpacing:'-.05em',
                  color:isC?'rgba(255,255,255,.34)':'rgba(16,40,90,.13)',transition:'color .35s ease'}}>{it.num}</div>
                <div style={{marginTop:'auto',fontSize:mobile?17:19,fontWeight:800,letterSpacing:'-.025em',
                  color:isC?'#fff':'#111',transition:'color .35s ease'}}>{it.title}</div>
                <div style={{marginTop:10,fontSize:mobile?12:12.5,lineHeight:1.55,
                  color:isC?'rgba(255,255,255,.88)':'rgba(0,0,0,.55)',transition:'color .35s ease'}}>{it.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };


  /* ══ Орбита разделов (порт radial-orbital-timeline) ══ */
const SVG = (p) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ORBIT_ICONS = {
  kassa: SVG('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/>'),
  sales: SVG('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>'),
  stock: SVG('<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/>'),
  clients: SVG('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
  staff: SVG('<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0114 0"/><circle cx="18" cy="9" r="2.5"/>'),
  finance: SVG('<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 000 7H14a3.5 3.5 0 010 7H6"/>'),
  accounts: SVG('<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>'),
  reports: SVG('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 13v4M12 9v8M16 11v6"/>'),
  ai: SVG('<path d="M12 3l2.2 5.3L20 10l-5.8 1.7L12 17l-2.2-5.3L4 10l5.8-1.7z"/>'),
  dashboard: SVG('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  shift: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  receipt: SVG('<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h3"/>'),
  salary: SVG('<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 000 7H14a3.5 3.5 0 010 7H6"/>'),
  profit: SVG('<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v6h-6"/>'),
  plan: SVG('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>'),
  chart: SVG('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  boxes: SVG('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>'),
  supply: SVG('<path d="M3 16V6h11l4 4v6"/><circle cx="8" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M3 16h2M10 18h5"/>'),
  inventory: SVG('<path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>'),
  writeoff: SVG('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11l4 4M14 11l-4 4"/>'),
  suppliers: SVG('<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>'),
  loyalty: SVG('<path d="M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 10-7.1 7.1L12 21l8.8-8.3a5 5 0 000-7.1z"/>'),
  promo: SVG('<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  timesheet: SVG('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4M8 14h3M8 18h5"/>'),
  settings: SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 002.6 14H2.5a2 2 0 110-4h.1A1.6 1.6 0 004.6 7a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 2.6V2.5a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0021.4 10h.1a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>'),
};
  const ORBIT_DATA = [
  { id:1, title:'Панель управления', cat:'Обзор', icon:'dashboard', related:[2,9,22],
    content:'Главный экран: выручка, расходы, прибыль и последние операции за сегодня.',
    feats:['Доходы, расходы, итог за день','Последние операции','Быстрые действия','Сводка по всем точкам'] },
  { id:2, title:'AI помощник', cat:'Обзор', icon:'ai', related:[1,10,22],
    content:'AI-ассистент отвечает на вопросы по вашим цифрам и находит точки роста простым языком.',
    feats:['Ответы на вопросы по данным','Автоматические инсайты','Прогноз выручки','Поиск аномалий'] },
  { id:3, title:'Касса', cat:'Продажи', icon:'kassa', related:[7,12,13],
    content:'Рабочее место кассира: пробивайте чеки, принимайте оплату и контролируйте смену.',
    feats:['Открытие и закрытие смены','Наличные, карта, QR','Печать и отправка чеков','Поиск товара по штрихкоду'] },
  { id:4, title:'Доходы и расходы', cat:'Финансы', icon:'finance', related:[5,9,8],
    content:'Все денежные потоки по категориям: платежи, операции и сверка по счёту.',
    feats:['Операции по категориям','Сверка с банком','Планирование платежей','История изменений'] },
  { id:5, title:'Счета', cat:'Финансы', icon:'accounts', related:[4,9],
    content:'Несколько касс и счетов одновременно, переводы между ними и контроль остатков.',
    feats:['Наличные и безналичные счета','Переводы между счетами','Остаток по каждому счёту','История движений'] },
  { id:6, title:'Смены', cat:'Продажи', icon:'shift', related:[3,7],
    content:'Открытие и закрытие смен сотрудников, расхождение по кассе и контроль кассиров.',
    feats:['Открытие и закрытие смены','Сверка наличных в кассе','Кто и когда работал','Расхождения и недостачи'] },
  { id:7, title:'Чеки', cat:'Продажи', icon:'receipt', related:[3,6],
    content:'История всех чеков с фильтрами по дате, кассиру и способу оплаты. Возвраты.',
    feats:['История чеков с детализацией','Возвраты и отмены','Фильтры по кассиру','Выгрузка в Excel'] },
  { id:8, title:'Зарплата', cat:'Команда', icon:'salary', related:[21,22,4],
    content:'Оклады, премии и выплаты. Система сама посчитает зарплату по выработке.',
    feats:['Расчёт зарплаты','Премии и бонусы','История выплат','Связь с табелем'] },
  { id:9, title:'Чистая прибыль', cat:'Аналитика', icon:'profit', related:[4,22,1],
    content:'Отчёт о прибыли и убытках: выручка минус все расходы за период.',
    feats:['P&L за любой период','Динамика по месяцам','Топ категорий расходов','Сравнение периодов'] },
  { id:10, title:'Планирование', cat:'Аналитика', icon:'plan', related:[9,4,2],
    content:'Планы по выручке и расходам, контроль выполнения и прогноз на будущее.',
    feats:['Планы по выручке','Планы по расходам','Факт vs план','Прогноз до конца месяца'] },
  { id:11, title:'Товары и услуги', cat:'Склад', icon:'stock', related:[12,13,17],
    content:'Карточки товаров и услуг: цены, себестоимость, штрихкоды и категории.',
    feats:['Карточки товаров','Цены и себестоимость','Категории и единицы','Штрихкоды'] },
  { id:12, title:'Аналитика товаров', cat:'Склад', icon:'chart', related:[11,13,9],
    content:'Что продаётся лучше, где маржа выше и какой товар залёживается.',
    feats:['Топ продаж','Маржинальность по товару','Медленные позиции','ABC-анализ'] },
  { id:13, title:'Остатки', cat:'Склад', icon:'boxes', related:[11,14,16],
    content:'Остатки по складам и точкам в реальном времени, с минимальными порогами.',
    feats:['Остатки по складам','Минимальные остатки','Перемещения','Отчёты по остаткам'] },
  { id:14, title:'Поставки', cat:'Склад', icon:'supply', related:[13,17,15],
    content:'Приём товара от поставщиков: накладные, партии и цены закупки.',
    feats:['Приёмка товара','Накладные поставщиков','Цены закупки','История поставок'] },
  { id:15, title:'Инвентаризация', cat:'Склад', icon:'inventory', related:[13,16],
    content:'Пересчёт товара на складе и автоматическое выравнивание остатков.',
    feats:['Создание пересчёта','Ввод фактических остатков','Расхождения','Акт инвентаризации'] },
  { id:16, title:'Списания', cat:'Склад', icon:'writeoff', related:[13,15],
    content:'Списание брака, порчи и внутренних расходов с фиксацией причины.',
    feats:['Списание товара','Причины списания','Акты списания','История'] },
  { id:17, title:'Поставщики', cat:'Склад', icon:'suppliers', related:[14,5],
    content:'База поставщиков с контактами, условиями и историей закупок.',
    feats:['Карточка поставщика','Контакты и реквизиты','История закупок','Задолженность'] },
  { id:18, title:'База клиентов', cat:'Клиенты', icon:'clients', related:[19,20],
    content:'Карточки клиентов с историей покупок, контактами и сегментами.',
    feats:['Карточка клиента','История покупок','Поиск по телефону','Сегменты'] },
  { id:19, title:'Лояльность', cat:'Клиенты', icon:'loyalty', related:[18,20],
    content:'Бонусные программы, скидки и уровни клиентов.',
    feats:['Бонусные программы','Скидки по уровню','Начисления и списания бонусов','Отчёты по лояльности'] },
  { id:20, title:'Акции', cat:'Клиенты', icon:'promo', related:[19,18],
    content:'Скидочные акции и промокоды с расписанием и контролем условий.',
    feats:['Создание акций','Промокоды','Расписание действия','Результаты акций'] },
  { id:21, title:'Сотрудники', cat:'Команда', icon:'staff', related:[22,8],
    content:'Список сотрудников, должности, доступы и права в системе.',
    feats:['Карточка сотрудника','Должности','Права доступа','Активность'] },
  { id:22, title:'Табель', cat:'Команда', icon:'timesheet', related:[21,8],
    content:'Учёт рабочего времени: часы, явки, отсутствия по каждому сотруднику.',
    feats:['Отметки прихода/ухода','Часы за период','Отсутствия и отпуска','Связь с зарплатой'] },
  { id:23, title:'Отчеты', cat:'Аналитика', icon:'reports', related:[9,1,12],
    content:'Все отчёты системы в одном месте: продажи, склад, финансы, сотрудники.',
    feats:['Отчёты по продажам','Отчёты по складу','Финансовые отчёты','Выгрузка в Excel'] },
];

  const OrbitRing = () => {
    const n = ORBIT_DATA.length;
    const [angle, setAngle] = React.useState(0);
    const [auto, setAuto] = React.useState(true);
    const [activeId, setActiveId] = React.useState(null);
    const [parked, setParked] = React.useState(false);

    const OUT = 272, IN = 165;

    React.useEffect(() => {
      if (!auto) return;
      let raf, last = performance.now(), acc = 0;
      const SPEED = 6; // градусов в секунду
      const tick = (now) => {
        const dt = now - last;
        last = now;
        acc += dt;
        if (acc >= 16) {
          setAngle(a => (a + SPEED * (acc / 1000)) % 360);
          acc = 0;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [auto]);

    // при остановке — доворачиваем так, чтобы выбранный узел встал наверх
    React.useEffect(() => {
      if (activeId === null) return;
      const idx = ORBIT_DATA.findIndex(d => d.id === activeId);
      if (idx < 0) return;
      const isOut = idx % 2 === 0;
      const inRow = isOut ? Math.ceil(n / 2) : Math.floor(n / 2);
      const rowIdx = Math.floor(idx / 2);
      const step = 360 / inRow;
      const offset = isOut ? 0 : step / 2;
      const target = rowIdx * step + offset;
      setAngle(((270 - target) % 360 + 360) % 360);
    }, [activeId, n]);

    const calc = (index) => {
      const isOut = index % 2 === 0;
      const radius = isOut ? OUT : IN;
      const inRow = isOut ? Math.ceil(n / 2) : Math.floor(n / 2);
      const rowIdx = Math.floor(index / 2);
      const step = 360 / inRow;
      const offset = isOut ? 0 : step / 2;
      const a = ((rowIdx * step + offset + angle) % 360 + 360) % 360;
      const rad = a * Math.PI / 180;
      return {
        x: radius * Math.cos(rad),
        y: radius * Math.sin(rad),
        z: Math.round(100 + 50 * Math.cos(rad)),
        op: Math.max(0.45, Math.min(1, 0.45 + 0.55 * ((1 + Math.sin(rad)) / 2)))
      };
    };

    const related = (id) => {
      const it = ORBIT_DATA.find(d => d.id === id);
      return it ? it.related : [];
    };

    const k = mobile ? 0.72 : 1;
    const OUTs = OUT * k, INs = IN * k;
    const offsetOf = (isOut) => isOut
      ? Math.ceil(n / 2)
      : Math.floor(n / 2);

    const calcS = (index) => {
      const isOut = index % 2 === 0;
      const radius = (isOut ? OUTs : INs);
      const inRow = offsetOf(isOut);
      const rowIdx = Math.floor(index / 2);
      const step = 360 / inRow;
      const off = isOut ? 0 : step / 2;
      const a = ((rowIdx * step + off + angle) % 360 + 360) % 360;
      const rad = a * Math.PI / 180;
      return {
        x: radius * Math.cos(rad),
        y: radius * Math.sin(rad),
        z: Math.round(100 + 50 * Math.cos(rad)),
        op: Math.max(0.45, Math.min(1, 0.45 + 0.55 * ((1 + Math.sin(rad)) / 2)))
      };
    };

    const select = (item) => {
      if (activeId === item.id) { setActiveId(null); setAuto(true); setParked(false); return; }
      setActiveId(item.id); setAuto(false); setParked(true);
    };
    const reset = () => { setActiveId(null); setAuto(true); setParked(false); };

    const activeItem = activeId ? ORBIT_DATA.find(d => d.id === activeId) : null;

    return (
      <div onClick={reset} style={{position:'relative',width:'100%',height:mobile?500:720,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
        <div style={{position:'relative',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
          {/* кольца */}
          <div style={{position:'absolute',width:(OUTs*2),height:(OUTs*2),borderRadius:'50%',border:'1px solid rgba(16,40,90,.06)'}} />
          <div style={{position:'absolute',width:(INs*2),height:(INs*2),borderRadius:'50%',border:'1px solid rgba(16,40,90,.12)'}} />

          {/* ядро А */}
          <div style={{position:'absolute',width:mobile?52:64,height:mobile?52:64,borderRadius:mobile?15:18,
            background:'linear-gradient(135deg,#1F75FF,#0d4ea8)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
            fontWeight:800,fontSize:mobile?19:26,letterSpacing:'-.02em',zIndex:10,
            boxShadow:'0 10px 28px -10px rgba(31,117,255,.85)'}}>A</div>

          {/* узлы */}
          {ORBIT_DATA.map((item, i) => {
            const p = calcS(i);
            const isActive = item.id === activeId;
            const isRel = activeId !== null && related(activeId).includes(item.id);
            return (
              <div key={item.id}
                onClick={e => { e.stopPropagation(); select(item); }}
                style={{
                  position:'absolute',left:'50%',top:'50%',
                  transform:`translate(-50%,-50%) translate3d(${p.x}px, ${p.y}px, 0)`,
                  zIndex: isActive ? 200 : p.z,
                  opacity: isActive ? 1 : p.op,
                  display:'flex',flexDirection:'column',alignItems:'center',gap:6,
                  width: mobile?74:96, cursor:'pointer',
                  transition: parked ? 'transform .7s cubic-bezier(.4,0,.2,1), opacity .7s' : 'opacity .7s'
                }}>
                <div style={{
                  width:mobile?34:42,height:mobile?34:42,borderRadius:'50%',flex:'none',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  background: isActive ? 'linear-gradient(135deg,#1F75FF,#0d4ea8)' : '#fff',
                  border: '1px solid ' + (isActive ? '#1F75FF' : (isRel ? '#60a5fa' : 'rgba(16,40,90,.14)')),
                  boxShadow: isActive
                    ? '0 8px 20px -8px rgba(31,117,255,.8)'
                    : (isRel ? '0 0 0 4px rgba(59,130,246,.14), 0 4px 12px -4px rgba(16,40,90,.22)' : '0 4px 12px -4px rgba(16,40,90,.22), 0 1px 3px -1px rgba(16,40,90,.10)'),
                  color: isActive ? '#fff' : '#1F75FF',
                  transition:'background .3s, border-color .3s, box-shadow .3s'
                }}
                  dangerouslySetInnerHTML={{__html: ORBIT_ICONS[item.icon]}} />
                <div style={{
                  fontSize: mobile?10.5:12, fontWeight: isActive?700:600, lineHeight:1.3,
                  textAlign:'center', maxWidth: mobile?70:96,
                  color: isActive ? '#0d4ea8' : 'rgba(0,0,0,.62)',
                  transition:'color .3s'
                }}>{item.title}</div>
              </div>
            );
          })}

          {/* карточка раздела */}
          {activeItem && (
            <div onClick={e=>e.stopPropagation()}
              style={{
                position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',
                zIndex:300, width: mobile?'min(330px,88vw)':'min(430px,88vw)',
                maxHeight: mobile?'66vh':'70vh', overflowY:'auto',
                background:'#fff',border:'1px solid rgba(16,40,90,.12)',borderRadius:18,
                padding:'22px 22px 24px',
                boxShadow:'0 30px 90px -30px rgba(16,40,90,.45), 0 8px 24px -12px rgba(16,40,90,.2)'
              }}>
              <button onClick={reset} aria-label="Закрыть"
                style={{position:'absolute',top:12,right:12,width:28,height:28,borderRadius:'50%',border:'none',
                  background:'rgba(16,40,90,.06)',color:'#111',cursor:'pointer',fontSize:14,lineHeight:1,
                  display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>✕</button>
              <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:12}}>
                <div style={{width:38,height:38,borderRadius:11,flex:'none',display:'flex',alignItems:'center',justifyContent:'center',
                  background:'linear-gradient(135deg,rgba(31,117,255,.14),rgba(13,78,168,.14))',border:'1px solid rgba(31,117,255,.22)',color:'#1F75FF'}}
                  dangerouslySetInnerHTML={{__html: ORBIT_ICONS[activeItem.icon]}} />
                <div>
                  <div style={{fontSize:17,fontWeight:800,letterSpacing:'-.02em',color:'#111'}}>{activeItem.title}</div>
                  <div style={{fontSize:11,color:'#1F75FF',marginTop:2,textTransform:'uppercase',letterSpacing:'.1em'}}>{activeItem.cat}</div>
                </div>
              </div>
              <div style={{fontSize:13.5,lineHeight:1.62,color:'rgba(0,0,0,.66)'}}>{activeItem.content}</div>
              <ul style={{listStyle:'none',margin:'14px 0 0',padding:0,display:'flex',flexDirection:'column',gap:8}}>
                {activeItem.feats.map((f,fi)=>(
                  <li key={fi} style={{display:'flex',gap:9,fontSize:12.5,lineHeight:1.5,color:'rgba(0,0,0,.62)'}}>
                    <span style={{width:5,height:5,borderRadius:'50%',background:'#1F75FF',flex:'none',marginTop:7}} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };


  /* ══ Сравнение: AtlasPos vs 1С/Excel (лёгкий стиль сайта) ══ */
  const ComparePro = () => {
    const pros = [
      <>Старт <b>за 15 минут</b> — без обучения и программиста</>,
      <>Касса, склад, клиенты и финансы — <b>в одной вкладке</b></>,
      <>Продажа сразу списывает остаток — <b>без расхождений</b></>,
      <><b>Чистая прибыль</b> считается автоматически</>,
      <>AI подсказывает <b>точки роста и риски</b></>,
      <>Зарплаты и табель — <b>без Excel</b></>,
      <>Перенос данных и <b>обновления бесплатно</b></>,
      <>Облако: телефон, планшет, компьютер + <b>резервные копии</b></>,
    ];
    const cons = [
      <>Внедрение <b>неделями</b>, платный программист для настройки</>,
      <>Сотни скрытых меню — <b>сотрудники путаются</b></>,
      <>Касса и склад <b>не связаны</b>, остатки расходятся</>,
      <>Формулы ломаются от <b>случайного клика</b></>,
      <>Чистой прибыли не видно — <b>кассовые разрывы</b></>,
      <>Продажи вносят вручную — <b>чеки теряются</b></>,
      <>Дорогие лицензии и <b>плата за обновления</b></>,
      <>Файлы на компьютерах и флешках — <b>один сбой и всё</b></>,
    ];
    const Check = () => (
      <span style={{width:16,height:16,flex:"none",marginTop:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1F75FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
      </span>
    );
    const Cross = () => (
      <span style={{width:16,height:16,flex:"none",marginTop:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(16,40,90,.35)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </span>
    );

    return (
      <div style={{position:"relative"}}>
      {!mobile && (
        <div style={{position:"absolute",left:"50%",top:24,transform:"translateX(-50%)",width:34,height:34,borderRadius:"50%",
          background:"#fff",border:"1px solid rgba(31,117,255,.28)",display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:10.5,fontWeight:800,color:"#1F75FF",letterSpacing:".05em",zIndex:2,boxShadow:"0 6px 16px -8px rgba(31,117,255,.6)"}}>VS</div>
      )}
      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:mobile?26:16,alignItems:"stretch"}}>
        {/* AtlasPos */}
        <div style={{borderRadius:20,padding:"22px 20px",display:"flex",flexDirection:"column",
          background:"linear-gradient(170deg,#F7FBFF,#EAF2FF)",border:"1px solid rgba(31,117,255,.22)",
          boxShadow:"0 18px 44px -32px rgba(31,117,255,.7)"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:16}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#1F75FF",flex:"none"}} />
            <span style={{fontSize:13,fontWeight:800,textTransform:"uppercase",letterSpacing:".13em",color:"#0d4ea8"}}>AtlasPos</span>
          </div>
          <ul style={{listStyle:"none",margin:0,padding:0,flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
            {pros.map((t,i)=>(
              <li key={i} style={{display:"flex",gap:9,fontSize:13.4,lineHeight:1.5,padding:"8px 0",alignItems:"flex-start",
                minHeight:36,color:"rgba(0,0,0,.74)"}}>
                <Check /><span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* 1С и Excel */}
        <div style={{borderRadius:20,padding:"22px 20px",display:"flex",flexDirection:"column",
          background:"#fff",border:"1px solid rgba(16,40,90,.10)"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:16}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"rgba(16,40,90,.25)",flex:"none"}} />
            <span style={{fontSize:13,fontWeight:800,textTransform:"uppercase",letterSpacing:".13em",color:"rgba(0,0,0,.42)"}}>1С и Excel</span>
          </div>
          <ul style={{listStyle:"none",margin:0,padding:0,flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
            {cons.map((t,i)=>(
              <li key={i} style={{display:"flex",gap:9,fontSize:13.4,lineHeight:1.5,padding:"8px 0",alignItems:"flex-start",
                minHeight:36,color:"rgba(0,0,0,.55)"}}>
                <Cross /><span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      </div>
    );
  };

  /* ══ Кому подходит: бегущие ленты сфер ══ */
  const SECTOR_ITEMS = [
      {i:'shop',e:'🛒',n:'Магазины'},
      {i:'cup',e:'☕',n:'Кофейни'},
      {i:'dish',e:'🍽️',n:'Рестораны и кафе'},
      {i:'pizza',e:'🍕',n:'Пиццерии'},
      {i:'fish',e:'🍣',n:'Суши-бары'},
      {i:'bread',e:'🥐',n:'Пекарни'},
      {i:'ice',e:'🍦',n:'Мороженое'},
      {i:'wrench',e:'🛠️',n:'Автосервисы'},
      {i:'moto',e:'🏍️',n:'Мотосервисы'},
      {i:'moto',e:'🏍️',n:'Мотомагазины'},
      {i:'wash',e:'🚿',n:'Автомойки'},
      {i:'scissors',e:'💇',n:'Салоны красоты'},
      {i:'nail',e:'💅',n:'Ногтевые студии'},
      {i:'dumbbell',e:'💪',n:'Фитнес-клубы'},
      {i:'lotus',e:'🧘',n:'Студии йоги'},
      {i:'paw',e:'🐾',n:'Зоомагазины'},
      {i:'flower',e:'🌸',n:'Цветочные'},
      {i:'phone',e:'📱',n:'Электроника'},
      {i:'laptop',e:'💻',n:'Компьютерные магазины'},
      {i:'shirt',e:'👗',n:'Бутики'},
      {i:'baby',e:'👶',n:'Детские товары'},
      {i:'bricks',e:'🏠',n:'Стройматериалы'},
      {i:'sofa',e:'🪑',n:'Мебельные салоны'},
      {i:'tools',e:'🔧',n:'Хозтовары'},
      {i:'book',e:'📚',n:'Книжные'},
      {i:'gamepad',e:'🎮',n:'Компьютерные клубы'},
      {i:'star',e:'🎳',n:'Развлечения'},
      {i:'truck',e:'🚚',n:'Доставка'},
      {i:'box',e:'🧾',n:'Оптовая торговля'},
      {i:'wrench',e:'🔨',n:'Ремонт техники'},
      {i:'dumbbell',e:'👟',n:'Спорттовары'},
      {i:'spark',e:'🎨',n:'Творческие мастерские'},
      {i:'car',e:'🚗',n:'Автосалоны'},
      {i:'wheel',e:'🛞',n:'Шиномонтаж'},
      {i:'beer',e:'🍺',n:'Бары и пабы'},
      {i:'cake',e:'🎂',n:'Кондитерские'},
      {i:'bowl',e:'🥗',n:'Столовые'},
      {i:'drop',e:'🧴',n:'Косметика'},
      {i:'hammer',e:'🏗️',n:'Строительные бригады'},
      {i:'bolt',e:'⚡',n:'Электротовары'}
  ];

  const SECTOR_SVG = {
    shop: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
    cup: '<path d="M4 8h13v5a6.5 6.5 0 01-13 0z"/><path d="M17 9h2a2.5 2.5 0 010 5h-2"/><path d="M3 21h16"/>',
    dish: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    pizza: '<path d="M12 3l9 17H3z"/><circle cx="12" cy="13" r="1"/><circle cx="9" cy="16" r="1"/><circle cx="15" cy="16" r="1"/>',
    fish: '<path d="M3 12c4-5 9-5 13 0-4 5-9 5-13 0z"/><path d="M16 12l5-3v6z"/><circle cx="7" cy="11" r=".8"/>',
    bread: '<path d="M4 10a5 5 0 015-5h6a5 5 0 015 5v8a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M8 9v2M12 9v2M16 9v2"/>',
    ice: '<path d="M12 3l8 5v8l-8 5-8-5V8z"/><path d="M12 3v18M4 8l16 8M20 8L4 16"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 105 5L11 20a3 3 0 01-4-4z"/>',
    moto: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6l-2-6H8l3-4h3"/>',
    wash: '<path d="M5 13h14v6a2 2 0 01-2 2H7a2 2 0 01-2-2z"/><path d="M8 9c0-2 2-2 2-4M13 9c0-2 2-2 2-4"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8l12 10M20 6L8 16"/>',
    nail: '<path d="M8 3h8l-1 9a3 3 0 01-6 0z"/><path d="M12 12v9"/>',
    dumbbell: '<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
    lotus: '<path d="M12 4c2 3 2 6 0 9-2-3-2-6 0-9z"/><path d="M4 12c3 0 6 2 8 5-3 1-6 0-8-5zM20 12c-3 0-6 2-8 5 3 1 6 0 8-5z"/>',
    paw: '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="17" cy="9" r="2"/><path d="M12 11c3 0 5 2 5 4.5S14.5 20 12 20s-5-2-5-4.5S9 11 12 11z"/>',
    flower: '<circle cx="12" cy="10" r="2.5"/><path d="M12 7.5c0-3 1.5-4.5 3-3.5S15 7.5 12 7.5zM12 7.5c0-3-1.5-4.5-3-3.5S9 7.5 12 7.5zM12 12.5c0 3 1.5 4.5 3 3.5S15 12.5 12 12.5zM12 12.5c0 3-1.5 4.5-3 3.5S9 12.5 12 12.5z"/><path d="M12 15v6"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
    shirt: '<path d="M8 3l4 3 4-3 5 3-2 4-2-1v11H7V9L5 10 3 6z"/>',
    baby: '<circle cx="12" cy="12" r="8"/><path d="M9 11h.01M15 11h.01"/><path d="M9 15c1.5 1.5 4.5 1.5 6 0"/>',
    bricks: '<rect x="3" y="5" width="8" height="6" rx="1"/><rect x="13" y="5" width="8" height="6" rx="1"/><rect x="3" y="13" width="18" height="6" rx="1"/>',
    sofa: '<path d="M4 12V8a2 2 0 012-2h12a2 2 0 012 2v4"/><path d="M2 12a2 2 0 012 2v4h16v-4a2 2 0 012-2"/><path d="M6 18v2M18 18v2"/>',
    tools: '<path d="M14.7 6.3a4 4 0 105 5L11 20a3 3 0 01-4-4z"/><path d="M3 3l6 6"/>',
    book: '<path d="M4 4h7a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H4z"/><path d="M20 4h-4a3 3 0 00-3 3"/>',
    gamepad: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 12h3M8.5 10.5v3"/><circle cx="16" cy="11.5" r=".9"/><circle cx="18" cy="14" r=".9"/>',
    star: '<path d="M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 17.2 6.4 20.2l1.3-6.3L3 9.6l6.3-.7z"/>',
    truck: '<path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    box: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
    spark: '<path d="M12 3l2.2 5.3L20 10l-5.8 1.7L12 17l-2.2-5.3L4 10l5.8-1.7z"/>',
    bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
    hammer: '<path d="M14 3l7 7-3 3-7-7z"/><path d="M11 6L4 13l4 4 7-7"/>',
    car: '<path d="M5 16l1.5-5h11L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.5"/><circle cx="7" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>',
    beer: '<path d="M7 3h8l-1 14a3 3 0 01-3 3h0a3 3 0 01-3-3z"/><path d="M15 7h2a2 2 0 010 4h-2"/>',
    cake: '<path d="M4 20h16v-6a3 3 0 00-3-3H7a3 3 0 00-3 3z"/><path d="M12 8V5"/><path d="M9 20v-4M15 20v-4"/>',
    bowl: '<path d="M3 11h18a9 9 0 01-18 0z"/><path d="M8 7c0-2 1.5-3 2-4M13 7c0-2 1.5-3 2-4"/>',
    drop: '<path d="M12 3s6 6.5 6 10a6 6 0 01-12 0c0-3.5 6-10 6-10z"/>',
  };

  const SectorChip = ({item, hero}) => (
    <div style={{flex:"none",display:"flex",alignItems:"baseline",gap:3,background:"none",border:"none",
      whiteSpace:"nowrap"}}>
      <span style={{fontSize:mobile?12:15,fontWeight:800,color:"#1F75FF",letterSpacing:"-.05em",lineHeight:1}}>{item.n.charAt(0).toUpperCase()}</span>
      <span style={{fontSize:mobile?12:13.5,fontWeight:600,color:"#111",letterSpacing:"-.02em",lineHeight:1}}>{item.n.slice(1)}</span>
      <span style={{width:5,height:5,borderRadius:"50%",background:"rgba(31,117,255,.35)",alignSelf:"center",marginLeft:16}} />
    </div>
  );

  const MarqueeSectors = () => {
    const half = Math.ceil(SECTOR_ITEMS.length / 2);
    const row1 = SECTOR_ITEMS.slice(0, half);
    const row2 = SECTOR_ITEMS.slice(half);
    const mask = "linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)";
    const rowStyle = (rev) => ({
      display:"flex", gap:14, overflow:"hidden", padding:"7px 0",
      maskImage:mask, WebkitMaskImage:mask
    });
    const trackStyle = (dur, rev) => ({
      display:"flex", gap:14, flex:"none",
      animation:`secscroll ${dur}s linear infinite`,
      animationDirection: rev ? "reverse" : "normal"
    });
    return (
      <div className="sectors-marquee" style={{marginTop:mobile?18:24}}>
        <style>{`@keyframes secscroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
          .sectors-marquee:hover [style*="secscroll"]{animation-play-state:paused}`}</style>
        <div style={rowStyle(false)}>
          <div style={trackStyle(42,false)}>
            {[...row1, ...row1].map((it,i)=><SectorChip key={"a"+i} item={it} hero={i%7===0} />)}
          </div>
        </div>
        <div style={rowStyle(true)}>
          <div style={trackStyle(50,true)}>
            {[...row2, ...row2].map((it,i)=><SectorChip key={"b"+i} item={it} hero={i%7===0} />)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="landing-page" style={{fontFamily:"Inter,sans-serif",color:"#111",minHeight:"100vh",display:"block",width:"100%",maxWidth:"100vw",overflowX:"clip",position:"relative",background:"#fff",margin:0}}>
      {/* ===== ФОНОВОЕ СВЕЧЕНИЕ ОТ САМОГО ВЕРХА ===== */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:"1200px",pointerEvents:"none",zIndex:0,
        background:"radial-gradient(ellipse 80% 55% at 50% 0%, rgba(31,117,255,.13), rgba(31,117,255,.05) 45%, transparent 75%)"}} />
      <div style={{position:"relative",zIndex:1}}>
      {/* ===== ХЕДЕР ===== */}
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:mobile?"12px 16px":"14px 24px",maxWidth:1280,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:mobile?7:9,flexShrink:0}}>
          <div style={{width:mobile?26:30,height:mobile?26:30,borderRadius:mobile?8:9,flexShrink:0,
            background:"linear-gradient(135deg,#1F75FF,#0d4ea8)",color:"#fff",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontWeight:800,fontSize:mobile?13:15,letterSpacing:"-.02em",lineHeight:1}}>A</div>
          <span style={{fontWeight:800,fontSize:mobile?16:18,letterSpacing:"-.03em",color:"#111",lineHeight:1}}>AtlasPos</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:"auto",marginRight:mobile?0:56,minWidth:0}}>
          <button onClick={()=>n('/login')} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:mobile?"7px 11px":"9px 22px",borderRadius:100,border:"1px solid rgba(16,40,90,.12)",background:"#fff",color:"#111",fontSize:mobile?11.5:13,whiteSpace:"nowrap",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 3px 0 -1px #e6eaf1, 0 6px 12px -6px rgba(16,40,90,.22)",transition:"transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .22s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 0 -1px #e6eaf1, 0 9px 16px -8px rgba(16,40,90,.26)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 3px 0 -1px #e6eaf1, 0 6px 12px -6px rgba(16,40,90,.22)";}}>
            Войти
          </button>
          <button onClick={()=>n('/register')} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:mobile?"7px 11px":"9px 22px",borderRadius:100,border:"1px solid rgba(16,40,90,.12)",background:"#fff",color:"#111",fontSize:mobile?11.5:13,whiteSpace:"nowrap",fontWeight:700,fontFamily:"inherit",cursor:"pointer",boxShadow:"0 3px 0 -1px #e6eaf1, 0 6px 12px -6px rgba(16,40,90,.22)",transition:"transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .22s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 0 -1px #e6eaf1, 0 9px 16px -8px rgba(16,40,90,.26)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 3px 0 -1px #e6eaf1, 0 6px 12px -6px rgba(16,40,90,.22)";}}>
            Попробовать бесплатно
          </button>
        </div>
      </header>

      {/* ===== ЗАГОЛОВОК ===== */}
      <section style={{maxWidth:1180,margin:"0 auto",padding:mobile?"18px 20px 6px":"26px 24px 10px"}}>
        <div style={{textAlign:"left",marginBottom:mobile?20:26}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 16px",borderRadius:100,background:"#E6F0FF",fontSize:mobile?11.5:13,fontWeight:700,color:"#0d4ea8"}}>
            Первая программа с AI аналитикой
          </span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1.05fr .95fr",gap:mobile?22:56,alignItems:"center"}}>
          <h1 style={{fontSize:mobile?30:56,fontWeight:800,letterSpacing:"-.035em",lineHeight:1.04,color:"#111"}}>
            <span style={{display:"block"}}>Учёт бизнеса</span>
            <span style={{display:"block",color:"rgba(0,0,0,.22)"}}>без</span>
            <span style={{display:"block",background:"linear-gradient(135deg,#4a92ff,#1F75FF 55%,#0d4ea8)",WebkitBackgroundClip:"text",backgroundClip:"text",color:"transparent"}}>рутины.</span>
          </h1>
          <div style={{maxWidth:520,display:"flex",alignItems:"center"}}>
            <p style={{fontSize:mobile?13:15,lineHeight:1.62,color:"rgba(0,0,0,.55)"}}>
              Умный учёт для современного бизнеса. Объедините кассу, склад, финансы, команду и маркетинг в единый автоматизированный контур. AI-аналитика избавит от таблиц и покажет реальные точки роста вашей прибыли.
            </p>
          </div>
        </div>
      </section>

      {/* ===== ИЗОГНУТАЯ ЛЕНТА СО СКРИНАМИ ===== */}
      <section style={{width:"100%",padding:0}}>
        <ScreenBand />
      </section>

      {/* ===== ЧЕТЫРЕ ПРИЧИНЫ (веер карточек) ===== */}
      <section style={{maxWidth:1180,margin:mobile?"56px auto":"88px auto",padding:"0 24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:mobile?10:14}}>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
          <h2 style={{fontSize:mobile?13:15,fontWeight:700,textTransform:"uppercase",letterSpacing:".16em",color:"#111",whiteSpace:"nowrap",textAlign:"center"}}>Порядок в учёте с первых минут</h2>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
        </div>
        <p style={{fontSize:mobile?14:15.5,color:"rgba(0,0,0,.5)",textAlign:"center",marginBottom:mobile?14:20,lineHeight:1.5}}>Четыре причины автоматизировать учёт в AtlasPos</p>
        <WhyStack />
      </section>

      {/* ===== ПРЕВЬЮ ИНТЕРФЕЙСА (6 возможностей) ===== */}
      <section style={{maxWidth:1280,margin:"80px auto",padding:"0 24px"}}>
                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:mobile?10:14}}>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
          <h2 style={{fontSize:mobile?13:15,fontWeight:700,textTransform:"uppercase",letterSpacing:".16em",color:"#111",whiteSpace:mobile?"normal":"nowrap",textAlign:"center",maxWidth:mobile?"78%":"none",lineHeight:1.5}}>Внутри AtlasPos: от кассы до чистой прибыли</h2>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
        </div>
        <p style={{fontSize:mobile?14:15.5,color:"rgba(0,0,0,.5)",textAlign:"center",marginBottom:mobile?14:20}}>Все разделы системы — нажмите любой, чтобы узнать, что он умеет</p>
        <OrbitRing />
      </section>

      {/* ===== КОНТРАСТ СИСТЕМ (AtlasPos vs 1С/Excel) ===== */}
      <section style={{maxWidth:1280,margin:"80px auto",padding:"0 24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:mobile?10:14}}>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
          <h2 style={{fontSize:mobile?13:15,fontWeight:700,textTransform:"uppercase",letterSpacing:".16em",color:"#111",whiteSpace:mobile?"normal":"nowrap",textAlign:"center",margin:0,lineHeight:1.45,maxWidth:mobile?"78%":"none"}}>Забудьте о сложных настройках других программ</h2>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
        </div>
        <p style={{fontSize:mobile?14:15.5,color:"rgba(0,0,0,.5)",textAlign:"center",marginBottom:mobile?14:24}}>Сравните, как работают привычные методы и наша умная платформа</p>

        <ComparePro />
      </section>
      <section style={{maxWidth:900,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:mobile?10:14}}>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
          <h2 style={{fontSize:mobile?13:15,fontWeight:700,textTransform:"uppercase",letterSpacing:".16em",color:"#111",whiteSpace:mobile?"normal":"nowrap",textAlign:"center",lineHeight:1.45,maxWidth:mobile?"70%":"none"}}>Для какого бизнеса создана платформа?</h2>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
        </div>
        <p style={{fontSize:mobile?14:15.5,color:"rgba(0,0,0,.5)",textAlign:"center",marginBottom:mobile?14:24}}>AtlasPos адаптируется под ваши задачи, вне зависимости от масштаба и направления компании</p>
        <MarqueeSectors />
        <p style={{fontSize:mobile?12.5:13,color:"rgba(0,0,0,.42)",textAlign:"center",marginTop:mobile?20:26}}>
          Не нашли свою сферу? <b style={{color:"#0d4ea8",fontWeight:700}}>Настроим под ваш бизнес</b> — перенос данных бесплатно
        </p>
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
                "Спросите «Сколько заработали в марте?» или «Какой сотрудник принес больше всего прибыли?»."},
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
                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:mobile?10:14}}>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
          <h2 style={{fontSize:mobile?13:15,fontWeight:700,textTransform:"uppercase",letterSpacing:".16em",color:"#111",whiteSpace:"nowrap",textAlign:"center"}}>Остались вопросы? Отвечаем</h2>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
        </div>
        <p style={{fontSize:mobile?14:15.5,color:"rgba(0,0,0,.5)",textAlign:"center",marginBottom:mobile?14:24}}>Все, что нужно знать о старте, безопасности и возможностях платформы AtlasPos</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[ 
            {q:"Сколько стоит AtlasPos?",a:"Мы гибко подходим к ценообразованию в зависимости от масштаба вашей компании. Есть прозрачные тарифы для небольших команд и крупных сетей, а начать можно абсолютно бесплатно."},
            {q:"Можно ли попробовать бесплатно?",a:"Да! Мы предоставляем полноценный тестовый доступ на 14 дней. Вам не нужно привязывать банковскую карту — просто зарегистрируйтесь за 1 минуту и сразу тестируйте все возможности системы."},
            {q:"Нужно ли устанавливать программу?",a:"Нет, ничего скачивать не нужно. AtlasPos — это облачная платформа. Вы можете работать из любого браузера на компьютере, планшете или смартфоне, а данные обновляются в реальном времени."},
            {q:"Мои данные в безопасности?",a:"Абсолютно. Мы используем передовые протоколы шифрования, регулярное резервное копирование и строгую систему разграничения прав доступа. Ваши показатели защищены надежнее, чем в Excel."},
            {q:"Можно ли добавить сотрудников?",a:"Да, вы можете подключать всю команду и гибко настраивать права доступа для каждого. Например, кладовщик будет видеть только склад, но не получит доступ к отчетам о чистой прибыли."},
          ].map((f,i)=>(
            <FaqItem key={i} question={f.q} answer={f.a} />
          ))}
        </div>
      </section>

      {/* ===== ТАРИФЫ ===== */}
      <section style={{maxWidth:1280,margin:"80px auto",padding:"0 24px"}}>
                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:mobile?10:14}}>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
          <h2 style={{fontSize:mobile?13:15,fontWeight:700,textTransform:"uppercase",letterSpacing:".16em",color:"#111",whiteSpace:"nowrap",textAlign:"center"}}>Тарифы</h2>
          <span style={{flex:1,height:1,background:"rgba(16,40,90,.14)"}} />
        </div>
        <p style={{fontSize:mobile?14:15.5,color:"rgba(0,0,0,.5)",textAlign:"center",marginBottom:mobile?14:24}}>Прозрачные цены для бизнеса любого масштаба</p>

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
            {name:"Базовый",price:490,desc:"Для самозанятых и микро-бизнеса",features:["Учет доходов и расходов","База клиентов (CRM)","1 пользователь"],popular:false,btn:"Подключить"},
            {name:"Старт",price:990,desc:"Для малого бизнеса и сервисов",features:["Полный учет кассы","Складской учет и остатки","Автокатегоризация AI","До 2 пользователей"],popular:false,btn:"Подключить"},
            {name:"Бизнес",price:2900,desc:"Для компаний с командой",features:["Все функции тарифа «Старт»","Зарплата и табель сотрудников","Управление ролями и доступом","Безлимитный AI-помощник","До 5 пользователей"],popular:true,btn:"Подключить"},
            {name:"Профи",price:6900,desc:"Для сетей и крупных проектов",features:["Все функции тарифа «Бизнес»","Мульти-аккаунты (несколько точек)","Интеграции и доступ к API","ИИ-мониторинг аномалий","Безлимитные пользователи"],popular:false,btn:"Подключить"},
          ].map((t,i)=>{
            const basePrice = t.price;
            const currentPrice = periodPrices[period][i];
            const saving = period === '1m' ? 0 : periodSavings[period][i];
            const periodText = period === '1y' ? 'год' : period === '6m' ? '6 мес' : period === '3m' ? '3 мес' : 'мес';
            return (
            <div key={i} style={{
              border: t.popular ? "1.5px solid #1F75FF" : "1.5px solid rgba(0,0,0,.08)",
              borderRadius:20,padding:"24px 14px",background:"#fff",
              position:"relative",boxShadow:t.popular?"0 8px 24px rgba(0,0,0,.08)":"none",
              display:"flex",flexDirection:"column",
            }}>
              {t.popular && <div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",padding:"3px 14px",borderRadius:100,background:"linear-gradient(135deg,#1F75FF,#0d4ea8)",fontSize:10,fontWeight:700,color:"#fff",whiteSpace:"nowrap"}}>Популярный</div>}
              <div style={{fontSize:15,fontWeight:700,marginBottom:2}}>{t.name}</div>
              <div style={{marginBottom:2}}>
                {period === '1m' ? (
                  <>
                    <span style={{fontSize:22,fontWeight:800}}>{basePrice.toLocaleString()} {cur}</span>
                  </>
                ) : (
                  <>
                    <span style={{fontSize:15,fontWeight:600,color:"rgba(0,0,0,.2)",textDecoration:"line-through",textDecorationColor:"rgba(220,38,38,.4)",textDecorationThickness:2}}>
                      {basePrice.toLocaleString()} {cur}
                    </span>
                    <span style={{fontSize:22,fontWeight:800,marginLeft:6}}>{currentPrice.toLocaleString()} {cur}</span>
                  </>
                )}
              </div>
              {period !== '1m' && (
                <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"#f0fdf4",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,color:"#16a34a",marginBottom:6,width:"fit-content"}}>
                  Выгода {saving.toLocaleString()} {cur}
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
                background:t.popular?"linear-gradient(135deg,#1F75FF,#0d4ea8)":"rgba(0,0,0,.06)",color:t.popular?"#fff":"#111",
                transition:"all .15s",
              }}
                onMouseEnter={e=>{if(t.popular)e.currentTarget.style.background="#0d4ea8"}}
                onMouseLeave={e=>{if(t.popular)e.currentTarget.style.background="linear-gradient(135deg,#1F75FF,#0d4ea8)"}}>{t.btn}</button>
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
          <button onClick={()=>n('/register')} style={{padding:"12px 32px",borderRadius:100,border:"none",background:"linear-gradient(135deg,#1F75FF,#0d4ea8)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#fff"}}>Создать аккаунт</button>
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
    </div>
  );
}
