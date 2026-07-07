// Общие действия AI — используются в AiChat и AiAssistant
import { supabase } from './supabase';
import * as XLSX from 'xlsx';

const daysMap = { today: 1, week: 7, month: 30, all: 9999 };

// Простой текстовый отчёт по транзакциям
export async function getReport(period, user, { asTable } = {}) {
  const d = daysMap[period] || 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - d);
  const cs = cutoff.toISOString().split('T')[0];
  const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', user.id).gte('date', cs);
  if (!txs || txs.length === 0) return '📭 Нет операций за этот период';
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = txs.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const profit = income - expense;
  const periodLabel = { today: 'сегодня', week: 'неделю', month: 'месяц', all: 'всё время' }[period] || period;
  return {
    text: `📊 Отчёт за ${periodLabel}:\nДоходы: +${income.toLocaleString()} ₽\nРасходы: −${expense.toLocaleString()} ₽\nПрибыль: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()} ₽`,
    table: asTable ? [
      ['Показатель', 'Сумма'],
      ['Доходы', income],
      ['Расходы', expense],
      ['Прибыль', profit],
    ] : null,
    title: `📊 Отчёт за ${periodLabel}`,
  };
}

// Полный еженедельный отчёт с Excel
export async function getWeeklyReport(user) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const cs = cutoff.toISOString().split('T')[0];
  const [txRes, recRes, clRes, acRes] = await Promise.all([
    supabase.from('transactions').select('date,type,amount,description').eq('user_id',user.id).gte('date',cs).order('date',{ascending:false}),
    supabase.from('receipts').select('date,total_amount,client_name').eq('user_id',user.id).gte('date',cs).order('date',{ascending:false}),
    supabase.from('clients').select('name,orders_count,total_spent,debt').eq('user_id',user.id).order('total_spent',{ascending:false}).limit(5),
    supabase.from('accounts').select('name,balance').eq('user_id',user.id),
  ]);
  const txs = txRes.data || []; const recs = recRes.data || []; const clients = clRes.data || []; const accts = acRes.data || [];
  const income = txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount||0),0);
  const expense = txs.filter(t=>t.type!=='income').reduce((s,t)=>s+Number(t.amount||0),0);
  const profit = income - expense;
  const recTotal = recs.reduce((s,r)=>s+Number(r.total_amount||0),0);
  const avgCheck = recs.length ? Math.round(recTotal/recs.length) : 0;
  const topProduct = txs.filter(t=>t.type==='sale').reduce((s,t)=>s+Number(t.amount||0),0);
  return {
    text: [
      `📊 Отчёт за неделю (${cs} – ${new Date().toISOString().split('T')[0]})`,
      ``,
      `💰 Доходы: +${income.toLocaleString()} ₽`,
      `💸 Расходы: −${expense.toLocaleString()} ₽`,
      `📈 Прибыль: ${profit>=0?'+':''}${profit.toLocaleString()} ₽`,
      ``,
      `🧾 Продаж: ${recs.length}, средний чек: ${avgCheck.toLocaleString()} ₽`,
      `👥 Новых клиентов: ${clients.length}`,
    ].join('\n'),
    table: {
      метрики: [
        ['Показатель', 'Значение'],
        ['Доходы', income],
        ['Расходы', expense],
        ['Прибыль', profit],
        ['Продаж', recs.length],
        ['Средний чек', avgCheck],
      ],
      транзакции: [
        ['Дата', 'Тип', 'Сумма', 'Описание'],
        ...txs.map(t => [(t.date||'').slice(0,10), t.type, Number(t.amount||0), (t.description||'').slice(0,50)]),
      ],
      чеки: [
        ['Дата', 'Клиент', 'Сумма'],
        ...recs.map(r => [(r.date||'').slice(0,10), r.client_name||'—', Number(r.total_amount||0)]),
      ],
    },
    title: '📊 Отчёт за неделю',
  };
}

