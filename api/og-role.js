// Serves an OG-tagged HTML shell for a single role page (/jobs/:slug) to
// link-preview crawlers only — see vercel.json and _lib/ogTemplate.js for
// why. Public, unauthenticated, read-only, mirrors RolePublic.jsx's own
// query (is_active + employer visibility) so a crawler never previews a
// role real visitors can't see.

import { createClient } from '@supabase/supabase-js'
import { renderOgHtml, truncate } from './_lib/ogTemplate.js'
import { SITE_URL } from './_lib/email-template.js'

const DEFAULT_IMAGE = `${SITE_URL}/mellow.white.logo.png`

function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  const slug = new URL(req.url, 'http://localhost').searchParams.get('slug')
  const url = `${SITE_URL}/jobs/${slug}`

  try {
    const supabase = getServiceClient()
    const { data: role } = await supabase
      .from('roles')
      .select('title, description, employer_profiles(company_name, logo_url, is_visible)')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (!role || role.employer_profiles?.is_visible === false) {
      res.statusCode = 404
      res.end(renderOgHtml({ title: 'Role not found — Mellow', description: 'This role is no longer available.', image: DEFAULT_IMAGE, url }))
      return
    }

    const companyName = role.employer_profiles?.company_name || 'Mellow'
    res.statusCode = 200
    res.end(
      renderOgHtml({
        title: `${role.title} at ${companyName}`,
        description: truncate(role.description, 200) || `${role.title} at ${companyName} — apply on Mellow.`,
        image: role.employer_profiles?.logo_url || DEFAULT_IMAGE,
        url,
      }),
    )
  } catch {
    res.statusCode = 200
    res.end(renderOgHtml({ title: 'Mellow', description: 'Mellow is a video-first hiring platform.', image: DEFAULT_IMAGE, url }))
  }
}
