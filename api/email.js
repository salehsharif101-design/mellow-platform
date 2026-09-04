// Vercel serverless function. Sends transactional emails via Resend.
// Runs server-side only — RESEND_API_KEY and the Supabase service role key
// never reach the browser. Callers pass only IDs; this function looks up the
// authoritative data itself via the service role client rather than trusting
// client-supplied email content.
//
// Requires a valid Supabase session bearer token (same pattern as
// api/team-remove.js and the accept branch of api/team-invite.js) — this
// only proves the request came from some signed-in Mellow user, not that
// they're specifically entitled to trigger the requested action, but it
// closes the endpoint off from the open internet, which is all every other
// call site (all of them fired right after that same user's own write
// succeeds) needs.

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from './_lib/resend.js'
import { renderEmailHtml, SITE_URL } from './_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact } from './_lib/db.js'
import { escapeHtml } from './_lib/html.js'

// Server-side equivalent of src/lib/employerAccess.js's getEmployerUserIds
// — that file can't be imported here since it pulls in the browser
// Supabase client, which reads Vite-only env vars unavailable in this
// runtime. Every employer-facing email used to resolve its recipient via
// employer_profiles.user_id alone (the owner), even though the in-app
// experience treats the whole team as equal — a team member who posts a
// role, or is the one actually managing applicants, got none of the
// emails about it.
async function getEmployerEmails(supabase, employerId) {
  const [ownerResult, membersResult] = await Promise.all([
    supabase.from('employer_profiles').select('user_id').eq('id', employerId).maybeSingle(),
    supabase.from('employer_team_members').select('user_id').eq('employer_id', employerId).eq('status', 'active'),
  ])
  const userIds = []
  if (ownerResult.data?.user_id) userIds.push(ownerResult.data.user_id)
  ;(membersResult.data || []).forEach((m) => {
    if (m.user_id) userIds.push(m.user_id)
  })
  if (userIds.length === 0) return []
  const { data: users } = await supabase.from('users').select('email').in('id', userIds)
  return (users || []).map((u) => u.email).filter(Boolean)
}

function getAnonClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

// Fires the candidate "Welcome to Mellow" email exactly once. Two triggers
// call this, both re-verifying eligibility here rather than trusting the
// caller: Dashboard.jsx's candidate-welcome notify(), fired the first time
// a candidate with a fully live profile lands on their dashboard (see
// scenario 1), and api/cron/welcome-email-nudge.js, a daily nudge for
// anyone who confirmed their email but never made it back to finish
// onboarding (scenario 2) — that one calls sendEmail directly with the
// same content rather than importing this, matching how this codebase's
// other cron jobs are self-contained (see work-video-nudge.js). Someone
// who never confirms their email never gets a candidate_profiles row in
// the first place (see ProfileEdit.jsx's upsert, which only ever runs once
// an authenticated session exists), so scenario 3 — never sending to them —
// falls out naturally rather than needing an explicit check here.
async function sendCandidateWelcome(supabase, candidateId) {
  const candidate = unwrap(
    await supabase
      .from('candidate_profiles')
      .select('id, user_id, is_live, welcome_email_sent')
      .eq('id', candidateId)
      .single(),
  )
  if (candidate.welcome_email_sent || !candidate.is_live) return { skipped: true }

  // Claims the send atomically before actually sending, rather than just
  // checking here and writing welcome_email_sent at the end — two
  // concurrent triggers (two open dashboard tabs, or this and a 30s poll
  // landing right before the other's write completes) would otherwise both
  // read false above and both send. The extra .eq('welcome_email_sent',
  // false) makes this a conditional update: only the request whose write
  // actually matches a row (still false at that instant) wins the race.
  const { data: claimed } = await supabase
    .from('candidate_profiles')
    .update({ welcome_email_sent: true })
    .eq('id', candidate.id)
    .eq('welcome_email_sent', false)
    .select('id')
    .maybeSingle()
  if (!claimed) return { skipped: true }

  const user = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())

  // This function only ever fires once is_live is already true (the check
  // above), unlike welcome-email-nudge.js's own copy of this email (a
  // near-identical string, deliberately NOT shared with this function —
  // see the comment above it) for candidates who haven't finished
  // onboarding yet. Telling an already-live candidate to "complete your
  // profile, upload your video" describes the one thing they just did.
  await sendEmail({
    to: user.email,
    subject: 'Welcome to Mellow',
    html: renderEmailHtml({
      heading: 'Your living first impression starts here',
      bodyText:
        'Your profile is live and visible to employers. Keep it fresh, add a work video or two, and let the right opportunities find you.',
      ctaLabel: 'Go to my dashboard',
      ctaUrl: `${SITE_URL}/dashboard`,
      illustration: 'Flexible.PNG',
    }),
  })

  return { sent: true }
}

