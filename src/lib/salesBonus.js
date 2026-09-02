// Расчёт авто-бонуса за позицию продажи по правилам сотрудника.
// Приоритет: конкретная позиция → категория → тип (услуги/товары).
// Правила хранятся в employees.bonus_rules: [{ scope, ref, vt: 'percent'|'fixed', val }]
export function calcSalesBonus(rules, row, prods, cats) {
  if (!rules || rules.length === 0) return { rub: 0, pct: 0 };
  const p = prods.find(x => String(x.id) === String(row.product_id));
  const type = p ? p.type : 'product';
  const catName = p ? (p.cat || '') : '';
  const cat = cats.find(c => String(c.name) === String(catName) && String(c.type) === String(type));
  const total = Number(row.total) || 0;
  const qty = Number(row.qty) || 0;
  const order = ['product', 'service', 'product_category', 'service_category', 'all_products', 'all_services'];
  let rule = null;
  order.forEach(sc => {
    if (rule) return;
    const r = rules.find(x => x.scope === sc);
    if (!r) return;
    if (sc === 'product' && type !== 'service' && String(r.ref) === String(row.product_id)) rule = r;
    else if (sc === 'service' && type === 'service' && String(r.ref) === String(row.product_id)) rule = r;
    else if (sc === 'product_category' && type !== 'service' && cat && String(r.ref) === String(cat.id)) rule = r;
    else if (sc === 'service_category' && type === 'service' && cat && String(r.ref) === String(cat.id)) rule = r;
    else if (sc === 'all_products' && type !== 'service') rule = r;
    else if (sc === 'all_services' && type === 'service') rule = r;
  });
  if (!rule) return { rub: 0, pct: 0 };
  const val = Number(rule.val) || 0;
  if (rule.vt === 'fixed') {
    const rub = Math.round(val * qty);
    return { rub, pct: total > 0 ? Math.round(rub / total * 1000) / 10 : 0 };
  }
  const rub = Math.round(total * val / 100);
  return { rub, pct: val };
}
