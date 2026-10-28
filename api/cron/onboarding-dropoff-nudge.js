// Vercel Cron target — see the "crons" entry in vercel.json (runs daily).
//
// A single friendly nudge for candidates who started onboarding but dropped
// off before finishing: they have a candidate_profiles row, aren't live,
// haven't reached the end of the wizard (onboarding_step < 6), and never
// used "save for later" at the video step (video_reminder_started_at is
// null — those candidates are already covered by video-reminder.js's own
// sequence). nudge_sent (migration 0082) keeps it to once per candidate.
//
// This is the second step after welcome-email-nudge.js, not a parallel
// send: it requires welcome_email_sent = true (that cron already emailed
// them) and a row at least 24h old. welcome-email-nudge.js also fires on
// the first daily run after 24h, so this can land on the same day as that
// one (that cron runs earlier in the day).
//
// The query has no upper bound on row age, so a daily run still catches
// everyone eventually, just with up to a day's extra delay past the 24h mark.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap } from '../_lib/db.js'

const HOUR_MS = 60 * 60 * 1000
const MIN_ROW_AGE_MS = 24 * HOUR_MS
const LAST_ONBOARDING_STEP = 5

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // Fails closed — a missing CRON_SECRET is a misconfiguration, not a reason
  // to let this endpoint (which emails real candidates) run open.
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
    const candidates = unwrap(
      await supabase
        .from('candidate_profiles')
        .select('id, user_id')
        .eq('is_live', false)
        .eq('nudge_sent', false)
        .eq('welcome_email_sent', true)
        .lte('onboarding_step', LAST_ONBOARDING_STEP)
        .is('video_reminder_started_at', null)
        .lte('created_at', cutoff),
    )

    let sent = 0
    for (const candidate of candidates) {
      // One candidate's failure (lookup or Resend) is logged and skipped so
      // the rest of the run still goes out. nudge_sent is only written after
      // the send succeeds, so a failed send is retried on the next run.
      try {
        const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())

        await sendEmail({
          to: candidateUser.email,
          subject: 'Still thinking about it? Your Mellow profile is ready when you are',
          html: renderEmailHtml({
            heading: 'You are almost there',
            bodyText:
              'You started setting up your Mellow profile but did not quite finish. It only takes a few more minutes and once your video is live employers across Bahrain and the GCC can start finding you.',
            ctaLabel: 'Complete my profile',
            ctaUrl: `${SITE_URL}/onboarding`,
            illustration: 'Easy_stuff.png',
          }),
        })

        unwrap(await supabase.from('candidate_profiles').update({ nudge_sent: true }).eq('id', candidate.id))

        sent += 1
      } catch (err) {
        console.error(`onboarding-dropoff-nudge: skipped candidate ${candidate.id}:`, err.message)
      }
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, nudgesSent: sent }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
