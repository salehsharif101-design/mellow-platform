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
import { getServiceClient } from './_lib/db.js'
import { escapeHtml } from './_lib/html.js'
import { isPastDeadline, daysLeftToAnswer, ANSWER_WINDOW_DAYS } from '../src/lib/videoQuestions.js'

const BUCKET = 'candidate-videos'
// Server-side allowlist, independent of the client's own file-type check —
// whatever this resolves to is spliced straight into a storage path below.
const EXT_BY_CONTENT_TYPE = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
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
  if (!token) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Missing token' }))
    return
  }

  const supabase = getServiceClient()

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
      const ext = EXT_BY_CONTENT_TYPE[body.contentType] || 'webm'
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
      const { data: teamMembers } = await supabase
        .from('employer_team_members')
        .select('user_id')
        .eq('employer_id', question.employer_id)
        .eq('status', 'active')
      const { data: owner } = await supabase
        .from('employer_profiles')
        .select('user_id')
        .eq('id', question.employer_id)
        .maybeSingle()
      const recipientUserIds = [owner?.user_id, ...(teamMembers || []).map((m) => m.user_id)].filter(Boolean)
      if (recipientUserIds.length > 0) {
        const { data: users } = await supabase.from('users').select('email').in('id', recipientUserIds)
        const emails = (users || []).map((u) => u.email).filter(Boolean)
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
