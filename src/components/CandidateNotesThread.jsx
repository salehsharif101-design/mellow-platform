import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { formatRelativeTime } from '../lib/roleFormat.js'

// Append-only note thread: every post is its own row (migration 0058),
// nothing is ever edited or overwritten, and the whole team sees every
// teammate's posts. author_email is denormalized on each row at post time
// rather than resolved via a join, since RLS only ever lets a user read
// their own public.users row — a teammate couldn't otherwise learn who
// posted someone else's note.
export default function CandidateNotesThread({ employerId, candidateId, roleId, userId, userEmail, notes, onPosted }) {
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  async function post() {
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    const { data, error } = await supabase
      .from('candidate_notes')
      .insert({
        employer_id: employerId,
        candidate_id: candidateId,
        role_id: roleId,
        author_id: userId,
        author_email: userEmail,
        body,
      })
      .select()
      .single()
    setPosting(false)
    if (error) return
    setDraft('')
    onPosted?.(data)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      post()
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <textarea
          className="input"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a private note for your team… (Enter to post)"
          style={{ fontSize: 13, resize: 'vertical' }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={post}
          disabled={posting || !draft.trim()}
          style={{ padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}
        >
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>

      {notes.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>No notes yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600 }}>{n.author_email}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatRelativeTime(n.created_at)}</span>
              </div>
              <p style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
