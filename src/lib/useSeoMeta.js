import { useEffect } from 'react'

// Sets document.title and the meta description tag for the current page.
// No react-helmet in this project and no SSR — this is the plain client-side
// equivalent, good enough since modern crawlers execute JS. Restores the
// previous title/description on unmount so navigating away (client-side,
// no full reload) doesn't leave a stale SEO page's title on an unrelated
// page.
export function useSeoMeta({ title, description }) {
  useEffect(() => {
    const previousTitle = document.title
    let descriptionTag = document.querySelector('meta[name="description"]')
    const hadDescriptionTag = Boolean(descriptionTag)
    const previousDescription = descriptionTag?.getAttribute('content') ?? null

    if (title) document.title = title
    if (description) {
      if (!descriptionTag) {
        descriptionTag = document.createElement('meta')
        descriptionTag.setAttribute('name', 'description')
        document.head.appendChild(descriptionTag)
      }
      descriptionTag.setAttribute('content', description)
    }

    return () => {
      document.title = previousTitle
      if (descriptionTag) {
        if (hadDescriptionTag) descriptionTag.setAttribute('content', previousDescription || '')
        else descriptionTag.remove()
      }
    }
  }, [title, description])
}
