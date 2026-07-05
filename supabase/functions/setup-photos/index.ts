// Setup photos storage & migration — one-time call
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async () => {
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  const results: string[] = [];

  // 1. Create bucket
  const bucketCheck = await fetch(`${SUPABASE_URL}/storage/v1/bucket/product-photos`, { headers });
  if (bucketCheck.status === 404) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'product-photos', name: 'product-photos', public: true }),
    });
    const data = await res.json();
    results.push(`Bucket: ${res.ok ? '✅ created' : '❌ ' + JSON.stringify(data)}`);
  } else {
    results.push('Bucket: ✅ already exists');
  }

  // 2. Add column
  const sqlRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT NULL' }),
  });
  // Alternative: use pg endpoint
  const pgRes = await fetch(`${SUPABASE_URL}/pg`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT NULL' }),
  });
  results.push(`Column: pg status=${pgRes.status}`);

  // 3. Set up RLS policy for the bucket
  // Files are stored under {user_id}/{product_id}.ext
  // Anyone can read (public bucket), only owner can write
  const policySQL = `
    BEGIN;
    -- Allow public read (bucket is public)
    INSERT INTO storage.buckets (id, name, public) VALUES ('product-photos', 'product-photos', true)
      ON CONFLICT (id) DO UPDATE SET public = true;
    -- Allow authenticated users to upload
    DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
    CREATE POLICY "Give users access to own folder" ON storage.objects
      FOR ALL USING (bucket_id = 'product-photos' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'product-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
    -- Allow public read
    DROP POLICY IF EXISTS "Public read product photos" ON storage.objects;
    CREATE POLICY "Public read product photos" ON storage.objects
      FOR SELECT USING (bucket_id = 'product-photos');
    COMMIT;
  `;
  
  // Run policy SQL via pg endpoint
  const policyRes = await fetch(`${SUPABASE_URL}/pg`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: policySQL }),
  });
  results.push(`RLS: status=${policyRes.status}`);

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
