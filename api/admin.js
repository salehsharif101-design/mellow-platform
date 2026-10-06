// Vercel serverless function. Runs server-side only — the service role key
// and admin password never reach the browser.
//
// Access is password + TOTP two-factor (see _lib/adminAuth.js). The login
// actions below exchange credentials for a signed 24-hour session token;
// every other action requires that token, checked here on the server on
// every request — never trusted from the client. While ADMIN_TOTP_SECRET is
// unset the password alone is enough to get a token (so 2FA can be set up
// without locking anyone out); once it's set, a valid code is mandatory.

import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { generateSecret, generateURI } from 'otplib'
import { deleteUserStorageFiles } from './_lib/storageCleanup.js'
import {
  SESSION_TTL_MS,
  PENDING_TTL_MS,
  passwordIsValid,
  totpEnabled,
  issueToken,
  verifyToken,
  totpCodeIsValid,
} from './_lib/adminAuth.js'

const COMPLETENESS_FIELDS = ['full_name', 'job_title', 'location', 'bio', 'intro_video_url']

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

async function getStats(supabase) {
  const [candidates, employers, roles, applications, messages] = await Promise.all([
    supabase.from('candidate_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('employer_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('roles').select('id', { count: 'exact', head: true }),
    supabase.from('applications').select('id', { count: 'exact', head: true }),
    supabase.from('messages').select('id', { count: 'exact', head: true }),
  ])
  for (const r of [candidates, employers, roles, applications, messages]) {
    if (r.error) throw new Error(r.error.message)
  }
  return {
    totalCandidates: candidates.count || 0,
    totalEmployers: employers.count || 0,
    totalRoles: roles.count || 0,
    totalApplications: applications.count || 0,
    totalMessages: messages.count || 0,
  }
}

async function getCandidates(supabase) {
  const candidates = unwrap(
    await supabase
      .from('candidate_profiles')
      .select(
        'id, user_id, username, full_name, job_title, location, bio, skills, languages, intro_video_url, is_live, created_at, users(email, created_at)',
      )
      .order('created_at', { ascending: false }),
  )

  const apps = unwrap(await supabase.from('applications').select('candidate_id'))
  const appCounts = {}
  apps.forEach((a) => {
    appCounts[a.candidate_id] = (appCounts[a.candidate_id] || 0) + 1
  })

  return candidates.map((c) => {
    const filled = COMPLETENESS_FIELDS.filter((f) => Boolean(c[f])).length
    const hasSkills = (c.skills || []).length > 0
    const hasLanguages = (c.languages || []).length > 0
    const completeness = Math.round(((filled + hasSkills + hasLanguages) / (COMPLETENESS_FIELDS.length + 2)) * 100)
    return {
      id: c.id,
      userId: c.user_id,
      username: c.username,
      fullName: c.full_name,
      email: c.users?.email || null,
      location: c.location,
      dateJoined: c.users?.created_at || c.created_at,
      isLive: c.is_live,
      completeness,
      applicationCount: appCounts[c.id] || 0,
    }
  })
}

async function getEmployers(supabase) {
  const employers = unwrap(
    await supabase
      .from('employer_profiles')
      // employer_dashboard_views (migration 0076) added a second path between
      // employer_profiles and users (via its own two FKs), so the implicit
      // "users(...)" embed is now ambiguous — must name the FK explicitly.
      .select('id, user_id, company_name, company_slug, is_visible, created_at, users!employer_profiles_user_id_fkey(email, created_at)')
      .order('created_at', { ascending: false }),
  )

  const roles = unwrap(await supabase.from('roles').select('employer_id'))
  const roleCounts = {}
  roles.forEach((r) => {
    roleCounts[r.employer_id] = (roleCounts[r.employer_id] || 0) + 1
  })

  const messages = unwrap(await supabase.from('messages').select('sender_id'))
  const messageCounts = {}
  messages.forEach((m) => {
    messageCounts[m.sender_id] = (messageCounts[m.sender_id] || 0) + 1
  })

  return employers.map((e) => ({
    id: e.id,
    userId: e.user_id,
    companyName: e.company_name,
    companySlug: e.company_slug,
    isVisible: e.is_visible,
    email: e.users?.email || null,
    dateJoined: e.users?.created_at || e.created_at,
    rolesPosted: roleCounts[e.id] || 0,
    messagesSent: messageCounts[e.user_id] || 0,
  }))
}

async function toggleEmployerVisibility(supabase, employerId, isVisible) {
  if (!employerId || typeof isVisible !== 'boolean') {
    throw new Error('employerId and isVisible (boolean) are required')
  }
  const data = unwrap(
    await supabase.from('employer_profiles').update({ is_visible: isVisible }).eq('id', employerId).select().single(),
  )
  return { success: true, isVisible: data.is_visible }
}

async function getRoles(supabase) {
  const roles = unwrap(
    await supabase
      .from('roles')
      .select('id, title, slug, status, is_active, created_at, employer_profiles(company_name, company_slug)')
      .order('created_at', { ascending: false }),
  )

  const apps = unwrap(await supabase.from('applications').select('role_id'))
  const counts = {}
  apps.forEach((a) => {
    counts[a.role_id] = (counts[a.role_id] || 0) + 1
  })

  return roles.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    company: r.employer_profiles?.company_name || null,
    companySlug: r.employer_profiles?.company_slug || null,
    datePosted: r.created_at,
    status: r.status,
    isActive: r.is_active,
    applicationCount: counts[r.id] || 0,
  }))
}

