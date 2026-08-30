// Красивый экран загрузки — спиннер по центру экрана
export default function Loader({ label }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      background:'#fff', gap:'14px'
    }}>
      <div style={{ width:'34px', height:'34px', border:'3px solid #eee', borderTopColor:'#111', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      {label ? <div style={{ fontSize:'.8rem', color:'#999' }}>{label}</div> : null}
    </div>
  );
}
