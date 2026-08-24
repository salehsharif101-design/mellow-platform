// Vercel Cron target — see the "crons" entry in vercel.json (runs daily at
// 07:00 UTC — Vercel's Hobby plan caps crons at once per day, so this can't
// run hourly; the uncapped "onboarding_completed_at <= cutoff" query below
// means a daily check still catches everyone eventually, just with up to a
// day's extra delay past the 24h mark instead of within the hour).
// Nudges an employer to check out candidates' work videos 24 hours after
// they finish onboarding, once, and only if they haven't already started
// using the platform (shortlisted someone or sent a message) — in which
// case they clearly don't need the nudge. Same runtime shape as the other
// cron handlers (GET-only, no request body) since Vercel Cron issues a
// plain GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap } from '../_lib/db.js'

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
  // No upper bound on the window (just "completed at least 24h ago") so a
  // late or skipped cron run can't cause anyone to be missed entirely —
  // work_video_nudge_sent is what keeps this a one-time send.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    const employers = unwrap(
      await supabase
        .from('employer_profiles')
        .select('id, user_id, company_name')
        .eq('work_video_nudge_sent', false)
        .not('onboarding_completed_at', 'is', null)
        .lte('onboarding_completed_at', cutoff),
    )

    let sent = 0
    for (const employer of employers) {
      const [{ count: shortlistCount }, { count: messageCount }] = await Promise.all([
        supabase.from('shortlists').select('id', { count: 'exact', head: true }).eq('employer_id', employer.id),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', employer.user_id),
      ])

      // Already active on the platform — they clearly know how it works,
      // so leave work_video_nudge_sent false rather than mark this as
      // "sent" for an email that was never actually sent.
      if (shortlistCount > 0 || messageCount > 0) continue

      const employerUser = unwrap(await supabase.from('users').select('email').eq('id', employer.user_id).single())

      await sendEmail({
        to: employerUser.email,
        subject: 'Have you checked their work videos yet?',
        html: renderEmailHtml({
          heading: 'Go beyond the intro video',
          bodyText:
            'The best candidates on Mellow do not just tell you who they are — they show you how they actually think and work. Before you shortlist anyone, take a look at their work videos. It is the closest thing to seeing someone in action before the first conversation.',
          ctaLabel: 'Browse talent',
          ctaUrl: `${SITE_URL}/employer/talent`,
          illustration: 'Quality.PNG',
        }),
      })

      unwrap(await supabase.from('employer_profiles').update({ work_video_nudge_sent: true }).eq('id', employer.id))
      sent += 1
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, nudgesSent: sent }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
