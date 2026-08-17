import { useState } from 'react'

// Controlled bookmark toggle — the parent owns the saved-state Set (fetched
// once in bulk) and the actual insert/delete against saved_roles, since a
// role list can render dozens of these and per-card fetching would be N+1.
export default function SaveRoleButton({ saved, onToggle, size = 17 }) {
  const [busy, setBusy] = useState(false)

  async function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      await onToggle()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={saved ? 'Remove from saved roles' : 'Save this role'}
      aria-pressed={saved}
      title={saved ? 'Saved' : 'Save for later'}
      style={{ background: 'none', border: 'none', padding: 0, cursor: busy ? 'default' : 'pointer', display: 'inline-flex', lineHeight: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={saved ? 'var(--color-primary)' : 'none'}
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
