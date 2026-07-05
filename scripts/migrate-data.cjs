const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const SUPABASE_URL = 'https://fqnmkynxuaxaljokptwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbm1reW54dWF4YWxqb2twdHduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzNzE4NCwiZXhwIjoyMDk0MDEzMTg0fQ.XRLuQT64Q14yNbzA-rcckrRP-W5-u7BYdnNQA8F_I1A';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const pool = new Pool({
  user: 'atlaspos',
  password: 'atlaspos_2026_secret',
  host: '194.226.163.4',
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
      if (error) { console.log(`  ${table}: ${error.message}`); continue; }
      if (!data?.length) { console.log(`  ${table}: 0 rows`); continue; }
      
      let ok = 0, fail = 0;
      for (const row of data) {
        try {
          const keys = Object.keys(row).filter(k => row[k] !== undefined && row[k] !== null);
          const vals = keys.map(k => row[k]);
          const cols = keys.join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          await pool.query(
            `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            vals
          );
          ok++;
        } catch(e) { fail++; }
      }
      console.log(`  ✓ ${table}: ${ok}/${data.length} rows (errors: ${fail})`);
    } catch(e) {
      console.log(`  ${table}: ERROR - ${e.message.slice(0,80)}`);
    }
  }

  console.log('\n✅ Migration complete!');
  
  // Show counts
  const { rows: counts } = await pool.query(`
    SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int as count
    FROM (
      SELECT table_name, query_to_xml('SELECT count(*) as cnt FROM "' || table_name || '"', true, false, '') as xml_count
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ) t
    ORDER BY table_name
  `);
  console.log('\nData summary:');
  for (const row of counts) {
    console.log(`  ${row.table_name}: ${row.count} rows`);
  }
  
  process.exit(0);
}

migrate().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
