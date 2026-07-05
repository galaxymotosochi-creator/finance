const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const WebSocket = require('ws');
const supabase = createClient('https://fqnmkynxuaxaljokptwn.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbm1reW54dWF4YWxqb2twdHduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzNzE4NCwiZXhwIjoyMDk0MDEzMTg0fQ.XRLuQT64Q14yNbzA-rcckrRP-W5-u7BYdnNQA8F_I1A',{auth:{autoRefreshToken:false,persistSession:false},realtime:{transport:WebSocket}});
const pool = new Pool({user:'atlaspos',password:'atlaspos_2026_secret',host:'localhost',port:5432,database:'atlaspos'});
async function go() {
  for (const table of ['products','categories','accounts','shifts','suppliers','clients','employees','positions','receipts','receipt_items','transactions','promos','supplies','inventory','user_profiles']) {
    try {
      const {data} = await supabase.from(table).select('*');
      if (!data || !data.length) { console.log(table + ': 0 rows'); continue; }
      let ok=0, fail=0;
      for (const row of data) {
        try {
          const keys = Object.keys(row).filter(k => row[k]!==undefined && row[k]!==null);
          const rowsArray = [keys.map(k => row[k])];
          const cols = keys.join(',');
          const p = keys.map((_,i)=>'$'+(i+1)).join(',');
          await pool.query('INSERT INTO '+table+' ('+cols+') VALUES ('+p+') ON CONFLICT DO NOTHING', rowsArray[0]);
          ok++;
        } catch(e) {
          if (fail===0) console.log('  ' + table + ' sample error: ' + e.message.slice(0,150));
          fail++;
        }
      }
      console.log(table + ': ' + ok + '/' + data.length + ' fail:' + fail);
    } catch(e) {
      console.log(table + ': skip - ' + (e.message||'').slice(0,80));
    }
  }
  process.exit(0);
}
go().catch(e=>console.error(e));
