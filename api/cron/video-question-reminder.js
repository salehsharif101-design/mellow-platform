// Vercel Cron target — see the "crons" entry in vercel.json (runs daily).
// Two jobs for the async video interviewing feature's 3-day answer window:
// expire any pending question whose window has fully passed, and send the
// single "1 day left" reminder to anyone entering their last day who
// hasn't been reminded yet. Same runtime shape as the other cron handlers
// (GET-only, no request body) since Vercel Cron issues a plain GET.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact } from '../_lib/db.js'
import { escapeHtml } from '../_lib/html.js'
import { ANSWER_WINDOW_DAYS } from '../../src/lib/videoQuestions.js'

const DAY_MS = 24 * 60 * 60 * 1000
// "Day 2" of a 3-day window — 24 hours before the deadline.
const REMINDER_AT_MS = (ANSWER_WINDOW_DAYS - 1) * DAY_MS
const EXPIRE_AT_MS = ANSWER_WINDOW_DAYS * DAY_MS

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()

  try {
    // Anything still pending and at least 2 days old is either due for its
    // reminder or already past the full 3-day window — everything younger
    // than that needs neither and is left out of the fetch entirely.
    const twoDaysAgoIso = new Date(Date.now() - REMINDER_AT_MS).toISOString()
    const pending = unwrap(
      await supabase
        .from('video_questions')
        .select('id, candidate_id, asked_at, reminder_sent, answer_token, roles(title), employer_profiles(company_name)')
        .eq('status', 'pending')
        .lt('asked_at', twoDaysAgoIso),
    )

    let expired = 0
    let remindersSent = 0

    for (const question of pending) {
      const elapsedMs = Date.now() - new Date(question.asked_at).getTime()

      if (elapsedMs >= EXPIRE_AT_MS) {
        // Conditioned on status still being 'pending' — a candidate who
        // answers in the instant between this row being fetched above and
        // this update running should keep their real 'answered' status,
        // not get overwritten to 'expired' out from under them.
        const { data: updated } = await supabase
          .from('video_questions')
          .update({ status: 'expired' })
          .eq('id', question.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()
        if (updated) expired += 1
        continue
      }

      if (!question.reminder_sent && elapsedMs >= REMINDER_AT_MS) {
        const { email } = await getCandidateContact(supabase, question.candidate_id)
        const companyName = question.employer_profiles?.company_name || 'A company'
        const roleTitle = question.roles?.title || 'a role'

        await sendEmail({
          to: email,
          subject: `You have 1 day left to answer ${companyName}'s question`,
          html: renderEmailHtml({
            heading: 'You have 1 day left to answer',
            bodyText: `You received a video question from ${escapeHtml(companyName)} about your application for ${escapeHtml(roleTitle)}. You have 1 day left to record your answer.`,
            ctaLabel: 'Answer now',
            ctaUrl: `${SITE_URL}/answer-question/${question.answer_token}`,
            illustration: 'Easy_stuff.png',
          }),
        })

        unwrap(
          await supabase.from('video_questions').update({ reminder_sent: true }).eq('id', question.id),
        )
        remindersSent += 1
      }
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, remindersSent, expired }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
