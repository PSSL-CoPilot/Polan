import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Small reusable confirmation modal, styled to match the metric modal. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className="modal-overlay"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCancel()
          }}
        >
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="modal-card confirm-card"
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            transition={{ duration: 0.16 }}
          >
            <div className="modal-head">
              <div className="modal-icon danger">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2>{title}</h2>
                <p>{message}</p>
              </div>
            </div>
            <div className="modal-footer confirm-footer">
              <button className="ghost-button" onClick={onCancel} type="button">
                {cancelLabel}
              </button>
              <button
                className="primary-button danger-button"
                onClick={onConfirm}
                type="button"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
