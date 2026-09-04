import { useEffect } from 'react'

// Monotonically increasing token identifying whichever useSeoMeta instance
// most recently claimed the title/description — lets a cleanup tell
// whether it's still the current owner before restoring anything. Without
// this, a fast client-side navigation directly between two SEO-enabled
// pages could run the OLD page's unmount cleanup after the NEW page's own
// effect already set its title, stomping it back to the old page's stale
// value for a moment (or permanently, depending on exact timing).
let currentToken = 0

// Sets document.title and the meta description tag for the current page.
// No react-helmet in this project and no SSR — this is the plain client-side
// equivalent, good enough since modern crawlers execute JS. Restores the
// previous title/description on unmount so navigating away (client-side,
// no full reload) doesn't leave a stale SEO page's title on an unrelated
// page.
export function useSeoMeta({ title, description, canonicalUrl }) {
  useEffect(() => {
    const myToken = ++currentToken
    const previousTitle = document.title
    let descriptionTag = document.querySelector('meta[name="description"]')
    const hadDescriptionTag = Boolean(descriptionTag)
    const previousDescription = descriptionTag?.getAttribute('content') ?? null
    let canonicalTag = document.querySelector('link[rel="canonical"]')
    const hadCanonicalTag = Boolean(canonicalTag)
    const previousCanonical = canonicalTag?.getAttribute('href') ?? null

    if (title) document.title = title
    if (description) {
      if (!descriptionTag) {
        descriptionTag = document.createElement('meta')
        descriptionTag.setAttribute('name', 'description')
        document.head.appendChild(descriptionTag)
      }
      descriptionTag.setAttribute('content', description)
    }
    if (canonicalUrl) {
      if (!canonicalTag) {
        canonicalTag = document.createElement('link')
        canonicalTag.setAttribute('rel', 'canonical')
        document.head.appendChild(canonicalTag)
      }
      canonicalTag.setAttribute('href', canonicalUrl)
    }

    return () => {
      // A newer instance has already claimed ownership since this one
      // mounted — restoring now would stomp on ITS title/description, not
      // whatever was here before this one ever ran.
      if (currentToken !== myToken) return
      document.title = previousTitle
      if (descriptionTag) {
        if (hadDescriptionTag) descriptionTag.setAttribute('content', previousDescription || '')
        else descriptionTag.remove()
      }
      if (canonicalTag) {
        if (hadCanonicalTag) canonicalTag.setAttribute('href', previousCanonical || '')
        else canonicalTag.remove()
      }
    }
  }, [title, description, canonicalUrl])
}