async function closeRole(supabase, roleId) {
  if (!roleId) throw new Error('roleId is required')
  const data = unwrap(
    await supabase.from('roles').update({ status: 'closed' }).eq('id', roleId).select().single(),
  )
  return { success: true, status: data.status, isActive: data.is_active }
}

async function deleteRole(supabase, roleId) {
  if (!roleId) throw new Error('roleId is required')
  await supabase.from('applications').delete().eq('role_id', roleId)
  await supabase.from('roles').delete().eq('id', roleId)
  return { success: true }
}

// Full application list for moderation — every application on the
// platform, not just the 20 most recent shown in the Activity feed.
async function getApplications(supabase) {
  const apps = unwrap(
    await supabase
      .from('applications')
      .select(
        'id, status, applied_at, candidate_profiles(id, username, full_name), roles(id, title, slug, employer_profiles(company_name, company_slug))',
      )
      .order('applied_at', { ascending: false }),
  )

  return apps.map((a) => ({
    id: a.id,
    status: a.status,
    appliedAt: a.applied_at,
    candidateName: a.candidate_profiles?.full_name || null,
    candidateUsername: a.candidate_profiles?.username || a.candidate_profiles?.id || null,
    roleTitle: a.roles?.title || null,
    roleSlug: a.roles?.slug || null,
    companyName: a.roles?.employer_profiles?.company_name || null,
    companySlug: a.roles?.employer_profiles?.company_slug || null,
  }))
}

// One row per distinct candidate/employer pair that has exchanged messages,
// for the Messages moderation tab. The full thread for a pair is fetched
// separately via getConversationThread once an admin clicks into one.
async function getConversations(supabase) {
  const messages = unwrap(
    await supabase
      .from('messages')
      .select('sender_id, recipient_id, body, sent_at')
      .order('sent_at', { ascending: false }),
  )
  if (messages.length === 0) return []

  const userIds = new Set()
  messages.forEach((m) => {
    userIds.add(m.sender_id)
    userIds.add(m.recipient_id)
  })
  const idList = Array.from(userIds)

  const [usersRes, candidatesRes, employersRes] = await Promise.all([
    supabase.from('users').select('id, email').in('id', idList),
    supabase.from('candidate_profiles').select('user_id, full_name').in('user_id', idList),
    supabase.from('employer_profiles').select('user_id, company_name').in('user_id', idList),
  ])
  const emailById = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.email]))
  const nameById = {}
  ;(candidatesRes.data || []).forEach((c) => {
    nameById[c.user_id] = c.full_name
  })
  ;(employersRes.data || []).forEach((e) => {
    nameById[e.user_id] = e.company_name
  })

  // messages is already sorted newest-first, so the first message seen for
  // a given pair is that conversation's most recent one.
  const conversations = new Map()
  for (const m of messages) {
    const [userAId, userBId] = [m.sender_id, m.recipient_id].sort()
    const key = `${userAId}|${userBId}`
    const existing = conversations.get(key)
    if (existing) {
      existing.messageCount += 1
    } else {
      conversations.set(key, {
        userAId,
        userBId,
        userALabel: nameById[userAId] || emailById[userAId] || 'Unknown',
        userBLabel: nameById[userBId] || emailById[userBId] || 'Unknown',
        messageCount: 1,
        lastMessage: m.body,
        lastSentAt: m.sent_at,
      })
    }
  }

  return Array.from(conversations.values()).sort((a, b) => new Date(b.lastSentAt) - new Date(a.lastSentAt))
}

