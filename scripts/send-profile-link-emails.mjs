// Manual sender for the profile-link emails. Run from the project root:
//
//   node scripts/send-profile-link-emails.mjs preview --to someone@example.com
//       Sends BOTH emails to that address (who must be a candidate), using
//       their own profile link and a "preview copy" note, so nothing reaches
//       a real user.
//
//   node scripts/send-profile-link-emails.mjs blast
//       Dry run: prints how many existing candidates would receive the
//       one-time re-engagement email (live, visible, not hired), and sends
//       nothing.
//
//   node scripts/send-profile-link-emails.mjs blast --confirm
//       Actually sends it, once per eligible candidate who signed up more than
//       48 hours ago and hasn't had a profile-link email yet.
//
// Reads Supabase and Resend credentials from .env.local. Imports the app's
// modules dynamically after loading the env, because api/_lib/resend.js reads
// RESEND_FROM at import time.
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname })

const { getServiceClient, unwrap } = await import('../api/_lib/db.js')
const { sendEmail } = await import('../api/_lib/resend.js')
const { LIVE_EMAILS_FROM, isEligibleForLiveEmails, profileUrlFor, renderProfileLinkWelcome, renderProfileLinkReengagement } =
  await import('../api/_lib/profileLinkEmails.js')

const [mode, ...rest] = process.argv.slice(2)
const flag = (name) => rest.includes(name)
const valueOf = (name) => {
  const i = rest.indexOf(name)
  return i >= 0 ? rest[i + 1] : undefined
}

const supabase = getServiceClient()
const AUDIENCE_AGE_HOURS = 48
const cutoff = new Date(Date.now() - AUDIENCE_AGE_HOURS * 60 * 60 * 1000).toISOString()

// The one-time audience: candidates who are live right now, not hidden and not
// hired, signed up more than 48 hours ago, haven't had a profile-link email,
// and went live before the new hour-24/hour-48 sequence started (those
// candidates get the welcome version from the hourly cron instead).
//
// If migrations 0090/0091 aren't applied yet the tracking columns don't
// exist, so nobody has been emailed and nobody has a went_live_at; fall back
// to the other conditions alone (fine for counting and previewing, but
// `blast --confirm` refuses to send in that state).
async function loadAudience() {
  const base = 'id, user_id, username, full_name, is_live, is_open_to_opportunities, availability'
  let { data, error } = await supabase
    .from('candidate_profiles')
    .select(`${base}, went_live_at, profile_link_email_sent_at`)
    .eq('is_live', true)
    .lte('created_at', cutoff)
    .is('profile_link_email_sent_at', null)
  let trackingColumns = true
  if (error && /profile_link_email_sent_at|went_live_at/.test(error.message)) {
    trackingColumns = false
    ;({ data, error } = await supabase.from('candidate_profiles').select(base).eq('is_live', true).lte('created_at', cutoff))
  }
  const rows = unwrap({ data, error }).filter(
    (c) => isEligibleForLiveEmails(c) && (!c.went_live_at || c.went_live_at < LIVE_EMAILS_FROM),
  )
  return { rows, trackingColumn: trackingColumns }
}

if (mode === 'preview') {
  const to = valueOf('--to')
  if (!to) throw new Error('preview needs --to <email>')
  const user = unwrap(await supabase.from('users').select('id, user_type').eq('email', to).single())
  if (user.user_type !== 'candidate') throw new Error(`${to} is not a candidate account`)
  const candidate = unwrap(
    await supabase.from('candidate_profiles').select('id, username, full_name').eq('user_id', user.id).single(),
  )
  const { rows } = await loadAudience()
  const profileUrl = profileUrlFor(candidate)
  const note = (text) =>
    `<em style="color:#999999;font-size:13px;">PREVIEW COPY — ${text} Your own profile link is filled in below.</em>`

  const welcome = renderProfileLinkWelcome({
    fullName: candidate.full_name,
    profileUrl,
    previewNote: note('new candidates will receive this 48 hours after their profile goes live.'),
  })
  const reengagement = renderProfileLinkReengagement({
    fullName: candidate.full_name,
    profileUrl,
    previewNote: note(
      `this one-time email will go to ${rows.length} existing candidate${rows.length === 1 ? '' : 's'} (everyone with a live, visible, not-yet-hired profile who signed up more than ${AUDIENCE_AGE_HOURS} hours ago and hasn't received the welcome email).`,
    ),
  })
  await sendEmail({ to, subject: welcome.subject, html: welcome.html })
  await sendEmail({ to, subject: reengagement.subject, html: reengagement.html })
  console.log(`Sent 2 preview emails to ${to}. Link used: ${profileUrl}`)
  console.log(`One-time blast audience right now: ${rows.length}`)
} else if (mode === 'blast') {
  const { rows, trackingColumn } = await loadAudience()
  console.log(`Audience: ${rows.length} live, visible candidate(s) who signed up more than ${AUDIENCE_AGE_HOURS}h ago with no profile-link email yet.`)
  if (!flag('--confirm')) {
    console.log('Dry run — nothing sent. Re-run with --confirm to send.')
  } else {
    if (!trackingColumn) throw new Error('Apply migrations 0090 and 0091 first — without their tracking columns this could send twice.')
    let sent = 0
    let failed = 0
    for (const candidate of rows) {
      // Claim first (conditional update), so a second run or the hourly cron
      // can never send to the same candidate again.
      const { data: claimed } = await supabase
        .from('candidate_profiles')
        .update({ profile_link_email_sent_at: new Date().toISOString(), profile_link_email_kind: 'reengagement' })
        .eq('id', candidate.id)
        .is('profile_link_email_sent_at', null)
        .select('id')
        .maybeSingle()
      if (!claimed) continue
      try {
        const user = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())
        const { subject, html } = renderProfileLinkReengagement({
          fullName: candidate.full_name,
          profileUrl: profileUrlFor(candidate),
        })
        await sendEmail({ to: user.email, subject, html })
        sent += 1
      } catch (err) {
        failed += 1
        await supabase
          .from('candidate_profiles')
          .update({ profile_link_email_sent_at: null, profile_link_email_kind: null })
          .eq('id', candidate.id)
        console.error(`Failed for candidate ${candidate.id}: ${err.message}`)
      }
      // Stay under Resend's request rate limit.
      await new Promise((r) => setTimeout(r, 600))
    }
    console.log(`Done. Sent ${sent}, failed ${failed}.`)
  }
} else {
  console.log('Usage: preview --to <email> | blast [--confirm]')
}
