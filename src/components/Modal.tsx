import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Modale générique — overlay + carte centrée. ESC ferme.
 *  Rendue via portail dans `document.body` pour ne pas se retrouver imbriquée
 *  dans un `<form>` parent (ce qui produirait des formulaires nichés invalides
 *  et ferait soumettre le formulaire extérieur au lieu de celui de la modale). */
export function Modal({
  open, title, onClose, children, footer, maxWidth = 720,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'grid', placeItems: 'center', zIndex: 200, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--white)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth,
          maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderBottom: '1px solid var(--gray-200)',
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'transparent', border: 'none', fontSize: 22,
              color: 'var(--gray-500)', lineHeight: 1, padding: 4, borderRadius: 6,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: '14px 20px', borderTop: '1px solid var(--gray-200)',
              display: 'flex', gap: 10, justifyContent: 'flex-end',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
