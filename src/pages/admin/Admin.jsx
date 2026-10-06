import { useEffect, useState } from 'react'
import { adminLogin, adminVerifyCode, callAdminApi, clearStoredSession, getStoredSession, storeSession } from './adminApi.js'
import OverviewStats from './OverviewStats.jsx'
import CandidatesTable from './CandidatesTable.jsx'
import EmployersTable from './EmployersTable.jsx'
import RolesTable from './RolesTable.jsx'
import ApplicationsTable from './ApplicationsTable.jsx'
import ConversationsTable from './ConversationsTable.jsx'
import ActivityFeed from './ActivityFeed.jsx'
import HiresTable from './HiresTable.jsx'
import MeetingsTable from './MeetingsTable.jsx'
import PageLoading from '../../components/PageLoading.jsx'

const TABS = ['Overview', 'Candidates', 'Employers', 'Roles', 'Applications', 'Messages', 'Activity', 'Hires', 'Meetings']

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [authenticating, setAuthenticating] = useState(false)
  // Set once the password step passes and 2FA is on; its presence is what
  // switches the login form to the code screen.
  const [pendingToken, setPendingToken] = useState(null)
  const [codeInput, setCodeInput] = useState('')

  const [activeTab, setActiveTab] = useState('Overview')
  const [stats, setStats] = useState(null)
  const [candidates, setCandidates] = useState(null)
  const [employers, setEmployers] = useState(null)
  const [roles, setRoles] = useState(null)
  const [applications, setApplications] = useState(null)
  const [conversations, setConversations] = useState(null)
  const [activity, setActivity] = useState(null)
  const [hires, setHires] = useState(null)
  const [meetings, setMeetings] = useState(null)
  const [loadError, setLoadError] = useState('')

  // If a session token from an earlier visit is still stored, verify it
  // still works before trusting it (server re-validates on every call anyway).
  useEffect(() => {
    if (!getStoredSession()) {
      setCheckingSession(false)
      return
    }
    callAdminApi('stats')
      .then((data) => {
        setStats(data)
        setAuthenticated(true)
      })
      .catch(() => {
        clearStoredSession()
      })
      .finally(() => setCheckingSession(false))
  }, [])

  useEffect(() => {
    if (!authenticated) return
    loadTab(activeTab)
  }, [authenticated, activeTab])

  async function loadTab(tab) {
    setLoadError('')
    try {
      if (tab === 'Overview' && !stats) setStats(await callAdminApi('stats'))
      if (tab === 'Candidates' && !candidates) setCandidates(await callAdminApi('candidates'))
      if (tab === 'Employers' && !employers) setEmployers(await callAdminApi('employers'))
      if (tab === 'Roles' && !roles) setRoles(await callAdminApi('roles'))
      if (tab === 'Applications' && !applications) setApplications(await callAdminApi('applications'))
      if (tab === 'Messages' && !conversations) setConversations(await callAdminApi('conversations'))
      if (tab === 'Activity' && !activity) setActivity(await callAdminApi('activity'))
      if (tab === 'Hires' && !hires) setHires(await callAdminApi('hires'))
      if (tab === 'Meetings' && !meetings) setMeetings(await callAdminApi('meetings'))
    } catch (err) {
      // The 24-hour session ran out (or was invalidated by a secret/password
      // change) mid-visit — back to the login screen rather than a raw error.
      if (err.status === 401) {
        handleLogOut()
        setAuthError(err.message)
        return
      }
      setLoadError(err.message)
    }
  }

  async function finishLogin(session) {
    storeSession(session)
    const data = await callAdminApi('stats')
    setStats(data)
    setAuthenticated(true)
    setPasswordInput('')
    setCodeInput('')
    setPendingToken(null)
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setAuthenticating(true)
    setAuthError('')
    try {
      const result = await adminLogin(passwordInput)
      if (result.twoFactorRequired) {
        setPendingToken(result.pendingToken)
        // The password has done its job; don't keep it around in state.
        setPasswordInput('')
      } else {
        await finishLogin(result)
      }
    } catch (err) {
      clearStoredSession()
      setAuthError(err.status === 401 ? 'Incorrect password.' : err.message)
    } finally {
      setAuthenticating(false)
    }
  }

  async function handleCodeSubmit(e) {
    e.preventDefault()
    setAuthenticating(true)
    setAuthError('')
    try {
      const session = await adminVerifyCode(pendingToken, codeInput)
      await finishLogin(session)
    } catch (err) {
      setCodeInput('')
      // An expired password step can't be retried with another code — start over.
      if (err.status === 401 && /expired/i.test(err.message)) {
        setPendingToken(null)
      }
      setAuthError(err.message)
    } finally {
      setAuthenticating(false)
    }
  }

  function handleBackToPassword() {
    setPendingToken(null)
    setCodeInput('')
    setAuthError('')
  }

  function handleLogOut() {
    clearStoredSession()
    setPendingToken(null)
    setCodeInput('')
    setAuthenticated(false)
    setStats(null)
    setCandidates(null)
    setEmployers(null)
    setRoles(null)
    setApplications(null)
    setConversations(null)
    setActivity(null)
    setHires(null)
    setMeetings(null)
    setPasswordInput('')
  }

  if (checkingSession) return <PageLoading />

  if (!authenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg)',
          padding: 20,
        }}
      >
        {pendingToken ? (
          <form
            onSubmit={handleCodeSubmit}
            className="card"
            style={{ padding: 32, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <h1 style={{ fontSize: 20 }}>Two-factor authentication</h1>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
              Enter the 6-digit code from your authenticator app.
            </p>
            <div className="field">
              <label htmlFor="admin-code">Authentication code</label>
              <input
                id="admin-code"
                className="input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                style={{ letterSpacing: 4, fontSize: 18 }}
                required
              />
            </div>
            {authError && <p className="form-error">{authError}</p>}
            <button className="btn btn-primary" type="submit" disabled={authenticating || codeInput.length !== 6}>
              {authenticating ? 'Checking…' : 'Verify'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleBackToPassword} disabled={authenticating}>
              Back
            </button>
          </form>
        ) : (
          <form
            onSubmit={handlePasswordSubmit}
            className="card"
            style={{ padding: 32, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <h1 style={{ fontSize: 20 }}>Admin access</h1>
            <div className="field">
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                className="input"
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
              />
            </div>
            {authError && <p className="form-error">{authError}</p>}
            <button className="btn btn-primary" type="submit" disabled={authenticating}>
              {authenticating ? 'Checking…' : 'Enter'}
            </button>
          </form>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 26 }}>Admin dashboard</h1>
        <button className="btn btn-ghost" onClick={handleLogOut}>
          Log out
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24, borderBottom: '1.5px solid var(--color-border)', flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: 600,
              fontSize: 14,
              padding: '10px 4px',
              marginRight: 20,
              cursor: 'pointer',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        {loadError && <p className="form-error">{loadError}</p>}

        {activeTab === 'Overview' && (stats ? <OverviewStats stats={stats} /> : <p>Loading…</p>)}
        {activeTab === 'Candidates' && (candidates ? <CandidatesTable candidates={candidates} setCandidates={setCandidates} /> : <p>Loading…</p>)}
        {activeTab === 'Employers' && (employers ? <EmployersTable employers={employers} setEmployers={setEmployers} /> : <p>Loading…</p>)}
        {activeTab === 'Roles' && (roles ? <RolesTable roles={roles} setRoles={setRoles} /> : <p>Loading…</p>)}
        {activeTab === 'Applications' && (applications ? <ApplicationsTable applications={applications} /> : <p>Loading…</p>)}
        {activeTab === 'Messages' && (conversations ? <ConversationsTable conversations={conversations} /> : <p>Loading…</p>)}
        {activeTab === 'Activity' && (activity ? <ActivityFeed events={activity} /> : <p>Loading…</p>)}
        {activeTab === 'Hires' && (hires ? <HiresTable data={hires} /> : <p>Loading…</p>)}
        {activeTab === 'Meetings' && (meetings ? <MeetingsTable data={meetings} /> : <p>Loading…</p>)}
      </div>
    </div>
  )
}
