import { supabase } from './supabase.js'

// The reverse direction of RoleApplicants.jsx's own syncShortlist() (which
// pushes an application's status onto the shortlists table). Called when a
// shortlists row is removed or its status changed away from 'shortlisted'
// from the Shortlist / Shortlist Review pages, so the matching per-role
// application doesn't keep reading as "shortlisted" forever — which is
// exactly what fed a stale shortlisted count into the dashboard's role
// pipeline cards. Only ever touches an application that is CURRENTLY
// 'shortlisted', and only when the shortlist entry is tied to a specific
// role — one shortlisted straight from the Talent Feed has no per-role
// application to update.
export async function syncApplicationStatus(roleId, candidateId, status) {
  if (!roleId || !candidateId) return
  await supabase
    .from('applications')
    .update({ status })
    .eq('role_id', roleId)
    .eq('candidate_id', candidateId)
    .eq('status', 'shortlisted')
}
