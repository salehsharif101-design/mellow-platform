// Vercel Cron target — see the "crons" entry in vercel.json (runs daily).
// One-time "You're one step away from hiring on Mellow" email to an employer
// who signed up but never completed onboarding. The employer welcome email
// (api/email.js's sendEmployerWelcome) only fires when the onboarding form is
// submitted, so an employer who abandons it mid-way never gets it and nothing
// retries — welcome_email_sent stays false. employer_profiles.created_at
// (the row is created the first time they open /employer/onboarding) must be
// at least 24 hours ago, to give them time to finish on their own.
// onboarding_completed_at must still be null: an employer who DID finish but
// whose welcome email failed or predates the flag isn't "unfinished", and
// shouldn't be told to complete a profile they already have.
// employer_nudge_sent must be false too: api/cron/employer-onboarding-
// dropoff-nudge.js (the 96-hour version of the same message) sets it, and an
// employer it already emailed shouldn't get a second near-identical email.
// onboarding_reminder_sent (migration 0094) keeps it to one send per
// employer, ever. Same runtime shape as the other cron handlers (GET-only,
// no request body) since Vercel Cron issues a plain GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap } from '../_lib/db.js'
import { escapeHtml } from '../_lib/html.js'

const HOUR_MS = 60 * 60 * 1000
const MIN_ROW_AGE_MS = 24 * HOUR_MS

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
        .select('id, user_id, company_name')
        .eq('welcome_email_sent', false)
        .is('onboarding_completed_at', null)
        .eq('onboarding_reminder_sent', false)
        .eq('employer_nudge_sent', false)
        .lte('created_at', cutoff),
    )

    let sent = 0
    let failed = 0
    for (const employer of employers) {
      // Claims the send atomically before sending, so two overlapping runs
      // can't both email the same employer. welcome_email_sent and
      // onboarding_completed_at are re-checked too: someone who finishes
      // between the fetch above and this update shouldn't get a "finish your
      // profile" email. Released again below if the send fails.
      const { data: claimed } = await supabase
        .from('employer_profiles')
        .update({ onboarding_reminder_sent: true })
        .eq('id', employer.id)
        .eq('onboarding_reminder_sent', false)
        .eq('welcome_email_sent', false)
        .eq('employer_nudge_sent', false)
        .is('onboarding_completed_at', null)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

      try {
        const employerUser = unwrap(await supabase.from('users').select('email').eq('id', employer.user_id).single())
        // Employers have no personal name on file (signup only collects an
        // email), so this greets the company the way the employer welcome
        // email does, falling back to "there" before a name is saved.
        const name = String(employer.company_name || '').trim()

        await sendEmail({
          to: employerUser.email,
          subject: 'You’re one step away from hiring on Mellow',
          html: renderEmailHtml({
            heading: 'Complete your profile to start hiring',
            bodyText: `Hey ${name ? escapeHtml(name) : 'there'},<br /><br />You've created your Mellow account but haven't finished setting up your company profile yet. It only takes a few minutes. Once you're done, you'll be able to browse video profiles from candidates across Bahrain and the MENA region, send them questions and get video answers back, and start hiring faster.`,
            ctaLabel: 'Complete your profile',
            ctaUrl: `${SITE_URL}/employer/onboarding`,
            illustration: 'Easy_stuff.png',
          }),
        })
        sent += 1
      } catch {
        await supabase.from('employer_profiles').update({ onboarding_reminder_sent: false }).eq('id', employer.id)
        failed += 1
      }
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, remindersSent: sent, failed }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
