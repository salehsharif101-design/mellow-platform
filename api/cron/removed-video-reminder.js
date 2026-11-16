// Vercel Cron target — see the "crons" entry in vercel.json (runs hourly).
// One-time "Your application is no longer visible to employers" email to a
// candidate who has applied to at least one role but whose profile is no
// longer live (is_live = false) with no intro video. Employers can only read
// live candidate profiles (the "anyone can read live candidate profiles"
// policy in migration 0001), so an application from a candidate who removed
// their video drops out of the employer's pipeline.
// candidate_profiles.removed_video_reminder_sent (migration 0093) keeps it to
// one send per candidate, ever. Same runtime shape as the other cron handlers
// (GET-only, no request body) since Vercel Cron issues a plain GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact } from '../_lib/db.js'
import { escapeHtml } from '../_lib/html.js'
import { firstNameOf } from '../_lib/profileLinkEmails.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()

  try {
    // !inner makes this an "has at least one application" filter. A null or
    // empty-string intro_video_url both count as "no video".
    const candidates = unwrap(
      await supabase
        .from('candidate_profiles')
        .select('id, applications!inner(id)')
        .eq('is_live', false)
        .eq('removed_video_reminder_sent', false)
        .or('intro_video_url.is.null,intro_video_url.eq.'),
    )

    let sent = 0
    let failed = 0
    for (const candidate of candidates) {
      // Claims the send atomically before sending — conditioned on
      // removed_video_reminder_sent still being false, so two overlapping
      // runs can't both send it. Released again below if the send fails, so
      // the next hourly run retries.
      const { data: claimed } = await supabase
        .from('candidate_profiles')
        .update({ removed_video_reminder_sent: true })
        .eq('id', candidate.id)
        .eq('removed_video_reminder_sent', false)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

      try {
        const { email, fullName } = await getCandidateContact(supabase, candidate.id)

        await sendEmail({
          to: email,
          subject: 'Your application is no longer visible to employers',
          html: renderEmailHtml({
            heading: 'Employers can’t see your application',
            bodyText: `Hey ${escapeHtml(firstNameOf(fullName))},<br /><br />You’ve applied to a role on Mellow, but it looks like your profile video has been removed. Employers can only see applications with a video profile, so your application is currently hidden. Re-add your video to be considered for the role. If you’d prefer not to be discovered by other employers while you job search, you can hide your profile from your dashboard or profile settings.`,
            ctaLabel: 'Add your video',
            ctaUrl: `${SITE_URL}/profile`,
            illustration: 'Easy_stuff.png',
          }),
        })
        sent += 1
      } catch {
        await supabase.from('candidate_profiles').update({ removed_video_reminder_sent: false }).eq('id', candidate.id)
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
