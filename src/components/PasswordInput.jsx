import { useState } from 'react'

// A password <input> with an eye button inside its right edge that toggles
// the field between hidden and visible text. All props go to the <input>.
export default function PasswordInput({ style, ...inputProps }) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        {...inputProps}
        className="input"
        type={visible ? 'text' : 'password'}
        style={{ paddingRight: 46, ...style }}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          setVisible((v) => !v)
        }}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {visible ? (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </>
          ) : (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  )
}
