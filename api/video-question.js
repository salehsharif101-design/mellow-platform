// Vercel serverless function backing the public /answer-question/:token
// page. Every action here is deliberately public (no bearer token
// required, unlike api/email.js) — the answer_token itself is the
// credential, same idea as api/team-invite.js's `lookup`/`accept` split,
// since a candidate answering a question may not be signed in at all.
//
// Video upload is a two-step signed-URL handoff rather than routing file
// bytes through this function: 'create-upload-url' hands back a
// service-role-issued signed upload URL (which itself bypasses
// candidate-videos' normal "folder must match auth.uid()" storage policy,
// since it is pre-authorized independent of the caller's own auth state),
// the browser uploads the file straight to Supabase Storage with it, and
// only then does 'submit-answer' get called to record the result — this
// avoids ever passing a multi-MB video through a Vercel function body.

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from './_lib/resend.js'
import { renderEmailHtml, SITE_URL } from './_lib/email-template.js'
import { getServiceClient, getEmployerUserIds, getEmployerEmails } from './_lib/db.js'
import { escapeHtml } from './_lib/html.js'
import { isPastDeadline, daysLeftToAnswer, ANSWER_WINDOW_DAYS, QUESTION_LIMIT } from '../src/lib/videoQuestions.js'

const BUCKET = 'candidate-videos'
// Server-side allowlist, independent of the client's own file-type check —
// whatever this resolves to is spliced straight into a storage path below.
const EXT_BY_CONTENT_TYPE = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

// Same idea as api/email.js's getAnonClient — verifies a bearer token
// against Supabase Auth without the service role key, so 'ask-question'
// (the one action here that performs a privileged write rather than
// reading via the answer_token) can require proof the caller is actually
// signed in.
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

// Shared by 'lookup', 'create-upload-url', and 'submit-answer' — every
// action needs the same question-plus-context row, and the same "is this
// still actually answerable" check re-derived here rather than trusted
// from the client either way.
async function loadQuestion(supabase, token) {
  const { data, error } = await supabase
    .from('video_questions')
    .select(
      'id, question_text, asked_at, answered_at, status, answer_video_url, role_id, candidate_id, employer_id, roles(title), employer_profiles(company_name, logo_url), candidate_profiles(full_name, user_id)',
    )
    .eq('answer_token', token)
    .maybeSingle()
  // A malformed token (not even a valid uuid) fails at the query level
  // rather than coming back as a plain "no row" miss — treat it the same
  // way so the public page shows its friendly "invalid link" state instead
  // of a raw Postgres error string.
  if (error) {
    if (error.code === '22P02') return null
    throw new Error(error.message)
  }
  return data
}

