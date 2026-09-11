import { useState } from 'react'

// A useState that mirrors its value to sessionStorage under a fixed key, so
// which screen of a multi-step flow the user is on survives a same-tab
// reload — the real-world trigger being a browser discarding a background
// tab under memory pressure (opening a link in a new tab is a common way to
// cause exactly that) and reloading it from scratch when the user switches
// back, which resets every plain useState to its initial value even though
// nothing the user did should have moved them. A genuinely new tab (or the
// browser fully restarted) still starts fresh, since sessionStorage is
// scoped to that one tab.
//
// Keys are fixed strings, not scoped to a user/candidate id, since the id
// usually isn't available synchronously on first render (auth/profile data
// loads in async) and re-keying after the fact can't retroactively fix a
// lazy useState initializer that already ran. clearPersistedOnboardingState
// below is responsible for clearing these on sign-out instead (see
// AuthContext.jsx), so a different account signing in on the same tab
// doesn't inherit them.
export function usePersistedState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored === null ? initialValue : JSON.parse(stored)
    } catch {
      return initialValue
    }
  })

  function setPersistedState(value) {
    setState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      try {
        sessionStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Private browsing / quota exceeded — the state itself still
        // updates normally, it just won't survive a reload this time.
      }
      return next
    })
  }

  return [state, setPersistedState]
}

// Every key any onboarding flow persists through the hook above — kept in
// one place so signOut can wipe them all without each screen needing to
// know about the others.
export const ONBOARDING_PERSISTED_KEYS = [
  'mellow_onboarding_candidate_just_completed',
  'mellow_onboarding_candidate_show_welcome',
  'mellow_onboarding_candidate_show_video_tips',
  'mellow_onboarding_candidate_celebration_tip_shown',
  'mellow_onboarding_candidate_add_video_modal_open',
  'mellow_onboarding_employer_just_completed',
  'mellow_onboarding_employer_celebration_tip_shown',
  'mellow_onboarding_employer_celebration_destination',
]

export function clearPersistedOnboardingState() {
  for (const key of ONBOARDING_PERSISTED_KEYS) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}
