import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { supabase } from '../lib/supabase.js'
import { notify } from '../lib/notify.js'
import CandidateAvatar from './CandidateAvatar.jsx'
import CompanyAvatar from './CompanyAvatar.jsx'

// The composer grows with its text up to this height, then scrolls.
const COMPOSER_MAX_HEIGHT = 160

// `myIds` lets a shared company inbox (multiple team members) see and mark
// read the same conversation regardless of which teammate a past message
// was sent to/from — defaults to just the current user for the normal
// one-person-per-account case (candidates, or an employer with no team).
//
// `otherUserIds` is the same idea for the *other* side of the thread: a
// candidate's conversation with a company can span however many different
// team members have messaged them (owner, active teammates, removed ones —
// see migration 0065), and all of it needs to render as one continuous
// thread rather than splintering per sender. Falls back to the single
// `otherUserId` for callers where the other party really is just one
// person (the employer inbox, the public-profile contact modal).
// `otherUserId` itself is still what a new outgoing message is addressed
// to — callers with a multi-person other side should pass a permanent id
// there (e.g. the company owner) rather than whichever individual happens
// to be selected.
//
// `otherAvatarUrl`/`otherAvatarType`/`otherProfileUrl` are all optional —
// callers that don't pass them (e.g. the contact modal on a public profile)
// get the original avatar-less thread unchanged.
export default function MessageThread({
  otherUserId,
  otherUserIds,
  otherUserLabel,
  myIds,
  otherAvatarUrl,
  otherAvatarType = 'candidate',
  otherProfileUrl,
}) {
  const { user } = useAuth()
  const { refresh: refreshNotifications } = useNotifications()
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const composerRef = useRef(null)

  // Resize to fit the text, including shrinking back after a send. `loading`
  // is a dependency because the textarea only mounts once loading finishes.
  useLayoutEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    const borders = el.offsetHeight - el.clientHeight
    el.style.height = `${Math.min(el.scrollHeight + borders, COMPOSER_MAX_HEIGHT)}px`
  }, [body, loading])

  const myIdList = myIds && myIds.length > 0 ? myIds : user ? [user.id] : []
  const myIdKey = myIdList.join(',')
  const otherIdList = otherUserIds && otherUserIds.length > 0 ? otherUserIds : otherUserId ? [otherUserId] : []
  const otherIdKey = otherIdList.join(',')

  useEffect(() => {
    if (!user || otherIdList.length === 0 || myIdList.length === 0) return

    async function load() {
      const filters = myIdList
        .flatMap((mid) =>
          otherIdList.map(
            (oid) => `and(sender_id.eq.${mid},recipient_id.eq.${oid}),and(sender_id.eq.${oid},recipient_id.eq.${mid})`,
          ),
        )
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
  }, [user, otherIdKey, refreshNotifications, myIdKey])

  async function handleSend(e) {
    e.preventDefault()
    if (sending || !body.trim()) return
    // A message row needs exactly one recipient — otherUserId is that
    // fixed send target; otherIdList's first entry only covers a caller
    // that passed nothing else.
    const recipientId = otherUserId || otherIdList[0]
    if (!recipientId) return
    setSending(true)
    setError('')
    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, recipient_id: recipientId, body: body.trim() })
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

  // Enter alone is left to the textarea (new line); Ctrl+Enter, or Cmd+Enter
  // on a Mac, sends.
  function handleComposerKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(e)
  }

  // Lighter than PageLoading — this sits inside an already-rendered panel
  // (the conversation list is already on screen around it), not a whole
  // blank page, so a smaller inline spinner fits better than the full-page
  // 80px padding.
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
        <div className="spinner" role="status" aria-label="Loading" />
      </div>
    )
  }

  const AvatarComponent = otherAvatarType === 'company' ? CompanyAvatar : CandidateAvatar
  const avatarProps =
    otherAvatarType === 'company' ? { logoUrl: otherAvatarUrl, companyName: otherUserLabel } : { avatarUrl: otherAvatarUrl, fullName: otherUserLabel }

  const headerContent = otherUserLabel && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {(otherAvatarUrl !== undefined || otherProfileUrl) && <AvatarComponent {...avatarProps} size={36} />}
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Conversation with {otherUserLabel}</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {otherProfileUrl ? (
        <Link to={otherProfileUrl} style={{ textDecoration: 'none', color: 'inherit', width: 'fit-content' }}>
          {headerContent}
        </Link>
      ) : (
        headerContent
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
          // A shared team inbox means a message can come from three
          // places: the current user, a teammate on the same account, or
          // the other party. Only the first counts as "from me" — a
          // teammate's own message is a colleague's words, not this
          // viewer's, and rendering it identically to "me" (as a plain
          // myIdList.includes() check did before) misattributed it.
          const fromMe = user && m.sender_id === user.id
          const fromTeammate = !fromMe && myIdList.includes(m.sender_id)
          const showAvatar = !fromMe && !fromTeammate && (otherAvatarUrl !== undefined || otherProfileUrl)
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: fromMe ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                alignSelf: fromMe ? 'flex-end' : 'flex-start',
              }}
            >
              {fromTeammate && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                  Teammate
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: fromMe ? 'row-reverse' : 'row' }}>
                {showAvatar && <AvatarComponent {...avatarProps} size={26} style={{ border: 'none', boxShadow: 'none' }} />}
                <div
                  style={{
                    background: fromMe ? 'var(--color-primary)' : fromTeammate ? '#eef1f6' : 'var(--color-bg-soft)',
                    color: fromMe ? '#fff' : 'var(--color-text)',
                    borderRadius: 12,
                    padding: '8px 14px',
                    fontSize: 14,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {m.body}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <textarea
          ref={composerRef}
          className="input"
          rows={1}
          placeholder="Write a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          style={{ resize: 'none', lineHeight: '20px' }}
        />
        {/* Matches the one-line composer height, and stays at the bottom as it grows. */}
        <button className="btn btn-primary" type="submit" disabled={sending || !body.trim()} style={{ minHeight: 47 }}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
