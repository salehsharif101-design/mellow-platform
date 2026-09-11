// Serves an OG-tagged HTML shell for the /jobs SEO landing page to
// link-preview crawlers only — see vercel.json and _lib/ogTemplate.js for
// why. Fully static (mirrors JobsIndex.jsx's own useSeoMeta exactly), no
// database lookup needed.

import { renderOgHtml } from './_lib/ogTemplate.js'
import { SITE_URL } from './_lib/email-template.js'

const DEFAULT_IMAGE = `${SITE_URL}/mellow.white.logo.png`

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.statusCode = 200
  res.end(
    renderOgHtml({
      title: 'Find Jobs in Bahrain, the UAE and Saudi Arabia | Mellow',
      description: 'Browse open roles across Bahrain, the UAE, and Saudi Arabia on Mellow, apply with a 60-second video instead of a CV.',
      image: DEFAULT_IMAGE,
      url: `${SITE_URL}/jobs`,
    }),
  )
}
