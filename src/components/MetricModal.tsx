import { AnimatePresence, motion } from 'framer-motion'
import { Link2, Sigma, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { MetricRecord } from '../types'
import { isValidHttpUrl } from '../utils/storage'

export interface MetricFormValues {
  name: string
  measureName: string
  atlanLink?: string
  description?: string
}

interface MetricModalProps {
  open: boolean
  /** When set, the modal edits this metric instead of creating a new one. */
  metric?: MetricRecord | null
  onClose: () => void
  onSubmit: (values: MetricFormValues) => void
}

export function MetricModal({ open, metric, onClose, onSubmit }: MetricModalProps) {
  const [name, setName] = useState('')
  const [measureName, setMeasureName] = useState('')
  const [atlanLink, setAtlanLink] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setName(metric?.name ?? '')
    setMeasureName(metric?.measureName ?? '')
    setAtlanLink(metric?.atlanLink ?? '')
    setDescription(metric?.description ?? '')
    setErrors({})
  }, [open, metric])

  const submit = () => {
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = 'Metric Name is required.'
    if (!measureName.trim()) {
      nextErrors.measureName = 'Measure Name is required.'
    }
    if (atlanLink.trim() && !isValidHttpUrl(atlanLink.trim())) {
      nextErrors.atlanLink = 'Enter a valid http(s) URL.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSubmit({
      name: name.trim(),
      measureName: measureName.trim(),
      atlanLink: atlanLink.trim() || undefined,
      description: description.trim() || undefined,
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className="modal-overlay"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="modal-card"
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            role="dialog"
            aria-modal="true"
            aria-label={metric ? 'Edit metric' : 'Create metric'}
            transition={{ duration: 0.18 }}
          >
            <div className="modal-head">
              <div className="modal-icon">
                <Sigma size={18} />
              </div>
              <div>
                <h2>{metric ? 'Edit Metric' : 'Create Metric'}</h2>
                <p>
                  Define the business metric and the underlying measure it is
                  computed from.
                </p>
              </div>
              <button
                aria-label="Close"
                className="modal-close"
                onClick={onClose}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <form
              className="modal-body"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <label className={`field ${errors.name ? 'invalid' : ''}`}>
                <span>
                  Metric Name <i>*</i>
                </span>
                <input
                  autoFocus
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Net Revenue"
                  value={name}
                />
                {errors.name && <em>{errors.name}</em>}
              </label>

              <label className={`field ${errors.measureName ? 'invalid' : ''}`}>
                <span>
                  Measure Name <i>*</i>
                </span>
                <input
                  onChange={(event) => setMeasureName(event.target.value)}
                  placeholder="e.g. SUM(net_revenue)"
                  value={measureName}
                />
                {errors.measureName && <em>{errors.measureName}</em>}
              </label>

              <label className={`field ${errors.atlanLink ? 'invalid' : ''}`}>
                <span>
                  <Link2 size={11} /> Atlan Link
                </span>
                <input
                  onChange={(event) => setAtlanLink(event.target.value)}
                  placeholder="https://your-org.atlan.com/..."
                  value={atlanLink}
                />
                {errors.atlanLink && <em>{errors.atlanLink}</em>}
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What this metric represents and how it should be used."
                  rows={3}
                  value={description}
                />
              </label>

              <div className="modal-footer">
                <button
                  className="ghost-button"
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  {metric ? 'Save changes' : 'Create Metric'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
