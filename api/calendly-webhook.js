// Vercel serverless function receiving Calendly's webhook deliveries for
// every connected candidate (one shared organization-scoped signing key,
// one endpoint — see verifyWebhookSignature in _lib/calendly.js).
//
// Calendly's v2 API only has two invitee webhook events — invitee.created
// and invitee.canceled. There is no separate "rescheduled" event: a
// reschedule delivers as an invitee.canceled for the old booking (with
// new_invitee set, pointing at its replacement) paired with an
// invitee.created for the new one (with old_invitee set, pointing back at
// what it replaced). handleInviteeCreated/handleInviteeCanceled below use
// those two fields to tell a genuine cancellation from a reschedule.
//
// Matching a webhook back to our data happens in two steps: the payload's
// event_memberships[0].user is the organizer's Calendly user uri, matched
// against calendly_tokens.calendly_user_uri to find which candidate this
// is; the payload's own invitee email is the person who filled out the
// scheduling form — i.e. the employer — matched against that candidate's
// still-pending meetings rows (the ones created by "Book a meeting")
// by employer contact email.
//
// This file's payload-field assumptions (event_memberships, old_invitee /
// new_invitee, the /users/me and scheduled-event response shapes) are
// written from Calendly's documented v2 schema but have not been exercised
// against a real webhook delivery — verify against a real test booking once
// a candidate has actually connected a Calendly account.

import { getServiceClient, unwrap, getCandidateContact, getEmployerContact, getEmployerEmails } from './_lib/db.js'
import { sendEmail } from './_lib/resend.js'
import { renderEmailHtml, SITE_URL } from './_lib/email-template.js'
import { escapeHtml } from './_lib/html.js'
import { verifyWebhookSignature, getValidAccessToken, getScheduledEvent } from './_lib/calendly.js'

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function formatDateTime(iso, timezone) {
  const options = { dateStyle: 'full', timeStyle: 'short' }
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone || 'UTC' }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(new Date(iso))
  }
}

async function findCandidateIdByOrganizerUri(supabase, organizerUri) {
  const tokenRow = unwrap(
    await supabase.from('calendly_tokens').select('candidate_id').eq('calendly_user_uri', organizerUri).maybeSingle(),
  )
  return tokenRow?.candidate_id || null
}

async function findMeetingByInviteeUri(supabase, inviteeUri) {
  return unwrap(
    await supabase
      .from('meetings')
      .select('id, employer_id, candidate_id, status, start_time, timezone')
      .eq('calendly_invitee_uri', inviteeUri)
      .maybeSingle(),
  )
}

async function findPendingMeetingForEmployerEmail(supabase, candidateId, inviteeEmail) {
  const pending = unwrap(
    await supabase
      .from('meetings')
      .select('id, employer_id, candidate_id')
      .eq('candidate_id', candidateId)
      .eq('status', 'pending')
      .order('booking_created_at', { ascending: false }),
  )
  for (const meeting of pending) {
    const { email } = await getEmployerContact(supabase, meeting.employer_id)
    if (email && inviteeEmail && email.toLowerCase() === inviteeEmail.toLowerCase()) return meeting
  }
  return null
}

async function sendConfirmationEmails(supabase, meeting) {
  const [candidate, employer, teamEmails] = await Promise.all([
    getCandidateContact(supabase, meeting.candidate_id),
    getEmployerContact(supabase, meeting.employer_id),
    getEmployerEmails(supabase, meeting.employer_id),
  ])
  const when = formatDateTime(meeting.start_time, meeting.timezone)
  const profileUrl = `${SITE_URL}/profile/${candidate.username || meeting.candidate_id}`

  await sendEmail({
    to: candidate.email,
    subject: `Your meeting with ${employer.companyName} is confirmed`,
    html: renderEmailHtml({
      heading: 'Meeting confirmed',
      bodyText: `Your meeting with ${escapeHtml(employer.companyName)} is confirmed for ${when}. Make sure you're ready to make a great impression.`,
      ctaLabel: 'View my applications',
      ctaUrl: `${SITE_URL}/applications`,
      illustration: 'Client_to_creative.png',
    }),
  })

  if (teamEmails.length > 0) {
    await sendEmail({
      to: teamEmails,
      subject: `Your meeting with ${candidate.fullName} is confirmed`,
      html: renderEmailHtml({
        heading: 'Meeting confirmed',
        bodyText: `Your meeting with ${escapeHtml(candidate.fullName)} is confirmed for ${when}. Take a look at their profile before you meet.`,
        ctaLabel: 'View applicant',
        ctaUrl: profileUrl,
        illustration: 'Client_to_creative.png',
      }),
    })
  }
}

