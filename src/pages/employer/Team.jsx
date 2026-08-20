import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { notify } from '../../lib/notify.js'
import ConfirmModal from '../../components/ConfirmModal.jsx'

const STATUS_STYLE = {
  active: { background: '#e3f9e9', color: '#0f7a3d' },
  invited: { background: '#fff6e0', color: '#8a6100' },
}

const MAX_TEAM_MEMBERS = 5

export default function Team() {
  const { user } = useAuth()

  const [employerId, setEmployerId] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [removingMember, setRemovingMember] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setLoading(true)
    const { employerId: resolvedId, isOwner: ownerFlag } = await resolveEmployerId(user.id)
    if (!resolvedId) {
      setLoading(false)
      return
    }
    setEmployerId(resolvedId)
    setIsOwner(ownerFlag)

    const { data: employer } = await supabase
      .from('employer_profiles')
      .select('user_id')
      .eq('id', resolvedId)
      .maybeSingle()
    if (employer?.user_id) {
      const { data: ownerUser } = await supabase.from('users').select('email').eq('id', employer.user_id).maybeSingle()
      setOwnerEmail(ownerUser?.email || '')
    }

    if (ownerFlag) {
      const { data, error: membersError } = await supabase
        .from('employer_team_members')
        .select('id, invited_email, status, created_at')
        .eq('employer_id', resolvedId)
        .order('created_at', { ascending: true })
      if (membersError) setError(membersError.message)
      else setMembers(data || [])
    }

    setLoading(false)
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
    const { error: removeError } = await supabase.from('employer_team_members').delete().eq('id', removingMember.id)
    if (removeError) throw new Error(removeError.message)
    setMembers((prev) => prev.filter((m) => m.id !== removingMember.id))
    setRemovingMember(null)
  }

  if (loading) return null

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