async function sendEmployerWelcome(supabase, userId) {
  const user = unwrap(await supabase.from('users').select('email').eq('id', userId).single())

  return sendEmail({
    to: user.email,
    subject: 'Welcome to Mellow',
    html: renderEmailHtml({
      heading: 'Start meeting people, not documents',
      bodyText:
        'Browse real talent, post your first role, and find the right person without reading a single CV. Your talent feed is ready and waiting.',
      ctaLabel: 'Browse the talent feed',
      ctaUrl: `${SITE_URL}/employer/talent`,
      illustration: 'Client_to_creative.png',
    }),
  })
}

async function sendFirstRoleVideoNudge(supabase, employerId) {
  // Re-checked here (not trusted from the client) so this only fires once,
  // exactly on the role that brings the employer's total from 0 to 1 —
  // matches the dedup pattern sendProfileViewNotification uses below.
  const roles = unwrap(await supabase.from('roles').select('id').eq('employer_id', employerId))
  if (roles.length !== 1) return { skipped: true }

  const employer = unwrap(
    await supabase.from('employer_profiles').select('user_id, video_nudge_sent').eq('id', employerId).single(),
  )
  // Belt and suspenders on top of the role-count check: guarantees a single
  // send per employer even across delete-and-repost cycles, which could
  // otherwise bring the count back to 1 a second time.
  if (employer.video_nudge_sent) return { skipped: true }

  const emails = await getEmployerEmails(supabase, employerId)
  if (emails.length === 0) return { skipped: true }

  const result = await sendEmail({
    to: emails,
    subject: 'Your role is live, now make it stand out',
    html: renderEmailHtml({
      heading: 'Your role is live',
      bodyText:
        'Employers who add a company video get more applications. Talent wants to know who they will be working with before they apply, a 60-second video gives them exactly that. It takes two minutes to record and makes your role stand out from every other posting.',
      ctaLabel: 'Add your company video',
      ctaUrl: `${SITE_URL}/employer/profile/edit`,
      illustration: 'Client_to_creative.png',
    }),
  })

  unwrap(await supabase.from('employer_profiles').update({ video_nudge_sent: true }).eq('id', employerId))

  return result
}

async function sendRoleLiveNotification(supabase, roleId) {
  const role = unwrap(
    await supabase.from('roles').select('title, slug, employer_id').eq('id', roleId).single(),
  )
  const emails = await getEmployerEmails(supabase, role.employer_id)
  if (emails.length === 0) return { skipped: true }

  return sendEmail({
    to: emails,
    subject: 'Your role is live on Mellow',
    html: renderEmailHtml({
      heading: 'Your role is live',
      bodyText: `Your ${escapeHtml(role.title)} role has been posted successfully. Talent can now discover and apply to it on Mellow. Share it widely to get the best applications.`,
      ctaLabel: 'View your role',
      ctaUrl: `${SITE_URL}/jobs/${role.slug}`,
      illustration: 'Collaborate2.png',
    }),
  })
}

async function sendMessageNotification(supabase, messageId) {
  const message = unwrap(
    await supabase.from('messages').select('recipient_id').eq('id', messageId).single(),
  )
  const recipient = unwrap(
    await supabase.from('users').select('email, user_type').eq('id', message.recipient_id).single(),
  )

  return sendEmail({
    to: recipient.email,
    subject: 'You have a new message on Mellow',
    html: renderEmailHtml({
      heading: 'You have a new message',
      bodyText: 'You have a new message on Mellow — log in to reply.',
      ctaLabel: 'Reply now',
      ctaUrl: `${SITE_URL}${recipient.user_type === 'employer' ? '/employer/messages' : '/messages'}`,
      illustration: 'connection.png',
    }),
  })
}

