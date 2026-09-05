// "Reviewing" and "Shortlisted" are ordinary role_pipeline_stages rows, just
// like any employer-added custom stage — renamable, reorderable, deletable.
// Only "New" (status 'applied') and "Rejected" stay truly fixed and never
// become rows at all (see RoleApplicants.jsx).
//
// A couple of other features still need to know which row IS "the"
// Reviewing/Shortlisted stage for a role even after it's been renamed: the
// application's own status enum ('reviewing' / 'shortlisted', which drives
// the separate shortlists-table sync, candidate-facing status labels, and
// the weekly digest cron's query), and the Manage Stages panel's badge
// coloring. Rather than a schema change (a "which builtin is this" column),
// each role's two seed stages get a fixed id derived from the role's own
// id — the first 20 hex chars of the role id, plus a constant suffix. That
// makes a row recognizable as "the Reviewing/Shortlisted stage for role X"
// by id alone, computable identically in the browser or a one-off script,
// with no round-trip needed to find out.
function builtinId(roleId, suffixHex) {
  const hex = roleId.replace(/-/g, '')
  const combined = hex.slice(0, 20) + suffixHex
  return `${combined.slice(0, 8)}-${combined.slice(8, 12)}-${combined.slice(12, 16)}-${combined.slice(16, 20)}-${combined.slice(20, 32)}`
}

export function reviewingStageId(roleId) {
  return builtinId(roleId, 'aaaaaaaaaaaa')
}

export function shortlistedStageId(roleId) {
  return builtinId(roleId, 'bbbbbbbbbbbb')
}

// A permanent, never-rendered row marking "this role's builtin stages have
// already been seeded" — see ensureBuiltinStages below for why this can't
// just be "does a Reviewing/Shortlisted row exist," and always filtered out
// of every list this module hands back.
function seedMarkerId(roleId) {
  return builtinId(roleId, 'ffffffffffff')
}

function withoutSeedMarker(stages, roleId) {
  const markerId = seedMarkerId(roleId)
  return stages.filter((s) => s.id !== markerId)
}

// The applications.status a candidate should have while sitting in `stage`.
// Custom stages have always layered on top of 'reviewing' rather than
// replacing it (a stage is never itself a status), so anything that isn't
// specifically the builtin Shortlisted row maps to 'reviewing'.
export function statusForStage(stage, roleId) {
  if (stage.id === shortlistedStageId(roleId)) return 'shortlisted'
  return 'reviewing'
}

export const STATUS_LABELS = { applied: 'New', reviewing: 'Reviewing', shortlisted: 'Shortlisted', rejected: 'Rejected' }
export const STATUS_COLORS = {
  applied: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  reviewing: { background: '#fff6e0', color: '#8a6100' },
  shortlisted: { background: '#e3f9e9', color: '#0f7a3d' },
  rejected: { background: '#fdeceb', color: '#d92d20' },
}
export const CUSTOM_STAGE_COLOR = { background: '#f1e8fd', color: '#6b21a8' }

export function stageBadgeColor(stage, roleId) {
  if (stage.id === reviewingStageId(roleId)) return STATUS_COLORS.reviewing
  if (stage.id === shortlistedStageId(roleId)) return STATUS_COLORS.shortlisted
  return CUSTOM_STAGE_COLOR
}

// Makes sure a role has its two seed stages before the Manage Stages panel
// or the status dropdown renders — needed for any role that existed before
// this generalization, or was otherwise never seeded.
//
// This can only ever run ONCE per role, ever — not "once per row missing."
// An effect re-run triggered by something unrelated (a token refresh that
// hands AuthContext a new user object reference, a remount, a second tab)
// would otherwise see a deliberately-deleted Reviewing/Shortlisted row as
// indistinguishable from "never seeded" and silently recreate it, undoing
// the employer's own delete. The seed marker row is the fix: it's inserted
// once, alongside the two builtins, and never deleted by anything — so
// "has this role been seeded" no longer depends on whether either builtin
// row still exists. It's never surfaced: every path in and out of this
// function filters it out before returning.
export async function ensureBuiltinStages(supabase, roleId, rawStages) {
  const markerId = seedMarkerId(roleId)
  if (rawStages.some((s) => s.id === markerId)) return withoutSeedMarker(rawStages, roleId)

  const basePosition = rawStages.length > 0 ? Math.max(...rawStages.map((s) => s.position)) + 1 : 0
  const { error } = await supabase.from('role_pipeline_stages').insert([
    { id: reviewingStageId(roleId), role_id: roleId, name: STATUS_LABELS.reviewing, position: basePosition },
    { id: shortlistedStageId(roleId), role_id: roleId, name: STATUS_LABELS.shortlisted, position: basePosition + 1 },
    { id: markerId, role_id: roleId, name: '', position: -1 },
  ])

  if (error) {
    // Most likely a concurrent load already seeded this role — trust
    // what's actually in the database over this insert's own (all-or-
    // nothing, so possibly entirely unapplied) view of it.
    const { data: fresh } = await supabase
      .from('role_pipeline_stages')
      .select('id, name, position')
      .eq('role_id', roleId)
      .order('position', { ascending: true })
    return withoutSeedMarker(fresh || rawStages, roleId)
  }

  return [
    ...rawStages,
    { id: reviewingStageId(roleId), name: STATUS_LABELS.reviewing, position: basePosition },
    { id: shortlistedStageId(roleId), name: STATUS_LABELS.shortlisted, position: basePosition + 1 },
  ]
}

// Applications that predate this generalization sit at status 'reviewing'
// or 'shortlisted' with custom_stage_id left null (there was no row to
// point at yet). Left alone, a rename of the builtin stage would never
// reach them — they'd keep showing the old hardcoded "Reviewing" /
// "Shortlisted" label forever. Points them at the builtin row so a rename
// reaches every candidate in that bucket, not just ones moved after the
// seed — but only if that builtin row is actually still there: `stages`
// is the post-ensureBuiltinStages list, so its absence here means the
// employer has since deleted that stage, and custom_stage_id pointing at
// a row that doesn't exist would violate its own foreign key.
export async function backfillBuiltinStageIds(supabase, roleId, apps, stages) {
  const reviewingId = reviewingStageId(roleId)
  const shortlistedId = shortlistedStageId(roleId)
  const needsReviewing =
    stages.some((s) => s.id === reviewingId) && apps.some((a) => a.status === 'reviewing' && !a.custom_stage_id)
  const needsShortlisted =
    stages.some((s) => s.id === shortlistedId) && apps.some((a) => a.status === 'shortlisted' && !a.custom_stage_id)

  if (needsReviewing) {
    await supabase
      .from('applications')
      .update({ custom_stage_id: reviewingId })
      .eq('role_id', roleId)
      .eq('status', 'reviewing')
      .is('custom_stage_id', null)
  }
  if (needsShortlisted) {
    await supabase
      .from('applications')
      .update({ custom_stage_id: shortlistedId })
      .eq('role_id', roleId)
      .eq('status', 'shortlisted')
      .is('custom_stage_id', null)
  }
  if (!needsReviewing && !needsShortlisted) return apps

  return apps.map((a) => {
    if (a.status === 'reviewing' && !a.custom_stage_id) return { ...a, custom_stage_id: reviewingId }
    if (a.status === 'shortlisted' && !a.custom_stage_id) return { ...a, custom_stage_id: shortlistedId }
    return a
  })
}
