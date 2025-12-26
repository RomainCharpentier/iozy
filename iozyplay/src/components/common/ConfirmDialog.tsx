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
  if (!isOpen) return null

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          {title && <h3 className="confirm-dialog-title">{title}</h3>}
          <button
            type="button"
            className="confirm-dialog-close"
            onClick={onCancel}
            aria-label="Fermer"
          >
            <FaTimes />
          </button>
        </div>
        <div className="confirm-dialog-body">
          <div className={`confirm-dialog-icon confirm-dialog-icon-${variant}`}>
            <FaExclamationTriangle />
          </div>
          <p className="confirm-dialog-message">{message}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-button confirm-dialog-button-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-dialog-button confirm-dialog-button-confirm confirm-dialog-button-${variant}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}


