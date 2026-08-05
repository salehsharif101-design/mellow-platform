import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { notify } from '../lib/notify.js'

export default function MessageThread({ otherUserId, otherUserLabel }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !otherUserId) return

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`,
        )
        .order('sent_at', { ascending: true })

      if (fetchError) setError(fetchError.message)
      else setMessages(data)
      setLoading(false)
    }

    load()
  }, [user, otherUserId])

  async function handleSend(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setError('')
    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, recipient_id: otherUserId, body: body.trim() })
      .select()
      .single()
    if (sendError) {
      setError(sendError.message)
    } else {
      setMessages((prev) => [...prev, data])
      setBody('')
      notify('message-notification', { messageId: data.id })
    }
    setSending(false)
  }

  if (loading) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {otherUserLabel && (
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Conversation with {otherUserLabel}</p>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 320,
          overflowY: 'auto',
          padding: messages.length ? '4px 4px' : 0,
        }}
      >
        {messages.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>No messages yet — say hello.</p>
        )}
        {messages.map((m) => {
          const fromMe = m.sender_id === user.id
          return (
            <div
              key={m.id}
              style={{
                alignSelf: fromMe ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                background: fromMe ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                color: fromMe ? '#fff' : 'var(--color-text)',
                borderRadius: 12,
                padding: '8px 14px',
                fontSize: 14,
              }}
            >
              {m.body}
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
        <input
          className="input"
          placeholder="Write a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
