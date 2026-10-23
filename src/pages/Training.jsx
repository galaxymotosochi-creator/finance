import { useAuth } from '../hooks/useAuth';

export default function Training() {
  const { businessType } = useAuth();
  const isServices = businessType === 'services';
  const baseSteps = [
    {
      section: 'Настройка базы',
      items: isServices ? [
        { num: '1', title: 'Категории услуг',
          desc: 'Создайте группы услуг — так их удобнее искать в кассе и анализировать.',
          path: 'Склад → Категории → + Добавить' },
        { num: '2', title: 'Услуги',
          desc: 'Добавьте то, что оказываете: название, цена, категория.',
          path: 'Склад → Услуги → + Добавить' },
      ] : [
        { num: '1', title: 'Категории товаров и услуг',
          desc: 'Создайте группы для товаров — так их удобнее искать в кассе и анализировать.',
          path: 'Склад → Категории → + Добавить' },
        { num: '2', title: 'Товары и услуги',
          desc: 'Добавьте то, что продаете: название, цена, категория.',
          path: 'Склад → Товары и услуги → + Добавить' },
        { num: '3', title: 'Поставщики',
          desc: 'Добавьте, у кого закупаете товары или материалы.',
          path: 'Склад → Поставщики → + Добавить' },
        { num: '4', title: 'Товар на складе',
          desc: 'Если товара еще нет — сделайте поставку. Если уже есть на полках — внесите начальные остатки.',
          path: 'Нет товара: Склад → Поставки | Есть товар: Склад → Остатки → Ввести начальные остатки' },
      ],
    },
    {
      section: 'Финансы и команда',
      items: [
        { num: '5', title: 'Категории доходов и расходов',
          desc: 'Настройте статьи, по которым программа будет группировать деньги в отчетах.',
          path: 'Финансы → Категории → + Добавить' },
        { num: '6', title: 'Счета и начальный баланс',
          desc: 'Создайте счета: Наличные, Расчетный счет, Касса. При создании укажите, сколько денег уже есть.',
          path: 'Финансы → Счета → + Счет' },
        { num: '7', title: 'Сотрудники и доступ',
          desc: 'Добавьте сотрудников и назначьте должности с правами для работы в кассе.',
          path: 'Команда → Должности → + Должность → Команда → Сотрудники → + Сотрудник' },
      ],
    },
    {
      section: 'Работа',
      items: [
        { num: '8', title: 'Касса и первая продажа',
          desc: isServices ? 'Откройте смену, выберите услугу и проведите оплату — наличными или картой.' : 'Откройте смену, выберите товар и проведите оплату — наличными или картой.',
          path: isServices ? 'Касса → Открыть смену → Выбрать услугу → Оплатить' : 'Касса → Открыть смену → Выбрать товар → Оплатить' },
        { num: '8.1', title: 'Быстрые действия',
          desc: isServices ? 'Внизу экрана — панель кнопок для быстрых операций из любого раздела: продажа, доход, расход.' : 'Внизу экрана — панель кнопок для быстрых операций из любого раздела: продажа, поставка, доход, расход.',
          path: '' },
        { num: '9', title: 'Проверить',
          desc: isServices ? 'Убедитесь, что все работает: продажа отобразилась в транзакциях, баланс изменился.' : 'Убедитесь, что все работает: продажа отобразилась в транзакциях, товар списался, баланс изменился.',
          path: isServices ? 'Финансы → Доходы и расходы / Финансы → Счета' : 'Финансы → Доходы и расходы / Склад → Остатки / Финансы → Счета' },
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

      {baseSteps.map(group => (
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
          Программа настроена. Можно вести клиентов, смотреть отчеты, ставить цели и спрашивать AI помощника.
        </div>
      </div>
    </div>
  );
}
