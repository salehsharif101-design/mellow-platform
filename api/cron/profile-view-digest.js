// Vercel Cron target — see the "crons" entry in vercel.json (15:00 UTC daily,
// 18:00 Bahrain time). Batches the day's profile views into one digest email
// per candidate instead of the old per-view email. Same runtime shape as
// api/email.js (GET-only, no request body) since Vercel Cron issues a plain
// GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact } from '../_lib/db.js'

const BAHRAIN_OFFSET_MS = 3 * 60 * 60 * 1000

// A plain `.toDateString()` uses the SERVER's runtime timezone (Vercel
// functions run in UTC), not Bahrain's, despite this cron being explicitly
// scheduled and documented as an 18:00 Bahrain-time send — this makes the
// "already sent today" day boundary itself timezone-explicit too, so it
// doesn't depend on whatever timezone happens to be configured wherever
// this function actually runs.
function bahrainDateString(date) {
  return new Date(date.getTime() + BAHRAIN_OFFSET_MS).toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  // Vercel sends `Authorization: Bearer $CRON_SECRET` on cron-triggered
  // requests when CRON_SECRET is set on the project — keeps this endpoint
  // from being triggered by anyone who finds the URL. No-op if unset.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const today = bahrainDateString(new Date())

  try {
    const views = unwrap(
      await supabase.from('profile_views').select('candidate_id, viewer_id').gte('viewed_at', since),
    )

    // The same employer viewing a candidate more than once today should
    // still only count as one view in the digest.
    const viewersByCandidate = new Map()
    for (const v of views) {
      if (!v.viewer_id) continue
      if (!viewersByCandidate.has(v.candidate_id)) viewersByCandidate.set(v.candidate_id, new Set())
      viewersByCandidate.get(v.candidate_id).add(v.viewer_id)
    }

    // Real UTC instant at which "today" (Bahrain time) began — a timestamp
    // cutoff, not a derived string, so it can be used directly as an atomic
    // database-level guard below rather than a read-then-compare in JS.
    const todayStartBahrainIso = new Date(Date.parse(`${today}T00:00:00.000Z`) - BAHRAIN_OFFSET_MS).toISOString()

    let sent = 0
    for (const [candidateId, viewers] of viewersByCandidate) {
      // Claims today's digest atomically before sending — conditioned on
      // last_digest_sent_at not already falling within today (Bahrain
      // time), so two overlapping runs of this cron can't both pass the
      // guard and both send. The first claim's own write (last_digest_sent_at
      // = now) is what makes the second one's .lt(todayStartBahrainIso) stop
      // matching, rather than both reading the same stale value first.
      const { data: claimed } = await supabase
        .from('candidate_profiles')
        .update({ last_digest_sent_at: new Date().toISOString() })
        .eq('id', candidateId)
        .or(`last_digest_sent_at.is.null,last_digest_sent_at.lt.${todayStartBahrainIso}`)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

      const { email, username } = await getCandidateContact(supabase, candidateId)
      const count = viewers.size

      await sendEmail({
        to: email,
        subject: 'Your Mellow profile is getting noticed',
        html: renderEmailHtml({
          heading: 'People are looking',
          bodyText: `${count} employer${count === 1 ? '' : 's'} viewed your profile today. Keep your profile updated and make sure your intro video is looking its best.`,
          ctaLabel: 'View my profile',
          ctaUrl: `${SITE_URL}/profile/${username || candidateId}`,
          illustration: 'Easy_stuff.png',
        }),
      })

      sent += 1
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, digestsSent: sent }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
