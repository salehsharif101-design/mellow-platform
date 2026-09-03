import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { suppressAuthRedirectsFor } from '../lib/authRedirectGuard.js'

// Shown in place of a confirmation, invite, or password-recovery link's
// normal flow when the browser already has a different account signed in.
// Used by Login.jsx (email confirmation), TeamAccept.jsx (team invites),
// and ResetPassword.jsx (password recovery) — each renders this inside its
// own page shell, since they don't share one.
// skipSignOut: for a caller that already knows the session it wants to
// keep active is the one currently live (ResetPassword.jsx — the session
// showing this notice IS the recovery link's own, correct one; there's
// nothing to actually sign out of, since signOut() invalidates whatever
// session it's called on server-side regardless of scope, which would
// destroy the very session the page needs to finish the reset).
export default function WrongAccountNotice({ currentEmail, onSignOut, skipSignOut = false }) {
  const [signingOut, setSigningOut] = useState(false)

  async function handleClick() {
    setSigningOut(true)
    if (!skipSignOut) {
      suppressAuthRedirectsFor(3000)
      await supabase.auth.signOut({ scope: 'local' })
    }
    await onSignOut?.()
    setSigningOut(false)
  }

  return (
    <>
      <h1 style={{ fontSize: 28 }}>Wrong account</h1>
      <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
        You are currently signed in as <strong>{currentEmail}</strong>. This link was sent to a different email
        address. To continue, please sign out first.
      </p>
      <button type="button" className="btn btn-primary" onClick={handleClick} disabled={signingOut} style={{ marginTop: 20 }}>
        {signingOut ? 'Signing out…' : 'Sign out and continue'}
      </button>
    </>
  )
}
