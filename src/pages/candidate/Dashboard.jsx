import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'

const COMPLETENESS_FIELDS = ['full_name', 'job_title', 'location', 'bio', 'intro_video_url']

export default function CandidateDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const [views, setViews] = useState(null) // null = unavailable, [] = none yet
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: candidate } = await supabase
        .from('candidate_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!candidate) {
        setLoading(false)
        return
      }
      setProfile(candidate)

      const { data: apps } = await supabase
        .from('applications')
        .select('id, status, applied_at, roles(title, employer_profiles(company_name))')
        .eq('candidate_id', candidate.id)
        .order('applied_at', { ascending: false })
      setApplications(apps || [])

      const { data: viewRows, error: viewsError } = await supabase
        .from('profile_views')
        .select('viewed_at, viewer_id')
        .eq('candidate_id', candidate.id)
        .order('viewed_at', { ascending: false })
      if (!viewsError) setViews(viewRows)

      setLoading(false)
    }

    load()
  }, [user])

  if (loading) return null

  if (!profile) {
    return (
      <div className="section">
        <p>
          You haven't started your profile yet. <Link to="/profile/edit">Start now →</Link>
        </p>
      </div>
    )
  }

  const filledCount = COMPLETENESS_FIELDS.filter((f) => Boolean(profile[f])).length
  const hasSkills = profile.skills?.length > 0
  const hasLanguages = profile.languages?.length > 0
  const totalChecks = COMPLETENESS_FIELDS.length + 2
  const completeness = Math.round(((filledCount + hasSkills + hasLanguages) / totalChecks) * 100)

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>Your dashboard</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/profile/edit" className="btn btn-primary">
            Edit profile
          </Link>
          <Link to={`/profile/${profile.username || profile.id}`} className="btn btn-ghost">
            View my public profile
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginTop: 28 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Profile completeness</h3>
          <div style={{ marginTop: 14, height: 8, borderRadius: 4, background: 'var(--color-bg-soft)' }}>
            <div
              style={{
                width: `${completeness}%`,
                height: '100%',
                borderRadius: 4,
                background: 'var(--color-primary)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          <p style={{ marginTop: 10, fontSize: 14, color: 'var(--color-text-muted)' }}>{completeness}% complete</p>
          {!profile.is_live && (
            <Link to="/profile/edit" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
              Finish your profile →
            </Link>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Applications sent</h3>
          <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10 }}>{applications.length}</p>
          <Link to="/applications" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
            View all →
          </Link>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Profile views</h3>
          {views === null ? (
            <p style={{ marginTop: 10, fontSize: 14, color: 'var(--color-text-muted)' }}>Not available yet.</p>
          ) : (
            <>
              <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10 }}>{views.length}</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {views.length > 0 ? 'employers have viewed your profile' : 'No views yet'}
              </p>
            </>
          )}
        </div>
      </div>

      {applications.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 18, marginBottom: 14 }}>Recent applications</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {applications.slice(0, 5).map((a) => (
              <div key={a.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{a.roles?.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{a.roles?.employer_profiles?.company_name}</p>
                </div>
                <span className="tag">{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
