import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import MessageThread from '../../components/MessageThread.jsx'

export default function EmployerMessages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('sent_at', { ascending: false })

      const otherIds = Array.from(
        new Set((messages || []).map((m) => (m.sender_id === user.id ? m.recipient_id : m.sender_id))),
      )

      if (otherIds.length === 0) {
        setConversations([])
        setLoading(false)
        return
      }

      const { data: candidates } = await supabase
        .from('candidate_profiles')
        .select('id, user_id, full_name')
        .in('user_id', otherIds)

      const infoByUserId = Object.fromEntries(
        (candidates || []).map((c) => [c.user_id, { name: c.full_name, candidateId: c.id }]),
      )

      const convos = otherIds.map((otherId) => {
        const lastMessage = messages.find((m) => m.sender_id === otherId || m.recipient_id === otherId)
        return {
          otherId,
          label: infoByUserId[otherId]?.name || 'Candidate',
          candidateId: infoByUserId[otherId]?.candidateId,
          lastBody: lastMessage?.body,
        }
      })

      setConversations(convos)
      setLoading(false)
    }

    load()
  }, [user])

  if (loading) return null

  return (
    <div className="section">
      <h1 style={{ fontSize: 28 }}>Messages</h1>

      {conversations.length === 0 ? (
        <p style={{ marginTop: 24, color: 'var(--color-text-muted)' }}>
          No messages yet — contact a candidate from their profile to start a conversation.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 32, marginTop: 28, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
            {conversations.map((c) => (
              <button
                key={c.otherId}
                type="button"
                onClick={() => setSelected(c.otherId)}
                className="card"
                style={{
                  textAlign: 'left',
                  padding: 14,
                  cursor: 'pointer',
                  border: selected === c.otherId ? '1.5px solid var(--color-primary)' : undefined,
                  background: '#fff',
                }}
              >
                <p style={{ fontWeight: 700, fontSize: 14 }}>{c.label}</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.lastBody}
                </p>
              </button>
            ))}
          </div>

          <div className="card" style={{ flex: 1, padding: 24, maxWidth: 480 }}>
            {selected ? (
              <>
                <MessageThread
                  otherUserId={selected}
                  otherUserLabel={conversations.find((c) => c.otherId === selected)?.label}
                />
                {conversations.find((c) => c.otherId === selected)?.candidateId && (
                  <Link
                    to={`/profile/${conversations.find((c) => c.otherId === selected).candidateId}`}
                    style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}
                  >
                    View profile →
                  </Link>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Select a conversation to view messages.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
