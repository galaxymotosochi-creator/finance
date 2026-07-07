export default function Training() {
  const steps = [
    {
      section: 'Настройка базы',
      items: [
        { num: '1', title: 'Категории товаров и услуг',
          desc: 'Создайте группы для товаров — так их удобнее искать в кассе и анализировать.',
          path: 'Склад → Категории → + Добавить' },
        { num: '2', title: 'Товары и услуги',
          desc: 'Добавьте то, что продаёте: название, цена, категория.',
          path: 'Склад → Товары и услуги → + Добавить' },
        { num: '3', title: 'Поставщики',
          desc: 'Добавьте, у кого закупаете товары или материалы.',
          path: 'Склад → Поставщики → + Добавить' },
        { num: '4', title: 'Товар на складе',
          desc: 'Если товара ещё нет — сделайте поставку. Если уже есть на полках — внесите начальные остатки.',
          path: 'Нет товара: Склад → Поставки | Есть товар: Склад → Остатки → Ввести начальные остатки' },
      ],
    },
    {
      section: 'Финансы и команда',
      items: [
        { num: '5', title: 'Категории доходов и расходов',
          desc: 'Настройте статьи, по которым программа будет группировать деньги в отчётах.',
          path: 'Финансы → Категории → + Добавить' },
        { num: '6', title: 'Счета и начальный баланс',
          desc: 'Создайте счета: Наличные, Расчётный счёт, Касса. При создании укажите, сколько денег уже есть.',
          path: 'Финансы → Счета → + Счёт' },
        { num: '7', title: 'Сотрудники и доступ',
          desc: 'Добавьте сотрудников и назначьте должности с правами для работы в кассе.',
          path: 'Команда → Должности → + Должность → Команда → Сотрудники → + Сотрудник' },
      ],
    },
    {
      section: 'Работа',
      items: [
        { num: '8', title: 'Касса и первая продажа',
          desc: 'Откройте смену, выберите товар и проведите оплату — наличными или картой.',
          path: 'Касса → Открыть смену → Выбрать товар → Оплатить' },
        { num: '8.1', title: 'Быстрые действия',
          desc: 'Внизу экрана — панель кнопок для быстрых операций из любого раздела: продажа, поставка, доход, расход.',
          path: '' },
        { num: '9', title: 'Проверить',
          desc: 'Убедитесь, что всё работает: продажа отобразилась в транзакциях, товар списался, баланс изменился.',
          path: 'Финансы → Транзакции / Склад → Остатки / Финансы → Счета' },
      ],
    },
  ];

  const s = {
    page: { fontFamily: 'inherit', color: '#111' },
    title: { fontSize: '1.2rem', fontWeight: 700, marginBottom: 4, letterSpacing: '-.02em' },
    sub: { fontSize: '.82rem', color: 'rgba(0,0,0,.54)', marginBottom: 24 },
    sectionTitle: { fontSize: '.7rem', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 12, marginTop: 4 },
    row: { display: 'flex', gap: 12, padding: '10px 0' },
    rowBorder: { borderBottom: '1px solid rgba(0,0,0,.04)' },
    num: { fontSize: '.68rem', fontWeight: 600, color: '#bbb', minWidth: 32, paddingTop: 1 },
    body: { flex: 1 },
    name: { fontSize: '.85rem', fontWeight: 700, color: '#111' },
    desc: { fontSize: '.78rem', color: '#666', lineHeight: 1.5, marginTop: 2 },
    path: { fontSize: '.72rem', color: '#888', marginTop: 4, background: '#f5f5f5', padding: '2px 8px', borderRadius: 4, display: 'inline-block' },
    final: { background: '#f5f5f5', borderRadius: 12, padding: '1rem 1.25rem', marginTop: 20 },
    finalTitle: { fontSize: '.85rem', fontWeight: 700, marginBottom: 2 },
    finalSub: { fontSize: '.78rem', color: '#888' },
  };

  return (
    <div style={s.page}>
      <h1 style={s.title}>Обучение</h1>
      <p style={s.sub}>10 шагов для запуска. Выполняйте по порядку — и программа готова к работе.</p>

      {steps.map(group => (
        <div key={group.section} style={{ marginBottom: 20 }}>
          <div style={s.sectionTitle}>{group.section}</div>
          <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: '4px 20px', background: '#fff' }}>
            {group.items.map((item, i) => (
              <div key={item.num} style={{ ...s.row, ...(i < group.items.length - 1 ? s.rowBorder : {}) }}>
                <div style={s.num}>{item.num}</div>
                <div style={s.body}>
                  <div style={s.name}>{item.title}</div>
                  <div style={s.desc}>{item.desc}</div>
                  {item.path && <div style={s.path}>{item.path}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={s.final}>
        <div style={s.finalTitle}>Готово!</div>
        <div style={s.finalSub}>
          Программа настроена. Можно вести клиентов, смотреть отчёты, ставить цели и спрашивать AI помощника.
        </div>
      </div>
    </div>
  );
}
