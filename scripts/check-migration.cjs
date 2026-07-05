const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const WebSocket = require('ws');
const s = createClient('https://fqnmkynxuaxaljokptwn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbm1reW54dWF4YWxqb2twdHduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzNzE4NCwiZXhwIjoyMDk0MDEzMTg0fQ.XRLuQT64Q14yNbzA-rcckrRP-W5-u7BYdnNQA8F_I1A', {auth:{autoRefreshToken:false,persistSession:false},realtime:{transport:WebSocket}});
const pool = new Pool({user:'atlaspos',password:'atlaspos_2026_secret',host:'localhost',port:5432,database:'atlaspos'});

async function go() {
  const tables = ['products','categories','accounts','transactions','receipts','receipt_items',
    'shifts','supplies','writeoffs','inventory','suppliers','employees','positions',
    'position_templates','timesheet_entries','clients','loyalty','loyalties','promos',
    'subscriptions','user_profiles','salary','stock_categories','plans','deductions','bonuses'];
  
  for (const table of tables) {
    try {
      const {data: supData} = await s.from(table).select('*');
      const supCount = supData?.length || 0;
      let localCount = -1;
      try {
        const {rows} = await pool.query('SELECT count(*) as c FROM ' + table);
        localCount = parseInt(rows[0]?.c || 0);
      } catch(e) { localCount = -1; }
      
      if (supCount === 0 && localCount === 0) {
        console.log(table + ': 0 (ok)');
      } else if (localCount < 0) {
        console.log('❌ ' + table + ': Supabase=' + supCount + ', Local=НЕТ ТАБЛИЦЫ');
      } else if (supCount !== localCount) {
        console.log('⚠️ ' + table + ': Supabase=' + supCount + ', Local=' + localCount);
      } else {
        console.log('✅ ' + table + ': ' + supCount + ' записей');
      }
    } catch(e) {
      console.log('❌ ' + table + ': error ' + (e.message || '').slice(0,60));
    }
  }
  process.exit(0);
}
go().catch(e=>console.error(e));
