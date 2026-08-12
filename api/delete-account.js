// Vercel serverless function. Permanently deletes the calling user's account
// and every row associated with it. Runs server-side only — the service
// role key never reaches the browser. The caller's identity is verified
// from their own session token (via the anon client), never trusted from
// the request body, so one user can never delete another's account.

import { createClient } from '@supabase/supabase-js'
import { deleteUserStorageFiles } from './_lib/storageCleanup.js'

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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Missing authorization token' }))
    return
  }

  const { data: userData, error: userError } = await getAnonClient().auth.getUser(token)
  if (userError || !userData?.user) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Invalid or expired session' }))
    return
  }
  const userId = userData.user.id

  const supabase = getServiceClient()

  try {
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

    res.statusCode = 200
    res.end(JSON.stringify({ success: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
