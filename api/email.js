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
  const user = unwrap(await supabase.from('users').select('email, user_type').eq('id', userId).single())

  if (user.user_type === 'employer') {
    return sendEmail({
      to: user.email,
      subject: 'Welcome to Mellow',
      html: renderEmailHtml({
        heading: 'Start meeting people, not documents',
        bodyText: 'Browse real candidates, post your first role, and find the right person without reading a single CV.',
        ctaLabel: 'Browse the talent feed',
        ctaUrl: `${SITE_URL}/employer/talent`,
        illustration: 'Email_Verification3.png',
      }),
    })
  }

  return sendEmail({
    to: user.email,
    subject: 'Welcome to Mellow',
    html: renderEmailHtml({
      heading: 'Your living first impression starts here',
      bodyText:
        'You are one step away from showing employers exactly who you are. Complete your profile, upload your 60-second video, and let the right opportunities find you.',
      ctaLabel: 'Complete my profile',
      ctaUrl: `${SITE_URL}/dashboard`,
      illustration: 'Email_Verification2.png',
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
      illustration: 'Email_Verification.png',
    }),
  })
}

async function sendApplicationNotification(supabase, applicationId) {
  const application = unwrap(
    await supabase.from('applications').select('candidate_id, role_id').eq('id', applicationId).single(),
  )
  const candidate = unwrap(
    await supabase.from('candidate_profiles').select('full_name').eq('id', application.candidate_id).single(),
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
      ctaUrl: `${SITE_URL}/profile/${application.candidate_id}`,
      illustration: 'Email_Verification3.png',
    }),
  })
}

async function sendShortlistNotification(supabase, shortlistId) {
  const shortlist = unwrap(
    await supabase.from('shortlists').select('candidate_id').eq('id', shortlistId).single(),
  )
  const candidate = unwrap(
    await supabase.from('candidate_profiles').select('user_id').eq('id', shortlist.candidate_id).single(),
  )
  const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())

  return sendEmail({
    to: candidateUser.email,
    subject: 'You were shortlisted on Mellow',
    html: renderEmailHtml({
      heading: "You've been shortlisted",
      bodyText: 'An employer shortlisted your Mellow profile. Keep it up to date — they may reach out soon.',
      ctaLabel: 'View my profile',
      ctaUrl: `${SITE_URL}/profile/${shortlist.candidate_id}`,
      illustration: 'Email_Verification2.png',
    }),
  })
}

async function sendLiveNotification(supabase, candidateId) {
  const candidate = unwrap(
    await supabase.from('candidate_profiles').select('user_id').eq('id', candidateId).single(),
  )
  const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())

  return sendEmail({
    to: candidateUser.email,
    subject: 'Your Mellow profile is live',
    html: renderEmailHtml({
      heading: 'Your profile is live',
      bodyText: 'Your Mellow profile is now live and visible to employers. Share it, or sit back while opportunities find you.',
      ctaLabel: 'View my profile',
      ctaUrl: `${SITE_URL}/profile/${candidateId}`,
      illustration: 'Email_Verification.png',
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
