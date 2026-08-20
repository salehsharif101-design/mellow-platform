import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { supabase } from '../lib/supabase.js'
import { notify } from '../lib/notify.js'

// `myIds` lets a shared company inbox (multiple team members) see and mark
// read the same conversation regardless of which teammate a past message
// was sent to/from — defaults to just the current user for the normal
// one-person-per-account case (candidates, or an employer with no team).
export default function MessageThread({ otherUserId, otherUserLabel, myIds }) {
  const { user } = useAuth()
  const { refresh: refreshNotifications } = useNotifications()
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const myIdList = myIds && myIds.length > 0 ? myIds : user ? [user.id] : []
  const myIdKey = myIdList.join(',')

  useEffect(() => {
    if (!user || !otherUserId || myIdList.length === 0) return

    async function load() {
      const filters = myIdList
        .map((id) => `and(sender_id.eq.${id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${id})`)
        .join(',')
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .or(filters)
        .order('sent_at', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setMessages(data)
      setLoading(false)

      const unreadIds = data.filter((m) => myIdList.includes(m.recipient_id) && !m.read_at).map((m) => m.id)
      if (unreadIds.length > 0) {
        await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
        refreshNotifications()
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, otherUserId, refreshNotifications, myIdKey])

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
          const fromMe = myIdList.includes(m.sender_id)
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
