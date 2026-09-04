// Shared Supabase service-role helpers for serverless functions under api/.
// Prefixed-underscore directory so Vercel does not turn this into a route.

import { createClient } from '@supabase/supabase-js'

export function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export async function getCandidateContact(supabase, candidateId) {
  const candidate = unwrap(
    await supabase.from('candidate_profiles').select('user_id, username, full_name').eq('id', candidateId).single(),
  )
  const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())
  return { email: candidateUser.email, username: candidate.username, fullName: candidate.full_name }
}

export async function getEmployerContact(supabase, employerId) {
  const employer = unwrap(
    await supabase.from('employer_profiles').select('user_id, company_name').eq('id', employerId).single(),
  )
  const employerUser = unwrap(await supabase.from('users').select('email').eq('id', employer.user_id).single())
  return { email: employerUser.email, companyName: employer.company_name }
}

// Server-side equivalent of src/lib/employerAccess.js's getEmployerUserIds
// — that client-side file can't be imported here since it pulls in the
// browser Supabase client, which reads Vite-only env vars unavailable in
// this runtime. Resolves every user id who can act on behalf of this
// company: the owner plus every active team member.
export async function getEmployerUserIds(supabase, employerId) {
  const [ownerResult, membersResult] = await Promise.all([
    supabase.from('employer_profiles').select('user_id').eq('id', employerId).maybeSingle(),
    supabase.from('employer_team_members').select('user_id').eq('employer_id', employerId).eq('status', 'active'),
  ])
  const userIds = []
  if (ownerResult.data?.user_id) userIds.push(ownerResult.data.user_id)
  ;(membersResult.data || []).forEach((m) => {
    if (m.user_id) userIds.push(m.user_id)
  })
  return userIds
}

// Every email address for getEmployerUserIds' user ids — used wherever an
// employer-facing notification needs to reach the whole team, not just
// whichever single address a caller already had on hand.
export async function getEmployerEmails(supabase, employerId) {
  const userIds = await getEmployerUserIds(supabase, employerId)
  if (userIds.length === 0) return []
  const { data: users } = await supabase.from('users').select('email').in('id', userIds)
  return (users || []).map((u) => u.email).filter(Boolean)
}

// Deletes a user's Supabase Auth account, which cascades away their
// public.users row (see migration 0001) — used when removing a team member
// (api/team-remove.js) and, defensively, when check-email.js finds one
// still stuck. public.users.id cascades cleanly, but a couple of other
// tables reference it with no "on delete" behavior of their own
// (candidate_notes.author_id, candidate_activity_log.actor_user_id — see
// migrations 0057/0058), so deleteUser() fails outright with any of those
// still pointing at this user. Both are purely referential (never read back
// through a join — candidate_notes keeps its own denormalized author_email,
// and the activity log's detail text already has the author's email baked
// in), so clearing them first is safe and doesn't lose or corrupt anything
// visible.
export async function deleteAuthAccount(supabase, userId) {
  await supabase.from('candidate_notes').update({ author_id: null }).eq('author_id', userId)
  await supabase.from('candidate_activity_log').update({ actor_user_id: null }).eq('actor_user_id', userId)
  return supabase.auth.admin.deleteUser(userId)
}
