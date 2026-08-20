import { supabase } from './supabase.js'

// Resolves which employer_profiles row a user can act on behalf of — either
// because they own it, or because they're an active invited team member.
// Every employer page should resolve "my employer" through this instead of
// querying employer_profiles by user_id directly, so team members land on
// the same company account as the owner.
export async function resolveEmployerId(userId) {
  const { data: owned } = await supabase.from('employer_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (owned) return { employerId: owned.id, isOwner: true }

  const { data: membership } = await supabase
    .from('employer_team_members')
    .select('employer_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (membership) return { employerId: membership.employer_id, isOwner: false }

  return { employerId: null, isOwner: false }
}

// All auth user ids who can act as this company — the owner plus every
// active team member. Used wherever "messages to/from this company" needs
// to cover the whole team's inbox, not just whichever person is logged in.
export async function getEmployerUserIds(employerId) {
  const [ownerResult, membersResult] = await Promise.all([
    supabase.from('employer_profiles').select('user_id').eq('id', employerId).maybeSingle(),
    supabase.from('employer_team_members').select('user_id').eq('employer_id', employerId).eq('status', 'active'),
  ])
  const ids = []
  if (ownerResult.data?.user_id) ids.push(ownerResult.data.user_id)
  ;(membersResult.data || []).forEach((m) => {
    if (m.user_id) ids.push(m.user_id)
  })
  return ids
}
