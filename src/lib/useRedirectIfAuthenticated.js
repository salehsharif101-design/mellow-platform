import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase.js'

// Bounces an already-authenticated user straight to their dashboard instead
// of ever letting them see an auth form (login or signup) — including a
// cold load in a fresh tab, where the session first has to be read from
// storage before we know either way. `checking` starts true so the caller
// can render nothing until it resolves to false (confirmed no session) or a
// redirect has already been kicked off.
export function useRedirectIfAuthenticated(skip = false) {
  const [checking, setChecking] = useState(!skip)
  const navigate = useNavigate()

  useEffect(() => {
    if (skip) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session) {
        if (!cancelled) setChecking(false)
        return
      }
      const { data: row } = await supabase.from('users').select('user_type').eq('id', session.user.id).single()
      if (cancelled) return
      // Deliberately not resetting `checking` here — the component is about
      // to unmount as the route changes, and flipping it to false first
      // would render the form for one frame before that navigation
      // actually takes effect.
      navigate(row?.user_type === 'employer' ? '/employer/dashboard' : '/dashboard', { replace: true })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip])

  return checking
}
