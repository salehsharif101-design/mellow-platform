import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import EmptyState from '../../components/EmptyState.jsx'

const STATUS_STYLES = {
  applied: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  shortlisted: { background: '#fff6e0', color: '#8a6100' },
  contacted: { background: '#eae5ff', color: '#5b3df0' },
  hired: { background: '#e3f9e9', color: '#0f7a3d' },
}

function StatusTag({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.applied
  return (
    <span className="tag" style={{ background: style.background, color: style.color, textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}

export default function Applications() {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        .select('id, status, applied_at, roles(title, employer_profiles(company_name))')
        .eq('candidate_id', candidate.id)
        .order('applied_at', { ascending: false })

      if (appsError) setError(appsError.message)
      else setApplications(data)

      setLoading(false)
    }

    load()
  }, [user])

  if (loading) return null

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
          />
          <p style={{ textAlign: 'center', marginTop: -20 }}>
            <Link to="/roles" style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}>
              Browse open roles →
            </Link>
          </p>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28, maxWidth: 640 }}>
          {applications.map((a) => (
            <div
              key={a.id}
              className="card"
              style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
            >
              <div>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{a.roles?.title}</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {a.roles?.employer_profiles?.company_name} · Applied {new Date(a.applied_at).toLocaleDateString()}
                </p>
              </div>
              <StatusTag status={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