// Топ продаж
export async function getTopProducts(period, user, limit=10) {
  const d = daysMap[period] || 7;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - d);
  const cs = cutoff.toISOString().split('T')[0];
  const {data:recs} = await supabase.from('receipts').select('id').eq('user_id',user.id).gte('date',cs);
  const rids = (recs||[]).map(r=>r.id);
  if (!rids.length) return '📭 Нет продаж за этот период';
  const {data:items} = await supabase.from('receipt_items').select('product_name,quantity,total').in('receipt_id',rids);
  const top = {};
  (items||[]).forEach(i => { const n = i.product_name||'Товар'; if (!top[n]) top[n] = {qty:0,rev:0}; top[n].qty += i.quantity||0; top[n].rev += i.total||0; });
  const sorted = Object.entries(top).sort((a,b)=>b[1].rev-a[1].rev).slice(0, limit);
  const text = sorted.map(([n,v],i) => `${i+1}. ${n}: ${v.qty} шт, ${v.rev.toLocaleString()} ₽`).join('\n');
  return {
    text: `🏆 Топ ${sorted.length} товаров:\n${text}`,
    table: [['#','Товар','Кол-во','Выручка'], ...sorted.map(([n,v],i)=>[i+1,n,v.qty,v.rev])],
    title: '🏆 Топ продаж',
  };
}

// Остатки
export async function getZeroStock(user) {
  const {data:prods} = await supabase.from('products').select('id,name').eq('user_id',user.id).eq('hidden',false);
  if (!prods?.length) return { text: '📭 Нет товаров', table: null, title: '📦 Остатки' };
  const [supRes, woRes] = await Promise.all([
    supabase.from('supplies').select('items').eq('user_id',user.id),
    supabase.from('writeoffs').select('items').eq('user_id',user.id),
  ]);
  const sm = {}; prods.forEach(p => sm[p.id] = 0);
  (supRes.data||[]).forEach(sp => (sp.items||[]).forEach(it => { if (sm[it.prodId]!==undefined) sm[it.prodId] += it.qty||0; }));
  (woRes.data||[]).forEach(w => (w.items||[]).forEach(it => { if (sm[it.prodId]!==undefined) sm[it.prodId] -= it.qty||0; }));
  const zero = Object.entries(sm).filter(([,q]) => q<=0);
  const names = {}; prods.forEach(p => names[p.id] = p.name);
  return {
    text: `📦 Товаров с нулевым остатком: ${zero.length}\n${zero.map(([id,q]) => `- ${names[id]||'Товар'}: ${q} шт`).join('\n')}`,
    table: [['Товар', 'Остаток'], ...zero.map(([id,q]) => [names[id]||'Товар', q])],
    title: '📦 Нулевые остатки',
  };
}

// Прогноз
export async function getForecast(user) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const cs = cutoff.toISOString().split('T')[0];
  const {data:txs} = await supabase.from('transactions').select('amount,type').eq('user_id',user.id).gte('date',cs);
  if (!txs?.length) return { text: '📭 Нет данных для прогноза', table: null, title: '📈 Прогноз' };
  const income = txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount||0),0);
  const daysElapsed = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
  const avgPerDay = income / daysElapsed;
  const forecast = Math.round(avgPerDay * daysInMonth);
  return {
    text: `📈 Прогноз на месяц:\nТекущий доход: +${income.toLocaleString()} ₽ (за ${daysElapsed} дн.)\nПрогноз: ${forecast.toLocaleString()} ₽`,
    table: [['Показатель', 'Значение'], ['Доход сейчас', income], ['Дней прошло', daysElapsed], ['Прогноз на месяц', forecast]],
    title: '📈 Прогноз',
  };
}

// Excel export
export function downloadExcel(tableData, filename = 'otchet.xlsx') {
  if (!tableData) return;
  const wb = XLSX.utils.book_new();
  // Если несколько листов
  if (typeof tableData === 'object' && !Array.isArray(tableData)) {
    Object.entries(tableData).forEach(([name, data]) => {
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    });
  } else if (Array.isArray(tableData)) {
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    XLSX.utils.book_append_sheet(wb, ws, 'Данные');
  }
  XLSX.writeFile(wb, filename);
}
