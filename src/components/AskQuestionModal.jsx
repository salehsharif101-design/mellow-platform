import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { notify } from '../lib/notify.js'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from './Modal.jsx'
import { QUESTION_LIMIT, QUESTION_TEXT_MAX_LENGTH } from '../lib/videoQuestions.js'

// questionNumber is 1 or 2 — how many questions this candidate has already
// been asked for this role (from the caller's own count), plus one for the
// question being composed now. The caller is responsible for not rendering
// this at all once that count has already reached QUESTION_LIMIT.
export default function AskQuestionModal({ employerId, candidateId, roleId, candidateLabel, questionNumber, onClose, onSent }) {
  const { user } = useAuth()
  const [questionText, setQuestionText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = questionText.trim()
    if (!trimmed) return
    setSending(true)
    setError('')
    const { data, error: insertError } = await supabase
      .from('video_questions')
      .insert({ employer_id: employerId, candidate_id: candidateId, role_id: roleId, question_text: trimmed, asked_by: user.id })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      setSending(false)
      return
    }
    notify('question-asked', { questionId: data.id })
    onSent?.(data)
    onClose()
  }

  return (
    <Modal title={`Ask ${candidateLabel || 'this candidate'} a question`} onClose={onClose} width={440}>
      <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Send a video question and receive their recorded answer, right here on Mellow. This is question {questionNumber}{' '}
          of {QUESTION_LIMIT}.
        </p>
        <textarea
          className="input"
          rows={4}
          autoFocus
          placeholder="What would you like to ask?"
          value={questionText}
          maxLength={QUESTION_TEXT_MAX_LENGTH}
          onChange={(e) => setQuestionText(e.target.value)}
        />
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'right', marginTop: -6 }}>
          {questionText.length}/{QUESTION_TEXT_MAX_LENGTH}
        </p>
        {error && <p className="form-error">{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={sending || !questionText.trim()}>
            {sending ? 'Sending…' : 'Send question'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
