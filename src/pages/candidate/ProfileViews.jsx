import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatRelativeTime } from '../../lib/roleFormat.js'
import EmptyState from '../../components/EmptyState.jsx'

export default function ProfileViews() {
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

      const { data: views, error: viewsError } = await supabase
        .from('profile_views')
        .select('id, viewed_at, viewer_id')
        .eq('candidate_id', candidate.id)
        .order('viewed_at', { ascending: false })

      if (viewsError) {
        setError(viewsError.message)
        setLoading(false)
        return
      }

      const viewerIds = Array.from(new Set((views || []).map((v) => v.viewer_id).filter(Boolean)))
      if (viewerIds.length === 0) {
        setEntries([])
        setLoading(false)
        return
      }

      const { data: employers } = await supabase
        .from('employer_profiles')
        .select('user_id, company_name, logo_url, company_slug')
        .in('user_id', viewerIds)

      const employerByUserId = Object.fromEntries((employers || []).map((e) => [e.user_id, e]))

      setEntries((views || []).map((v) => ({ ...v, employer: employerByUserId[v.viewer_id] })))
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
      <h1 style={{ fontSize: 28 }}>Profile views</h1>

      {entries.length === 0 ? (
        <EmptyState
          heading="No profile views yet"
          body="Keep your profile strong and employers will find you."
          illustration="/Easy_stuff.png"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 28, maxWidth: 640 }}>
          {entries.map((entry) => {
            const employer = entry.employer
            if (!employer) return null
            return (
              <div key={entry.id} className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                {employer.logo_url ? (
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
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{employer.company_name}</p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Viewed {formatRelativeTime(entry.viewed_at)}
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
