import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import MySiteSettings from './MySiteSettings';
import ShowcaseFilters from './ShowcaseFilters';
import MySiteOrders from './MySiteOrders';

const TABS = [
  { id:'orders', label:'Заявки' },
  { id:'settings', label:'Настройки витрины' },
];

export default function MySite() {
  const { user } = useAuth();
  const [tab, setTab] = useState('orders');
  const [shop, setShop] = useState(null);
  const [slug, setSlug] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const s = await supabase.from('shops').select('*').eq('user_id', user.id).maybeSingle();
    if (s.data) { setShop(s.data); setSlug(s.data.slug); }
    else { setShop({}); setSlug(''); }
    const o = await supabase.from('shop_orders').select('*').eq('user_id', user.id).order('created_at', { ascending:false }).limit(100);
    setOrders(o.data || []);
    const pr = await supabase.from('products').select('id, name, cat, type').eq('user_id', user.id).limit(500);
    setProducts(pr.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const save = async (form) => {
    if (!user) return;
    if (!slug) { setToast('Укажите адрес витрины'); return; }
    setSaving(true);
    const payload = { ...form, slug, user_id: user.id, updated_at: new Date().toISOString() };
    // Режимы витрины: корзина — для товаров, запись — для услуг
    if (payload.use_cart === undefined) payload.use_cart = true;
    if (payload.use_booking === undefined) payload.use_booking = false;
    let err = null;
    if (shop && shop.id) {
      const r = await supabase.from('shops').update(payload).eq('id', shop.id);
      err = r.error;
    } else {
      const r = await supabase.from('shops').insert([payload]);
      err = r.error;
    }
    setSaving(false);
    if (err) { setToast('Ошибка: ' + (err.message || 'неизвестно')); return; }
    setToast('Сохранено'); load();
  };

  const changeStatus = async (o, status) => {
    await supabase.from('shop_orders').update({ status }).eq('id', o.id);
    if (status === 'confirmed') {
      // Резервируем товар из заявки, чтобы его не продали в кассе
      const its = await supabase.from('shop_order_items').select('*').eq('order_id', o.id);
      for (const it of (its.data || [])) {
        await supabase.from('shop_reserves').insert([{
          user_id: user.id, order_id: String(o.id), product_id: String(it.product_id), quantity: it.quantity
        }]);
      }
    }
    if (status === 'canceled') {
      await supabase.from('shop_reserves').delete().eq('order_id', String(o.id));
    }
    load();
  };

  const makeReceipt = async (o) => {
    const its = await supabase.from('shop_order_items').select('*').eq('order_id', o.id);
    const items = (its.data || []).map(it => ({
      id: it.product_id,
      name: it.product_name,
      price: Number(it.price) || 0,
      qty: Number(it.quantity) || 1,
      final_price: Number(it.price) || 0,
      type: 'product',
    }));
    if (!items.length) { setToast('В заявке нет товаров'); return; }
    try {
      localStorage.setItem('kassa_cart', JSON.stringify(items));
      localStorage.setItem('kassa_order_id', String(o.id));
      localStorage.setItem('kassa_order_num', String(o.order_number));
    } catch (e) {}
    setToast('Заявка №' + o.order_number + ' передана в кассу');
    setTimeout(() => { window.location.href = '/kassa'; }, 600);
  };

  return (
    <div style={{ padding:'0 0 40px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:16 }}>
        <div>
          <h1 style={{ margin:0, fontSize:'1.4rem', fontWeight:800, letterSpacing:'-.02em' }}>Мой сайт</h1>
          <div style={{ fontSize:'0.84rem', color:'#9ca3af', marginTop:4 }}>
            {slug ? <>Витрина: <b style={{ color:'#1F75FF' }}>atlaspos.ru/s/{slug}</b></> : 'Витрина ещё не создана'}
          </div>
        </div>
        {slug && (
          <button className="btn btn-outline" onClick={() => window.open('/s/' + slug, '_blank')}>Открыть витрину</button>
        )}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:16, borderBottom:'1px solid #eee' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background:'none', border:'none', padding:'10px 14px', cursor:'pointer',
              fontSize:'0.88rem', fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? '#111' : '#9ca3af',
              borderBottom: tab === t.id ? '2px solid #111' : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <>
          <MySiteSettings shop={shop} slug={slug} setShop={setShop} setSlug={setSlug} onSave={save} saving={saving} />
          <ShowcaseFilters form={shop || {}} setForm={setShop} products={products} />
          <div style={{ marginTop:12 }}>
            <button className="btn btn-dark" onClick={() => save(shop || {})} disabled={saving}>
              {saving ? 'Сохраняю…' : 'Сохранить фильтры'}
            </button>
          </div>
        </>
      )}
      {tab === 'orders' && <MySiteOrders orders={orders} loading={loading} onChangeStatus={changeStatus} onMakeReceipt={makeReceipt} />}

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#111',
          color:'#fff', padding:'10px 18px', borderRadius:24, fontSize:'0.84rem', fontWeight:600, zIndex:9999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
