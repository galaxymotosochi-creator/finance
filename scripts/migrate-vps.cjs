const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const WebSocket = require('ws');

const SUPABASE_URL = 'https://fqnmkynxuaxaljokptwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbm1reW54dWF4YWxqb2twdHduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzNzE4NCwiZXhwIjoyMDk0MDEzMTg0fQ.XRLuQT64Q14yNbzA-rcckrRP-W5-u7BYdnNQA8F_I1A';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket }
});

const pool = new Pool({
  user: 'atlaspos',
  password: 'atlaspos_2026_secret',
  host: 'localhost',
  port: 5432,
  database: 'atlaspos',
});

async function migrate() {
  const tables = [
    'products', 'categories', 'accounts', 'transactions', 'receipts', 'receipt_items',
    'shifts', 'supplies', 'writeoffs', 'inventory', 'suppliers',
    'employees', 'positions', 'timesheet',
    'clients', 'loyalty', 'promos', 'subscriptions', 'user_profiles'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) { console.log('  ' + table + ': ' + error.message); continue; }
      if (!data || !data.length) { console.log('  ' + table + ': 0 rows'); continue; }
      
      let ok = 0, fail = 0;
      for (const row of data) {
        try {
          const keys = Object.keys(row).filter(k => row[k] !== undefined && row[k] !== null);
          const vals = keys.map(k => row[k]);
          const cols = keys.join(', ');
          const p = keys.map((_, i) => '$' + (i + 1)).join(', ');
          await pool.query('INSERT INTO ' + table + ' (' + cols + ') VALUES (' + p + ') ON CONFLICT DO NOTHING', vals);
          ok++;
        } catch(e) { fail++; }
      }
      console.log('  ' + table + ': ' + ok + '/' + data.length + ' rows (err: ' + fail + ')');
    } catch(e) {
      console.log('  ' + table + ': ERROR - ' + (e.message || '').slice(0, 80));
    }
  }

  console.log('');
  const { rows: counts } = await pool.query("SELECT tablename as t, n_live_tup FROM pg_stat_user_tables ORDER BY t");
  for (const r of counts) {
    console.log('  ' + r.t + ': ' + r.n_live_tup + ' rows');
  }
  console.log('\nDone!');
  process.exit(0);
}

migrate().catch(e => { console.error('Fatal:', e.message || e); process.exit(1); });
