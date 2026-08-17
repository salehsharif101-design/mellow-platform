// Vercel Cron target — see the "crons" entry in vercel.json (06:00 UTC every
// Sunday, 09:00 Bahrain time). Sends both the talent "search summary" and
// the employer "hiring update" digest in one run, since they're on the same
// schedule and each is a cheap per-row loop — same runtime shape as
// api/cron/profile-view-digest.js (GET-only, no request body).

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact, getEmployerContact } from '../_lib/db.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
// A cron misfire (retried run, manual re-trigger) shouldn't double-send —
// guard against re-sending to anyone digested in the last 6 days rather than
// requiring an exact 7-day gap.
const DEDUP_GUARD_MS = 6 * 24 * 60 * 60 * 1000

// Same loose word-overlap match as src/lib/roleFormat.js's
// roleMatchesCandidate — duplicated here since api/ functions run as
// standalone serverless bundles and don't share code with src/.
function roleMatches(role, candidateSkills, candidateJobTitle) {
  const haystack = [role.title, role.typical_roles].filter(Boolean).join(' ').toLowerCase()
  if (!haystack) return false
  const needles = [...(candidateSkills || []), candidateJobTitle].filter(Boolean).map((s) => s.toLowerCase().trim())
  return needles.some((needle) => {
    if (needle.length < 3) return false
    if (haystack.includes(needle)) return true
    return needle.split(/\s+/).some((word) => word.length >= 3 && haystack.includes(word))
  })
}

async function sendTalentDigests(supabase, since) {
  const candidates = unwrap(
    await supabase.from('candidate_profiles').select('id, skills, job_title, last_weekly_digest_sent_at'),
  )
  if (candidates.length === 0) return 0

  const [{ data: recentViews }, { data: recentRoles }, { data: statusUpdates }] = await Promise.all([
    supabase.from('profile_views').select('candidate_id').gte('viewed_at', since),
    supabase.from('roles').select('id, title, employer_profiles(typical_roles)').eq('is_active', true).gte('created_at', since),
    supabase.from('applications').select('candidate_id').in('status', ['reviewing', 'shortlisted']).gte('status_changed_at', since),
  ])

  const viewCountByCandidate = new Map()
  for (const v of recentViews || []) viewCountByCandidate.set(v.candidate_id, (viewCountByCandidate.get(v.candidate_id) || 0) + 1)

  const updateCountByCandidate = new Map()
  for (const a of statusUpdates || []) updateCountByCandidate.set(a.candidate_id, (updateCountByCandidate.get(a.candidate_id) || 0) + 1)

  const roles = (recentRoles || []).map((r) => ({ title: r.title, typical_roles: r.employer_profiles?.typical_roles }))

  let sent = 0
  for (const candidate of candidates) {
    if (candidate.last_weekly_digest_sent_at && Date.now() - new Date(candidate.last_weekly_digest_sent_at).getTime() < DEDUP_GUARD_MS) {
      continue
    }

    const profileViews = viewCountByCandidate.get(candidate.id) || 0
    const statusUpdateCount = updateCountByCandidate.get(candidate.id) || 0
    const matchingRoles = roles.filter((r) => roleMatches(r, candidate.skills, candidate.job_title)).length

    if (profileViews === 0 && statusUpdateCount === 0 && matchingRoles === 0) continue

    const parts = []
    if (profileViews > 0) parts.push(`${profileViews} employer${profileViews === 1 ? '' : 's'} viewed your profile`)
    if (matchingRoles > 0) parts.push(`${matchingRoles} new role${matchingRoles === 1 ? '' : 's'} matched your skills`)
    if (statusUpdateCount > 0) parts.push(`${statusUpdateCount} application update${statusUpdateCount === 1 ? '' : 's'}`)
    const summary = parts.length > 0 ? `This week: ${parts.join(', ')}.` : ''

    const { email } = await getCandidateContact(supabase, candidate.id)

    await sendEmail({
      to: email,
      subject: 'Your Mellow week in review',
      html: renderEmailHtml({
        heading: 'Here is what happened this week',
        bodyText: `${summary} Keep your profile updated and your next opportunity could be one view away.`,
        ctaLabel: 'View my dashboard',
        ctaUrl: `${SITE_URL}/dashboard`,
        illustration: 'Collaborate2.png',
      }),
    })

    unwrap(
      await supabase
        .from('candidate_profiles')
        .update({ last_weekly_digest_sent_at: new Date().toISOString() })
        .eq('id', candidate.id),
    )
    sent += 1
  }
  return sent
}

async function sendEmployerDigests(supabase, since) {
  const employers = unwrap(
    await supabase.from('employer_profiles').select('id, user_id, last_weekly_digest_sent_at'),
  )
  if (employers.length === 0) return 0

  let sent = 0
  for (const employer of employers) {
    if (employer.last_weekly_digest_sent_at && Date.now() - new Date(employer.last_weekly_digest_sent_at).getTime() < DEDUP_GUARD_MS) {
      continue
    }

    const [{ count: newApplicants }, { count: messagesThisWeek }, { count: unreadMessages }, { count: companyViews }] = await Promise.all([
      supabase
        .from('applications')
        .select('id, roles!inner(employer_id)', { count: 'exact', head: true })
        .eq('roles.employer_id', employer.id)
        .gte('applied_at', since),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', employer.user_id)
        .gte('sent_at', since),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', employer.user_id)
        .is('read_at', null),
      supabase.from('company_views').select('id', { count: 'exact', head: true }).eq('employer_id', employer.id).gte('viewed_at', since),
    ])

    if ((newApplicants || 0) === 0 && (messagesThisWeek || 0) === 0 && (companyViews || 0) === 0) continue

    const parts = []
    if (newApplicants > 0) parts.push(`${newApplicants} new applicant${newApplicants === 1 ? '' : 's'} across all roles`)
    if (unreadMessages > 0) parts.push(`${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'}`)
    if (companyViews > 0) parts.push(`${companyViews} talent${companyViews === 1 ? '' : 's'} viewed your company profile`)
    const summary = parts.length > 0 ? `This week: ${parts.join(', ')}.` : ''

    const { email } = await getEmployerContact(supabase, employer.id)

    await sendEmail({
      to: email,
      subject: 'Your Mellow hiring update',
      html: renderEmailHtml({
        heading: 'Here is what happened this week',
        bodyText: `${summary} Log in to review your applicants and keep your pipeline moving.`,
        ctaLabel: 'View my dashboard',
        ctaUrl: `${SITE_URL}/employer/dashboard`,
        illustration: 'Collaborate2.png',
      }),
    })

    unwrap(
      await supabase
        .from('employer_profiles')
        .update({ last_weekly_digest_sent_at: new Date().toISOString() })
        .eq('id', employer.id),
    )
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
  const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

  try {
    const [talentSent, employerSent] = await Promise.all([
      sendTalentDigests(supabase, since),
      sendEmployerDigests(supabase, since),
    ])

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, talentDigestsSent: talentSent, employerDigestsSent: employerSent }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
