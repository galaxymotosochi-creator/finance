import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth();

  return (
    <>
      <Sidebar />
      <div className="main">
        <header style={{background:'#000',padding:'5px 16px',display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#ff6052'}}/>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#ffbd2e'}}/>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#28c93f'}}/>
          <span style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,.8)',letterSpacing:'.03em',marginLeft:'4px'}}>FINANCE</span>
          <span style={{flex:1}} />
          <span style={{fontSize:10,color:'rgba(255,255,255,.5)',marginRight:'10px'}}>{user?.email}</span>
          <button onClick={signOut} style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.15)',color:'rgba(255,255,255,.7)',fontSize:9,fontWeight:600,borderRadius:'100px',padding:'3px 12px',cursor:'pointer',fontFamily:'inherit',letterSpacing:'.03em'}}>Выйти</button>
        </header>
        <div className="content">
          {children}
        </div>
      </div>
    </>
  );
}
