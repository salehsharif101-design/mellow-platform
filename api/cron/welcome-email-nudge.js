// Vercel Cron target — see the "crons" entry in vercel.json (runs daily). It is
// the daily fallback for the live-candidate welcome email: the primary triggers
// are the dashboard load (api/email.js's candidate-welcome case) and the
// hourly api/cron/live-profile-emails.js, and this catches anyone both missed.
//
// Only ever emails candidates whose profile is live: any live candidate who
// still has welcome_email_sent = false an hour after going live gets the
// email, sent through _lib/welcomeEmail.js's sendLiveWelcomeEmail (the same
// one the dashboard trigger and live-profile-emails.js use). Candidates who
// haven't finished onboarding get no "Welcome to Mellow" email; their nudge is
// onboarding-dropoff-nudge.js's "You are almost there".
import { getServiceClient, unwrap } from '../_lib/db.js'
import { sendLiveWelcomeEmail } from '../_lib/welcomeEmail.js'

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
  const liveCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  let liveWelcomeEmailsSent = 0
  try {
    const liveCandidates = unwrap(
      await supabase
        .from('candidate_profiles')
        .select('id, user_id, full_name')
        .eq('is_live', true)
        .eq('welcome_email_sent', false)
        .lte('went_live_at', liveCutoff),
    )

    for (const candidate of liveCandidates) {
      // Claims the send atomically before sending, so overlapping runs (or the
      // dashboard trigger and the hourly cron) can't both email the same
      // candidate, and releases the claim again if the send fails so the
      // candidate is retried on the next run instead of being marked as
      // welcomed without ever getting the email. One candidate's failure is
      // logged and skipped rather than stopping the rest.
      const { data: claimed } = await supabase
        .from('candidate_profiles')
        .update({ welcome_email_sent: true })
        .eq('id', candidate.id)
        .eq('welcome_email_sent', false)
        .eq('is_live', true)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

      try {
        const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())

        await sendLiveWelcomeEmail(candidateUser.email, candidate.full_name)

        liveWelcomeEmailsSent += 1
      } catch (err) {
        console.error(`welcome-email-nudge: live welcome failed for candidate ${candidate.id}:`, err.message)
        await supabase.from('candidate_profiles').update({ welcome_email_sent: false }).eq('id', candidate.id)
      }
    }
  } catch (err) {
    console.error('welcome-email-nudge: live welcome pass failed:', err.message)
  }

  res.statusCode = 200
  res.end(JSON.stringify({ success: true, liveWelcomeEmailsSent }))
}
