// Маленький кружок строго по центру экрана — пока грузятся данные раздела.
// Не перекрывает интерфейс белым фоном и не дублирует системный экран «AtlasPos»
// (чтобы не было эффекта «второй экран загрузки»).
export default function CenterSpinner() {
  return (
    <>
      <div style={{flex:1,minHeight:0}} />
      <div style={{position:'fixed',inset:0,zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
        <div style={{width:'26px',height:'26px',border:'3px solid #eee',borderTopColor:'#111',borderRadius:'50%',animation:'spin 0.8s linear infinite',background:'#fff',boxShadow:'0 0 0 6px #fff'}} />
      </div>
    </>
  );
}
