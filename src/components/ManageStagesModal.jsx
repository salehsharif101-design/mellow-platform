import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Modal from './Modal.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import { STATUS_COLORS, statusForStage } from '../lib/pipelineStages.js'

// New and Rejected are the only two stages that are never rows in
// role_pipeline_stages — they're fixed, hardcoded here to render locked at
// the top/bottom, which is what keeps "New always first, Rejected always
// last" true without needing a column to enforce it. Everything else
// (Reviewing, Shortlisted, and any custom stage) is a regular row: freely
// renamable, reorderable, and deletable, rendered from `stages` below.
const FIXED_BEFORE = { label: 'New', color: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' } }
const FIXED_END = [{ label: 'Rejected', color: STATUS_COLORS.rejected }]

function FixedStageRow({ label, color }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--color-bg-soft)',
      }}
    >
      <span className="tag" style={{ fontSize: 12, ...color }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Locked</span>
    </div>
  )
}

export default function ManageStagesModal({ roleId, stages, applications, onClose, onStagesUpdated, onStageDeleted }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [deletingStage, setDeletingStage] = useState(null)
  const [error, setError] = useState('')

  const sorted = [...stages].sort((a, b) => a.position - b.position)

  function countInStage(stageId) {
    return applications.filter((a) => a.custom_stage_id === stageId).length
  }

  function startEditing(stage) {
    setError('')
    setEditingId(stage.id)
    setEditValue(stage.name)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditValue('')
  }

  async function commitRename(stage) {
    const trimmed = editValue.trim()
    setEditingId(null)
    if (!trimmed || trimmed === stage.name) return

    setError('')
    setSavingId(stage.id)
    const previous = stages
    onStagesUpdated(stages.map((s) => (s.id === stage.id ? { ...s, name: trimmed } : s)))

    const { error: updateError } = await supabase.from('role_pipeline_stages').update({ name: trimmed }).eq('id', stage.id)
    if (updateError) {
      onStagesUpdated(previous)
      setError('Could not rename that stage — please try again.')
    }
    setSavingId(null)
  }

  async function moveStage(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= sorted.length) return
    setError('')

    const current = sorted[index]
    const target = sorted[targetIndex]
    const previous = stages
    onStagesUpdated(
      stages.map((s) => {
        if (s.id === current.id) return { ...s, position: target.position }
        if (s.id === target.id) return { ...s, position: current.position }
        return s
      }),
    )

    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase.from('role_pipeline_stages').update({ position: target.position }).eq('id', current.id),
      supabase.from('role_pipeline_stages').update({ position: current.position }).eq('id', target.id),
    ])
    if (err1 || err2) {
      onStagesUpdated(previous)
      setError('Could not reorder stages — please try again.')
    }
  }

  // A deleted stage's candidates need somewhere to land — the nearest
  // remaining neighbor (preferring the one before it, since that reads as
  // "held back to the previous stage" rather than skipping ahead). There's
  // always at least one candidate: handleDeleteClick refuses to open the
  // confirm dialog when `stage` is the only one left.
  function destinationFor(stage) {
    const index = sorted.findIndex((s) => s.id === stage.id)
    return sorted[index - 1] || sorted[index + 1] || null
  }

  function handleDeleteClick(stage) {
    setError('')
    const destination = destinationFor(stage)
    if (!destination) {
      setError('You need at least one other stage between New and Rejected before you can delete this one.')
      return
    }
    setDeletingStage({ ...stage, count: countInStage(stage.id), destination })
  }

  async function confirmDelete() {
    const stage = deletingStage
    const destination = stage.destination
    if (stage.count > 0) {
      const destStatus = statusForStage(destination, roleId)
      const { error: moveError } = await supabase
        .from('applications')
        .update({ status: destStatus, custom_stage_id: destination.id })
        .eq('custom_stage_id', stage.id)
      if (moveError) throw new Error('Could not move candidates out of that stage — please try again.')
      onStageDeleted(stage.id, destination)
    }

    const { error: deleteError } = await supabase.from('role_pipeline_stages').delete().eq('id', stage.id)
    if (deleteError) throw new Error('Could not delete that stage — please try again.')

    onStagesUpdated(stages.filter((s) => s.id !== stage.id))
    setDeletingStage(null)
  }

  return (
    <>
      <Modal title="Manage pipeline stages" onClose={onClose} width={480}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          New and Rejected always stay first and last. Everything else — Reviewing, Shortlisted, and any custom
          stages — can be freely reordered, renamed, or removed.
        </p>

        {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <FixedStageRow {...FIXED_BEFORE} />

          {sorted.map((stage, index) => (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button
                  type="button"
                  onClick={() => moveStage(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${stage.name} up`}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 2,
                    cursor: index === 0 ? 'default' : 'pointer',
                    color: index === 0 ? 'var(--color-border)' : 'var(--color-text-muted)',
                    lineHeight: 1,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveStage(index, 1)}
                  disabled={index === sorted.length - 1}
                  aria-label={`Move ${stage.name} down`}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 2,
                    cursor: index === sorted.length - 1 ? 'default' : 'pointer',
                    color: index === sorted.length - 1 ? 'var(--color-border)' : 'var(--color-text-muted)',
                    lineHeight: 1,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === stage.id ? (
                  <input
                    autoFocus
                    className="input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitRename(stage)
                      } else if (e.key === 'Escape') {
                        cancelEditing()
                      }
                    }}
                    onBlur={() => commitRename(stage)}
                    style={{ padding: '6px 10px', fontSize: 14 }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(stage)}
                    disabled={savingId === stage.id}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '6px 4px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    {savingId === stage.id ? 'Saving…' : stage.name}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteClick(stage)}
                disabled={sorted.length <= 1}
                aria-label={`Delete ${stage.name}`}
                title={sorted.length <= 1 ? 'Keep at least one stage between New and Rejected' : 'Delete stage'}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: sorted.length <= 1 ? 'default' : 'pointer',
                  color: sorted.length <= 1 ? 'var(--color-border)' : '#d92d20',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}

          {FIXED_END.map((stage) => (
            <FixedStageRow key={stage.label} {...stage} />
          ))}
        </div>
      </Modal>

      {deletingStage && (
        <ConfirmModal
          title="Delete this stage?"
          message={
            deletingStage.count > 0
              ? `${deletingStage.count} candidate${deletingStage.count === 1 ? ' is' : 's are'} in this stage. They will be moved to "${deletingStage.destination.name}" if you delete it.`
              : `"${deletingStage.name}" has no candidates in it and can be safely deleted.`
          }
          confirmLabel="Delete"
          busyLabel="Deleting…"
          onClose={() => setDeletingStage(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}