function effectiveStatus(question) {
  if (question.status !== 'pending') return question.status
  return isPastDeadline(question.asked_at) ? 'expired' : 'pending'
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

  const { action, token } = body
  const supabase = getServiceClient()

  // Unlike every other action here, asking a question isn't reached via an
  // answer_token at all — it's the employer-side write that CREATES one —
  // so it's handled up front, before the token requirement below (which
  // every read/answer action still needs) even applies.
  if (action === 'ask-question') {
    try {
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

      const { employerId, candidateId, roleId, questionText } = body
      const trimmed = (questionText || '').trim()
      if (!employerId || !candidateId || !roleId || !trimmed) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing required fields' }))
        return
      }

      const employerUserIds = await getEmployerUserIds(supabase, employerId)
      if (!employerUserIds.includes(userData.user.id)) {
        res.statusCode = 403
        res.end(JSON.stringify({ error: 'Not authorized for this employer' }))
        return
      }

      // The actual race-condition fix: count and insert both happen here,
      // server-side, in one request — a UI-only disabled button (or an
      // RLS policy that only checks employer ownership, not how many rows
      // already exist) can't stop two nearly-simultaneous requests from
      // both passing a client-side check and both inserting. This can
      // still race against a page that hasn't reloaded — the DB will
      // faithfully reflect the true count either way, this just makes the
      // limit itself impossible to exceed.
      const { count, error: countError } = await supabase
        .from('video_questions')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidateId)
        .eq('role_id', roleId)
      if (countError) throw new Error(countError.message)
      if ((count || 0) >= QUESTION_LIMIT) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'You have already asked the maximum number of questions for this candidate.' }))
        return
      }

      const { data: inserted, error: insertError } = await supabase
        .from('video_questions')
        .insert({ employer_id: employerId, candidate_id: candidateId, role_id: roleId, question_text: trimmed, asked_by: userData.user.id })
        .select()
        .single()
      if (insertError) throw new Error(insertError.message)

      res.statusCode = 200
      res.end(JSON.stringify({ question: inserted }))
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  if (!token) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Missing token' }))
    return
  }

  try {
    const question = await loadQuestion(supabase, token)
    if (!question) {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'This link is invalid.' }))
      return
    }
    const status = effectiveStatus(question)

    if (action === 'lookup') {
      res.statusCode = 200
      res.end(
        JSON.stringify({
          questionText: question.question_text,
          status,
          askedAt: question.asked_at,
          answeredAt: question.answered_at,
          answerVideoUrl: status === 'answered' ? question.answer_video_url : null,
          daysLeft: status === 'pending' ? daysLeftToAnswer(question.asked_at) : 0,
          answerWindowDays: ANSWER_WINDOW_DAYS,
          roleTitle: question.roles?.title || 'this role',
          companyName: question.employer_profiles?.company_name || 'This company',
          companyLogoUrl: question.employer_profiles?.logo_url || null,
        }),
      )
      return
    }

    if (action === 'create-upload-url') {
      if (status !== 'pending') {
        res.statusCode = 409
        res.end(JSON.stringify({ error: 'This question can no longer be answered.', status }))
        return
      }
      // Recorded video (as opposed to an uploaded file) arrives with codec
      // parameters attached, e.g. "video/webm;codecs=vp9,opus" — stripped
      // here so the lookup below matches on the base type rather than
      // silently missing and falling through to the 'webm' default.
      const baseContentType = (body.contentType || '').split(';')[0].trim().toLowerCase()
      const ext = EXT_BY_CONTENT_TYPE[baseContentType] || 'webm'
      const path = `${question.candidate_profiles?.user_id || question.candidate_id}/answer-${question.id}-${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error) throw new Error(error.message)
      res.statusCode = 200
      res.end(JSON.stringify({ signedUrl: data.signedUrl, uploadToken: data.token, path }))
      return
    }

    if (action === 'submit-answer') {
      if (status !== 'pending') {
        res.statusCode = 409
        res.end(JSON.stringify({ error: 'This question can no longer be answered.', status }))
        return
      }
      const { path } = body
      if (!path) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing uploaded file path' }))
        return
      }
      // Never trust the client-supplied path as-is — without this, any
      // holder of a valid, still-pending answer_token could point this
      // question's answer_video_url at an arbitrary object already sitting
      // in the bucket (someone else's video, unrelated content) rather
      // than whatever create-upload-url actually issued them. The expected
      // shape is re-derived from the question row itself, the same way
      // create-upload-url built it, rather than trusting a value stored
      // client-side between the two calls.
      const expectedUserId = question.candidate_profiles?.user_id || question.candidate_id
      const pathPattern = new RegExp(`^${expectedUserId}/answer-${question.id}-\\d+\\.(mp4|mov|webm)$`)
      if (!pathPattern.test(path)) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Invalid upload path for this question.' }))
        return
      }
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)

      const { data: updated, error: updateError } = await supabase
        .from('video_questions')
        .update({ answer_video_url: publicData.publicUrl, answered_at: new Date().toISOString(), status: 'answered' })
        .eq('id', question.id)
        .eq('status', 'pending')
        .select()
        .maybeSingle()
      if (updateError) throw new Error(updateError.message)
      if (!updated) {
        res.statusCode = 409
        res.end(JSON.stringify({ error: 'This question can no longer be answered.' }))
        return
      }

      // Self-contained send (sendEmail/renderEmailHtml directly, not the
      // notify()/api/email.js dispatch) since the actor triggering this —
      // a candidate who may be logged out — cannot supply the bearer
      // session token that endpoint requires. Matches how the daily cron
      // jobs already send email directly rather than through that path.
      const candidateName = question.candidate_profiles?.full_name || 'A candidate'
      const emails = await getEmployerEmails(supabase, question.employer_id)
      if (emails.length > 0) {
        await sendEmail({
          to: emails,
          subject: `${candidateName} answered your question`,
          html: renderEmailHtml({
            heading: 'You have a new video answer',
            bodyText: `${escapeHtml(candidateName)} has recorded their answer to your question for ${escapeHtml(question.roles?.title || 'your role')}. Watch it now on the platform.`,
            ctaLabel: 'Watch the answer',
            ctaUrl: `${SITE_URL}/employer/roles/${question.role_id}/applicants`,
            illustration: 'Collaborate2.png',
          }),
        })
      }

      res.statusCode = 200
      res.end(JSON.stringify({ success: true }))
      return
    }

    res.statusCode = 400
    res.end(JSON.stringify({ error: `Unknown action: ${action}` }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
