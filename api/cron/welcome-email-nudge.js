// Vercel Cron target — see the "crons" entry in vercel.json (runs daily;
// Vercel's Hobby plan caps crons at once per day, so this can't run
// hourly — the uncapped "created_at <= cutoff" query below means a daily
// check still catches everyone eventually, just with up to a day's extra
// delay past the 24h mark instead of within the hour, same tradeoff as
// this codebase's other daily crons).
//
// Scenario 2 of the candidate welcome email: a candidate who confirmed
// their email but never made it back to finish onboarding gets the same
// "Welcome to Mellow" email as a gentle nudge, once, 24h after they first
// showed up. A candidate_profiles row only ever exists once its owner has
// an authenticated session — see ProfileEdit.jsx's upsert — and for a
// normal signup that requires confirming their email first, so this row's
// created_at doubles as "confirmed their email at" without needing to
// touch auth.users directly. Scenario 1 (finishing onboarding and landing
// on /dashboard) is handled separately by the candidate-welcome case in
// api/email.js, which sends the identical content — keep the two in sync
// if either changes. welcome_email_sent is what keeps both triggers from
// ever double-sending the same candidate, and is_live = false is what
// keeps this one from firing for someone who already finished onboarding
// (and so already got the email from the other trigger, or is about to).
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
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    const candidates = unwrap(
      await supabase
        .from('candidate_profiles')
        .select('id, user_id')
        .eq('welcome_email_sent', false)
        .eq('is_live', false)
        // Excludes anyone already in video-reminder.js's own multi-step
        // sequence (set once a candidate uses "save for later" at the
        // video step) — without this, a candidate could get both this
        // cron's welcome nudge AND that cron's own reminder on the same
        // day, both saying some version of "come finish your profile."
        // video-reminder.js is the more specific nudge for that segment,
        // so this one is reserved for someone who never even reached that
        // step.
        .is('video_reminder_started_at', null)
        .lte('created_at', cutoff),
    )

    let sent = 0
    for (const candidate of candidates) {
      const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())

      await sendEmail({
        to: candidateUser.email,
        subject: 'Welcome to Mellow',
        html: renderEmailHtml({
          heading: 'Your living first impression starts here',
          bodyText:
            'You are one step away from showing employers exactly who you are. Complete your profile, upload your 60-second video, and let the right opportunities find you.',
          ctaLabel: 'Complete my profile',
          ctaUrl: `${SITE_URL}/dashboard`,
          illustration: 'Flexible.PNG',
        }),
      })

      unwrap(await supabase.from('candidate_profiles').update({ welcome_email_sent: true }).eq('id', candidate.id))
      sent += 1
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, welcomeEmailsSent: sent }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
