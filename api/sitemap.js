// Vercel serverless function serving /sitemap.xml (see the rewrite in
// vercel.json — the static public/sitemap.xml this replaces has been
// removed so this route wins). Public, unauthenticated, read-only.
//
// Combines the fixed pages (the hand-built /hire/:location/:role
// combinations plus /hire, /jobs, /jobs/:location) with the dynamic
// /hire/:location/:role-type pages generated from whatever role titles
// employers are actually posting right now — a page only gets listed once
// 2+ active roles share that role-type slug in that location, matching the
// "no thin pages" gate the page itself enforces in
// src/pages/public/HireLocationRole.jsx.

import { createClient } from '@supabase/supabase-js'
import { getAllHirePages, JOBS_LOCATIONS } from '../src/lib/seoContent.js'
import { roleTitleToSlug } from '../src/lib/roleTypeSlug.js'

const SITE_URL = 'https://beta.joinmellow.xyz'
const MIN_ACTIVE_ROLES = 2

function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getDynamicHirePages(supabase) {
  const { data: roles, error } = await supabase.from('roles').select('title, location').eq('is_active', true)
  if (error) throw error

  const staticKeys = new Set(getAllHirePages().map(({ location, role }) => `${location}/${role}`))
  const counts = new Map() // "location/slug" -> count

  for (const role of roles || []) {
    const slug = roleTitleToSlug(role.title)
    if (!slug) continue
    for (const [locationKey, loc] of Object.entries(JOBS_LOCATIONS)) {
      const matches = loc.matchTerms.some((term) => (role.location || '').toLowerCase().includes(term))
      if (!matches) continue
      const key = `${locationKey}/${slug}`
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }

  const pages = []
  for (const [key, count] of counts) {
    if (count < MIN_ACTIVE_ROLES) continue
    if (staticKeys.has(key)) continue // already covered by a static page below
    pages.push(key)
  }
  return pages
}

function xmlEscape(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default async function handler(req, res) {
  try {
    const dynamicKeys = await getDynamicHirePages(getServiceClient())

    const staticHirePaths = getAllHirePages().map(({ location, role }) => `/hire/${location}/${role}`)
    const dynamicHirePaths = dynamicKeys.map((key) => `/hire/${key}`)

    const urls = [
      '/hire',
      ...staticHirePaths,
      ...dynamicHirePaths,
      '/jobs',
      ...Object.keys(JOBS_LOCATIONS).map((location) => `/jobs/${location}`),
    ]

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map((path) => `  <url><loc>${xmlEscape(SITE_URL + path)}</loc></url>`),
      '</urlset>',
      '',
    ].join('\n')

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    // Sitemaps don't need to be perfectly fresh — cache at the edge for an
    // hour so a burst of crawler hits doesn't hit the database every time.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600')
    res.statusCode = 200
    res.end(body)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message }))
  }
}
