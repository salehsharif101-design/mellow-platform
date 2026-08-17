import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'

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
        .select(
          'id, candidate_id, status, candidate_profiles(id, user_id, username, full_name, job_title, current_company, location, skills, availability, years_of_experience, intro_video_url, avatar_url, education_level, field_of_study, institution_name, graduation_year, linkedin_url, calendly_url, website_url)',
        )
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>Shortlisted talent</h1>
        {entries.length > 0 && (
          <Link to="/employer/shortlist/review" className="btn btn-primary">
            Review candidates
          </Link>
        )}
      </div>

      {entries.length === 0 ? (
        <>
          <EmptyState
            heading="No shortlisted talent yet"
            body="Browse the talent feed and click Shortlist on any talent you want to save here."
            illustration="/Collaborate2.png"
          />
          <p style={{ textAlign: 'center', marginTop: -20 }}>
            <Link to="/employer/talent" style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}>
              Browse talent →
            </Link>
          </p>
        </>
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
                <div style={{ position: 'relative' }}>
                  <Link
                    to={`/profile/${c.username || c.id}`}
                    style={{ position: 'absolute', top: 10, left: 10, zIndex: 1, lineHeight: 0 }}
                  >
                    <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} />
                  </Link>
                  {c.intro_video_url ? (
                    <VideoPlayCard url={c.intro_video_url} />
                  ) : (
                    <div
                      style={{
                        aspectRatio: '9 / 16',
                        width: '100%',
                        maxWidth: 400,
                        margin: '0 auto',
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
                </div>

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
