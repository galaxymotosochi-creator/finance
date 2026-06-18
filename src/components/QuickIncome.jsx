import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function QuickIncome({ onClose }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [payMode, setPayMode] = useState(null);
  const [client, setClient] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    supabase.from('accounts').select('*').eq('user_id', user.id).order('name').then(({ data }) => { if (data) setAccounts(data); });
  }, [user]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  const process = async () => {
    if (!amount || !payMode) return setToast('⚠️ Укажите сумму и выберите счёт');
    const date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id, type: 'income', amount: parseFloat(amount),
      description: desc.trim() || 'Доход',
      date, account_id: payMode, status: 'paid',
    });
    if (error) return setToast('' + error.message);
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={e => { if (e.target.className === 'modal-overlay active') onClose(); }}>
      {toast && <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'1rem 1.5rem',fontSize:'.9rem',zIndex:10000}}>{toast}</div>}
      <div className="modal-box" style={{maxWidth:'420px',padding:0}}>
        <div style={{padding:'20px 24px 0',display:'flex',justifyContent:'space-between',alignItems:'center',paddingBottom:'12px',borderBottom:'1px solid #eee'}}>
          <h2 style={{fontSize:'16px',fontWeight:700,margin:0}}>Доход</h2>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'#999',padding:'0 4px'}}>×</button>
        </div>
        <div style={{padding:'14px 24px 0'}}>
          <div className="form-group">
            <label>Описание</label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Назначение платежа..." />
          </div>
          <div className="form-group">
            <label>Сумма</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
          </div>
          <div className="form-group">
            <label>Счёт</label>
            <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
              {accounts.map(a => (
                <button key={a.id} onClick={() => setPayMode(a.id)} style={{
                  padding:'6px 12px',borderRadius:'6px',border:'1px solid #eee',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                  background: payMode === a.id ? '#000' : '#fff', color: payMode === a.id ? '#fff' : '#555',
                }}>{a.name}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{padding:'16px 24px',borderTop:'1px solid #eee',display:'flex',gap:'8px',marginTop:'14px'}}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{flex:1}}>Отмена</button>
          <button type="button" className="btn btn-account-select" onClick={process} disabled={!amount || !payMode}
            style={{flex:1,opacity: (amount && payMode) ? 1 : 0.4}}>Добавить</button>
        </div>
      </div>
    </div>
  );
}
