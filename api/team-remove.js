// Vercel serverless function backing "Remove" on the Team page. Only the
// employer account owner can remove a team member — verified from the
// caller's own session token, never trusted from the request body.
//
// If the member had already accepted their invite (has a linked auth
// account), their access is revoked immediately by flipping their
// employer_team_members row to status 'removed' — every RLS policy that
// grants team access keys off status = 'active', so this alone locks them
// out of employer actions before the auth account is even touched. Their
// Supabase Auth account is then deleted entirely so the email is completely
// free for a fresh signup; that deletion cascades away the users row and
// this membership row along with it. If the auth deletion fails for some
// reason, the 'removed' row is left in place as a fallback marker — see
// Login.jsx, which checks for it and blocks sign-in with a clear message.
//
// A member who never accepted their invite (no linked auth account yet) has
// nothing to revoke or delete — their row is just removed outright.

import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
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

  const { teamMemberId } = body
  if (!teamMemberId) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Missing team member id' }))
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
  const callerId = userData.user.id

  const supabase = getServiceClient()

  try {
    const { data: member, error: memberError } = await supabase
      .from('employer_team_members')
      .select('id, employer_id, user_id')
      .eq('id', teamMemberId)
      .maybeSingle()
    if (memberError) throw new Error(memberError.message)
    if (!member) {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'Team member not found.' }))
      return
    }

    const { data: employer, error: employerError } = await supabase
      .from('employer_profiles')
      .select('id')
      .eq('id', member.employer_id)
      .eq('user_id', callerId)
      .maybeSingle()
    if (employerError) throw new Error(employerError.message)
    if (!employer) {
      res.statusCode = 403
      res.end(JSON.stringify({ error: 'Only the account owner can remove team members.' }))
      return
    }

    if (!member.user_id) {
      const { error: deleteError } = await supabase.from('employer_team_members').delete().eq('id', member.id)
      if (deleteError) throw new Error(deleteError.message)
      res.statusCode = 200
      res.end(JSON.stringify({ success: true }))
      return
    }

    const { error: statusError } = await supabase
      .from('employer_team_members')
      .update({ status: 'removed' })
      .eq('id', member.id)
    if (statusError) throw new Error(statusError.message)

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(member.user_id)
    if (deleteAuthError) {
      res.statusCode = 200
      res.end(JSON.stringify({ success: true, authDeleted: false }))
      return
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, authDeleted: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
