// Публичная витрина «Мой сайт»: просмотр магазина, товаров и приём заявок
const express = require('express');
const slugify = (s) => String(s || '')
  .toLowerCase().replace(/[^a-z0-9а-яё-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

module.exports = function (pool) {
  const router = express.Router();

  // Публично: магазин по slug + товары
  router.get('/public/shop/:slug', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM shops WHERE slug = $1 AND is_active = true', [req.params.slug]);
      const shop = rows[0];
      if (!shop) return res.status(404).json({ error: 'Магазин не найден' });
      const pr = await pool.query(
        `SELECT id, name, price, description, photo_url, type, cat FROM products
         WHERE user_id = $1 AND COALESCE(hidden,false) = false ORDER BY name LIMIT 500`,
        [shop.user_id]
      );
      res.json({ shop: { id: shop.id, slug: shop.slug, name: shop.name, tagline: shop.tagline,
        about: shop.about, logo_url: shop.logo_url, cover_url: shop.cover_url, phone: shop.phone,
        address: shop.address, work_hours: shop.work_hours,
        use_cart: shop.use_cart !== false, use_booking: shop.use_booking === true,
        show_types: shop.show_types || [], show_cats: shop.show_cats || [],
        hidden_products: shop.hidden_products || [] }, products: pr.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Публично: приём заявки из корзины
  router.post('/public/shop/:slug/order', async (req, res) => {
    const client = await pool.connect();
    try {
      const { name, phone, email, comment, items } = req.body || {};
      if (!name || !phone) return res.status(400).json({ error: 'Укажите имя и телефон' });
      if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Корзина пуста' });
      const { rows } = await client.query('SELECT * FROM shops WHERE slug = $1 AND is_active = true', [req.params.slug]);
      const shop = rows[0];
      if (!shop) return res.status(404).json({ error: 'Магазин не найден' });

      await client.query('BEGIN');
      let total = 0;
      const clean = [];
      for (const it of items.slice(0, 100)) {
        const pid = String(it.id);
        const p = await client.query('SELECT id, name, price FROM products WHERE id = $1 AND user_id = $2', [pid, shop.user_id]);
        if (!p.rows.length) continue;
        const prod = p.rows[0];
        const qty = Math.max(1, Math.min(999, parseInt(it.qty) || 1));
        const sum = Number(prod.price || 0) * qty;
        total += sum;
        clean.push({ id: prod.id, name: prod.name, price: Number(prod.price || 0), qty, sum });
      }
      if (!clean.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Товары не найдены' }); }

      const numRow = await client.query('SELECT COALESCE(MAX(order_number),0)+1 AS n FROM shop_orders WHERE user_id = $1', [shop.user_id]);
      const orderNumber = Number(numRow.rows[0].n);
      const o = await client.query(
        `INSERT INTO shop_orders (user_id, shop_id, order_number, customer_name, customer_phone,
          customer_email, comment, total, status, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new','showcase') RETURNING *`,
        [shop.user_id, shop.id, orderNumber, String(name).slice(0,120), String(phone).slice(0,40),
         String(email || '').slice(0,120), String(comment || '').slice(0,1000), total]
      );
      const order = o.rows[0];
      for (const c of clean) {
        await client.query(
          'INSERT INTO shop_order_items (order_id, product_id, product_name, price, quantity, total) VALUES ($1,$2,$3,$4,$5,$6)',
          [order.id, c.id, c.name, c.price, c.qty, c.sum]
        );
      }
      await client.query('COMMIT');
      res.json({ ok: true, order_number: orderNumber, total });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (e2) {}
      res.status(500).json({ error: e.message });
    } finally { client.release(); }
  });


  // Публично: свободные слоты на дату
  router.get('/public/shop/:slug/slots', async (req, res) => {
    try {
      const { date } = req.query;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ error: 'Укажите дату' });
      const { rows } = await pool.query('SELECT * FROM shops WHERE slug = $1 AND is_active = true', [req.params.slug]);
      const shop = rows[0];
      if (!shop) return res.status(404).json({ error: 'Магазин не найден' });
      const step = Number(shop.booking_step) || 60;
      const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
      const toStr = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
      // График по дням недели: 0=Пн ... 6=Вс (в базе ключи Пн..Вс)
      const DAY_KEYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
      const dObj = new Date(String(date) + 'T12:00:00');
      const dow = (dObj.getDay() + 6) % 7;
      const sched = shop.booking_schedule || {};
      const dayCfg = sched[DAY_KEYS[dow]];
      if (dayCfg && dayCfg.off) return res.json({ slots: [], date, step, closed: true });
      const open = (dayCfg && dayCfg.open) || shop.booking_open || '09:00';
      const close = (dayCfg && dayCfg.close) || shop.booking_close || '20:00';
      const brkS = shop.booking_break_start || '';
      const brkE = shop.booking_break_end || '';
      const busy = await pool.query(
        "SELECT start_time FROM shop_bookings WHERE user_id = $1 AND booking_date = $2 AND status <> 'canceled'",
        [shop.user_id, date]
      );
      const taken = new Set(busy.rows.map(r => String(r.start_time).slice(0, 5)));
      const slots = [];
      for (let t = toMin(open); t + step <= toMin(close); t += step) {
        const st = toStr(t);
        if (brkS && brkE && t < toMin(brkE) && (t + step) > toMin(brkS)) continue; // слот пересекает перерыв
        if (!taken.has(st)) slots.push({ start: st, end: toStr(t + step) });
      }
      res.json({ slots, date, step });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Публично: создать запись
  router.post('/public/shop/:slug/booking', async (req, res) => {
    try {
      const { name, phone, comment, date, start, service_id, service_name, price, end } = req.body || {};
      if (!name || !phone) return res.status(400).json({ error: 'Укажите имя и телефон' });
      if (!date || !start) return res.status(400).json({ error: 'Выберите дату и время' });
      const { rows } = await pool.query('SELECT * FROM shops WHERE slug = $1 AND is_active = true', [req.params.slug]);
      const shop = rows[0];
      if (!shop) return res.status(404).json({ error: 'Магазин не найден' });
      const dup = await pool.query(
        "SELECT 1 FROM shop_bookings WHERE user_id = $1 AND booking_date = $2 AND start_time = $3 AND status <> 'canceled'",
        [shop.user_id, date, start]
      );
      if (dup.rows.length) return res.status(409).json({ error: 'Это время уже занято' });
      const o = await pool.query(
        `INSERT INTO shop_bookings (user_id, booking_date, start_time, end_time, customer_name,
          customer_phone, comment, service_name, service_id, price, status, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new','showcase') RETURNING id`,
        [shop.user_id, date, start, end || start, String(name).slice(0,120), String(phone).slice(0,40),
         String(comment || '').slice(0,1000), String(service_name || '').slice(0,200),
         service_id ? String(service_id) : null, Number(price) || 0]
      );
      res.json({ ok: true, id: o.rows[0].id, date, start });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
