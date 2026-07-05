const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const WebSocket = require('ws');
const supabase = createClient('https://fqnmkynxuaxaljokptwn.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbm1reW54dWF4YWxqb2twdHduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzNzE4NCwiZXhwIjoyMDk0MDEzMTg0fQ.XRLuQT64Q14yNbzA-rcckrRP-W5-u7BYdnNQA8F_I1A',{auth:{autoRefreshToken:false,persistSession:false},realtime:{transport:WebSocket}});
const pool = new Pool({user:'atlaspos',password:'atlaspos_2026_secret',host:'localhost',port:5432,database:'atlaspos'});
async function go() {
  const {data} = await supabase.from('products').select('*').limit(1);
  if (data && data[0]) {
    const row = data[0];
    const keys = Object.keys(row).filter(k => row[k] !== undefined);
    const vals = keys.map(k => row[k]);
    const cols = keys.join(',');
    const p = keys.map((_,i)=>'$'+(i+1)).join(',');
    try {
      await pool.query('INSERT INTO products ('+cols+') VALUES ('+p+')', vals);
      console.log('OK');
    } catch(e) {
      console.log('ERROR:', e.message.slice(0,300));
    }
  }
  const {rows} = await pool.query("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_name='products'");
  console.log('Local columns:', rows.map(r=>r.column_name).join(','));
  process.exit(0);
}
go().catch(e=>console.error(e));
