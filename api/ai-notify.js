// API для AI-уведомлений
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const [txRes, prodRes] = await Promise.all([
      sb.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(100),
      sb.from('products').select('*').eq('user_id', userId),
    ]);

    const transactions = txRes.data || [];
    const products = prodRes.data || [];

    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

    const weekTx = transactions.filter(t => t.date && new Date(t.date) >= weekAgo);
    const monthTx = transactions.filter(t => t.date && new Date(t.date) >= monthAgo);
    
    const weekIncome = weekTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const weekExpense = weekTx.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthExpense = monthTx.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);

    const notifications = [];

    // 1. Расходы превышают доходы
    if (weekExpense > weekIncome && weekExpense > 0) {
      notifications.push({ level:'critical', title:'📉 Убыток за неделю', text:`Доходы ${weekIncome.toLocaleString()}₽, расходы ${weekExpense.toLocaleString()}₽`, color:'#dc2626' });
    }

    // 2. Прибыль за месяц
    const monthProfit = monthIncome - monthExpense;
    if (monthProfit > 0) {
      notifications.push({ level:'info', title:'📈 Прибыль за месяц', text:`+${monthProfit.toLocaleString()}₽ при доходах ${monthIncome.toLocaleString()}₽`, color:'#16a34a' });
    } else if (monthProfit < 0 && monthTx.length > 0) {
      notifications.push({ level:'critical', title:'📉 Убыток за месяц', text:`−${Math.abs(monthProfit).toLocaleString()}₽`, color:'#dc2626' });
    }

    // 3. Расходы > 70% от доходов
    if (weekIncome > 0 && weekExpense > 0) {
      const ratio = Math.round(weekExpense / weekIncome * 100);
      if (ratio > 70) {
        notifications.push({ level:'warning', title:'⚠️ Высокие расходы', text:`${ratio}% доходов уходит на расходы`, color:'#f59e0b' });
      }
    }

    // 4. Нет активности за неделю
    if (weekTx.length === 0 && transactions.length > 5) {
      notifications.push({ level:'warning', title:'📭 Нет операций за неделю', text:'За 7 дней не было ни одной операции', color:'#f59e0b' });
    }

    // 5. Критические остатки товаров
    const lowStock = products.filter(p => {
      const supplyData = transactions.filter(t => t.description?.toLowerCase().includes(p.name?.toLowerCase()));
      const recent = supplyData.filter(t => t.type === 'income' && new Date(t.date || 0) >= monthAgo).length;
      return recent === 0 && products.indexOf(p) < 5;
    }).slice(0, 2);
    
    if (lowStock.length > 0 && products.length > 3) {
      notifications.push({ level:'warning', title:'📦 Проверьте остатки', text:`${lowStock.map(p => p.name).join(', ')} — давно не было продаж`, color:'#f59e0b' });
    }

    // Определяем главный цвет
    const colors = { critical:'#dc2626', warning:'#f59e0b', info:'#16a34a' };
    const topLevel = ['critical','warning','info'].find(l => notifications.some(n => n.level === l));
    const dotColor = topLevel ? colors[topLevel] : null;

    res.json({ notifications, dotColor, count: notifications.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
