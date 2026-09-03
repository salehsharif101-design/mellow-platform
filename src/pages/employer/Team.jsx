import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { notify } from '../../lib/notify.js'
import { getCachedPage, setCachedPage } from '../../lib/dashboardCache.js'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import ListPageSkeleton from '../../components/ListPageSkeleton.jsx'

const STATUS_STYLE = {
  active: { background: '#e3f9e9', color: '#0f7a3d' },
  invited: { background: '#fff6e0', color: '#8a6100' },
}

const MAX_TEAM_MEMBERS = 5

export default function Team() {
  const { user } = useAuth()

  const cacheKey = user ? `team:${user.id}` : null
  const cached = cacheKey ? getCachedPage(cacheKey) : null

  const [employerId, setEmployerId] = useState(cached?.employerId ?? null)
  const [isOwner, setIsOwner] = useState(cached?.isOwner ?? false)
  const [ownerEmail, setOwnerEmail] = useState(cached?.ownerEmail ?? '')
  const [members, setMembers] = useState(cached?.members ?? [])
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [removingMember, setRemovingMember] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function load() {
    const { employerId: resolvedId, isOwner: ownerFlag } = await resolveEmployerId(user.id)
    if (!resolvedId) {
      setLoading(false)
      return
    }
    setEmployerId(resolvedId)
    setIsOwner(ownerFlag)

    // Neither query depends on the other's result — both only need
    // resolvedId — so they go out together instead of one after another.
    const [employerResult, membersResult] = await Promise.all([
      supabase.from('employer_profiles').select('user_id').eq('id', resolvedId).maybeSingle(),
      ownerFlag
        ? supabase
            .from('employer_team_members')
            .select('id, invited_email, status, created_at')
            .eq('employer_id', resolvedId)
            // A removed member's row is kept forever as a tombstone (status
            // 'removed', user_id set null — see migration 0046) so the login
            // page can still recognize and block that email even after the
            // auth account itself is gone. Without this filter it was still
            // being fetched here and, since nothing but 'active' renders as
            // "Active", falling into the "Invited" label — indistinguishable
            // from a real pending invite, making a removed member look like
            // they'd come back after a refresh.
            .neq('status', 'removed')
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])

    let email = ''
    if (employerResult.data?.user_id) {
      const { data: ownerUser } = await supabase.from('users').select('email').eq('id', employerResult.data.user_id).maybeSingle()
      email = ownerUser?.email || ''
      setOwnerEmail(email)
    }

    let memberRows = []
    if (ownerFlag) {
      if (membersResult.error) setError(membersResult.error.message)
      else {
        memberRows = membersResult.data || []
        setMembers(memberRows)
      }
    }

    setLoading(false)

    if (cacheKey) {
      setCachedPage(cacheKey, { employerId: resolvedId, isOwner: ownerFlag, ownerEmail: email, members: memberRows })
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    setInviteError('')
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return

    if (members.length >= MAX_TEAM_MEMBERS) {
      setInviteError(`You have reached the maximum of ${MAX_TEAM_MEMBERS} team members.`)
      return
    }

    setInviting(true)
    try {
      // Team invites can only go to emails with no existing Mellow account
      // at all — reuses the same lookup the signup form uses to catch
      // duplicate emails, so this doesn't create a second way to check
      // whether an email is registered.
      const checkRes = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const checkData = await checkRes.json()
      if (checkRes.ok && checkData.exists) {
        setInviteError('This email is already registered on Mellow. Please use a different email address to invite a team member.')
        return
      }

      const { data, error: insertError } = await supabase
        .from('employer_team_members')
        .insert({ employer_id: employerId, invited_email: email, invited_by: user.id })
        .select()
        .single()
      if (insertError) {
        setInviteError(
          insertError.code === '23505' ? 'This email has already been invited.' : insertError.message,
        )
        return
      }
      notify('team-invite', { teamMemberId: data.id })
      setMembers((prev) => [...prev, data])
      setInviteEmail('')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove() {
    if (!removingMember) return
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const res = await fetch('/api/team-remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ teamMemberId: removingMember.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Failed to remove team member.')
    setMembers((prev) => prev.filter((m) => m.id !== removingMember.id))
    setRemovingMember(null)
  }

  if (loading) return <ListPageSkeleton titleWidth={100} rows={3} />

  if (!employerId) {
    return (
      <div className="section">
        <p>Finish setting up your company profile first.</p>
      </div>
    )
  }

  return (
    <div className="section">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28 }}>Team</h1>
        <p style={{ marginTop: 8, color: 'var(--color-text-muted)', fontSize: 15 }}>
          {isOwner
            ? 'Invite teammates to help manage applications, message candidates, shortlist, and post roles. Only you can invite or remove team members and edit the company profile.'
            : "You're a team member on this account. Only the account owner can invite or remove team members and edit the company profile."}
        </p>

        {error && <p className="form-error" style={{ marginTop: 16 }}>{error}</p>}

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            className="card"
            style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
          >
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{ownerEmail || 'Account owner'}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Owner</p>
            </div>
          </div>

          {isOwner &&
            members.map((m) => (
              <div
                key={m.id}
                className="card"
                style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
              >
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{m.invited_email}</p>
                  <span
                    className="tag"
                    style={{ marginTop: 4, display: 'inline-block', fontSize: 11, fontWeight: 700, ...STATUS_STYLE[m.status] }}
                  >
                    {m.status === 'active' ? 'Active' : 'Invited'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRemovingMember(m)}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: '#d92d20', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            ))}
        </div>

        {isOwner && (
          <>
            {members.length >= MAX_TEAM_MEMBERS ? (
              <p style={{ marginTop: 28, fontSize: 14, color: 'var(--color-text-muted)' }}>
                You have reached the maximum of {MAX_TEAM_MEMBERS} team members.
              </p>
            ) : (
              <form onSubmit={handleInvite} style={{ marginTop: 28, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="invite-email">Invite a team member by email</label>
                  <input
                    id="invite-email"
                    className="input"
                    type="email"
                    required
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  {inviteError && <p className="form-error" style={{ marginTop: 6 }}>{inviteError}</p>}
                </div>
                <button className="btn btn-primary" type="submit" disabled={inviting} style={{ marginTop: 24 }}>
                  {inviting ? 'Sending…' : 'Invite'}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {removingMember && (
        <ConfirmModal
          title="Remove team member?"
          message={`${removingMember.invited_email} will lose access to this company account.`}
          confirmLabel="Remove"
          onClose={() => setRemovingMember(null)}
          onConfirm={handleRemove}
        />
      )}
    </div>
  )
}