async function getConversationThread(supabase, userAId, userBId) {
  if (!userAId || !userBId) throw new Error('userAId and userBId are required')
  return unwrap(
    await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, sent_at')
      .or(
        `and(sender_id.eq.${userAId},recipient_id.eq.${userBId}),and(sender_id.eq.${userBId},recipient_id.eq.${userAId})`,
      )
      .order('sent_at', { ascending: true }),
  )
}

async function getActivity(supabase) {
  const [usersRes, appsRes, messagesRes] = await Promise.all([
    supabase.from('users').select('id, email, user_type, created_at').order('created_at', { ascending: false }).limit(20),
    supabase
      .from('applications')
      .select('id, applied_at, candidate_profiles(full_name), roles(title, employer_profiles(company_name))')
      .order('applied_at', { ascending: false })
      .limit(20),
    supabase.from('messages').select('id, sender_id, recipient_id, sent_at').order('sent_at', { ascending: false }).limit(20),
  ])
  for (const r of [usersRes, appsRes, messagesRes]) {
    if (r.error) throw new Error(r.error.message)
  }

  const otherIds = new Set()
  messagesRes.data.forEach((m) => {
    otherIds.add(m.sender_id)
    otherIds.add(m.recipient_id)
  })
  let emailById = {}
  if (otherIds.size > 0) {
    const rows = unwrap(await supabase.from('users').select('id, email').in('id', Array.from(otherIds)))
    emailById = Object.fromEntries(rows.map((u) => [u.id, u.email]))
  }

  const events = []
  usersRes.data.forEach((u) => {
    events.push({
      type: 'signup',
      timestamp: u.created_at,
      description: `${u.email} signed up as ${u.user_type}`,
    })
  })
  appsRes.data.forEach((a) => {
    events.push({
      type: 'application',
      timestamp: a.applied_at,
      description: `${a.candidate_profiles?.full_name || 'A candidate'} applied to ${a.roles?.title || 'a role'} at ${
        a.roles?.employer_profiles?.company_name || 'a company'
      }`,
    })
  })
  messagesRes.data.forEach((m) => {
    events.push({
      type: 'message',
      timestamp: m.sent_at,
      description: `${emailById[m.sender_id] || 'Someone'} messaged ${emailById[m.recipient_id] || 'someone'}`,
    })
  })

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  return events.slice(0, 20)
}

// Confirmed hires, newest first, with the candidate/company identity
// needed to link out to their profiles and a computed "time to hire" —
// days between the candidate's first application to this employer (any
// role) and the confirmed hire date. role_id on hires is often null (there
// is no reliable way to know which specific role a hire came from once it
// happens outside the application-status flow), so roleTitle just falls
// back to "—" in the UI when unknown rather than guessing.
async function getHires(supabase) {
  const hires = unwrap(
    await supabase
      .from('hires')
      .select(
        'id, employer_id, candidate_id, confirmed_at, candidate_profiles(id, username, full_name, avatar_url), employer_profiles(id, company_name, company_slug, logo_url), roles(title)',
      )
      .order('confirmed_at', { ascending: false }),
  )
  if (hires.length === 0) return { total: 0, hires: [] }

  const candidateIds = [...new Set(hires.map((h) => h.candidate_id))]
  const apps = unwrap(
    await supabase.from('applications').select('candidate_id, applied_at, roles(employer_id)').in('candidate_id', candidateIds),
  )

  // Earliest applied_at per (employer_id, candidate_id) pair — the
  // candidate's first-ever application to that specific employer.
  const firstAppliedByPair = new Map()
  for (const a of apps) {
    const employerId = a.roles?.employer_id
    if (!employerId) continue
    const key = `${employerId}|${a.candidate_id}`
    const existing = firstAppliedByPair.get(key)
    if (!existing || new Date(a.applied_at) < new Date(existing)) {
      firstAppliedByPair.set(key, a.applied_at)
    }
  }

  const rows = hires.map((h) => {
    const firstAppliedAt = firstAppliedByPair.get(`${h.employer_id}|${h.candidate_id}`) || null
    const daysToHire = firstAppliedAt
      ? Math.round((new Date(h.confirmed_at) - new Date(firstAppliedAt)) / (24 * 60 * 60 * 1000))
      : null
    return {
      id: h.id,
      candidateName: h.candidate_profiles?.full_name || null,
      candidateUsername: h.candidate_profiles?.username || h.candidate_profiles?.id || null,
      candidateAvatarUrl: h.candidate_profiles?.avatar_url || null,
      companyName: h.employer_profiles?.company_name || null,
      companySlug: h.employer_profiles?.company_slug || null,
      companyLogoUrl: h.employer_profiles?.logo_url || null,
      roleTitle: h.roles?.title || null,
      confirmedAt: h.confirmed_at,
      daysToHire,
    }
  })

  return { total: rows.length, hires: rows }
}

