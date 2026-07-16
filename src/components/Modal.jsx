import { useEffect } from 'react';

/**
 * Универсальный компонент модалки
 *
 * width — 'narrow' (400px) | 'medium' (480px) | 'wide' (560px) | число (своя ширина)
 * Пример: <Modal open={show} onClose={fn} title="Заголовок" subtitle="Описание" width="wide">
 */
export default function Modal({ open, onClose, title, subtitle, children, actions, width }) {
  // Закрытие по Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Блокировка скролла body
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  // Определяем класс ширины
  let widthClass = '';
  let customWidth = null;
  if (width === 'narrow') widthClass = 'modal-narrow';
  else if (width === 'medium') widthClass = 'modal-medium';
  else if (width === 'wide' || !width) widthClass = 'modal-wide';
  else if (typeof width === 'number') customWidth = width;

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target.className === 'modal-overlay active') onClose(); }}>
      <div className={`modal-box ${widthClass}`} style={customWidth ? { maxWidth: customWidth + 'px' } : {}}>
        <button className="modal-close" onClick={onClose} type="button">&times;</button>
        {title && <h1 className="modal-title">{title}</h1>}
        {subtitle && <p className="modal-sub">{subtitle}</p>}
        <div className="modal-body">
          {children}
        </div>
        {actions && (
          <div className="modal-actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
