import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId, getEmployerUserIds } from '../../lib/employerAccess.js'
import MessageThread from '../../components/MessageThread.jsx'
import EmptyState from '../../components/EmptyState.jsx'

export default function EmployerMessages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myIds, setMyIds] = useState([])

  useEffect(() => {
    if (!user) return

    async function load() {
      // The inbox is shared across the whole team — a candidate's
      // conversation with "the company" isn't tied to whichever teammate
      // happens to be logged in.
      const { employerId } = await resolveEmployerId(user.id)
      const ids = employerId ? await getEmployerUserIds(employerId) : [user.id]
      setMyIds(ids)

      const orFilter = ids.map((id) => `sender_id.eq.${id},recipient_id.eq.${id}`).join(',')
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(orFilter)
        .order('sent_at', { ascending: false })

      const otherIds = Array.from(
        new Set((messages || []).map((m) => (ids.includes(m.sender_id) ? m.recipient_id : m.sender_id))),
      )

      if (otherIds.length === 0) {
        setConversations([])
        setLoading(false)
        return
      }

      const { data: candidates } = await supabase
        .from('candidate_profiles')
        .select('id, user_id, username, full_name')
        .in('user_id', otherIds)

      const infoByUserId = Object.fromEntries(
        (candidates || []).map((c) => [c.user_id, { name: c.full_name, candidateId: c.username || c.id }]),
      )

      const convos = otherIds.map((otherId) => {
        const lastMessage = messages.find((m) => m.sender_id === otherId || m.recipient_id === otherId)
        return {
          otherId,
          label: infoByUserId[otherId]?.name || 'Talent',
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
        <EmptyState
          heading="No messages yet"
          body="Start a conversation by visiting a talent profile and clicking Contact."
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
              <>
                <MessageThread
                  otherUserId={selected}
                  otherUserLabel={conversations.find((c) => c.otherId === selected)?.label}
                  myIds={myIds}
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
