// Vercel serverless function. Sends transactional emails via Resend.
// Runs server-side only — RESEND_API_KEY and the Supabase service role key
// never reach the browser. Callers pass only IDs; this function looks up the
// authoritative data itself via the service role client rather than trusting
// client-supplied email content.

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from './_lib/resend.js'
import { renderEmailHtml, SITE_URL } from './_lib/email-template.js'

function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
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

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
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
        'Browse real candidates, post your first role, and find the right person without reading a single CV. Your talent feed is ready and waiting.',
      ctaLabel: 'Browse the talent feed',
      ctaUrl: `${SITE_URL}/employer/talent`,
      illustration: 'Client_to_creative.png',
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

async function getCandidateContact(supabase, candidateId) {
  const candidate = unwrap(
    await supabase.from('candidate_profiles').select('user_id, username').eq('id', candidateId).single(),
  )
  const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())
  return { email: candidateUser.email, username: candidate.username }
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
        'Your Mellow profile starts with your 60-second intro video. But the candidates who stand out go further. The work video library lets you upload additional videos that show employers exactly how you think and what you are capable of, before the first interview.<br><br>' +
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
      case 'message-notification':
        await sendMessageNotification(supabase, body.messageId)
        break
      case 'application-notification':
        await sendApplicationNotification(supabase, body.applicationId)
        break
      case 'shortlist-notification':
        await sendShortlistNotification(supabase, body.shortlistId)
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
