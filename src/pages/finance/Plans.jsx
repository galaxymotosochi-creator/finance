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

// «1 000,50» → 1000.5; «-5» → -5; пусто/мусор → 0
const parseAmount = (raw) => {
  const cleaned = String(raw || '').replace(/\s/g, '').replace(',', '.');
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : v;
};

export default function Plans() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState('month');
  const [plans, setPlans] = useState([]);
  const [editValues, setEditValues] = useState({});
  const [toast, setToast] = useState(null);
  const [toastError, setToastError] = useState(false);
  const [dirty, setDirty] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  const showToast = (msg, isError = false) => {
    setToastError(isError);
    setToast(msg);
    setTimeout(() => setToast(null), isError ? 4000 : 2000);
  };

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase.from('plans').select('*')
        .eq('user_id', user.id).eq('period', period).eq('year', year);
      // Фильтруем по конкретному месяцу/кварталу, чтобы план прошлого месяца
      // не подхватывался как текущий и не перезаписывался
      if (period === 'month') q = q.eq('month', month);
      else if (period === 'quarter') q = q.eq('quarter', quarter);
      const { data, error } = await q;
      if (error) throw error;

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
      plansList.forEach(p => { vals[p.target_type] = p.target_amount ? String(p.target_amount) : ''; });
      setEditValues(vals);
      setDirty(false);
    } catch (e) {
      showToast('Ошибка загрузки: ' + (e.message || 'неизвестная ошибка'), true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); }, [user, period]);

  const switchPeriod = (k) => {
    if (k === period) return;
    if (dirty && !window.confirm('Есть несохранённые изменения. Переключить период без сохранения?')) return;
    setPeriod(k);
  };

  const handleChange = (key, val) => {
    setEditValues({ ...editValues, [key]: val });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      // 1. Валидация сумм
      const amounts = {};
      for (const p of plans) {
        const v = parseAmount(editValues[p.target_type]);
        amounts[p.target_type] = v;
        if (v < 0) {
          showToast('«' + p.label + '» — сумма не может быть отрицательной', true);
          setSaving(false);
          return;
        }
      }

      // 2. Найти ВСЕ записи за период (включая «хвосты» прошлых месяцев и дубли)
      const { data: allRows, error: selErr } = await supabase.from('plans').select('*')
        .eq('user_id', user.id).eq('period', period).eq('year', year);
      if (selErr) throw selErr;

      const keyCol = period === 'month' ? 'month' : period === 'quarter' ? 'quarter' : null;
      const keyVal = period === 'month' ? month : period === 'quarter' ? quarter : null;

      // 3. Удаляем хвосты (не текущий месяц/квартал) и дубли одного target_type
      const seen = new Set();
      const toDelete = [];
      for (const r of allRows || []) {
        if (keyCol && r[keyCol] !== keyVal) { toDelete.push(r.id); continue; }
        if (seen.has(r.target_type)) toDelete.push(r.id);
        else seen.add(r.target_type);
      }
      for (const id of toDelete) {
        const { error: delErr } = await supabase.from('plans').delete().eq('id', id);
        if (delErr) throw delErr;
      }

      // 4. Обновить существующие / вставить новые (проверяем каждый ответ)
      const ops = [];
      for (const p of plans) {
        const payload = {
          user_id: user.id,
          period,
          year,
          month: period === 'month' ? month : null,
          quarter: period === 'quarter' ? quarter : null,
          target_type: p.target_type,
          target_amount: amounts[p.target_type],
        };
        if (p.id) {
          ops.push(supabase.from('plans').update(payload).eq('id', p.id));
        } else {
          ops.push(supabase.from('plans').insert({ ...payload, id: Date.now() + Math.floor(Math.random() * 99999) }));
        }
      }
      const results = await Promise.all(ops);
      const errs = results.filter(r => r && r.error);
      if (errs.length) throw errs[0].error;

      showToast('Планы успешно сохранены!');
      setDirty(false);
      await load();
    } catch (e) {
      showToast('Ошибка сохранения: ' + (e.message || 'неизвестная ошибка'), true);
    } finally {
      setSaving(false);
    }
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
          <button key={k} onClick={() => switchPeriod(k)} style={{
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
                    onChange={e => handleChange(p.target_type, e.target.value)}
                    placeholder="0"
                    style={{
                      width:'130px', padding:'5px 8px', border:'1.5px solid #ddd', borderRadius:'8px',
                      fontSize:'.8rem', fontFamily:'inherit', textAlign:'left', outline:'none', background:'#fafafa'
                    }}
                    onFocus={e => e.target.style.borderColor = '#000'}
                    onBlur={e => e.target.style.borderColor = '#ddd'}
                  />

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
        position:'fixed', bottom:'24px', right:'24px',
        background: toastError ? '#dc2626' : '#fff',
        color: toastError ? '#fff' : '#333',
        border: toastError ? 'none' : '1px solid #e5e7eb',
        borderRadius:'12px', padding:'.7rem 1.2rem', fontSize:'.85rem',
        boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.15)', zIndex:9999, maxWidth:'320px'
      }}>{toast}</div>}
    </div>
  );
}
