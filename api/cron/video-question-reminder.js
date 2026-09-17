// Vercel Cron target — see the "crons" entry in vercel.json (runs hourly).
// Two jobs for the async video interviewing feature's 3-day answer window:
// send the single "1 day left" reminder to anyone who has just entered
// their last day and hasn't been reminded yet, then expire any pending
// question whose window has fully passed. Reminders run first each pass so
// a question that crosses the 72h mark in the same run it would have
// qualified for a reminder is never expired out from under a reminder that
// hasn't gone out yet.
//
// This needs to run more often than once a day. asked_at is an arbitrary
// timestamp, not aligned to the cron's own schedule — with a once-daily
// cron, a question asked just before the cron's fixed run time drifts: it
// first clears the 48h mark only a few minutes before the *next* day's run,
// which then finds it sitting at just under 72h elapsed and sends "1 day
// left" with actual minutes left, not a day. isPastDeadline() in
// src/lib/videoQuestions.js (used by the answer page itself, api/
// video-question.js) checks real elapsed time independent of this cron's
// own `status` column, so the page can already read as expired by the time
// the candidate opens that email. Running hourly caps that drift at under
// an hour, so a candidate who gets the reminder actually has close to a
// full day left, not whatever is left of it.
//
// Vercel Cron issues a plain GET, and only GET is accepted below —
// enforced, not just assumed.

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

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // Fails closed rather than silently skipping the check — a missing
  // CRON_SECRET in the deployment environment is a misconfiguration, not
  // a reason to let this endpoint (which expires and reminds real
  // candidates) run open to anyone who finds the URL.
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
  const now = Date.now()
  const reminderCutoffIso = new Date(now - REMINDER_AT_MS).toISOString() // 48h ago
  const expireCutoffIso = new Date(now - EXPIRE_AT_MS).toISOString() // 72h ago

  try {
    let remindersSent = 0
    let expired = 0

    // Phase 1 — reminders. asked_at strictly between 72h and 48h ago: past
    // the 48h mark (so there's a real "1 day left" to report) but not yet
    // past 72h (so it isn't about to be swept up by phase 2 below in this
    // same run).
    const dueForReminder = unwrap(
      await supabase
        .from('video_questions')
        .select('id, candidate_id, asked_at, answer_token, roles(title), employer_profiles(company_name)')
        .eq('status', 'pending')
        .eq('reminder_sent', false)
        .gte('asked_at', expireCutoffIso)
        .lt('asked_at', reminderCutoffIso),
    )

    for (const question of dueForReminder) {
      // Claims the reminder atomically before sending — conditioned on
      // reminder_sent still being false, so two overlapping runs of this
      // cron can't both send the same "1 day left" email.
      const { data: claimed } = await supabase
        .from('video_questions')
        .update({ reminder_sent: true })
        .eq('id', question.id)
        .eq('reminder_sent', false)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

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

      remindersSent += 1
    }

    // Phase 2 — expiry. asked_at more than 72h ago and still pending. Runs
    // after phase 1 so nothing here was still eligible for a reminder a
    // moment ago in this same pass.
    const dueForExpiry = unwrap(
      await supabase.from('video_questions').select('id').eq('status', 'pending').lt('asked_at', expireCutoffIso),
    )

    for (const question of dueForExpiry) {
      // Conditioned on status still being 'pending' — a candidate who
      // answers in the instant between this row being fetched above and
      // this update running should keep their real 'answered' status, not
      // get overwritten to 'expired' out from under them.
      const { data: updated } = await supabase
        .from('video_questions')
        .update({ status: 'expired', expired_at: new Date().toISOString() })
        .eq('id', question.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()
      if (updated) expired += 1
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, remindersSent, expired }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