async function sendCancellationEmails(supabase, meeting) {
  const [candidate, employer, teamEmails] = await Promise.all([
    getCandidateContact(supabase, meeting.candidate_id),
    getEmployerContact(supabase, meeting.employer_id),
    getEmployerEmails(supabase, meeting.employer_id),
  ])
  const when = formatDateTime(meeting.start_time, meeting.timezone)
  const profileUrl = `${SITE_URL}/profile/${candidate.username || meeting.candidate_id}`

  await sendEmail({
    to: candidate.email,
    subject: 'Your meeting has been cancelled',
    html: renderEmailHtml({
      heading: 'Meeting cancelled',
      bodyText: `Your meeting with ${escapeHtml(employer.companyName)} scheduled for ${when} has been cancelled.`,
      ctaLabel: 'View my applications',
      ctaUrl: `${SITE_URL}/applications`,
      illustration: 'Easy_stuff.png',
    }),
  })

  if (teamEmails.length > 0) {
    await sendEmail({
      to: teamEmails,
      subject: 'Your meeting has been cancelled',
      html: renderEmailHtml({
        heading: 'Meeting cancelled',
        bodyText: `Your meeting with ${escapeHtml(candidate.fullName)} scheduled for ${when} has been cancelled.`,
        ctaLabel: 'View applicant',
        ctaUrl: profileUrl,
        illustration: 'Easy_stuff.png',
      }),
    })
  }
}

async function sendRescheduleEmails(supabase, meeting) {
  const [candidate, employer, teamEmails] = await Promise.all([
    getCandidateContact(supabase, meeting.candidate_id),
    getEmployerContact(supabase, meeting.employer_id),
    getEmployerEmails(supabase, meeting.employer_id),
  ])
  const when = formatDateTime(meeting.start_time, meeting.timezone)
  const profileUrl = `${SITE_URL}/profile/${candidate.username || meeting.candidate_id}`

  await sendEmail({
    to: candidate.email,
    subject: 'Your meeting has been rescheduled',
    html: renderEmailHtml({
      heading: 'Meeting rescheduled',
      bodyText: `Your meeting with ${escapeHtml(employer.companyName)} has been moved to ${when}.`,
      ctaLabel: 'View my applications',
      ctaUrl: `${SITE_URL}/applications`,
      illustration: 'Easy_stuff.png',
    }),
  })

  if (teamEmails.length > 0) {
    await sendEmail({
      to: teamEmails,
      subject: 'Your meeting has been rescheduled',
      html: renderEmailHtml({
        heading: 'Meeting rescheduled',
        bodyText: `Your meeting with ${escapeHtml(candidate.fullName)} has been moved to ${when}.`,
        ctaLabel: 'View applicant',
        ctaUrl: profileUrl,
        illustration: 'Easy_stuff.png',
      }),
    })
  }
}

async function handleInviteeCreated(supabase, payload) {
  // Idempotency: a Calendly webhook retry re-delivers the exact same
  // invitee.created — if we've already recorded this invitee uri, there's
  // nothing left to do (and re-matching would fail anyway once the meeting
  // row has already moved out of 'pending').
  const already = await findMeetingByInviteeUri(supabase, payload.uri)
  if (already) return

  const organizerUri = payload.event_memberships?.[0]?.user
  if (!organizerUri) return
  const candidateId = await findCandidateIdByOrganizerUri(supabase, organizerUri)
  if (!candidateId) return

  const isReschedule = Boolean(payload.old_invitee)
  const meeting = isReschedule
    ? await findMeetingByInviteeUri(supabase, payload.old_invitee)
    : await findPendingMeetingForEmployerEmail(supabase, candidateId, payload.email)

  if (!meeting) {
    console.error('Calendly invitee.created: no matching meeting row for candidate', candidateId)
    return
  }

  const accessToken = await getValidAccessToken(supabase, candidateId)
  const { resource: event } = await getScheduledEvent(accessToken, payload.event)

  const updated = unwrap(
    await supabase
      .from('meetings')
      .update({
        status: 'confirmed',
        start_time: event.start_time,
        timezone: payload.timezone || null,
        calendly_event_uri: payload.event,
        calendly_invitee_uri: payload.uri,
        reminder_sent: false,
      })
      .eq('id', meeting.id)
      .select('id, employer_id, candidate_id, start_time, timezone')
      .single(),
  )

  if (isReschedule) {
    await sendRescheduleEmails(supabase, updated)
  } else {
    await sendConfirmationEmails(supabase, updated)
  }
}

async function handleInviteeCanceled(supabase, payload) {
  // See the file-level comment — a cancellation carrying new_invitee is
  // just the "old half" of a reschedule, already handled by the paired
  // invitee.created above. Nothing to send here.
  if (payload.new_invitee) return

  const meeting = await findMeetingByInviteeUri(supabase, payload.uri)
  if (!meeting || meeting.status === 'cancelled') return

  const updated = unwrap(
    await supabase
      .from('meetings')
      .update({ status: 'cancelled' })
      .eq('id', meeting.id)
      .select('id, employer_id, candidate_id, start_time, timezone')
      .single(),
  )

  await sendCancellationEmails(supabase, updated)
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const rawBody = await readRawBody(req)

  if (!verifyWebhookSignature(rawBody, req.headers['calendly-webhook-signature'])) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Invalid signature' }))
    return
  }

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }

  const supabase = getServiceClient()

  try {
    if (body.event === 'invitee.created') {
      await handleInviteeCreated(supabase, body.payload)
    } else if (body.event === 'invitee.canceled') {
      await handleInviteeCanceled(supabase, body.payload)
    }
    res.statusCode = 200
    res.end(JSON.stringify({ success: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
