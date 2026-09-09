import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { getCachedPage, setCachedPage } from '../../lib/dashboardCache.js'
import { formatRelativeTime } from '../../lib/roleFormat.js'
import MessageThread from '../../components/MessageThread.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import MessagesSkeleton from '../../components/MessagesSkeleton.jsx'
import CompanyAvatar from '../../components/CompanyAvatar.jsx'
import UnreadDot from '../../components/UnreadDot.jsx'

const POLL_MS = 30000

export default function CandidateMessages() {
  const { user } = useAuth()

  const cacheKey = user ? `candidate-messages:${user.id}` : null
  const cached = cacheKey ? getCachedPage(cacheKey) : null

  const [conversations, setConversations] = useState(cached?.conversations ?? [])
  const [selected, setSelected] = useState(null)
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)

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
        if (cacheKey) setCachedPage(cacheKey, { conversations: [] })
        return
      }

      // A message's other party is whichever individual sent/received it —
      // the owner (employer_profiles.user_id directly) or any team member,
      // active or removed. Messages always display the *company's*
      // identity, never the individual team member's, so every otherId
      // needs to resolve back to one employer_profiles row either way.
      // employer_team_members isn't otherwise readable by a candidate (its
      // invite_token/invited_email columns are sensitive, so there's no
      // broad RLS policy on it like employer_profiles has) — this RPC is
      // the narrow, security-definer path built for exactly this lookup;
      // see migration 0065.
      const { data: teamMatches } = await supabase.rpc('employer_ids_for_team_users', { uids: otherIds })
      const employerIdByOtherId = Object.fromEntries(
        (teamMatches || []).filter((m) => m.matched_user_id).map((m) => [m.matched_user_id, m.employer_id]),
      )
      const teamEmployerIds = Array.from(new Set(Object.values(employerIdByOtherId)))

      const { data: employers } = await supabase
        .from('employer_profiles')
        .select('id, user_id, company_name, logo_url, company_slug')
        .or(
          [`user_id.in.(${otherIds.join(',')})`, teamEmployerIds.length > 0 ? `id.in.(${teamEmployerIds.join(',')})` : null]
            .filter(Boolean)
            .join(','),
        )

      const employerByEmployerId = Object.fromEntries((employers || []).map((e) => [e.id, e]))
      const infoByUserId = {}
      ;(employers || []).forEach((e) => {
        infoByUserId[e.user_id] = { name: e.company_name, logoUrl: e.logo_url, companySlug: e.company_slug }
      })
      otherIds.forEach((otherId) => {
        if (infoByUserId[otherId]) return
        const employer = employerByEmployerId[employerIdByOtherId[otherId]]
        if (employer) infoByUserId[otherId] = { name: employer.company_name, logoUrl: employer.logo_url, companySlug: employer.company_slug }
      })

      const convos = otherIds.map((otherId) => {
        const lastMessage = messages.find((m) => m.sender_id === otherId || m.recipient_id === otherId)
        const info = infoByUserId[otherId]
        const unread = messages.some((m) => m.sender_id === otherId && m.recipient_id === user.id && !m.read_at)
        return {
          otherId,
          label: info?.name || 'Employer',
          logoUrl: info?.logoUrl || null,
          profileUrl: info?.companySlug ? `/company/${info.companySlug}` : null,
          lastBody: lastMessage?.body,
          lastAt: lastMessage?.sent_at,
          unread,
        }
      })

      setConversations(convos)
      setLoading(false)

      if (cacheKey) setCachedPage(cacheKey, { conversations: convos })
    }

    load()
    // The nav's own unread badge polls on this interval — without a
    // matching poll here, this page could sit open on a stale
    // conversation list while that badge ticks up.
    const interval = setInterval(load, POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function selectConversation(otherId) {
    setSelected(otherId)
    // Opening a conversation is what triggers MessageThread to mark it
    // read server-side — reflect that here too, immediately, so switching
    // to a different conversation and back doesn't show the dot again
    // while waiting for the next poll to catch up.
    setConversations((prev) => prev.map((c) => (c.otherId === otherId ? { ...c, unread: false } : c)))
  }

  if (loading) return <MessagesSkeleton />

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
            {conversations.map((c) => {
              // Marking read happens inside MessageThread once opened, but
              // that's an async DB write — selecting the conversation is
              // what should make the dot disappear right away rather than
              // waiting on that round trip.
              const showUnreadDot = c.unread && selected !== c.otherId
              const avatar = (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <CompanyAvatar logoUrl={c.logoUrl} companyName={c.label} size={36} />
                  {showUnreadDot && <UnreadDot label="Unread messages" />}
                </div>
              )
              return (
              <div
                key={c.otherId}
                onClick={() => selectConversation(c.otherId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    selectConversation(c.otherId)
                  }
                }}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {c.lastBody}
                  </p>
                  {c.lastAt && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                      {formatRelativeTime(c.lastAt)}
                    </span>
                  )}
                </div>
              </div>
              )
            })}
          </div>

          <div className="card" style={{ flex: 1, padding: 24, maxWidth: 480 }}>
            {selected ? (
              <MessageThread
                otherUserId={selected}
                otherUserLabel={conversations.find((c) => c.otherId === selected)?.label}
                otherAvatarUrl={conversations.find((c) => c.otherId === selected)?.logoUrl}
                otherAvatarType="company"
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
