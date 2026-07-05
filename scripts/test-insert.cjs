const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const WebSocket = require('ws');

const supabase = createClient(
  'https://fqnmkynxuaxaljokptwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbm1reW54dWF4YWxqb2twdHduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzNzE4NCwiZXhwIjoyMDk0MDEzMTg0fQ.XRLuQT64Q14yNbzA-rcckrRP-W5-u7BYdnNQA8F_I1A',
  { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: WebSocket } }
);

const pool = new Pool({ user:'atlaspos', password:'atlaspos_2026_secret', host:'localhost', port:5432, database:'atlaspos' });

async function test() {
  const { data } = await supabase.from('products').select('*').limit(1);
  if (data && data[0]) {
    const row = data[0];
    console.log('Columns:', Object.keys(row).join(', '));
    try {
      const keys = Object.keys(row).filter(k => row[k] !== undefined && row[k] !== null);
      const vals = keys.map(k => row[k]);
      const cols = keys.join(', ');
      const p = keys.map((_, i) => '$' + (i+1)).join(', ');
      await pool.query('INSERT INTO products (' + cols + ') VALUES (' + p + ') ON CONFLICT DO NOTHING', vals);
      console.log('First product: OK');
    } catch(e) {
      console.log('ERROR:', e.message.slice(0,200));
    }
  }
  
  const { data: cats } = await supabase.from('categories').select('*').limit(1);
  if (cats && cats[0]) {
    try {
      const keys = Object.keys(cats[0]).filter(k => cats[0][k] !== undefined && cats[0][k] !== null);
      const vals = keys.map(k => cats[0][k]);
      const cols = keys.join(', ');
      const p = keys.map((_, i) => '$' + (i+1)).join(', ');
      await pool.query('INSERT INTO categories (' + cols + ') VALUES (' + p + ') ON CONFLICT DO NOTHING', vals);
      console.log('First category: OK');
    } catch(e) {
      console.log('Category ERROR:', e.message.slice(0,200));
    }
  }
  process.exit(0);
}
test();
