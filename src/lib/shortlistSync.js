import { supabase } from './supabase.js'

// The reverse direction of RoleApplicants.jsx's own syncShortlist() (which
// pushes an application's status onto the shortlists table). Called when a
// shortlists row is removed, rejected, or restored from the Shortlist /
// Shortlist Review pages, so the matching per-role application doesn't
// disagree with it forever — which is exactly what fed a stale shortlisted
// count into the dashboard's role pipeline cards. Unconditional (not gated
// on the application's current status): a candidate moved back from
// rejected to shortlisted, for instance, has an application that's
// currently 'rejected', not 'shortlisted' — gating the update on the old
// status here would silently no-op exactly the case this exists to fix.
// Only when the shortlist entry is tied to a specific role — one
// shortlisted straight from the Talent Feed has no per-role application to
// update.
export async function syncApplicationStatus(roleId, candidateId, status) {
  if (!roleId || !candidateId) return
  await supabase.from('applications').update({ status }).eq('role_id', roleId).eq('candidate_id', candidateId)
}
