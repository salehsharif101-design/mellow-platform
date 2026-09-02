import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId, getEmployerUserIds } from '../../lib/employerAccess.js'
import { getCachedPage, setCachedPage } from '../../lib/dashboardCache.js'
import MessageThread from '../../components/MessageThread.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import MessagesSkeleton from '../../components/MessagesSkeleton.jsx'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import UnreadDot from '../../components/UnreadDot.jsx'

export default function EmployerMessages() {
  const { user } = useAuth()

  const cacheKey = user ? `employer-messages:${user.id}` : null
  const cached = cacheKey ? getCachedPage(cacheKey) : null

  const [conversations, setConversations] = useState(cached?.conversations ?? [])
  const [selected, setSelected] = useState(null)
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)
  const [myIds, setMyIds] = useState(cached?.myIds ?? [])

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
        if (cacheKey) setCachedPage(cacheKey, { conversations: [], myIds: ids })
        return
      }

      const { data: candidates } = await supabase
        .from('candidate_profiles')
        .select('id, user_id, username, full_name, avatar_url')
        .in('user_id', otherIds)

      const infoByUserId = Object.fromEntries(
        (candidates || []).map((c) => [c.user_id, { name: c.full_name, candidateId: c.username || c.id, avatarUrl: c.avatar_url }]),
      )

      const convos = otherIds.map((otherId) => {
        const lastMessage = messages.find((m) => m.sender_id === otherId || m.recipient_id === otherId)
        const info = infoByUserId[otherId]
        const unread = messages.some((m) => m.sender_id === otherId && ids.includes(m.recipient_id) && !m.read_at)
        return {
          otherId,
          label: info?.name || 'Talent',
          candidateId: info?.candidateId,
          avatarUrl: info?.avatarUrl || null,
          profileUrl: info?.candidateId ? `/profile/${info.candidateId}` : null,
          lastBody: lastMessage?.body,
          unread,
        }
      })

      setConversations(convos)
      setLoading(false)

      if (cacheKey) setCachedPage(cacheKey, { conversations: convos, myIds: ids })
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (loading) return <MessagesSkeleton />

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
            {conversations.map((c) => {
              // Marking read happens inside MessageThread once opened, but
              // that's an async DB write — selecting the conversation is
              // what should make the dot disappear right away rather than
              // waiting on that round trip.
              const showUnreadDot = c.unread && selected !== c.otherId
              const avatar = (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <CandidateAvatar avatarUrl={c.avatarUrl} fullName={c.label} size={36} />
                  {showUnreadDot && <UnreadDot label="Unread messages" />}
                </div>
              )
              return (
              <div
                key={c.otherId}
                onClick={() => setSelected(c.otherId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(c.otherId)}
                className="card"
                style={{
                  textAlign: 'left',
                  padding: 14,
                  cursor: 'pointer',
                  border: selected === c.otherId ? '1.5px solid var(--color-primary)' : undefined,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {c.profileUrl ? (
                    <Link
                      to={c.profileUrl}
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', minWidth: 0 }}
                    >
                      {avatar}
                      <p style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</p>
                    </Link>
                  ) : (
                    <>
                      {avatar}
                      <p style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</p>
                    </>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.lastBody}
                </p>
              </div>
              )
            })}
          </div>

          <div className="card" style={{ flex: 1, padding: 24, maxWidth: 480 }}>
            {selected ? (
              <MessageThread
                otherUserId={selected}
                otherUserLabel={conversations.find((c) => c.otherId === selected)?.label}
                myIds={myIds}
                otherAvatarUrl={conversations.find((c) => c.otherId === selected)?.avatarUrl}
                otherAvatarType="candidate"
                otherProfileUrl={conversations.find((c) => c.otherId === selected)?.profileUrl}
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
