import { useState } from 'react'

// Small icon-only share control used everywhere a page link can be copied
// (candidate/company profiles, role pages, employer dashboard/roles list).
// Matches the size and stroke style of the LinkedIn/website icons in
// CompanyLinkIcons so it can sit inline with them.
export default function ShareButton({ url, label = 'Share', size = 17 }) {
  const [copied, setCopied] = useState(false)

  async function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable or blocked (older browser, denied permission,
      // non-trusted context) — fall back to the legacy selection-based copy.
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', lineHeight: 0 }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>
      {copied && (
        <span
          role="status"
          style={{
            position: 'absolute',
            bottom: '130%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-text)',
            color: 'var(--color-bg)',
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 9px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          Link copied!
        </span>
      )}
    </span>
  )
}
