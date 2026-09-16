import { useState } from 'react';

/**
 * Кнопка «?» рядом с заголовком раздела + справка ВЫДВИЖНОЙ ПАНЕЛЬЮ СПРАВА.
 *
 * Два режима содержимого:
 *  1) FAQ (как в разделе «Счета»):  faq={[{q:'Вопрос', a:<>Ответ</>}, ...]}
 *  2) Классические блоки (как в остальных разделах): blocks={[{title, items|text}, ...]}
 *
 * Пример:
 * <SectionHelp title="Счета"
 *   intro="..."
 *   faq={[{ q: 'С чего начать?', a: <>...</> }]} />
 */
export default function SectionHelp({ title = 'Справка', intro, blocks = [], faq = [] }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState([0]);
  const toggle = (i) => setOpened(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  const hasFaq = Array.isArray(faq) && faq.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Как пользоваться разделом"
        aria-label="Справка по разделу"
        className="sec-help-q"
      >?</button>

      {open && <div className="sec-help-ov" onClick={() => setOpen(false)} />}

      <aside className={'sec-help-panel' + (open ? ' open' : '')}>
        <div className="sec-help-head">
          <div>
            <h2>{title}</h2>
            <div className="ms">{hasFaq ? 'Частые вопросы' : 'Как пользоваться'}</div>
          </div>
          <button className="sec-help-x" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
        </div>
        <div className="sec-help-body">
          {intro && <p className="sec-help-intro">{intro}</p>}

          {hasFaq && (
            <div className="sec-help-faq">
              {faq.map((f, i) => (
                <div key={i} className={'sec-help-item' + (opened.includes(i) ? ' open' : '')}>
                  <button type="button" className="sec-help-q-row" onClick={() => toggle(i)}>
                    <span>{f.q}</span>
                    <span className="car">▾</span>
                  </button>
                  {opened.includes(i) && <div className="sec-help-a">{f.a}</div>}
                </div>
              ))}
            </div>
          )}

          {blocks.map((b, i) => (
            <div key={i} className="sec-help-block">
              <div className="bt">{b.title}</div>
              {b.items ? (
                <ul>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
              ) : b.text ? (
                <p>{b.text}</p>
              ) : null}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
