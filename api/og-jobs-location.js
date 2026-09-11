// Serves an OG-tagged HTML shell for a /jobs/:location SEO landing page
// (bahrain, uae, saudi-arabia) to link-preview crawlers only — see
// vercel.json and _lib/ogTemplate.js for why. Static content keyed off the
// same JOBS_LOCATIONS data JobsLocation.jsx itself renders from, no
// database lookup needed.

import { renderOgHtml } from './_lib/ogTemplate.js'
import { SITE_URL } from './_lib/email-template.js'
import { JOBS_LOCATIONS } from '../src/lib/seoContent.js'

const DEFAULT_IMAGE = `${SITE_URL}/mellow.white.logo.png`

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  const location = new URL(req.url, 'http://localhost').searchParams.get('location')
  const url = `${SITE_URL}/jobs/${location}`
  const loc = JOBS_LOCATIONS[location]

  if (!loc) {
    res.statusCode = 404
    res.end(renderOgHtml({ title: 'Page not found — Mellow', description: 'This page is no longer available.', image: DEFAULT_IMAGE, url }))
    return
  }

  res.statusCode = 200
  res.end(
    renderOgHtml({
      title: `Jobs in ${loc.name} | Mellow`,
      description: `Browse open roles in ${loc.name} on Mellow. Apply with a 60-second video instead of a CV, no cover letter, ever.`,
      image: DEFAULT_IMAGE,
      url,
    }),
  )
}
