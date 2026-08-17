import { useState } from 'react'
import { Link } from 'react-router-dom'

// Shared with Signup.jsx, which sets these at account creation — the single
// source of truth for "is this a brand new account that hasn't seen the
// primary nav link yet."
export const NEW_USER_HINT_KEYS = {
  candidate: 'mellow_new_user_hint_candidate',
  employer: 'mellow_new_user_hint_employer',
}

// Wraps a nav Link with a one-time pulsing highlight. The flag this checks
// is set once, at signup (see Signup.jsx), so only genuinely new accounts
// ever see it — existing users loading the app with empty localStorage (a
// new browser, a cleared cache) never get it. It then persists across
// visits until the link is actually clicked, at which point it's cleared
// for good.
export default function NavHighlight({ to, storageKey, children, style }) {
  const [show, setShow] = useState(() => localStorage.getItem(storageKey) === '1')

  function handleClick() {
    if (!show) return
    localStorage.removeItem(storageKey)
    setShow(false)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <Link to={to} onClick={handleClick} style={style}>
        {children}
      </Link>
      {show && <span className="nav-hint-pulse" aria-hidden="true" />}
    </span>
  )
}
