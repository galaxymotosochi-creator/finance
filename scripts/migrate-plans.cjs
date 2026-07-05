const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const WebSocket = require('ws');
const s = createClient('https://fqnmkynxuaxaljokptwn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbm1reW54dWF4YWxqb2twdHduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzNzE4NCwiZXhwIjoyMDk0MDEzMTg0fQ.XRLuQT64Q14yNbzA-rcckrRP-W5-u7BYdnNQA8F_I1A', {auth:{autoRefreshToken:false,persistSession:false},realtime:{transport:WebSocket}});
const pool = new Pool({user:'atlaspos',password:'atlaspos_2026_secret',host:'localhost',port:5432,database:'atlaspos'});

async function go() {
  const {data}=await s.from('plans').select('*');
  if (!data) {console.log('No data');process.exit(0);}
  let ok=0,err=0;
  for (const r of data) {
    try {
      const uid = 'b45adced-ef22-47e2-8691-76a2868e0765';
      const q = 'INSERT INTO plans (id, user_id, target_type, target_amount, period, year) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING';
      await pool.query(q, [r.id, uid, r.target_type, r.target_amount, r.period, r.year]);
      ok++;
      console.log('OK:', r.target_type);
    } catch(e) {err++;console.log('Error:', r.target_type, e.message.slice(0,60));}
  }
  console.log('Done:', ok, 'ok,', err, 'errors');
  process.exit(0);
}
go().catch(e=>console.error(e));
