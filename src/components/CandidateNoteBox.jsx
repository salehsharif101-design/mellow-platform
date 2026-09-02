import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { formatRelativeTime } from '../lib/roleFormat.js'

const SAVE_DELAY = 1200

// Private per-employer, per-candidate, per-role note on an applicant card.
// Auto-saves on a pause in typing (no save button) via upsert on
// candidate_notes' (employer_id, candidate_id, role_id) unique key — a
// DB trigger turns each save into a "note added"/"note edited" activity log
// entry, so this component only needs to own the debounce and the textarea.
export default function CandidateNoteBox({ employerId, candidateId, roleId, userId, initialBody, initialUpdatedAt }) {
  const [body, setBody] = useState(initialBody || '')
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt || null)
  const [saving, setSaving] = useState(false)
  const timeoutRef = useRef(null)
  const latestBodyRef = useRef(body)

  useEffect(() => {
    latestBodyRef.current = body
  }, [body])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  async function save(value) {
    setSaving(true)
    const { data, error } = await supabase
      .from('candidate_notes')
      .upsert(
        { employer_id: employerId, candidate_id: candidateId, role_id: roleId, body: value, updated_by: userId },
        { onConflict: 'employer_id,candidate_id,role_id' },
      )
      .select('updated_at')
      .single()
    // Only trust this response if nothing has been typed since the save
    // kicked off — otherwise a slow request could overwrite a newer
    // "Last edited" timestamp with a stale one.
    if (!error && latestBodyRef.current === value) {
      setUpdatedAt(data.updated_at)
    }
    setSaving(false)
  }

  function handleChange(e) {
    const value = e.target.value
    setBody(value)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => save(value), SAVE_DELAY)
  }

  return (
    <div>
      <textarea
        className="input"
        rows={3}
        value={body}
        onChange={handleChange}
        placeholder="Private note — only your team can see this…"
        style={{ fontSize: 13, resize: 'vertical' }}
      />
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
        {saving ? 'Saving…' : updatedAt ? `Last edited ${formatRelativeTime(updatedAt)}` : 'Not saved yet'}
      </p>
    </div>
  )
}