async function sendApplicationNotification(supabase, applicationId) {
  const application = unwrap(
    await supabase.from('applications').select('candidate_id, role_id').eq('id', applicationId).single(),
  )
  const candidate = unwrap(
    await supabase.from('candidate_profiles').select('full_name, username').eq('id', application.candidate_id).single(),
  )
  const role = unwrap(
    await supabase
      .from('roles')
      .select('title, employer_id')
      .eq('id', application.role_id)
      .single(),
  )
  const emails = await getEmployerEmails(supabase, role.employer_id)
  if (emails.length === 0) return { skipped: true }

  return sendEmail({
    to: emails,
    subject: 'New application on Mellow',
    html: renderEmailHtml({
      heading: 'New application received',
      bodyText: `${escapeHtml(candidate.full_name)} applied to ${escapeHtml(role.title)}. View their profile to learn more.`,
      ctaLabel: 'View profile',
      ctaUrl: `${SITE_URL}/profile/${candidate.username || application.candidate_id}`,
      illustration: 'Flexible.PNG',
    }),
  })
}

async function sendShortlistNotification(supabase, shortlistId) {
  const shortlist = unwrap(
    await supabase.from('shortlists').select('candidate_id').eq('id', shortlistId).single(),
  )
  const candidate = unwrap(
    await supabase
      .from('candidate_profiles')
      .select('user_id, username, calendly_url')
      .eq('id', shortlist.candidate_id)
      .single(),
  )
  const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())

  // Nudges the candidate to add a Calendly link, but only if they don't
  // already have one — an employer who just shortlisted them may want to
  // book time directly, and this is the moment that's most likely to land.
  const calendlyNudge = candidate.calendly_url
    ? ''
    : '<br><br>Make it easy for employers to reach you. Add your Calendly link to your profile so they can book a meeting with you directly.<br><br>' +
      `<a href="${SITE_URL}/profile/edit" style="color:#005ef5;font-weight:700;text-decoration:none;">Add your Calendly link</a>`

  return sendEmail({
    to: candidateUser.email,
    subject: 'You were shortlisted on Mellow',
    html: renderEmailHtml({
      heading: "You've been shortlisted",
      bodyText: `An employer shortlisted your Mellow profile. Keep it up to date — they may reach out soon.${calendlyNudge}`,
      ctaLabel: 'View my profile',
      ctaUrl: `${SITE_URL}/profile/${candidate.username || shortlist.candidate_id}`,
      illustration: 'Your_Requested_Is_Posted.png',
    }),
  })
}

async function sendRejectionNotification(supabase, applicationId) {
  const application = unwrap(
    await supabase.from('applications').select('candidate_id, role_id').eq('id', applicationId).single(),
  )
  const role = unwrap(
    await supabase
      .from('roles')
      .select('title, employer_profiles(company_name)')
      .eq('id', application.role_id)
      .single(),
  )
  const { email } = await getCandidateContact(supabase, application.candidate_id)
  const companyName = role.employer_profiles?.company_name || 'the company'

  return sendEmail({
    to: email,
    subject: `Update on your application to ${companyName}`,
    html: renderEmailHtml({
      heading: 'Thank you for applying',
      bodyText: `Thank you for applying to ${escapeHtml(role.title)} at ${escapeHtml(companyName)}. After careful consideration we have decided to move forward with other talent at this time. We appreciate your interest and wish you all the best in your search.`,
      illustration: 'Flexible.PNG',
    }),
  })
}

async function sendLiveNotification(supabase, candidateId) {
  const { email, username } = await getCandidateContact(supabase, candidateId)

  return sendEmail({
    to: email,
    subject: 'Your Mellow profile is live',
    html: renderEmailHtml({
      heading: 'Your profile is live',
      bodyText: 'Your Mellow profile is now live and visible to employers. Share it, or sit back while opportunities find you.',
      ctaLabel: 'View my profile',
      ctaUrl: `${SITE_URL}/profile/${username || candidateId}`,
      illustration: 'Collaborate2.png',
    }),
  })
}

