// Custom Supabase-compatible client for AtlasPos — uses local API + PostgREST

const API_URL = window.location.origin.includes('api.atlaspos.ru') ? '' : 'https://api.atlaspos.ru';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon';

let currentSession = null;
let authListeners = [];

class PostgrestFilter {
  constructor(url, headers, method = 'GET', body = null) {
    this.url = url;
    this.headers = { ...headers };
    this.method = method;
    this.body = body;
    this.params = [];
    this.orderClause = '';
    this.limitVal = null;
    this.selectCols = '*';
  }

  _clone() {
    const c = new PostgrestFilter(this.url, this.headers, this.method, this.body);
    c.params = [...this.params];
    c.orderClause = this.orderClause;
    c.limitVal = this.limitVal;
    c.selectCols = this.selectCols;
    return c;
  }

  eq(col, val) { const c = this._clone(); c.params.push(col + '=eq.' + encodeURIComponent(val)); return c; }
  neq(col, val) { const c = this._clone(); c.params.push(col + '=neq.' + encodeURIComponent(val)); return c; }
  gt(col, val) { const c = this._clone(); c.params.push(col + '=gt.' + encodeURIComponent(val)); return c; }
  gte(col, val) { const c = this._clone(); c.params.push(col + '=gte.' + encodeURIComponent(val)); return c; }
  lt(col, val) { const c = this._clone(); c.params.push(col + '=lt.' + encodeURIComponent(val)); return c; }
  lte(col, val) { const c = this._clone(); c.params.push(col + '=lte.' + encodeURIComponent(val)); return c; }
  like(col, val) { const c = this._clone(); c.params.push(col + '=like.' + encodeURIComponent(val)); return c; }
  ilike(col, val) { const c = this._clone(); c.params.push(col + '=ilike.' + encodeURIComponent(val)); return c; }
  is(col, val) { const c = this._clone(); c.params.push(col + '=is.' + encodeURIComponent(val)); return c; }
  in(col, vals) { const c = this._clone(); c.params.push(col + '=in.(' + vals.join(',') + ')'); return c; }
  not(col, op, val) { const c = this._clone(); c.params.push(col + '=not.' + op + '.' + encodeURIComponent(val)); return c; }

  order(col, opts = {}) {
    const c = this._clone();
    const dir = opts.ascending === false ? '.desc' : '.asc';
    c.orderClause = col + dir + (opts.nullsfirst ? '.nullsfirst' : '.nullslast');
    return c;
  }

  limit(n) { const c = this._clone(); c.limitVal = n; return c; }
  single() { const c = this._clone(); c.limitVal = 1; return c; }
  maybeSingle() { const c = this._clone(); c.limitVal = 1; return c; }

  select(cols) {
    const c = this._clone();
    c.selectCols = cols || '*';
    // Не меняем метод для POST (insert/upsert) — оставляем как есть
    if (c.method !== 'POST') c.method = 'GET';
    return c;
  }

  insert(values) {
    const c = this._clone();
    c.body = Array.isArray(values) ? values : [values];
    c.method = 'POST';
    return c;
  }

  update(values) {
    const c = this._clone();
    c.body = values;
    c.method = 'PATCH';
    return c;
  }

  delete() {
    const c = this._clone();
    c.method = 'DELETE';
    return c;
  }

