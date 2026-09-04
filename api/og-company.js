// Serves an OG-tagged HTML shell for a company profile page
// (/company/:slug) to link-preview crawlers only — see vercel.json and
// _lib/ogTemplate.js for why. Public, unauthenticated, read-only.

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
  const url = `${SITE_URL}/company/${slug}`

  try {
    const supabase = getServiceClient()
    const { data: company } = await supabase
      .from('employer_profiles')
      .select('company_name, headline, about, logo_url, is_visible')
      .eq('company_slug', slug)
      .maybeSingle()

    if (!company || !company.is_visible) {
      res.statusCode = 404
      res.end(renderOgHtml({ title: 'Company not found — Mellow', description: 'This company profile is no longer available.', image: DEFAULT_IMAGE, url }))
      return
    }

    res.statusCode = 200
    res.end(
      renderOgHtml({
        title: company.company_name,
        description: truncate(company.headline || company.about, 200) || `${company.company_name} on Mellow.`,
        image: company.logo_url || DEFAULT_IMAGE,
        url,
      }),
    )
  } catch {
    res.statusCode = 200
    res.end(renderOgHtml({ title: 'Mellow', description: 'Mellow is a video-first hiring platform.', image: DEFAULT_IMAGE, url }))
  }
}
