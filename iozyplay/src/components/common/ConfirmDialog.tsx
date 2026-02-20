import styles from './ConfirmDialog.module.scss'
import * as Dialog from '@radix-ui/react-dialog'

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
  variant = 'danger',
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.dialog}
          onEscapeKeyDown={onCancel}
          onInteractOutside={onCancel}
        >
          <div className={styles.header}>
            {title && <Dialog.Title className={styles.title}>{title}</Dialog.Title>}
            <Dialog.Close asChild>
              <button type="button" className={styles.close} aria-label="Fermer">
                <span style={{ fontSize: '18px' }}>✕</span>
              </button>
            </Dialog.Close>
          </div>
          <div className={styles.body}>
            <div
              className={`${styles.icon} ${styles[`icon${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}`}
              style={{ fontSize: '48px' }}
            >
              {variant === 'danger' ? '⚠️' : variant === 'warning' ? '⚠️' : 'ℹ️'}
            </div>
            <Dialog.Description className={styles.message}>{message}</Dialog.Description>
          </div>
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonCancel}`}
                onClick={onCancel}
              >
                {cancelText}
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonConfirm} ${styles[`button${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}`}
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
