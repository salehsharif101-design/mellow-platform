// Serves an OG-tagged HTML shell for a candidate's public profile page
// (/profile/:username) to link-preview crawlers only — see vercel.json and
// _lib/ogTemplate.js for why. Public, unauthenticated, read-only. Mirrors
// PublicProfile.jsx's own lookup exactly (username first, falling back to
// the old uuid-based URL), including that it does not gate on is_live —
// PublicProfile.jsx itself doesn't either.

import { createClient } from '@supabase/supabase-js'
import { renderOgHtml, truncate } from './_lib/ogTemplate.js'
import { SITE_URL } from './_lib/email-template.js'

const DEFAULT_IMAGE = `${SITE_URL}/mellow.white.logo.png`
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  const username = new URL(req.url, 'http://localhost').searchParams.get('username')
  const url = `${SITE_URL}/profile/${username}`

  try {
    const supabase = getServiceClient()
    let { data: candidate } = await supabase
      .from('candidate_profiles')
      .select('full_name, headline, bio, avatar_url')
      .eq('username', username)
      .maybeSingle()

    if (!candidate && UUID_RE.test(username)) {
      ;({ data: candidate } = await supabase
        .from('candidate_profiles')
        .select('full_name, headline, bio, avatar_url')
        .eq('id', username)
        .maybeSingle())
    }

    if (!candidate) {
      res.statusCode = 404
      res.end(renderOgHtml({ title: 'Profile not found — Mellow', description: 'This profile is no longer available.', image: DEFAULT_IMAGE, url }))
      return
    }

    res.statusCode = 200
    res.end(
      renderOgHtml({
        title: candidate.full_name,
        description: truncate(candidate.headline || candidate.bio, 200) || `${candidate.full_name} on Mellow.`,
        image: candidate.avatar_url || DEFAULT_IMAGE,
        url,
      }),
    )
  } catch {
    res.statusCode = 200
    res.end(renderOgHtml({ title: 'Mellow', description: 'Mellow is a video-first hiring platform.', image: DEFAULT_IMAGE, url }))
  }
}
