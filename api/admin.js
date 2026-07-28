// Vercel serverless function. Runs server-side only — the service role key
// and admin password never reach the browser. Every request re-validates
// the password before touching the database.

import { createClient } from '@supabase/supabase-js'

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
        'id, user_id, full_name, job_title, location, bio, skills, languages, intro_video_url, is_live, created_at, users(email, created_at)',
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
      .select('id, user_id, company_name, created_at, users(email, created_at)')
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
    companyName: e.company_name,
    email: e.users?.email || null,
    dateJoined: e.users?.created_at || e.created_at,
    rolesPosted: roleCounts[e.id] || 0,
    messagesSent: messageCounts[e.user_id] || 0,
  }))
}

async function getRoles(supabase) {
  const roles = unwrap(
    await supabase
      .from('roles')
      .select('id, title, is_active, created_at, employer_profiles(company_name)')
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
    company: r.employer_profiles?.company_name || null,
    datePosted: r.created_at,
    isActive: r.is_active,
    applicationCount: counts[r.id] || 0,
  }))
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

async function toggleLive(supabase, candidateId, isLive) {
  if (!candidateId || typeof isLive !== 'boolean') {
    throw new Error('candidateId and isLive (boolean) are required')
  }
  const data = unwrap(
    await supabase.from('candidate_profiles').update({ is_live: isLive }).eq('id', candidateId).select().single(),
  )
  return { success: true, isLive: data.is_live }
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

  const { password, action } = body

  if (!process.env.ADMIN_PASSWORD) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'ADMIN_PASSWORD is not configured on the server' }))
    return
  }

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Incorrect password' }))
    return
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
      case 'activity':
        result = await getActivity(supabase)
        break
      case 'toggle-live':
        result = await toggleLive(supabase, body.candidateId, body.isLive)
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
