// Vercel serverless function. Public, unauthenticated endpoint — the
// joinmellow.xyz marketing site (a separate static site/origin) posts an
// email address here and gets a thank-you email via Resend in return.
// CORS is scoped to the marketing site's origin since this is called
// cross-origin from a plain <script> fetch(), not from the app itself.

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from './_lib/resend.js'
import { renderEmailHtml } from './_lib/email-template.js'

const ALLOWED_ORIGIN = 'https://joinmellow.xyz'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

export default async function handler(req, res) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

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

  const email = (body.email || '').trim()
  if (!EMAIL_RE.test(email)) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'A valid email is required' }))
    return
  }

  // Best-effort storage — a transient DB hiccup shouldn't stop someone
  // from getting their thank-you email. Duplicate signups just no-op
  // (email column is unique) rather than erroring.
  try {
    await getServiceClient().from('waitlist_signups').insert({ email })
  } catch {
    // ignored — storage is secondary to actually sending the email
  }

  try {
    await sendEmail({
      to: email,
      subject: "You're on the list",
      html: renderEmailHtml({
        heading: "Your next job won't start with a CV.",
        bodyText:
          'Thank you for signing up. You are one of the first people to hear about Mellow, and that means something to us.<br><br>' +
          'Here is what we are building: a hiring platform where talent shows up as people, not documents. One 60-second video profile, recorded once, that travels to every opportunity. No CV, no cover letter, ever again. Employers get a feed of real people instead of a pile of identical paperwork. The first conversation happens faster than any tool on the market makes possible.<br><br>' +
          'We are in beta right now and will be opening up access very soon. When we do, you will be among the first to know.<br><br>' +
          'In the meantime, if you know someone who is hiring or looking for their next role, tell them about Mellow. Every person you bring in makes the platform better for everyone.<br><br>' +
          'We will be in touch soon.<br><br>' +
          'The Mellow team',
        ctaLabel: 'Learn more about Mellow',
        ctaUrl: 'https://joinmellow.xyz',
        illustration: 'Client_to_creative.png',
        footerDomain: 'joinmellow.xyz',
      }),
    })
    res.statusCode = 200
    res.end(JSON.stringify({ success: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
