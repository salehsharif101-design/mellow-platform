import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const FIXED_STAGE_STYLE = { background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)', width: 'fit-content' }

// New/Reviewing/Shortlisted/Rejected aren't rows in role_pipeline_stages at
// all (see migration 0056) — they're rendered here as plain fixed labels,
// which is what makes them structurally impossible to delete or reorder.
// Only the custom stages in between are backed by real rows, saved
// immediately on every add/rename/reorder/remove rather than gated behind
// the modal's own "Save changes" button, since they're a separate concern
// from the role's own fields.
export default function PipelineStagesEditor({ roleId }) {
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('role_pipeline_stages')
        .select('id, name, position')
        .eq('role_id', roleId)
        .order('position', { ascending: true })
      if (!cancelled) {
        setStages(data || [])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [roleId])

  async function addStage() {
    const nextPosition = stages.length > 0 ? Math.max(...stages.map((s) => s.position)) + 1 : 0
    const { data, error } = await supabase
      .from('role_pipeline_stages')
      .insert({ role_id: roleId, name: 'New stage', position: nextPosition })
      .select('id, name, position')
      .single()
    if (!error) setStages((prev) => [...prev, data])
  }

  function handleRenameLocal(id, name) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  async function persistRename(id, name) {
    const trimmed = name.trim() || 'Untitled stage'
    setSavingId(id)
    await supabase.from('role_pipeline_stages').update({ name: trimmed }).eq('id', id)
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)))
    setSavingId(null)
  }

  async function removeStage(id) {
    setStages((prev) => prev.filter((s) => s.id !== id))
    await supabase.from('role_pipeline_stages').delete().eq('id', id)
  }

  async function moveStage(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= stages.length) return
    const a = stages[index]
    const b = stages[targetIndex]
    const aPos = a.position
    const bPos = b.position
    setStages((prev) => {
      const next = [...prev]
      next[index] = { ...b, position: bPos }
      next[targetIndex] = { ...a, position: aPos }
      return next
    })
    await Promise.all([
      supabase.from('role_pipeline_stages').update({ position: bPos }).eq('id', a.id),
      supabase.from('role_pipeline_stages').update({ position: aPos }).eq('id', b.id),
    ])
  }

  return (
    <div className="field">
      <label>Pipeline stages</label>
      <p style={{ marginTop: 2, marginBottom: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
        New, Reviewing, Shortlisted, and Rejected always exist. Add your own stages in between — they'll show up
        in the status dropdown on this role's applicant cards.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="tag" style={FIXED_STAGE_STYLE}>
          New
        </div>
        <div className="tag" style={FIXED_STAGE_STYLE}>
          Reviewing
        </div>

        {!loading &&
          stages.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 16 }}>
              <input
                className="input"
                value={s.name}
                onChange={(e) => handleRenameLocal(s.id, e.target.value)}
                onBlur={(e) => persistRename(s.id, e.target.value)}
                style={{ fontSize: 13, padding: '6px 10px' }}
                disabled={savingId === s.id}
              />
              <button
                type="button"
                onClick={() => moveStage(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${s.name} up`}
                style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: 14 }}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStage(i, 1)}
                disabled={i === stages.length - 1}
                aria-label={`Move ${s.name} down`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: i === stages.length - 1 ? 'default' : 'pointer',
                  opacity: i === stages.length - 1 ? 0.3 : 1,
                  fontSize: 14,
                }}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeStage(s.id)}
                aria-label={`Remove ${s.name}`}
                style={{ background: 'none', border: 'none', color: '#d92d20', cursor: 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}

        <button
          type="button"
          className="btn btn-ghost"
          onClick={addStage}
          style={{ alignSelf: 'flex-start', fontSize: 13, padding: '6px 12px', marginTop: 2, marginLeft: 16 }}
        >
          + Add stage
        </button>

        <div className="tag" style={FIXED_STAGE_STYLE}>
          Shortlisted
        </div>
        <div className="tag" style={FIXED_STAGE_STYLE}>
          Rejected
        </div>
      </div>
    </div>
  )
}
