// Vercel serverless function backing the team invite accept flow.
// `lookup` is public (the invite token itself is the secret, like a
// password-reset link) and returns just enough to render the accept page.
// `accept` requires a valid session and only lets a user accept the invite
// addressed to their own verified email — never anyone else's.

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

  const { action, token } = body
  if (!token) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Missing invite token' }))
    return
  }

  const supabase = getServiceClient()

  try {
    if (action === 'lookup') {
      const { data: invite, error } = await supabase
        .from('employer_team_members')
        .select('invited_email, status, employer_profiles(company_name)')
        .eq('invite_token', token)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!invite) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'This invitation link is invalid.' }))
        return
      }

      res.statusCode = 200
      res.end(
        JSON.stringify({
          invitedEmail: invite.invited_email,
          companyName: invite.employer_profiles?.company_name || 'this company',
          status: invite.status,
        }),
      )
      return
    }

    if (action === 'accept') {
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

      const { data: invite, error: inviteError } = await supabase
        .from('employer_team_members')
        .select('id, invited_email, status')
        .eq('invite_token', token)
        .maybeSingle()

      if (inviteError) throw new Error(inviteError.message)
      if (!invite) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'This invitation link is invalid.' }))
        return
      }
      if (invite.status === 'active') {
        res.statusCode = 200
        res.end(JSON.stringify({ success: true, alreadyAccepted: true }))
        return
      }
      if (invite.invited_email.toLowerCase() !== (userData.user.email || '').toLowerCase()) {
        res.statusCode = 403
        res.end(JSON.stringify({ error: 'This invitation was sent to a different email address.' }))
        return
      }

      const { error: updateError } = await supabase
        .from('employer_team_members')
        .update({ user_id: userData.user.id, status: 'active', accepted_at: new Date().toISOString() })
        .eq('id', invite.id)

      if (updateError) throw new Error(updateError.message)

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
