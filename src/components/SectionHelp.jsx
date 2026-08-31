import { useState } from 'react';
import Modal from './Modal';

/**
 * Кнопка «?» рядом с заголовком раздела + модалка-справка в стиле пустой подсказки.
 *
 * Пример:
 * <SectionHelp title="Остатки"
 *   intro="Как пользоваться разделом"
 *   blocks={[
 *     { title: 'Как добавить товар', items: [<>Пункт 1</>, <>Пункт 2</>] },
 *     { title: 'Столбцы таблицы', items: [<><b>Товар</b> — название</>] },
 *   ]} />
 */
export default function SectionHelp({ title = 'Справка', intro, blocks = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Как пользоваться разделом"
        style={{
          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
          border: '1px solid var(--border)', background: 'var(--body-bg)',
          color: 'var(--muted)', fontSize: '.72rem', fontWeight: 700,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', padding: 0, lineHeight: 1, marginLeft: '.45rem',
        }}
      >?</button>

      <Modal open={open} onClose={() => setOpen(false)} title={title} width="wide">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.6rem', opacity: .15, marginBottom: '.5rem' }}>❓</div>
        </div>
        {intro && (
          <p style={{ fontSize: '.82rem', color: '#555', lineHeight: 1.6, marginBottom: '1rem' }}>{intro}</p>
        )}
        {blocks.map((b, i) => (
          <div key={i} style={{ marginBottom: '.9rem' }}>
            <div style={{ fontWeight: 600, fontSize: '.82rem', color: '#222', marginBottom: '.25rem' }}>{b.title}</div>
            {b.items ? (
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.8rem', color: '#555', lineHeight: 1.65 }}>
                {b.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            ) : b.text ? (
              <p style={{ margin: 0, fontSize: '.8rem', color: '#555', lineHeight: 1.65 }}>{b.text}</p>
            ) : null}
          </div>
        ))}
      </Modal>
    </>
  );
}
