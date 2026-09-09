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
// active team member. For anything that grants current access or reaches
// out to someone (permission checks, notification emails) — a removed
// member should never appear here. For "messages to/from this company",
// use getEmployerMessageUserIds below instead: a removed member's past
// messages still need to surface for everyone else, which this
// active-only list would silently drop.
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

// Every user id who has ever sent or received a message on behalf of this
// company — the owner, every active team member, and every removed one
// too. Messages are business records that belong to the company, not the
// individual who happened to type them, so a removed team member's
// messages must stay visible in the shared inbox permanently (see
// migration 0064 and api/team-remove.js). removed_user_id is what makes
// that possible even after the member's own user_id column goes null on
// full account deletion — it is a permanent copy of that id, written once
// at removal time, that survives exactly for this purpose.
export async function getEmployerMessageUserIds(employerId) {
  const [ownerResult, membersResult] = await Promise.all([
    supabase.from('employer_profiles').select('user_id').eq('id', employerId).maybeSingle(),
    supabase.from('employer_team_members').select('user_id, removed_user_id').eq('employer_id', employerId),
  ])
  const ids = []
  if (ownerResult.data?.user_id) ids.push(ownerResult.data.user_id)
  ;(membersResult.data || []).forEach((m) => {
    if (m.user_id) ids.push(m.user_id)
    if (m.removed_user_id) ids.push(m.removed_user_id)
  })
  return ids
}