async function sendTeamInvite(supabase, teamMemberId) {
  const teamMember = unwrap(
    await supabase
      .from('employer_team_members')
      .select('invited_email, invite_token, invited_by, employer_profiles(company_name)')
      .eq('id', teamMemberId)
      .single(),
  )
  const inviter = unwrap(await supabase.from('users').select('email').eq('id', teamMember.invited_by).single())
  const companyName = teamMember.employer_profiles?.company_name || 'their company'

  return sendEmail({
    to: teamMember.invited_email,
    subject: `You've been invited to join ${companyName} on Mellow`,
    html: renderEmailHtml({
      heading: `Join ${escapeHtml(companyName)} on Mellow`,
      bodyText: `${escapeHtml(inviter.email)} has invited you to join ${escapeHtml(companyName)}'s team on Mellow. Accept the invitation to help manage applications, message candidates, and post roles.`,
      ctaLabel: 'Accept invitation',
      ctaUrl: `${SITE_URL}/employer/team/accept?token=${teamMember.invite_token}`,
      illustration: 'Collaborate2.png',
    }),
  })
}

async function sendVideoLibraryNotification(supabase, candidateId) {
  const { email } = await getCandidateContact(supabase, candidateId)

  return sendEmail({
    to: email,
    subject: 'Your profile is more than an intro',
    html: renderEmailHtml({
      heading: 'Show employers how you actually work',
      bodyText:
        'Your Mellow profile starts with your 60-second intro video. But top talent goes further. The work video library lets you upload additional videos that show employers exactly how you think and what you are capable of, before the first interview.<br><br>' +
        'Here are a few ideas to get you started:<br><br>' +
        '🎨 Designer? Walk through a recent project, the brief, your thinking, the final result.<br><br>' +
        '💻 Developer? Screen record yourself solving a problem or building a feature and talk through your decisions.<br><br>' +
        '📊 Marketer? Break down a campaign you ran, the strategy, the execution, the results.<br><br>' +
        '🎙️ Presenter or communicator? Record yourself pitching an idea or explaining a complex topic simply.<br><br>' +
        'Each video can be 60 seconds or longer. Label it clearly so employers know what they are looking at. The more you show, the more they know.',
      ctaLabel: 'Add a work video',
      ctaUrl: `${SITE_URL}/profile/edit`,
      illustration: 'working.png',
    }),
  })
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }

  const authToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!authToken) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Missing authorization token' }))
    return
  }
  const { data: userData, error: userError } = await getAnonClient().auth.getUser(authToken)
  if (userError || !userData?.user) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Invalid or expired session' }))
    return
  }

  const { action } = body
  const supabase = getServiceClient()

  try {
    switch (action) {
      case 'candidate-welcome':
        await sendCandidateWelcome(supabase, body.candidateId)
        break
      case 'employer-welcome':
        await sendEmployerWelcome(supabase, body.userId)
        break
      case 'first-role-video-nudge':
        await sendFirstRoleVideoNudge(supabase, body.employerId)
        break
      case 'role-live-notification':
        await sendRoleLiveNotification(supabase, body.roleId)
        break
      case 'message-notification':
        await sendMessageNotification(supabase, body.messageId)
        break
      case 'application-notification':
        await sendApplicationNotification(supabase, body.applicationId)
        break
      case 'shortlist-notification':
        await sendShortlistNotification(supabase, body.shortlistId)
        break
      case 'team-invite':
        await sendTeamInvite(supabase, body.teamMemberId)
        break
      case 'rejection-notification':
        await sendRejectionNotification(supabase, body.applicationId)
        break
      case 'live-notification':
        await sendLiveNotification(supabase, body.candidateId)
        break
      case 'video-library-notification':
        await sendVideoLibraryNotification(supabase, body.candidateId)
        break
      default:
        res.statusCode = 400
        res.end(JSON.stringify({ error: `Unknown action: ${action}` }))
        return
    }
    res.statusCode = 200
    res.end(JSON.stringify({ success: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
