// Serves an OG-tagged HTML shell for a /hire/:location/:role SEO landing
// page to link-preview crawlers only — see vercel.json and
// _lib/ogTemplate.js for why. Mirrors HireLocationRole.jsx's own three
// cases exactly:
//  - a hand-built (location, role) combination in HIRE_LOCATION_ROLES —
//    static content, no query needed.
//  - a real location but a role-type slug with no hand-built page — only
//    gets its own title once 2+ active roles actually match it (same
//    MIN_ACTIVE_ROLES gate the page and api/sitemap.js both use), so a
//    crawler never previews a "page" for a role type with nothing behind
//    it.
//  - neither — same "page not found" shell as the other og-*.js endpoints.

import { createClient } from '@supabase/supabase-js'
import { renderOgHtml } from './_lib/ogTemplate.js'
import { SITE_URL } from './_lib/email-template.js'
import { getHirePage, JOBS_LOCATIONS } from '../src/lib/seoContent.js'
import { roleTitleToSlug, slugToLabel } from '../src/lib/roleTypeSlug.js'

const DEFAULT_IMAGE = `${SITE_URL}/mellow.white.logo.png`
const MIN_ACTIVE_ROLES = 2

function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  const params = new URL(req.url, 'http://localhost').searchParams
  const location = params.get('location')
  const role = params.get('role')
  const url = `${SITE_URL}/hire/${location}/${role}`

  const page = getHirePage(location, role)
  if (page) {
    const { loc, roleInfo } = page
    res.statusCode = 200
    res.end(
      renderOgHtml({
        title: `Hire ${roleInfo.plural} in ${loc.name} | Mellow`,
        description: `Hire ${roleInfo.plural.toLowerCase()} ${loc.locationLabel} on Mellow. Watch 60-second video profiles and skip the CV pile.`,
        image: DEFAULT_IMAGE,
        url,
      }),
    )
    return
  }

  const loc = JOBS_LOCATIONS[location]
  if (!loc) {
    res.statusCode = 404
    res.end(renderOgHtml({ title: 'Page not found — Mellow', description: 'This page is no longer available.', image: DEFAULT_IMAGE, url }))
    return
  }

  try {
    const supabase = getServiceClient()
    const orFilter = loc.matchTerms.map((term) => `location.ilike.%${term}%`).join(',')
    const { data } = await supabase.from('roles').select('title').eq('is_active', true).or(orFilter)
    const matchCount = (data || []).filter((r) => roleTitleToSlug(r.title) === role).length

    if (matchCount < MIN_ACTIVE_ROLES) {
      res.statusCode = 200
      res.end(renderOgHtml({ title: 'Hire on Mellow', description: 'Hire talent on Mellow — browse video profiles instead of screening CVs.', image: DEFAULT_IMAGE, url }))
      return
    }

    const dynamicLabel = slugToLabel(role)
    res.statusCode = 200
    res.end(
      renderOgHtml({
        title: `Hire ${dynamicLabel} ${loc.locationLabel} | Mellow`,
        description: `Hire ${dynamicLabel.toLowerCase()} ${loc.locationLabel} on Mellow. Watch 60-second video profiles and skip the CV pile.`,
        image: DEFAULT_IMAGE,
        url,
      }),
    )
  } catch {
    res.statusCode = 200
    res.end(renderOgHtml({ title: 'Mellow', description: 'Mellow is a video-first hiring platform.', image: DEFAULT_IMAGE, url }))
  }
}
