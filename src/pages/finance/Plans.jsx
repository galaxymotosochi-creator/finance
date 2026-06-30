import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const TARGET_LABELS = {
  revenue: { label: 'Выручка', icon: '💰', unit: '₽', color: '#16a34a' },
  profit: { label: 'Прибыль', icon: '📈', unit: '₽', color: '#16a34a' },
  expense: { label: 'Расходы (бюджет)', icon: '💸', unit: '₽', color: '#dc2626' },
  sales_qty: { label: 'Продать товаров', icon: '📦', unit: 'шт', color: '#f59e0b' },
  new_clients: { label: 'Новых клиентов', icon: '👥', unit: 'чел', color: '#16a34a' },
  avg_check: { label: 'Средний чек', icon: '🧾', unit: '₽', color: '#16a34a' },
  procurement: { label: 'Закупка товаров', icon: '🚚', unit: '₽', color: '#f59e0b' },
  marketing: { label: 'Реклама / Маркетинг', icon: '📢', unit: '₽', color: '#f59e0b' },
  payroll: { label: 'ФОТ (фонд оплаты)', icon: '👨‍💼', unit: '₽', color: '#dc2626' },
  unexpected: { label: 'Непредвиденные', icon: '⚠️', unit: '₽', color: '#dc2626' },
};

export default function Plans() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState('month');
  const [plans, setPlans] = useState([]);
  const [editValues, setEditValues] = useState({});
  const [toast, setToast] = useState(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  const load = async () => {
    setLoading(true);
    const filters = { user_id: user.id, period, year };
    const { data } = await supabase.from('plans').select('*').eq('user_id', user.id).eq('period', period).eq('year', year);
    const existing = data || [];
    const plansList = Object.keys(TARGET_LABELS).map(key => {
      const found = existing.find(p => p.target_type === key);
      return {
        id: found?.id || null,
        target_type: key,
        target_amount: found?.target_amount || 0,
        ...TARGET_LABELS[key],
      };
    });
    setPlans(plansList);
    const vals = {};
    plansList.forEach(p => { vals[p.target_type] = String(p.target_amount); });
    setEditValues(vals);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user, period]);

  const save = async () => {
    setSaving(true);
    const operations = [];
    
    for (const p of plans) {
      const amount = parseFloat(editValues[p.target_type]) || 0;
      const payload = { user_id: user.id, period, year, month: period === 'month' ? month : null, quarter: period === 'quarter' ? quarter : null, target_type: p.target_type, target_amount: amount };
      
      if (p.id) {
        operations.push(supabase.from('plans').update(payload).eq('id', p.id));
      } else if (amount > 0) {
        operations.push(supabase.from('plans').insert({ ...payload, id: Date.now() + Math.random() }));
      }
    }
    
    await Promise.all(operations);
    setSaving(false);
    setToast('Планы сохранены');
    setTimeout(() => setToast(null), 2000);
    load();
  };

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'300px',color:'#999',fontSize:'.85rem'}}>Загрузка...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Планирование</h1>
          <div className="sub">Цели и бюджеты на {period === 'month' ? 'месяц' : period === 'quarter' ? 'квартал' : 'год'}</div>
        </div>
        <div className="page-actions">
          <button className="btn-mint" onClick={save} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
        </div>
      </div>

      <div style={{display:'flex',gap:'4px',marginBottom:'14px'}}>
        {[['month','Месяц'],['quarter','Квартал'],['year','Год']].map(([k,l]) => (
          <button key={k} onClick={() => setPeriod(k)} style={{
            padding:'3px 12px', borderRadius:'100px', border:'1.5px solid rgba(0,0,0,.12)',
            background: period === k ? '#000' : 'transparent',
            color: period === k ? '#fff' : '#555',
            fontSize:'.75rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit'
          }}>{l}</button>
        ))}
      </div>

      {['💰 Финансовые цели','📦 Продажи','📈 Бюджет','🏢 Команда'].map((groupLabel, gi) => {
        const keys = gi === 0 ? ['revenue','profit','expense'] : gi === 1 ? ['sales_qty','new_clients','avg_check'] : gi === 2 ? ['procurement','marketing','unexpected'] : ['payroll'];
        const groupPlans = plans.filter(p => keys.includes(p.target_type));
        if (groupPlans.length === 0) return null;
        return (
          <div key={gi} className="plan-group" style={{
            background:'#fff', borderRadius:'14px', padding:'16px', marginBottom:'10px',
            border:'1px solid rgba(0,0,0,.08)', boxShadow:'0 1px 3px rgba(0,0,0,.04)'
          }}>
            <h2 style={{fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', color:'rgba(0,0,0,.5)', marginBottom:'8px'}}>{groupLabel}</h2>
            {groupPlans.map(p => (
              <div key={p.target_type} style={{
                display:'flex', alignItems:'center', gap:'10px', padding:'6px 0',
                borderBottom:'1px solid #f5f5f5'
              }}>
                <span style={{fontSize:'.82rem', fontWeight:500, flex:1, color:'#333'}}>
                  <span style={{marginRight:'6px'}}>{p.icon}</span>
                  {p.label}
                </span>
                <div style={{position:'relative'}}>
                  <input type="text" value={editValues[p.target_type] || ''}
                    onChange={e => setEditValues({...editValues, [p.target_type]: e.target.value})}
                    placeholder="0"
                    style={{
                      width:'130px', padding:'5px 8px', border:'1.5px solid #ddd', borderRadius:'8px',
                      fontSize:'.8rem', fontFamily:'inherit', textAlign:'right', outline:'none', background:'#fafafa'
                    }}
                    onFocus={e => e.target.style.borderColor = '#000'}
                    onBlur={e => e.target.style.borderColor = '#ddd'}
                  />
                  <span style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', fontSize:'.72rem', color:'rgba(0,0,0,.4)', pointerEvents:'none'}}>{p.unit}</span>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <p style={{textAlign:'center', marginTop:'12px', fontSize:'.72rem', color:'rgba(0,0,0,.3)'}}>
        Установите цели на период — дашборд покажет % выполнения
      </p>

      {toast && <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        background:'#fff', border:'1px solid #e5e7eb', borderRadius:'.75rem',
        padding:'.65rem 1.2rem', fontSize:'.85rem', color:'#333',
        boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.12)', zIndex:9999
      }}>{toast}</div>}
    </div>
  );
}
