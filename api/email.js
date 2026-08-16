// Vercel serverless function. Sends transactional emails via Resend.
// Runs server-side only — RESEND_API_KEY and the Supabase service role key
// never reach the browser. Callers pass only IDs; this function looks up the
// authoritative data itself via the service role client rather than trusting
// client-supplied email content.

import { sendEmail } from './_lib/resend.js'
import { renderEmailHtml, SITE_URL } from './_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact } from './_lib/db.js'

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

async function sendSignupWelcome(supabase, userId) {
  const user = unwrap(await supabase.from('users').select('email').eq('id', userId).single())

  return sendEmail({
    to: user.email,
    subject: 'Welcome to Mellow',
    html: renderEmailHtml({
      heading: 'Your living first impression starts here',
      bodyText:
        'You are one step away from showing employers exactly who you are. Complete your profile, upload your 60-second video, and let the right opportunities find you.',
      ctaLabel: 'Complete my profile',
      ctaUrl: `${SITE_URL}/dashboard`,
      illustration: 'Flexible.PNG',
    }),
  })
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

  const employerUser = unwrap(await supabase.from('users').select('email').eq('id', employer.user_id).single())

  const result = await sendEmail({
    to: employerUser.email,
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
    await supabase.from('roles').select('title, slug, employer_profiles(user_id)').eq('id', roleId).single(),
  )
  const employerUser = unwrap(
    await supabase.from('users').select('email').eq('id', role.employer_profiles.user_id).single(),
  )

  return sendEmail({
    to: employerUser.email,
    subject: 'Your role is live on Mellow',
    html: renderEmailHtml({
      heading: 'Your role is live',
      bodyText: `Your ${role.title} role has been posted successfully. Talent can now discover and apply to it on Mellow. Share it widely to get the best applications.`,
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
      .select('title, employer_profiles(user_id)')
      .eq('id', application.role_id)
      .single(),
  )
  const employerUser = unwrap(
    await supabase.from('users').select('email').eq('id', role.employer_profiles.user_id).single(),
  )

  return sendEmail({
    to: employerUser.email,
    subject: 'New application on Mellow',
    html: renderEmailHtml({
      heading: 'New application received',
      bodyText: `${candidate.full_name} applied to ${role.title}. View their profile to learn more.`,
      ctaLabel: 'View profile',
      ctaUrl: `${SITE_URL}/profile/${candidate.username || application.candidate_id}`,
      illustration: 'thinking.png',
    }),
  })
}

async function sendShortlistNotification(supabase, shortlistId) {
  const shortlist = unwrap(
    await supabase.from('shortlists').select('candidate_id').eq('id', shortlistId).single(),
  )
  const candidate = unwrap(
    await supabase.from('candidate_profiles').select('user_id, username').eq('id', shortlist.candidate_id).single(),
  )
  const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())

  return sendEmail({
    to: candidateUser.email,
    subject: 'You were shortlisted on Mellow',
    html: renderEmailHtml({
      heading: "You've been shortlisted",
      bodyText: 'An employer shortlisted your Mellow profile. Keep it up to date — they may reach out soon.',
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
      bodyText: `Thank you for applying to ${role.title} at ${companyName}. After careful consideration we have decided to move forward with other talent at this time. We appreciate your interest and wish you all the best in your search.`,
      illustration: 'thinking.png',
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

  const { action } = body
  const supabase = getServiceClient()

  try {
    switch (action) {
      case 'signup-welcome':
        await sendSignupWelcome(supabase, body.userId)
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
