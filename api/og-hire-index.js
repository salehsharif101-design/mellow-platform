// Serves an OG-tagged HTML shell for the /hire SEO landing page to
// link-preview crawlers only — see vercel.json and _lib/ogTemplate.js for
// why. Fully static (mirrors HireIndex.jsx's own useSeoMeta exactly), no
// database lookup needed.

import { renderOgHtml } from './_lib/ogTemplate.js'
import { SITE_URL } from './_lib/email-template.js'

const DEFAULT_IMAGE = `${SITE_URL}/mellow.white.logo.png`

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.statusCode = 200
  res.end(
    renderOgHtml({
      title: 'Hire Talent in Bahrain, the UAE and Saudi Arabia | Mellow',
      description:
        'Hire video editors, graphic designers, marketing managers, and more across Bahrain, the UAE, and Saudi Arabia, browse video profiles on Mellow instead of screening CVs.',
      image: DEFAULT_IMAGE,
      url: `${SITE_URL}/hire`,
    }),
  )
}
