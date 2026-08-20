import { useEffect, useRef } from 'react'

// Debounced draft autosave: calls `save()` a short while after any of
// `deps` change from the values they had on the very first render, and
// again immediately if the tab is hidden or the page is about to be left —
// so in-progress onboarding data survives a refresh, a tab switch, or the
// browser being closed entirely, instead of being lost until the user
// reaches the next explicit "Continue"/submit.
//
// Compares against a snapshot of the *initial* values (rather than just
// skipping "the first effect run") specifically because React StrictMode's
// dev-only mount→cleanup→mount double-invoke would otherwise still let a
// spurious save slip through on mount, firing with blank/loaded-but-
// unedited data before the user has typed anything.
export function useDraftAutosave(save, deps, { delay = 1200, enabled = true } = {}) {
  const saveRef = useRef(save)
  saveRef.current = save
  const initialSnapshotRef = useRef(null)
  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = JSON.stringify(deps)
  }
  const hasChanged = JSON.stringify(deps) !== initialSnapshotRef.current

  useEffect(() => {
    if (!enabled || !hasChanged) return undefined
    const timeout = setTimeout(() => saveRef.current(), delay)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasChanged, delay, ...deps])

  useEffect(() => {
    if (!enabled) return undefined
    function onVisibilityChange() {
      if (hasChanged && document.visibilityState === 'hidden') saveRef.current()
    }
    function onPageHide() {
      if (hasChanged) saveRef.current()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasChanged])
}
