import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatRelativeTime } from '../../lib/roleFormat.js'
import EmptyState from '../../components/EmptyState.jsx'

export default function Shortlisted() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
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

      const { data, error: shortlistError } = await supabase
        .from('shortlists')
        .select('id, created_at, employer_profiles(company_name, logo_url, company_slug)')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false })

      if (shortlistError) setError(shortlistError.message)
      else setEntries(data || [])

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
      <h1 style={{ fontSize: 28 }}>Shortlisted by employers</h1>

      {entries.length === 0 ? (
        <EmptyState
          heading="No shortlists yet"
          body="Keep your profile strong and employers will take notice."
          illustration="/Collaborate2.png"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 28, maxWidth: 640 }}>
          {entries.map((entry) => {
            const employer = entry.employer_profiles
            if (!employer) return null
            return (
              <div key={entry.id} className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                {(() => {
                  const logo = employer.logo_url ? (
                    <img
                      src={employer.logo_url}
                      alt=""
                      style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: 'var(--color-bg-soft)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-primary)',
                        fontWeight: 700,
                      }}
                    >
                      {employer.company_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )
                  return employer.company_slug ? (
                    <Link to={`/company/${employer.company_slug}`} style={{ flexShrink: 0, lineHeight: 0 }}>
                      {logo}
                    </Link>
                  ) : (
                    logo
                  )
                })()}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{employer.company_name}</p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Shortlisted {formatRelativeTime(entry.created_at)}
                  </p>
                </div>
                {employer.company_slug && (
                  <Link to={`/company/${employer.company_slug}`} className="btn btn-ghost" style={{ flexShrink: 0 }}>
                    View company
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
