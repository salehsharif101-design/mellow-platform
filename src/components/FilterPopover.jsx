import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// A compact filter-bar button that opens a floating panel beneath it — used
// to fold the talent feed's multi-row filter pills into one row. Closes on
// an outside press or Escape. `activeCount` shows how many options inside
// are currently applied, so a collapsed filter still reads as "on".
// `children` may be a function, called with { close }, for single-choice
// panels that should dismiss themselves once an option is picked.
// `maxLabelWidth` ellipsizes a long dynamic label (e.g. a role title) so
// it can't stretch the filter bar.
export default function FilterPopover({ label, activeCount = 0, children, panelWidth, maxLabelWidth }) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const wrapRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Anchored to the button's left edge by default; if that would push the
  // panel off the right side of the screen (a trigger that wrapped onto a
  // narrow row), anchor to its right edge instead.
  useLayoutEffect(() => {
    if (!open || !panelRef.current || !wrapRef.current) return
    const wrapLeft = wrapRef.current.getBoundingClientRect().left
    const panelWidthPx = panelRef.current.getBoundingClientRect().width
    setAlignRight(wrapLeft + panelWidthPx > window.innerWidth - 8)
  }, [open])

  const active = activeCount > 0

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={maxLabelWidth ? label : undefined}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          fontSize: 13,
          padding: '9px 10px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          background: active || open ? 'var(--color-bg-soft)' : undefined,
        }}
      >
        {maxLabelWidth ? (
          <span style={{ maxWidth: maxLabelWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
            {label}
          </span>
        ) : (
          label
        )}
        {active && (
          <span
            style={{
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeCount}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="2,3.5 5,6.5 8,3.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="group"
          aria-label={label}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(alignRight ? { right: 0 } : { left: 0 }),
            zIndex: 40,
            width: panelWidth,
            maxWidth: 'calc(100vw - 32px)',
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(10, 10, 10, 0.12)',
            padding: 12,
          }}
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  )
}
