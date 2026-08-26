// Vercel Cron target — see the "crons" entry in vercel.json (runs daily).
// Two related follow-ups after a Calendly meeting between an employer and
// a candidate: the "how did it go?" email to the employer 24h after the
// meeting's actual scheduled time, and a "keep going" nudge to the
// candidate 7 days after either side signals the hire isn't confirmed yet
// (employer says "still deciding", or the candidate says "not yet" to the
// hire-confirmation email). Same runtime shape as the other cron handlers
// (GET-only, no request body) since Vercel Cron issues a plain GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact, getEmployerContact } from '../_lib/db.js'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

async function sendMeetingFollowUps(supabase) {
  const cutoff = new Date(Date.now() - 24 * HOUR_MS).toISOString()
  const meetings = unwrap(
    await supabase.from('meetings').select('id, employer_id, candidate_id').eq('follow_up_sent', false).lte('scheduled_at', cutoff),
  )

  let sent = 0
  for (const meeting of meetings) {
    const [{ email: employerEmail }, { fullName: candidateName }] = await Promise.all([
      getEmployerContact(supabase, meeting.employer_id),
      getCandidateContact(supabase, meeting.candidate_id),
    ])

    await sendEmail({
      to: employerEmail,
      subject: `How did your meeting with ${candidateName} go?`,
      html: renderEmailHtml({
        heading: 'How did it go?',
        bodyText: `You recently connected with ${candidateName} through Mellow. We would love to know how it went. Did you make a hire?`,
        ctaLabel: 'Yes, we made a hire',
        ctaUrl: `${SITE_URL}/hire-confirmed?candidate=${meeting.candidate_id}&employer=${meeting.employer_id}`,
        secondaryCtaLabel: 'Still deciding',
        secondaryCtaUrl: `${SITE_URL}/still-deciding?candidate=${meeting.candidate_id}&employer=${meeting.employer_id}`,
        illustration: 'Collaborate2.png',
      }),
    })

    unwrap(await supabase.from('meetings').update({ follow_up_sent: true }).eq('id', meeting.id))
    sent += 1
  }
  return sent
}

async function sendTalentNudges(supabase) {
  const cutoff = new Date(Date.now() - 7 * DAY_MS).toISOString()
  const meetings = unwrap(
    await supabase
      .from('meetings')
      .select('id, employer_id, candidate_id')
      .eq('talent_nudge_sent', false)
      .not('outcome_recorded_at', 'is', null)
      .lte('outcome_recorded_at', cutoff),
  )

  let sent = 0
  for (const meeting of meetings) {
    // Guards against nudging a candidate who did end up getting hired by
    // this same employer through a later conversation after all.
    const { data: hire, error: hireErr } = await supabase
      .from('hires')
      .select('id')
      .eq('employer_id', meeting.employer_id)
      .eq('candidate_id', meeting.candidate_id)
      .maybeSingle()
    if (hireErr) throw new Error(hireErr.message)
    if (hire) {
      unwrap(await supabase.from('meetings').update({ talent_nudge_sent: true }).eq('id', meeting.id))
      continue
    }

    const { email } = await getCandidateContact(supabase, meeting.candidate_id)

    await sendEmail({
      to: email,
      subject: 'Keep going',
      html: renderEmailHtml({
        heading: 'Keep going',
        bodyText: 'Keep going. Your profile is live and employers are still finding you. Stay active and keep your profile updated.',
        ctaLabel: 'View my dashboard',
        ctaUrl: `${SITE_URL}/dashboard`,
        illustration: 'Easy_stuff.png',
      }),
    })

    unwrap(await supabase.from('meetings').update({ talent_nudge_sent: true }).eq('id', meeting.id))
    sent += 1
  }
  return sent
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()

  try {
    const [followUpsSent, nudgesSent] = await Promise.all([sendMeetingFollowUps(supabase), sendTalentNudges(supabase)])
    res.statusCode = 200
    res.end(JSON.stringify({ success: true, followUpsSent, nudgesSent }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
