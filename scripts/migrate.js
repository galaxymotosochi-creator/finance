const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const SUPABASE_URL = 'https://fqnmkynxuaxaljokptwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xZAKWBooUbfMSKQB7onKKQ_htOE7qbZ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const pool = new Pool({
  user: 'atlaspos',
  password: 'atlaspos_2026_secret',
  host: '194.226.163.4',
  port: 5432,
  database: 'atlaspos',
});

async function migrate(email, password) {
  const { data: auth } = await supabase.auth.signInWithPassword({ email, password });
  if (auth.error) { console.error('Login error:', auth.error.message); return; }
  
  const userId = auth.data.user.id;
  console.log('✓ Logged in as:', email);
  
  await pool.query(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
    [userId, email, 'migrated-' + Date.now(), '', new Date()]
  ).catch(() => {});
  console.log('✓ User record created');

  const tables = ['categories', 'accounts', 'products', 'shifts', 'clients', 'employees', 'positions', 'receipts'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
    if (error) { console.log(`  ${table}: ${error.message}`); continue; }
    if (!data?.length) { console.log(`  ${table}: 0 rows`); continue; }
    
    let ok = 0;
    for (const row of data) {
      try {
        const keys = Object.keys(row).filter(k => row[k] !== undefined && row[k] !== null);
        const vals = keys.map(k => row[k]);
        const cols = keys.join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, vals);
        ok++;
      } catch(e) { /* skip */ }
    }
    console.log(`  ✓ ${table}: ${ok}/${data.length} rows`);
  }
  
  // Migrate transactions (may reference receipts)
  const { data: txs, error: txErr } = await supabase.from('transactions').select('*').eq('user_id', userId);
  if (txErr) { console.log('  transactions:', txErr.message); }
  else if (txs?.length) {
    let ok = 0;
    for (const row of txs) {
      try {
        const keys = Object.keys(row).filter(k => row[k] !== undefined && row[k] !== null);
        const vals = keys.map(k => row[k]);
        const cols = keys.join(',');
        const p = keys.map((_, i) => `$${i+1}`).join(',');
        await pool.query(`INSERT INTO transactions (${cols}) VALUES (${p}) ON CONFLICT DO NOTHING`, vals);
        ok++;
      } catch(e) {}
    }
    console.log(`  ✓ transactions: ${ok}/${txs.length} rows`);
  }

  console.log('\n✅ Migration complete!');
  process.exit(0);
}

const email = process.argv[2];
const pwd = process.argv[3];
if (!email || !pwd) { console.log('Usage: node migrate.js email password'); process.exit(1); }
migrate(email, pwd).catch(e => { console.error(e); process.exit(1); });