  async _fetch() {
    let url = this.url + '?select=' + encodeURIComponent(this.selectCols);
    if (this.params.length) url += '&' + this.params.join('&');
    if (this.orderClause) url += '&order=' + encodeURIComponent(this.orderClause);
    if (this.limitVal) url += '&limit=' + this.limitVal;

    const headers = {
      'apikey': ANON_KEY,
      'Authorization': 'Bearer ' + (currentSession?.access_token || ''),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      let res;
      if (this.method === 'GET') {
        res = await fetch(url, { headers });
        if (!res.ok) return { data: null, error: new Error('HTTP ' + res.status) };
        const json = await res.json();
        // If the response is a single object wrapped in array or just an object
        const data = Array.isArray(json) ? json : [json];
        // For maybeSingle/single: return the first item if limit=1, otherwise the array
        return { data: this.limitVal === 1 ? (data[0] || null) : data, error: null };
      } else if (this.method === 'POST') {
        headers['Prefer'] = 'return=representation';
        res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(this.body) });
        if (!res.ok) return { data: null, error: new Error('HTTP ' + res.status) };
        const d = await res.json();
        const pData = Array.isArray(d) ? d : [d];
        return { data: this.limitVal === 1 ? (pData[0] || null) : pData, error: null };
      } else if (this.method === 'PATCH') {
        headers['Prefer'] = 'return=representation';
        res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(this.body) });
        if (!res.ok) return { data: null, error: new Error('HTTP ' + res.status) };
        let d = null;
        try { d = await res.json(); } catch(e) {}
        return { data: d, error: null };
      } else if (this.method === 'DELETE') {
        res = await fetch(url, { method: 'DELETE', headers });
        if (!res.ok && res.status !== 204) return { data: null, error: new Error('HTTP ' + res.status) };
        return { data: null, error: null };
      }
    } catch(e) {
      return { data: null, error: e };
    }
  }

  then(resolve, reject) { return this._fetch().then(resolve, reject); }
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
  }
  select(cols) { return new PostgrestFilter(API_URL + '/api/' + this.table, {}, 'GET').select(cols); }
  insert(values) { return new PostgrestFilter(API_URL + '/api/' + this.table, {}, 'POST', Array.isArray(values) ? values : [values]); }
  update(values) { return new PostgrestFilter(API_URL + '/api/' + this.table, {}, 'PATCH', values); }
  delete() { return new PostgrestFilter(API_URL + '/api/' + this.table, {}, 'DELETE'); }
  upsert(values) { return new PostgrestFilter(API_URL + '/api/' + this.table, {}, 'POST', Array.isArray(values) ? values : [values]); }
}

const auth = {
  async getSession() {
    if (!currentSession) {
      try {
        const stored = localStorage.getItem('atlaspos_session');
        if (stored) currentSession = JSON.parse(stored);
      } catch(e) {}
    }
    return { data: { session: currentSession }, error: null };
  },

  onAuthStateChange(callback) {
    authListeners.push(callback);
    if (currentSession) callback('SIGNED_IN', currentSession);
    return { data: { subscription: { unsubscribe: () => { authListeners = authListeners.filter(cb => cb !== callback); } } } };
  },

  async signInWithPassword({ email, password }) {
    try {
      const res = await fetch(API_URL + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: new Error(data.error || 'Login failed') };
      const session = {
        access_token: data.token, token_type: 'bearer',
        user: { id: data.user.id, email: data.user.email, user_metadata: {} },
      };
      currentSession = session;
      localStorage.setItem('atlaspos_session', JSON.stringify(session));
      authListeners.forEach(cb => cb('SIGNED_IN', session));
      return { data: { session, user: session.user }, error: null };
    } catch(e) { return { data: null, error: e }; }
  },

  async signUp({ email, password, options }) {
    try {
      const res = await fetch(API_URL + '/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: options?.data?.name || '' }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: new Error(data.error || 'Registration failed') };
      const session = {
        access_token: data.token, token_type: 'bearer',
        user: { id: data.user.id, email: data.user.email, user_metadata: {} },
      };
      currentSession = session;
      localStorage.setItem('atlaspos_session', JSON.stringify(session));
      return { data: { session, user: session.user }, error: null };
    } catch(e) { return { data: null, error: e }; }
  },

  async signOut() {
    currentSession = null;
    localStorage.removeItem('atlaspos_session');
    authListeners.forEach(cb => cb('SIGNED_OUT', null));
    return { error: null };
  },

  async resetPasswordForEmail(email) {
    try {
      const res = await fetch(API_URL + '/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return { data: {}, error: null };
    } catch(e) { return { data: null, error: e }; }
  },
};

const storage = {
  from(bucket) {
    return {
      async upload(path, file, opts) {
        try {
          const fd = new FormData();
          fd.append('photo', file);
          const res = await fetch(API_URL + '/api/upload', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + (currentSession?.access_token || '') },
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) return { data: null, error: new Error(data.error || 'Upload failed') };
          return { data: { path: data.url.replace('/uploads/', '') }, error: null };
        } catch(e) { return { data: null, error: e }; }
      },
      getPublicUrl(path) {
        return { data: { publicUrl: API_URL + '/uploads/' + path } };
      },
      async createBucket(name, opts) { return { data: {}, error: null }; },
    };
  },
};

export const supabase = { auth, storage, from(table) { return new QueryBuilder(table); }, rpc() { return { data: null, error: new Error('RPC not implemented') }; } };
export default supabase;
