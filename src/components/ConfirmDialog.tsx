import { Modal } from './Modal';

/** Dialogue de confirmation pour les actions destructrices. */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler',
  destructive = false, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      maxWidth={460}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={destructive ? 'btn btn-primary' : 'btn btn-dark'}
            style={destructive ? { background: 'var(--red)' } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{message}</p>
    </Modal>
  );
}
