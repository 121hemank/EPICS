import { useEffect, useRef } from 'react';

export default function Modal({ open, onClose, title, children }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus first focusable element
    requestAnimationFrame(() => {
      const focusable = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }
    });

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="lead-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
      onClick={onClose}
      style={{ display: 'flex' }}
    >
      <div className="lead-modal-content" onClick={e => e.stopPropagation()} ref={modalRef}>
        <div className="lead-modal-header">
          <h3>{title}</h3>
          <button type="button" className="lead-modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
