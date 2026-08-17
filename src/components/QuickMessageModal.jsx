import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { notify } from '../lib/notify.js'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from './Modal.jsx'

export default function QuickMessageModal({ recipientUserId, recipientLabel, onClose, onSent }) {
  const { user } = useAuth()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setError('')
    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, recipient_id: recipientUserId, body: body.trim() })
      .select()
      .single()
    setSending(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    notify('message-notification', { messageId: data.id })
    setSent(true)
    onSent?.()
    setTimeout(onClose, 1200)
  }

  return (
    <Modal title={`Message ${recipientLabel || 'talent'}`} onClose={onClose} width={420}>
      {sent ? (
        <p style={{ fontSize: 14, fontWeight: 600, color: '#0f7a3d' }}>Message sent</p>
      ) : (
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            className="input"
            rows={3}
            autoFocus
            placeholder="Write a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={sending || !body.trim()} style={{ alignSelf: 'flex-start' }}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}
    </Modal>
  )
}
