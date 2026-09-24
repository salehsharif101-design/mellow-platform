// Vercel Cron target — see the "crons" entry in vercel.json (runs daily).
//
// A single friendly nudge for employers who signed up and started
// onboarding but never finished it: they have an employer_profiles row
// (created the first time they open /employer/onboarding), onboarding_
// completed_at is still null, and the row is more than 96h old.
// employer_nudge_sent (migration 0083) keeps it to once per employer.
//
// Doesn't overlap with the employer emails that already exist: the welcome
// email and work-video-nudge.js both only apply once onboarding_completed_at
// is set, which is exactly what this excludes.
//
// The query has no upper bound on row age, so a daily run still catches
// everyone eventually, just with up to a day's extra delay past the 96h mark.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap } from '../_lib/db.js'

const HOUR_MS = 60 * 60 * 1000
const MIN_ROW_AGE_MS = 96 * HOUR_MS

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // Fails closed — a missing CRON_SECRET is a misconfiguration, not a reason
  // to let this endpoint (which emails real employers) run open.
  if (!process.env.CRON_SECRET) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'CRON_SECRET is not configured on the server' }))
    return
  }
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()
  const cutoff = new Date(Date.now() - MIN_ROW_AGE_MS).toISOString()

  try {
    const employers = unwrap(
      await supabase
        .from('employer_profiles')
        .select('id, user_id')
        .is('onboarding_completed_at', null)
        .eq('employer_nudge_sent', false)
        .lte('created_at', cutoff),
    )

    let sent = 0
    for (const employer of employers) {
      // Claims the send atomically before sending, so two overlapping runs
      // can't both email the same employer. onboarding_completed_at is
      // re-checked too: someone who finishes between the fetch above and
      // this update shouldn't get a "finish your profile" email.
      const { data: claimed } = await supabase
        .from('employer_profiles')
        .update({ employer_nudge_sent: true })
        .eq('id', employer.id)
        .eq('employer_nudge_sent', false)
        .is('onboarding_completed_at', null)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

      const employerUser = unwrap(await supabase.from('users').select('email').eq('id', employer.user_id).single())

      await sendEmail({
        to: employerUser.email,
        subject: 'Your Mellow company profile is waiting for you',
        html: renderEmailHtml({
          heading: 'You are one step away',
          bodyText:
            'You started setting up your Mellow company profile but did not quite finish. Complete your profile and post your roles free — it takes less than 5 minutes. Talent across Bahrain and the GCC are waiting to hear from you.',
          ctaLabel: 'Complete my profile',
          ctaUrl: `${SITE_URL}/employer/onboarding`,
          illustration: 'Easy_stuff.png',
        }),
      })

      sent += 1
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, nudgesSent: sent }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
