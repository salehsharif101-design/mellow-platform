// Vercel Cron target — see the "crons" entry in vercel.json (runs hourly).
//
// The two emails that follow a candidate's live welcome, both timed from
// candidate_profiles.went_live_at (set by a trigger, migration 0091):
//   hour 24  "Your profile is more than an intro" (work videos)
//   hour 48  "Take Mellow with you — your profile link inside"
// (hour 0 is the live "Welcome to Mellow" in api/email.js).
//
// Eligibility, re-checked at send time: the profile is live right now, is not
// hidden (is_open_to_opportunities), and the candidate hasn't been hired —
// the profile link is only publicly viewable while the profile is live. Only
// candidates who went live on or after LIVE_EMAILS_FROM are included;
// everyone live before that is the one-time re-engagement audience
// (scripts/send-profile-link-emails.mjs). There is no upper bound on age, so
// a skipped or late run never leaves anyone missed. Each email has its own
// sent column, claimed with a conditional update before sending, so overlapping
// runs can't double-send. profile_link_email_sent_at is shared with the
// re-engagement send, so nobody can get both of those.
import { sendEmail } from '../_lib/resend.js'
import { getServiceClient, unwrap } from '../_lib/db.js'
import {
  LIVE_EMAILS_FROM,
  isEligibleForLiveEmails,
  profileUrlFor,
  renderProfileLinkWelcome,
  renderVideoLibraryEmail,
} from '../_lib/profileLinkEmails.js'

const HOUR_MS = 60 * 60 * 1000

const CANDIDATE_COLUMNS =
  'id, user_id, username, full_name, is_live, is_open_to_opportunities, availability'

// Finds candidates due for one of the emails, claims each, sends, and releases
// the claim if the send itself fails so the next run retries.
async function runPhase(supabase, { sentColumn, kindValue, afterHours, render }) {
  const cutoff = new Date(Date.now() - afterHours * HOUR_MS).toISOString()
  const due = unwrap(
    await supabase
      .from('candidate_profiles')
      .select(CANDIDATE_COLUMNS)
      .eq('is_live', true)
      .is(sentColumn, null)
      .gte('went_live_at', LIVE_EMAILS_FROM)
      .lte('went_live_at', cutoff),
  )

  let sent = 0
  let failed = 0
  for (const candidate of due) {
    if (!isEligibleForLiveEmails(candidate)) continue

    const claim = { [sentColumn]: new Date().toISOString(), ...(kindValue ? { profile_link_email_kind: kindValue } : {}) }
    const { data: claimed } = await supabase
      .from('candidate_profiles')
      .update(claim)
      .eq('id', candidate.id)
      .is(sentColumn, null)
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    try {
      const user = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())
      const { subject, html } = render(candidate)
      await sendEmail({ to: user.email, subject, html })
      sent += 1
    } catch (err) {
      failed += 1
      const release = { [sentColumn]: null, ...(kindValue ? { profile_link_email_kind: null } : {}) }
      await supabase.from('candidate_profiles').update(release).eq('id', candidate.id)
      console.error(`live-profile-emails (${sentColumn}) send failed:`, candidate.id, err.message)
    }
  }
  return { sent, failed }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  // Vercel sends `Authorization: Bearer $CRON_SECRET` on cron-triggered
  // requests when CRON_SECRET is set — keeps this from being triggered by
  // anyone who finds the URL. No-op if unset.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()

  try {
    const videoLibrary = await runPhase(supabase, {
      sentColumn: 'video_library_email_sent_at',
      afterHours: 24,
      render: () => renderVideoLibraryEmail(),
    })
    const profileLink = await runPhase(supabase, {
      sentColumn: 'profile_link_email_sent_at',
      kindValue: 'welcome',
      afterHours: 48,
      render: (candidate) =>
        renderProfileLinkWelcome({ fullName: candidate.full_name, profileUrl: profileUrlFor(candidate) }),
    })

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, videoLibrary, profileLink }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
