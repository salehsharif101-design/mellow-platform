import { useEffect, useState } from 'react'
import { callAdminApi, clearStoredPassword, getStoredPassword, storePassword } from './adminApi.js'
import OverviewStats from './OverviewStats.jsx'
import CandidatesTable from './CandidatesTable.jsx'
import EmployersTable from './EmployersTable.jsx'
import RolesTable from './RolesTable.jsx'
import ActivityFeed from './ActivityFeed.jsx'

const TABS = ['Overview', 'Candidates', 'Employers', 'Roles', 'Activity']

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [authenticating, setAuthenticating] = useState(false)

  const [activeTab, setActiveTab] = useState('Overview')
  const [stats, setStats] = useState(null)
  const [candidates, setCandidates] = useState(null)
  const [employers, setEmployers] = useState(null)
  const [roles, setRoles] = useState(null)
  const [activity, setActivity] = useState(null)
  const [loadError, setLoadError] = useState('')

  // If a password is already stashed in this tab's sessionStorage, verify it
  // still works before trusting it (server re-validates on every call anyway).
  useEffect(() => {
    const stored = getStoredPassword()
    if (!stored) {
      setCheckingSession(false)
      return
    }
    callAdminApi('stats')
      .then((data) => {
        setStats(data)
        setAuthenticated(true)
      })
      .catch(() => {
        clearStoredPassword()
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
      if (tab === 'Activity' && !activity) setActivity(await callAdminApi('activity'))
    } catch (err) {
      setLoadError(err.message)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setAuthenticating(true)
    setAuthError('')
    storePassword(passwordInput)
    try {
      const data = await callAdminApi('stats')
      setStats(data)
      setAuthenticated(true)
    } catch (err) {
      clearStoredPassword()
      setAuthError(err.status === 401 ? 'Incorrect password.' : err.message)
    } finally {
      setAuthenticating(false)
    }
  }

  function handleLogOut() {
    clearStoredPassword()
    setAuthenticated(false)
    setStats(null)
    setCandidates(null)
    setEmployers(null)
    setRoles(null)
    setActivity(null)
    setPasswordInput('')
  }

  if (checkingSession) return null

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
        {activeTab === 'Roles' && (roles ? <RolesTable roles={roles} /> : <p>Loading…</p>)}
        {activeTab === 'Activity' && (activity ? <ActivityFeed events={activity} /> : <p>Loading…</p>)}
      </div>
    </div>
  )
}
