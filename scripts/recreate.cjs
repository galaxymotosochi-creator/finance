const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', port: 5432, database: 'atlaspos' });
const data = JSON.parse(fs.readFileSync('/opt/atlaspos-api/dump.json', 'utf8'));

async function recreate() {
  await pool.query('DROP TABLE IF EXISTS receipt_items, transactions, receipts, shifts, supplies, inventory, employees, promos, suppliers, clients, user_profiles, subscriptions, accounts, categories, products CASCADE');
  console.log('Tables dropped');

  for (const [table, rows] of Object.entries(data)) {
    if (!rows.length) continue;
    const keys = Object.keys(rows[0]);
    const cols = keys.map(k => {
      const val = rows[0][k];
      let type = 'text';
      if (typeof val === 'number') type = Number.isInteger(val) ? 'bigint' : 'numeric';
      else if (typeof val === 'boolean') type = 'boolean';
      else if (typeof val === 'object' && val !== null) type = 'jsonb';
      else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) type = 'timestamptz';
      return '"' + k + '" ' + type;
    }).join(', ');
    await pool.query('CREATE TABLE ' + table + ' (' + cols + ')');
    console.log('Created: ' + table);

    for (const row of rows) {
      const k2 = keys.filter(k => row[k] !== undefined && row[k] !== null);
      const vals = k2.map(k => typeof row[k] === 'object' && row[k] !== null ? JSON.stringify(row[k]) : row[k]);
      try {
        const q = 'INSERT INTO ' + table + ' ("' + k2.join('","') + '") VALUES (' + k2.map((_, i) => '$' + (i + 1)).join(',') + ')';
        await pool.query(q, vals);
      } catch (e) {
        console.log('  insert error: ' + (e.message || '').slice(0, 120));
      }
    }
    console.log('  ' + rows.length + ' rows inserted');
  }

  const { rows: tbls } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  for (const r of tbls) {
    await pool.query('GRANT ALL ON TABLE "' + r.tablename + '" TO atlaspos').catch(() => {});
  }
  console.log('\nDone! Permissions granted to atlaspos.');
  process.exit(0);
}
recreate().catch(e => console.error(e));
