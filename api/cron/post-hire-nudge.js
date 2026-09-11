// Vercel Cron target — see the "crons" entry in vercel.json (runs daily).
// One-time "how's the new role going?" check-in to a candidate 10 days
// after they confirm a hire — hires.confirmed_at, set by
// api/meeting-outcome.js's 'hire_accepted' action, the only path that ever
// inserts a hires row (reached from the candidate clicking "Yes, I got the
// role" in the hire-confirmation email, HireAccepted.jsx). Same runtime
// shape as the other cron handlers (GET-only, no request body) since
// Vercel Cron issues a plain GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact } from '../_lib/db.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NUDGE_AFTER_MS = 10 * DAY_MS

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()
  // No upper bound on the window (just "confirmed at least 10 days ago")
  // so a late or skipped cron run can't cause anyone to be missed entirely
  // — post_hire_nudge_sent is what keeps this a one-time send.
  const cutoff = new Date(Date.now() - NUDGE_AFTER_MS).toISOString()

  try {
    const hires = unwrap(
      await supabase
        .from('hires')
        .select('id, candidate_id')
        .eq('post_hire_nudge_sent', false)
        .lte('confirmed_at', cutoff),
    )

    let sent = 0
    for (const hire of hires) {
      // Claims the send atomically before sending — conditioned on
      // post_hire_nudge_sent still being false, so two overlapping runs of
      // this cron can't both send the same nudge.
      const { data: claimed } = await supabase
        .from('hires')
        .update({ post_hire_nudge_sent: true })
        .eq('id', hire.id)
        .eq('post_hire_nudge_sent', false)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

      const { email } = await getCandidateContact(supabase, hire.candidate_id)

      await sendEmail({
        to: email,
        subject: 'Congratulations again on your new role',
        html: renderEmailHtml({
          heading: 'How is the new role going?',
          bodyText:
            'We hope you are settling in well. Your Mellow profile is currently set to hidden. If you are ever open to freelance work or future opportunities you can turn it back on anytime from your dashboard.',
          ctaLabel: 'Go to my dashboard',
          ctaUrl: `${SITE_URL}/dashboard`,
          illustration: 'Client_to_creative.png',
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
