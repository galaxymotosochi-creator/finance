// API: показывает структуру базы данных Finance
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default async function handler(req, res) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not available on server' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Получаем список таблиц из information_schema
  const { data: tables, error: tablesError } = await supabase
    .rpc('get_tables_info');

  if (tablesError) {
    // Fallback: просто соберём данные по известным таблицам
    const tables = ['products', 'categories', 'stock_categories', 'transactions', 'accounts',
      'shifts', 'employees', 'position_templates', 'timesheet_entries', 'salary',
      'supplies', 'writeoffs', 'suppliers', 'inventory', 'clients', 'loyalty',
      'user_profiles', 'initial_stocks'];

    const result = {};
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (!error) {
        result[table] = { count };
      }
    }

    return res.status(200).json({
      message: 'Таблицы базы данных Finance',
      tables: result,
      note: 'Данные только счётчики записей. Без RLS ключа детали не видны.'
    });
  }

  return res.status(200).json({ tables });
}
