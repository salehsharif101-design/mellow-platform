import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'

export default function Shortlist() {
  const { user } = useAuth()
  const [employerId, setEmployerId] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: employer, error: employerError } = await supabase
        .from('employer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (employerError) {
        setError(employerError.message)
        setLoading(false)
        return
      }
      if (!employer) {
        setLoading(false)
        return
      }
      setEmployerId(employer.id)

      const { data, error: shortlistError } = await supabase
        .from('shortlists')
        .select('id, candidate_id, candidate_profiles(id, username, full_name, job_title, location, skills, intro_video_url)')
        .eq('employer_id', employer.id)
        .order('created_at', { ascending: false })

      if (shortlistError) setError(shortlistError.message)
      else setEntries(data)

      setLoading(false)
    }

    load()
  }, [user])

  async function remove(shortlistId) {
    setRemovingId(shortlistId)
    const { error: removeError } = await supabase.from('shortlists').delete().eq('id', shortlistId)
    if (!removeError) {
      setEntries((prev) => prev.filter((e) => e.id !== shortlistId))
    }
    setRemovingId(null)
  }

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
      <h1 style={{ fontSize: 28 }}>Shortlisted candidates</h1>

      {entries.length === 0 ? (
        <p style={{ marginTop: 24, color: 'var(--color-text-muted)' }}>
          You haven't shortlisted anyone yet. <Link to="/employer/talent">Browse talent →</Link>
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
            marginTop: 28,
          }}
        >
          {entries.map((entry) => {
            const c = entry.candidate_profiles
            if (!c) return null
            return (
              <div key={entry.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {c.intro_video_url ? (
                  <VideoPlayCard url={c.intro_video_url} style={{ aspectRatio: '4 / 3' }} />
                ) : (
                  <div
                    style={{
                      aspectRatio: '4 / 3',
                      background: 'var(--color-bg-soft)',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text-muted)',
                      fontSize: 13,
                    }}
                  >
                    No video yet
                  </div>
                )}

                <div>
                  <Link to={`/profile/${c.username || c.id}`} style={{ textDecoration: 'none' }}>
                    <h3 style={{ fontSize: 17 }}>{c.full_name}</h3>
                  </Link>
                  <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {c.job_title} · {c.location}
                  </p>
                </div>

                {c.skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {c.skills.map((s) => (
                      <span key={s} className="tag" style={{ fontSize: 12 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <Link to={`/profile/${c.username || c.id}`} className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>
                    View profile
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={removingId === entry.id}
                    onClick={() => remove(entry.id)}
                  >
                    {removingId === entry.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
