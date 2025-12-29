import * as Dialog from '@radix-ui/react-dialog'
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa'
import '../../styles/confirm-dialog.css'

interface ConfirmDialogProps {
  isOpen: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'warning' | 'info'
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-dialog-overlay" />
        <Dialog.Content className="confirm-dialog" onEscapeKeyDown={onCancel} onInteractOutside={onCancel}>
          <div className="confirm-dialog-header">
            {title && <Dialog.Title className="confirm-dialog-title">{title}</Dialog.Title>}
            <Dialog.Close asChild>
              <button
                type="button"
                className="confirm-dialog-close"
                aria-label="Fermer"
              >
                <FaTimes />
              </button>
            </Dialog.Close>
          </div>
          <div className="confirm-dialog-body">
            <div className={`confirm-dialog-icon confirm-dialog-icon-${variant}`}>
              <FaExclamationTriangle />
            </div>
            <Dialog.Description className="confirm-dialog-message">
              {message}
            </Dialog.Description>
          </div>
          <div className="confirm-dialog-actions">
            <Dialog.Close asChild>
              <button
                type="button"
                className="confirm-dialog-button confirm-dialog-button-cancel"
                onClick={onCancel}
              >
                {cancelText}
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                type="button"
                className={`confirm-dialog-button confirm-dialog-button-confirm confirm-dialog-button-${variant}`}
                onClick={onConfirm}
              >
                {confirmText}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