// Every "Book a meeting" click recorded (src/pages/candidate/
// PublicProfile.jsx), newest first, with the derived outcome for each —
// "Hired" if a hires row exists for that employer/candidate pair, "Still
// in progress" if either side has responded to the follow-up without
// confirming a hire (outcome_recorded_at set), otherwise "Pending
// follow-up" (covers both "not due yet" and "sent, no response yet").
async function getMeetings(supabase) {
  const meetings = unwrap(
    await supabase
      .from('meetings')
      .select('id, employer_id, candidate_id, booking_created_at, follow_up_sent, outcome_recorded_at, employer_profiles(company_name), candidate_profiles(full_name)')
      .order('booking_created_at', { ascending: false }),
  )
  if (meetings.length === 0) return { total: 0, meetings: [] }

  const hires = unwrap(await supabase.from('hires').select('employer_id, candidate_id'))
  const hiredPairs = new Set(hires.map((h) => `${h.employer_id}|${h.candidate_id}`))

  const rows = meetings.map((m) => {
    const pairKey = `${m.employer_id}|${m.candidate_id}`
    let outcome = 'Pending follow-up'
    if (hiredPairs.has(pairKey)) outcome = 'Hired'
    else if (m.outcome_recorded_at) outcome = 'Still in progress'

    return {
      id: m.id,
      employerName: m.employer_profiles?.company_name || null,
      candidateName: m.candidate_profiles?.full_name || null,
      bookedAt: m.booking_created_at,
      followUpSent: m.follow_up_sent,
      outcome,
    }
  })

  return { total: rows.length, meetings: rows }
}

async function toggleLive(supabase, candidateId, isLive) {
  if (!candidateId || typeof isLive !== 'boolean') {
    throw new Error('candidateId and isLive (boolean) are required')
  }
  const data = unwrap(
    await supabase.from('candidate_profiles').update({ is_live: isLive }).eq('id', candidateId).select().single(),
  )
  return { success: true, isLive: data.is_live }
}

