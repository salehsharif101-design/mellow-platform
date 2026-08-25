// Vercel Cron target — see the "crons" entry in vercel.json (runs daily).
// Three-email reminder sequence for candidates who saved their profile at
// the video step without uploading one (src/pages/candidate/ProfileEdit.jsx's
// "Save my profile and come back later" link) and still haven't gone live.
// Same runtime shape as the other cron handlers (GET-only, no request body)
// since Vercel Cron issues a plain GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact } from '../_lib/db.js'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Indexed by the candidate's current video_reminder_sent_count — each entry
// is the delay (from video_reminder_started_at) at which that next email
// goes out, and the email itself. Sending stays strictly in order: a
// candidate only ever gets email N once they've already received N-1.
const REMINDERS = [
  {
    delayMs: 24 * HOUR_MS,
    subject: 'Your Mellow profile is one video away',
    heading: 'You are 90% there',
    bodyText: 'You are 90% there. Record a quick 60-second video and your profile goes live immediately. Employers are already browsing.',
    ctaLabel: 'Add my video',
    illustration: 'Floating%20girl.PNG',
  },
  {
    delayMs: 3 * DAY_MS,
    subject: 'Employers are looking, is your profile ready?',
    heading: 'Employers are looking, is your profile ready?',
    bodyText: 'Your profile is saved but not yet visible to employers. It only takes 60 seconds to go live.',
    ctaLabel: 'Complete my profile',
    illustration: 'Easy_stuff.png',
  },
  {
    delayMs: 7 * DAY_MS,
    subject: 'Your Mellow profile is waiting for you',
    heading: 'Your Mellow profile is waiting for you',
    bodyText: 'You set up your profile on Mellow but never went live. Roles are being posted and employers are actively looking for talent. Do not miss out.',
    ctaLabel: 'Go live now',
    illustration: 'thinking2.png',
  },
]

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()

  try {
    const candidates = unwrap(
      await supabase
        .from('candidate_profiles')
        .select('id, video_reminder_started_at, video_reminder_sent_count')
        .eq('is_live', false)
        .not('video_reminder_started_at', 'is', null)
        .lt('video_reminder_sent_count', REMINDERS.length),
    )

    let sent = 0
    for (const candidate of candidates) {
      const reminder = REMINDERS[candidate.video_reminder_sent_count]
      const elapsedMs = Date.now() - new Date(candidate.video_reminder_started_at).getTime()
      if (elapsedMs < reminder.delayMs) continue

      const { email } = await getCandidateContact(supabase, candidate.id)

      await sendEmail({
        to: email,
        subject: reminder.subject,
        html: renderEmailHtml({
          heading: reminder.heading,
          bodyText: reminder.bodyText,
          ctaLabel: reminder.ctaLabel,
          ctaUrl: `${SITE_URL}/profile/edit`,
          illustration: reminder.illustration,
        }),
      })

      unwrap(
        await supabase
          .from('candidate_profiles')
          .update({ video_reminder_sent_count: candidate.video_reminder_sent_count + 1 })
          .eq('id', candidate.id),
      )
      sent += 1
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, remindersSent: sent }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
