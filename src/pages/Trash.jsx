import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import Loader from '../components/Loader';

// Человеческие названия таблиц для корзины
const TABLE_LABELS = {
  products: 'Товар / услуга',
  categories: 'Фин. категория',
  stock_categories: 'Категория склада',
  accounts: 'Счёт',
  transactions: 'Операция',
  suppliers: 'Поставщик',
  supplies: 'Поставка',
  writeoffs: 'Списание',
  inventory: 'Инвентаризация',
  employees: 'Сотрудник',
  position_templates: 'Должность',
  positions: 'Должность',
  receipts: 'Чек',
  clients: 'Клиент',
  promos: 'Акция',
  plans: 'План',
  initial_stocks: 'Начальные остатки',
  employee_debts: 'Долг сотрудника',
  salary: 'Начисление зарплаты',
  shifts: 'Кассовая смена',
  timesheet_entries: 'Запись табеля',
  stock_units: 'Ед. измерения',
};

// Достаём «имя» записи из данных — для каждой таблицы своё поле
function recordName(table, d) {
  const data = d.data || {};
  if (typeof data === 'string') { try { return JSON.parse(data).name || ''; } catch (e) { return ''; } }
  return data.name || data.supplier_name || data.title || data.number || data.employee_name || data.email || data.invoice || data.reason || '';
}

export default function Trash() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('trash').select('*').eq('user_id', user.id).order('deleted_at', { ascending: false });
      if (error) throw error;
      setList(data || []);
    } catch (e) { alert('Ошибка загрузки корзины: ' + e.message); }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  const restore = async (id) => {
    if (!confirm('Восстановить запись?')) return;
    try {
      let token = '';
      try { token = (JSON.parse(localStorage.getItem('atlaspos_session') || '{}').access_token) || ''; } catch (e) {}
      const res = await fetch('/api/trash/' + id + '/restore', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return alert('Ошибка восстановления: ' + (j.error || res.status));
      setToast('✅ Запись восстановлена');
      load();
    } catch (e) { alert('Ошибка: ' + e.message); }
  };

  const removeForever = async (id) => {
    if (!confirm('Удалить запись из корзины НАВСЕГДА? Восстановить будет нельзя.')) return;
    try {
      await supabase.from('trash').delete().eq('id', id);
      setToast('🗑️ Запись удалена навсегда');
      load();
    } catch (e) { alert('Ошибка: ' + e.message); }
  };

  if (loading) return <Loader />;

  return (
    <>
      {toast && <div className="toast toast-success">{toast}</div>}
      <div className="page-header">
        <div>
          <h1>Корзина</h1>
          <div className="sub">Удалённые записи хранятся 30 дней — можно восстановить</div>
        </div>
      </div>
      <div className="nav-sep" style={{ margin: '.25rem 0', width: '100%' }} />

      <div className="product-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ color: '#222', fontWeight: 400, fontSize: '.78rem', textAlign: 'left' }}>Тип</th>
              <th style={{ color: '#222', fontWeight: 400, fontSize: '.78rem', textAlign: 'left' }}>Название</th>
              <th style={{ color: '#222', fontWeight: 400, fontSize: '.78rem', textAlign: 'left' }}>Удалена</th>
              <th style={{ width: '170px' }}></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan="4"><div className="empty-products"><div className="big-icon">🗑️</div><p>Корзина пуста</p>
                <p style={{ fontSize: '.82rem', color: 'var(--muted)', margin: '.5rem 0 0' }}>Удалённые записи появятся здесь и будут храниться 30 дней</p></div></td></tr>
            ) : list.map(t => (
              <tr key={t.id}>
                <td style={{ textAlign: 'left' }}><span className="prod-cat">{TABLE_LABELS[t.table_name] || t.table_name}</span></td>
                <td style={{ textAlign: 'left', color: '#222', fontSize: '.78rem' }}>{recordName(t.table_name, t) || '—'}</td>
                <td style={{ textAlign: 'left', color: '#555', fontSize: '.78rem' }}>{new Date(t.deleted_at).toLocaleDateString('ru-RU') + ' ' + new Date(t.deleted_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-block', padding: '.2rem .6rem', borderRadius: '100px', fontSize: '.78rem', color: '#222', background: '#dcfce7', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }} onClick={() => restore(t.id)}>↩ Восстановить</span>
                  <span style={{ display: 'inline-block', padding: '.2rem .6rem', borderRadius: '100px', fontSize: '.78rem', color: '#dc2626', background: '#fee2e2', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', marginLeft: '4px' }} onClick={() => removeForever(t.id)}>Удалить</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
