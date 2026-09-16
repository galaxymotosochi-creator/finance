import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../lib/currency';
import CenterSpinner from '../../components/CenterSpinner';
import SectionHelp from '../../components/SectionHelp';


export default function Shifts() {
  const cur = getCurrencySymbol();
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [toastError, setToastError] = useState(false);
  // Подсказка скролла (вариант 2а): без замеров ширины. Тени видны всегда,
  // гасятся только по факту прокрутки — как в разделе «Счета».
  const [tblPos, setTblPos] = useState({left:true, right:true});
  const onTblScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    setTblPos({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const showToast = (msg, isError = false) => {
    setToastError(isError);
    setToast(msg);
    setTimeout(() => setToast(null), isError ? 4000 : 2500);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [sRes, tRes, aRes, rRes] = await Promise.all([
          supabase.from('shifts').select('*').eq('user_id', user.id).order('opened_at', { ascending: false }),
          supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(500),
          supabase.from('accounts').select('*').order('created_at', { ascending: true }),
          supabase.from('receipts').select('shift_id,paid_amount').eq('user_id', user.id),
        ]);
        if (sRes.error) throw sRes.error;
        setShifts(sRes.data || []);
        setTransactions(tRes.data || []);
        setAccounts(aRes.data || []);
        setReceipts(rRes.data || []);
      } catch (e) {
        showToast('Ошибка загрузки: ' + (e.message || 'неизвестная ошибка'), true);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Выручка смены = сумма оплаченного по чекам смены (только кассовые чеки, быстрые продажи не входят)
  const getShiftIncome = (s) => {
    return (receipts||[]).filter(r => r.shift_id === s.id).reduce((sum, r) => sum + (Number(r.paid_amount)||0), 0);
  };

  if (loading) return <CenterSpinner />;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>
      {toast && (
        <div style={{
          position:'fixed', bottom:'24px', right:'24px',
          background: toastError ? '#dc2626' : '#fff',
          color: toastError ? '#fff' : '#333',
          border: toastError ? 'none' : '1px solid #e5e7eb',
          borderRadius:'12px', padding:'.7rem 1.2rem', fontSize:'.85rem',
          boxShadow:'0 .5rem 1.5rem rgba(0,0,0,.15)', zIndex:9999, maxWidth:'320px'
        }}>{toast}</div>
      )}

      <div className="sk-bar">
        <div className="grow">
          <div style={{display:'flex',alignItems:'center'}}>
            <h1>Смены</h1>
            <SectionHelp
              title="Раздел «Смены»"
              intro="Здесь видна история работы касс: когда открыли смену, кто был кассиром, сколько выручки и каким остатком закрыли."
              faq={[
                { q: 'Что такое кассовая смена?', a: (
                  <p>Это рабочий период кассира: от открытия кассы до её закрытия. Все продажи и оплаты внутри этого времени привязываются к смене.</p>
                ) },
                { q: 'С чего начать работу?', a: (
                  <ol style={{paddingLeft:'1.15rem',margin:0}}>
                    <li style={{marginBottom:'.5rem'}}>Откройте кассу в разделе <b>«Кассы»</b> — смена создастся автоматически.</li>
                    <li style={{marginBottom:'.5rem'}}>Работайте как обычно: все продажи и оплаты попадут в текущую смену.</li>
                    <li>По окончании дня закройте смену с указанием конечного остатка в ящике.</li>
                  </ol>
                ) },
                { q: 'Что означает каждая колонка?', a: (
                  <ul>
                    <li><b>Дата / Время открытия</b> — когда смена началась.</li>
                    <li><b>Смена №</b> — порядковый номер смены на кассе.</li>
                    <li><b>Кассир</b> — кто открыл смену.</li>
                    <li><b>Начальный остаток</b> — сколько денег было в ящике на старте.</li>
                    <li><b>Выручка</b> — сумма оплат по чекам за смену.</li>
                    <li><b>Конечный остаток</b> — сколько денег осталось при закрытии.</li>
                    <li><b>Статус</b> — «Открыта» (касса работает) или «Закрыта».</li>
                  </ul>
                ) },
                { q: 'Почему выручка меньше, чем продаж?', a: (
                  <p>Выручка считается только по <b>кассовым чекам смены</b>. Быстрые продажи и другие операции в неё не входят.</p>
                ) },
                { q: 'Можно ли исправить закрытую смену?', a: (
                  <p>Изменить данные закрытой смены нельзя — она зафиксирована для порядка и контроля. При необходимости сделайте <b>корректировку остатка</b> в разделе «Счета».</p>
                ) },
              ]}
            />
          </div>
          <div className="sub">Контроль работы касс и выручки</div>
        </div>
      </div>

      {!loading && (
      <div className="sk-tablewrap">
        <div className="sk-fade sk-fade-l" style={{opacity:tblPos.left?1:0}}></div>
        <div className="sk-fade sk-fade-r" style={{opacity:tblPos.right?1:0}}></div>
        <div className="sk-card" style={{flex:1,overflowY:'auto',overflowX:'auto',WebkitOverflowScrolling:'touch',minHeight:0}} onScroll={onTblScroll}>
          <table className="sk-table sk-shifts">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Кассир</th>
                <th>Смена №</th>
                <th>Начальный остаток</th>
                <th>Выручка</th>
                <th>Конечный остаток</th>
                <th>Время</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr><td colSpan="8" style={{padding:"40px 20px",textAlign:"center",color:"#5b6472",fontSize:"13px"}}>Смен пока нет</td></tr>
              ) : shifts.map((s) => {
                const income = getShiftIncome(s);
                const isOpen = s.status === 'open';
                const opened = s.opened_at ? new Date(s.opened_at) : null;
                const dateStr = opened ? opened.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
                const timeOpen = opened ? opened.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) : '—';
                const timeClose = s.closed_at ? new Date(s.closed_at).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) : '—';
                const sCloseBal = parseFloat(s.closing_balance)||0;
                const cashier = s.current_cashier_name || s.cashier_name;
                return (
                  <tr key={s.id}>
                    <td><span className="sk-name">{dateStr}</span></td>
                    <td>{cashier || '—'}</td>
                    <td>{s.shift_number ? '#'+s.shift_number : '—'}</td>
                    <td>{(parseFloat(s.opening_balance)||0).toLocaleString()} {cur}</td>
                    <td>{income > 0 ? income.toLocaleString()+' ₽' : '—'}</td>
                    <td>{sCloseBal > 0 ? sCloseBal.toLocaleString()+' ₽' : '—'}</td>
                    <td>{timeOpen}{s.closed_at ? ' — '+timeClose : ''}</td>
                    <td><span className={isOpen ? 'sk-tag sk-tag-open' : 'sk-tag'}>{isOpen ? 'Открыта' : 'Закрыта'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