// Permanently deletes one user account and every row tied to it, by the
// exact user id the admin clicked in the table — mirrors the self-service
// account deletion flow in api/delete-account.js.
async function deleteUser(supabase, userId) {
  if (!userId) throw new Error('userId is required')

  const { data: candidateProfiles } = await supabase.from('candidate_profiles').select('id').eq('user_id', userId)
  const candidateIds = (candidateProfiles || []).map((c) => c.id)

  const { data: employerProfiles } = await supabase.from('employer_profiles').select('id').eq('user_id', userId)
  const employerIds = (employerProfiles || []).map((e) => e.id)

  let roleIds = []
  if (employerIds.length > 0) {
    const { data: roles } = await supabase.from('roles').select('id').in('employer_id', employerIds)
    roleIds = (roles || []).map((r) => r.id)
  }

  await supabase.from('messages').delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)

  await supabase.from('profile_views').delete().eq('viewer_id', userId)
  if (candidateIds.length > 0) {
    await supabase.from('profile_views').delete().in('candidate_id', candidateIds)
  }

  if (candidateIds.length > 0) {
    await supabase.from('candidate_videos').delete().in('candidate_id', candidateIds)
    await supabase.from('applications').delete().in('candidate_id', candidateIds)
    await supabase.from('shortlists').delete().in('candidate_id', candidateIds)
  }

  if (roleIds.length > 0) {
    await supabase.from('applications').delete().in('role_id', roleIds)
  }
  if (employerIds.length > 0) {
    await supabase.from('shortlists').delete().in('employer_id', employerIds)
    await supabase.from('roles').delete().in('employer_id', employerIds)
  }

  await supabase.from('candidate_profiles').delete().eq('user_id', userId)
  await supabase.from('employer_profiles').delete().eq('user_id', userId)
  await supabase.from('users').delete().eq('id', userId)

  await deleteUserStorageFiles(supabase, userId)

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId)
  if (deleteAuthError) throw new Error(deleteAuthError.message)

  return { success: true }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  // Responses can carry a freshly generated TOTP secret or a session token.
  res.setHeader('Cache-Control', 'no-store')

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

  if (!process.env.ADMIN_PASSWORD) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'ADMIN_PASSWORD is not configured on the server' }))
    return
  }

  function fail(status, error) {
    res.statusCode = status
    res.end(JSON.stringify({ error }))
  }

  // --- Authentication actions: these run before any session exists. ---

  if (action === 'login') {
    if (!passwordIsValid(body.password)) return fail(401, 'Incorrect password')
    if (totpEnabled()) {
      const { token } = issueToken('pw', PENDING_TTL_MS)
      res.statusCode = 200
      res.end(JSON.stringify({ twoFactorRequired: true, pendingToken: token }))
      return
    }
    const { token, expiresAt } = issueToken('session', SESSION_TTL_MS)
    res.statusCode = 200
    res.end(JSON.stringify({ twoFactorRequired: false, token, expiresAt }))
    return
  }

  if (action === 'verify-2fa') {
    if (!verifyToken(body.pendingToken, 'pw')) {
      return fail(401, 'Your password check expired. Please enter your password again.')
    }
    if (!totpEnabled()) return fail(400, 'Two-factor authentication is not enabled')
    if (!totpCodeIsValid(process.env.ADMIN_TOTP_SECRET, body.code)) {
      return fail(401, 'Invalid code. Check your authenticator app and try again.')
    }
    const { token, expiresAt } = issueToken('session', SESSION_TTL_MS)
    res.statusCode = 200
    res.end(JSON.stringify({ token, expiresAt }))
    return
  }

  // One-time enrollment. The secret is generated here, shown once, and never
  // stored — the admin copies it into ADMIN_TOTP_SECRET themselves. Refused
  // outright once that variable exists, so this can't be used to replace a
  // live secret. Still needs the password so it isn't open to anyone who
  // finds the URL.
  if (action === 'setup-2fa') {
    if (!passwordIsValid(body.password)) return fail(401, 'Incorrect password')
    if (totpEnabled()) return fail(403, 'Two-factor authentication is already set up.')
    const secret = generateSecret()
    const otpauthUri = generateURI({ issuer: 'Mellow', label: 'Admin', secret })
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 260 })
    res.statusCode = 200
    res.end(JSON.stringify({ secret, otpauthUri, qrDataUrl }))
    return
  }

  // Lets the admin prove their authenticator app produces matching codes
  // *before* the secret goes live in Vercel — catching a bad scan while it
  // still can't lock them out.
  if (action === 'setup-2fa-verify') {
    if (!passwordIsValid(body.password)) return fail(401, 'Incorrect password')
    if (totpEnabled()) return fail(403, 'Two-factor authentication is already set up.')
    if (!totpCodeIsValid(body.secret, body.code)) {
      return fail(401, 'That code does not match. Check your authenticator app and try again.')
    }
    res.statusCode = 200
    res.end(JSON.stringify({ success: true }))
    return
  }

  // --- Everything else needs a live session token. ---

  const sessionToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!verifyToken(sessionToken, 'session')) {
    return fail(401, 'Session expired. Please sign in again.')
  }

  const supabase = getServiceClient()

  try {
    let result
    switch (action) {
      case 'stats':
        result = await getStats(supabase)
        break
      case 'candidates':
        result = await getCandidates(supabase)
        break
      case 'employers':
        result = await getEmployers(supabase)
        break
      case 'roles':
        result = await getRoles(supabase)
        break
      case 'close-role':
        result = await closeRole(supabase, body.roleId)
        break
      case 'delete-role':
        result = await deleteRole(supabase, body.roleId)
        break
      case 'applications':
        result = await getApplications(supabase)
        break
      case 'conversations':
        result = await getConversations(supabase)
        break
      case 'conversation-thread':
        result = await getConversationThread(supabase, body.userAId, body.userBId)
        break
      case 'activity':
        result = await getActivity(supabase)
        break
      case 'hires':
        result = await getHires(supabase)
        break
      case 'meetings':
        result = await getMeetings(supabase)
        break
      case 'toggle-live':
        result = await toggleLive(supabase, body.candidateId, body.isLive)
        break
      case 'toggle-employer-visibility':
        result = await toggleEmployerVisibility(supabase, body.employerId, body.isVisible)
        break
      case 'delete-user':
        result = await deleteUser(supabase, body.userId)
        break
      default:
        res.statusCode = 400
        res.end(JSON.stringify({ error: `Unknown action: ${action}` }))
        return
    }
    res.statusCode = 200
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
