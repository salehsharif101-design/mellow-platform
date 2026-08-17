import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import MessageThread from '../../components/MessageThread.jsx'
import EmptyState from '../../components/EmptyState.jsx'

export default function CandidateMessages() {
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

      const { data: employers } = await supabase
        .from('employer_profiles')
        .select('user_id, company_name')
        .in('user_id', otherIds)

      const nameByUserId = Object.fromEntries((employers || []).map((e) => [e.user_id, e.company_name]))

      const convos = otherIds.map((otherId) => {
        const lastMessage = messages.find((m) => m.sender_id === otherId || m.recipient_id === otherId)
        return {
          otherId,
          label: nameByUserId[otherId] || 'Employer',
          lastBody: lastMessage?.body,
          lastAt: lastMessage?.sent_at,
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
        <EmptyState
          heading="No messages yet"
          body="When an employer reaches out, their message will appear here."
          illustration="/connection.png"
        />
      ) : (
        <div className="messages-layout" style={{ display: 'flex', gap: 32, marginTop: 28, alignItems: 'flex-start' }}>
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
              <MessageThread
                otherUserId={selected}
                otherUserLabel={conversations.find((c) => c.otherId === selected)?.label}
              />
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Select a conversation to view messages.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
