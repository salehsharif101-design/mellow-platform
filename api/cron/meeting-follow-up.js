// Vercel Cron target — see the "crons" entry in vercel.json (runs daily).
// Two related follow-ups between an employer and a candidate: the "how did
// it go?" email to the employer 7 days after they clicked "Book a
// meeting" on the candidate's public profile (src/pages/candidate/
// PublicProfile.jsx — there's no Calendly webhook telling us a meeting
// actually happened, so the click itself is the trigger), and a "keep
// going" nudge to the candidate 7 days after either side signals the hire
// isn't confirmed yet (employer says "still deciding", or the candidate
// says "not yet" to the hire-confirmation email). Same runtime shape as
// the other cron handlers (GET-only, no request body) since Vercel Cron
// issues a plain GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact, getEmployerContact } from '../_lib/db.js'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

async function sendMeetingFollowUps(supabase) {
  // scheduled_at is no longer an actual meeting time from Calendly — it's
  // stamped at click time as "now + 7 days" (src/pages/candidate/
  // PublicProfile.jsx's handleBookMeeting), so it already IS the send
  // time. No extra offset needed here, just "has that moment arrived yet".
  const now = new Date().toISOString()
  const meetings = unwrap(
    await supabase.from('meetings').select('id, employer_id, candidate_id').eq('follow_up_sent', false).lte('scheduled_at', now),
  )

  let sent = 0
  for (const meeting of meetings) {
    const [{ email: employerEmail }, { fullName: candidateName }] = await Promise.all([
      getEmployerContact(supabase, meeting.employer_id),
      getCandidateContact(supabase, meeting.candidate_id),
    ])

    await sendEmail({
      to: employerEmail,
      subject: `Your meeting with ${candidateName} — how did it go?`,
      html: renderEmailHtml({
        heading: 'Checking in',
        bodyText: `You recently connected with ${candidateName} through Mellow. Whether your meeting has already happened or is coming up soon, we wanted to check in. If you have already met — how did it go? Did you make a hire? If your meeting is still ahead — good luck. We hope it goes well.`,
        ctaLabel: 'We made a hire',
        ctaUrl: `${SITE_URL}/hire-confirmed?candidate=${meeting.candidate_id}&employer=${meeting.employer_id}`,
        secondaryCtaLabel: 'Still in progress',
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
