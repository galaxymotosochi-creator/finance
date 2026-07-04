// Follow Supabase Edge Functions conventions
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID = '791912';
const CLIENT_SECRET = 'f2f92f57198ae714530004d9373ee6da';

serve(async (req) => {
  try {
    const { code } = await req.json();
    if (!code) return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });

    // 1. Exchange code for token
    const tokenRes = await fetch('https://connect.mail.ru/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://atlaspos.ru/auth/callback.html',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Failed to get token');

    // 2. Get user info from Mail.ru
    const userRes = await fetch(`https://oauth.mail.ru/userinfo?access_token=${tokenData.access_token}`);
    const userData = await userRes.json();
    if (!userData.email) throw new Error('Email not provided by Mail.ru');

    // 3. Create or get user in Supabase
    const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    const { users } = await adminRes.json();
    let user = users.find((u: any) => u.email === userData.email);

    if (!user) {
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          email: userData.email,
          email_confirm: true,
          user_metadata: {
            name: userData.name || userData.nickname || userData.email,
            provider: 'mailru',
            avatar_url: userData.picture || userData.image || null,
          },
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.msg || 'Failed to create user');
      user = created;
    }

    // 4. Generate session for the user
    const sessionRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({
        email: userData.email,
        password: crypto.randomUUID(), // never used, just for API structure
      }),
    });

    // Instead, let's create a magic link token
    const tokenGenRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        type: 'signup',
        email: userData.email,
        password: crypto.randomUUID(),
        email_confirm: true,
      }),
    });
    const linkData = await tokenGenRes.json();

    if (!tokenGenRes.ok) {
      // User already exists — create a session directly
      // Use the GoTrue admin API to create a session
      const sessionGenRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          type: 'recovery',
          email: userData.email,
        }),
      });
      const recoveryData = await sessionGenRes.json();

      if (recoveryData.properties?.action_link) {
        const url = new URL(recoveryData.properties.action_link);
        const tokenHash = url.hash || '';
        const params = new URLSearchParams(tokenHash.replace('#', ''));
        return new Response(JSON.stringify({
          access_token: params.get('access_token'),
          refresh_token: params.get('refresh_token'),
          token_type: 'bearer',
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (linkData.properties?.action_link) {
      const url = new URL(linkData.properties.action_link);
      const tokenHash = url.hash || '';
      const params = new URLSearchParams(tokenHash.replace('#', ''));
      return new Response(JSON.stringify({
        access_token: params.get('access_token'),
        refresh_token: params.get('refresh_token'),
        token_type: 'bearer',
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    throw new Error('Failed to generate session');
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
