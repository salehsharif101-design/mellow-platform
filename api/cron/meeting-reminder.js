// Vercel Cron target — see the "crons" entry in vercel.json (runs hourly).
//
// Sends a one-hour-before reminder to both sides of every confirmed
// meeting (status set by api/calendly-webhook.js's invitee.created
// handler). reminder_sent keeps it to once per meeting — also cleared back
// to false if the meeting is later rescheduled, so a new reminder fires for
// the new time.
//
// Runs hourly rather than at a precise T-60min mark, so the window below is
// a full hour wide (now .. now+1h) — whichever run first sees a meeting
// land inside that window claims and sends it.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact, getEmployerContact, getEmployerEmails } from '../_lib/db.js'
import { escapeHtml } from '../_lib/html.js'

const HOUR_MS = 60 * 60 * 1000

function formatDateTime(iso, timezone) {
  const options = { dateStyle: 'full', timeStyle: 'short' }
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone || 'UTC' }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(new Date(iso))
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

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
  const now = new Date()
  const windowEnd = new Date(now.getTime() + HOUR_MS).toISOString()

  try {
    const meetings = unwrap(
      await supabase
        .from('meetings')
        .select('id, employer_id, candidate_id, start_time, timezone')
        .eq('status', 'confirmed')
        .eq('reminder_sent', false)
        .gt('start_time', now.toISOString())
        .lte('start_time', windowEnd),
    )

    let sent = 0
    for (const meeting of meetings) {
      // Claims the send atomically before sending, so two overlapping runs
      // can't both remind the same meeting.
      const { data: claimed } = await supabase
        .from('meetings')
        .update({ reminder_sent: true })
        .eq('id', meeting.id)
        .eq('reminder_sent', false)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

      const [candidate, employer, teamEmails] = await Promise.all([
        getCandidateContact(supabase, meeting.candidate_id),
        getEmployerContact(supabase, meeting.employer_id),
        getEmployerEmails(supabase, meeting.employer_id),
      ])
      const when = formatDateTime(meeting.start_time, meeting.timezone)
      const profileUrl = `${SITE_URL}/profile/${candidate.username || meeting.candidate_id}`

      await sendEmail({
        to: candidate.email,
        subject: 'Your meeting starts in an hour',
        html: renderEmailHtml({
          heading: 'Meeting starting soon',
          bodyText: `Your meeting with ${escapeHtml(employer.companyName)} starts at ${when}. Make sure you're ready to go.`,
          ctaLabel: 'View my applications',
          ctaUrl: `${SITE_URL}/applications`,
          illustration: 'Client_to_creative.png',
        }),
      })

      if (teamEmails.length > 0) {
        await sendEmail({
          to: teamEmails,
          subject: 'Your meeting starts in an hour',
          html: renderEmailHtml({
            heading: 'Meeting starting soon',
            bodyText: `Your meeting with ${escapeHtml(candidate.fullName)} starts at ${when}.`,
            ctaLabel: 'View applicant',
            ctaUrl: profileUrl,
            illustration: 'Client_to_creative.png',
          }),
        })
      }

      sent += 1
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, remindersSent: sent }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
