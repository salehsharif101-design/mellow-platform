import { useState } from 'react'
import Modal from './Modal.jsx'

export default function ConfirmModal({ title, message, confirmLabel = 'Delete', busyLabel, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} width={400}>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{message}</p>
      {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          style={{ background: '#d92d20' }}
        >
          {busy ? busyLabel || `${confirmLabel}…` : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
