import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { getCandidateStatusLabel } from '../../lib/roleFormat.js'
import { getCachedPage, setCachedPage } from '../../lib/dashboardCache.js'
import EmptyState from '../../components/EmptyState.jsx'
import ListPageSkeleton from '../../components/ListPageSkeleton.jsx'

const STATUS_LABEL_STYLES = {
  Applied: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  'Under review': { background: '#fff6e0', color: '#8a6100' },
  Shortlisted: { background: '#e3f9e9', color: '#0f7a3d' },
  'Not selected': { background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)' },
}

function StatusTag({ status }) {
  const label = getCandidateStatusLabel(status)
  const style = STATUS_LABEL_STYLES[label]
  return (
    <span className="tag" style={{ background: style.background, color: style.color }}>
      {label}
    </span>
  )
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Only steps that have actually happened appear here — an unviewed
// profile or a status still sitting at "applied" simply isn't a step yet,
// rather than a step shown with a "Not yet" placeholder.
function Timeline({ application }) {
  const steps = [{ label: 'Applied', date: application.applied_at }]
  if (application.viewed_at) {
    steps.push({ label: 'Profile viewed by employer', date: application.viewed_at })
  }
  if (['reviewing', 'shortlisted', 'rejected'].includes(application.status) && application.status_changed_at) {
    steps.push({
      label: `Status update — ${getCandidateStatusLabel(application.status)}`,
      date: application.status_changed_at,
    })
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
      {steps.map((step, i) => (
        <div key={step.label} style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'var(--color-primary)',
              }}
            />
            {i < steps.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 24, background: 'var(--color-border)' }} />}
          </div>
          <div style={{ paddingBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{step.label}</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{formatDate(step.date)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Applications() {
  const { user } = useAuth()

  const cacheKey = user ? `applications:${user.id}` : null
  const cached = cacheKey ? getCachedPage(cacheKey) : null

  const [applications, setApplications] = useState(cached?.applications ?? [])
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set())

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: candidate, error: candidateError } = await supabase
        .from('candidate_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (candidateError) {
        setError(candidateError.message)
        setLoading(false)
        return
      }
      if (!candidate) {
        setLoading(false)
        return
      }

      const { data, error: appsError } = await supabase
        .from('applications')
        .select('id, status, applied_at, viewed_at, status_changed_at, roles(title, employer_profiles(company_name))')
        .eq('candidate_id', candidate.id)
        .order('applied_at', { ascending: false })

      if (appsError) {
        setError(appsError.message)
        setLoading(false)
        return
      }
      setApplications(data)
      setLoading(false)

      if (cacheKey) setCachedPage(cacheKey, { applications: data })
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <ListPageSkeleton titleWidth={220} rows={4} />

  if (error) {
    return (
      <div className="section">
        <p className="form-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="section">
      <h1 style={{ fontSize: 28 }}>Your applications</h1>

      {applications.length === 0 ? (
        <>
          <EmptyState
            heading="No applications yet"
            body="Browse open roles and apply with one tap. Your applications will appear here."
            illustration="/Your_Requested_Is_Posted.png"
          />
          <p style={{ textAlign: 'center', marginTop: -20 }}>
            <Link to="/roles" style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}>
              Browse open roles →
            </Link>
          </p>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28, maxWidth: 640 }}>
          {applications.map((a) => {
            const expanded = expandedIds.has(a.id)
            return (
              <div key={a.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{a.roles?.title}</p>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {a.roles?.employer_profiles?.company_name} · Applied {formatDate(a.applied_at)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <StatusTag status={a.status} />
                    <button
                      type="button"
                      onClick={() => toggleExpanded(a.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      {expanded ? 'Hide timeline' : 'View timeline'}
                    </button>
                  </div>
                </div>
                {expanded && <Timeline application={a} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
