import { supabase } from './supabase.js'
import { reviewingStageId, shortlistedStageId } from './pipelineStages.js'

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

  // custom_stage_id has to move in step with status, or a candidate who was
  // sitting in a renamed custom/builtin stage would keep showing that
  // stage's old label on the applicant card after this changes their status
  // out from under it. Only set it if the target builtin row actually
  // exists yet for this role (RoleApplicants.jsx seeds it lazily on load) —
  // otherwise leave it null rather than pointing at a row that isn't there.
  let customStageId = null
  if (status === 'reviewing' || status === 'shortlisted') {
    const targetId = status === 'reviewing' ? reviewingStageId(roleId) : shortlistedStageId(roleId)
    const { data: stage } = await supabase.from('role_pipeline_stages').select('id').eq('id', targetId).maybeSingle()
    customStageId = stage?.id ?? null
  }

  await supabase
    .from('applications')
    .update({ status, custom_stage_id: customStageId })
    .eq('role_id', roleId)
    .eq('candidate_id', candidateId)
}
