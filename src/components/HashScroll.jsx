import { useEffect } from 'react'

// Jumps to the element named by the URL hash (e.g. #skills-section) — used
// by the candidate and employer profile-strength checklists' "Add a work
// video →" style links so they land directly on the relevant field instead
// of the top of the page. React Router doesn't scroll to hash fragments on
// its own.
//
// A single scrollIntoView() on mount isn't enough here: several sections
// fetch their own data after mount (work videos, skill suggestions, the
// intro video) and can resize once that resolves — sometimes more than
// once, as different pieces of async data settle at different times — which
// shifts the target from where it first landed. A ResizeObserver on the
// whole page catches any such shift, since it can come from any section,
// not just the one right above the target; each shift only *schedules* a
// correction rather than firing one immediately; so a burst of several
// resizes in quick succession collapses into one correction after they go
// quiet, instead of a pile of overlapping scrollIntoView() calls fighting
// each other (which was landing short, or even past, the target). Stops
// watching once the page has had time to settle.
export default function HashScroll() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    let target
    try {
      target = document.querySelector(hash)
    } catch {
      return
    }
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })

    let debounceTimer = null
    const scheduleResettle = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        target.scrollIntoView({ behavior: 'auto', block: 'start' })
      }, 200)
    }
    const observer = new ResizeObserver(scheduleResettle)
    observer.observe(document.body)
    // Async content settles well within this window in the normal case;
    // stops watching afterward so it doesn't keep fighting the user's own
    // scrolling once the page has had time to finish loading.
    const stopWatching = setTimeout(() => observer.disconnect(), 3000)

    return () => {
      observer.disconnect()
      clearTimeout(debounceTimer)
      clearTimeout(stopWatching)
    }
  }, [])

  return null
}
