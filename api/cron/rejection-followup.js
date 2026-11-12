// Vercel Cron target — see the "crons" entry in vercel.json (runs hourly).
// One-time "Don't let rejection stop you" email to a candidate 24-72 hours
// after their FIRST rejection on Mellow. A rejection is an application whose
// status is 'rejected'; applications.status_changed_at (migration 0037) is
// when that happened. candidate_profiles.rejection_followup_sent (migration
// 0092) keeps it to one send per candidate, ever. Same runtime shape as the
// other cron handlers (GET-only, no request body) since Vercel Cron issues a
// plain GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact } from '../_lib/db.js'
import { escapeHtml } from '../_lib/html.js'
import { firstNameOf } from '../_lib/profileLinkEmails.js'

const HOUR_MS = 60 * 60 * 1000
const MIN_AGE_MS = 24 * HOUR_MS
const MAX_AGE_MS = 72 * HOUR_MS

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()
  const now = Date.now()
  const windowStart = new Date(now - MAX_AGE_MS).toISOString()
  const windowEnd = new Date(now - MIN_AGE_MS).toISOString()

  try {
    // Rejections that happened 24-72 hours ago.
    const recent = unwrap(
      await supabase
        .from('applications')
        .select('candidate_id')
        .eq('status', 'rejected')
        .gte('status_changed_at', windowStart)
        .lte('status_changed_at', windowEnd),
    )
    const candidateIds = [...new Set(recent.map((a) => a.candidate_id))]

    let sent = 0
    let failed = 0
    if (candidateIds.length > 0) {
      // Anyone with a rejection older than the window had their first
      // rejection earlier than this email covers, so they're left out —
      // this is for the first rejection only, not older ones.
      const older = unwrap(
        await supabase
          .from('applications')
          .select('candidate_id')
          .eq('status', 'rejected')
          .in('candidate_id', candidateIds)
          .lt('status_changed_at', windowStart),
      )
      const hadEarlier = new Set(older.map((a) => a.candidate_id))

      const candidates = unwrap(
        await supabase
          .from('candidate_profiles')
          .select('id')
          .in('id', candidateIds)
          .eq('rejection_followup_sent', false),
      )

      for (const candidate of candidates) {
        if (hadEarlier.has(candidate.id)) continue

        // Claims the send atomically before sending — conditioned on
        // rejection_followup_sent still being false, so two overlapping runs
        // can't both send it. Released again below if the send fails, so the
        // next hourly run retries while the candidate is still in the window.
        const { data: claimed } = await supabase
          .from('candidate_profiles')
          .update({ rejection_followup_sent: true })
          .eq('id', candidate.id)
          .eq('rejection_followup_sent', false)
          .select('id')
          .maybeSingle()
        if (!claimed) continue

        try {
          const { email, fullName } = await getCandidateContact(supabase, candidate.id)

          await sendEmail({
            to: email,
            subject: 'Don’t let rejection stop you',
            html: renderEmailHtml({
              heading: 'Keep going, the right role is out there',
              bodyText: `Hey ${escapeHtml(firstNameOf(fullName))},<br /><br />Getting a no is never easy, but it’s part of the journey. The good news is there are other great roles on Mellow that you might be a perfect fit for. We’re actively adding new companies and roles, so keep your profile active and keep applying. The right opportunity might be closer than you think.`,
              ctaLabel: 'Browse open roles',
              ctaUrl: `${SITE_URL}/jobs`,
              illustration: 'Quality.PNG',
            }),
          })
          sent += 1
        } catch {
          await supabase.from('candidate_profiles').update({ rejection_followup_sent: false }).eq('id', candidate.id)
          failed += 1
        }
      }
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, followupsSent: sent, failed }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
