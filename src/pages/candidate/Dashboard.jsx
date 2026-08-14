import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { supabase } from '../../lib/supabase.js'
import AddWorkVideoModal from '../../components/AddWorkVideoModal.jsx'

const COMPLETENESS_FIELDS = ['full_name', 'job_title', 'location', 'bio', 'intro_video_url']

export default function CandidateDashboard() {
  const { user } = useAuth()
  const { newShortlists, newProfileViews, clearDashboardBadges } = useNotifications()
  const [profile, setProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const [views, setViews] = useState(null) // null = unavailable, [] = none yet
  const [shortlistCount, setShortlistCount] = useState(null) // null = unavailable
  const [workVideoCount, setWorkVideoCount] = useState(null) // null = unknown yet
  const [loading, setLoading] = useState(true)
  const [togglingVisibility, setTogglingVisibility] = useState(false)
  const [showAddVideo, setShowAddVideo] = useState(false)

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

      const { count: videoCount } = await supabase
        .from('candidate_videos')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidate.id)
      setWorkVideoCount(videoCount || 0)

      const { count: shortlistTotal, error: shortlistError } = await supabase
        .from('shortlists')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidate.id)
      if (!shortlistError) setShortlistCount(shortlistTotal || 0)

      setLoading(false)
    }

    load()
  }, [user])

  useEffect(() => {
    // The dashboard is where the shortlist and profile-view stats live, so
    // viewing it is what clears both of those unread badges.
    if (!loading && profile) clearDashboardBadges()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile])

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

  async function toggleVisibility() {
    setTogglingVisibility(true)
    const { data } = await supabase
      .from('candidate_profiles')
      .update({ is_open_to_opportunities: !isOpen })
      .eq('id', profile.id)
      .select()
      .single()
    if (data) setProfile(data)
    setTogglingVisibility(false)
  }

  const isOpen = profile.is_open_to_opportunities !== false
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

      <div
        className="card"
        style={{
          marginTop: 24,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600 }}>
          {isOpen ? 'Your profile is visible to employers' : 'Your profile is hidden from employers'}
        </p>
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={togglingVisibility}
          aria-pressed={isOpen}
          aria-label="Toggle open to opportunities"
          style={{
            flexShrink: 0,
            width: 46,
            height: 26,
            borderRadius: 999,
            border: 'none',
            padding: 3,
            cursor: togglingVisibility ? 'default' : 'pointer',
            background: isOpen ? 'var(--color-primary)' : 'var(--color-border)',
            transition: 'background 0.15s ease',
          }}
        >
          <span
            style={{
              display: 'block',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              transform: isOpen ? 'translateX(20px)' : 'translateX(0)',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>
      </div>

      {workVideoCount === 0 && (
        <div
          style={{
            marginTop: 24,
            padding: '24px 28px',
            background: '#EEF4FF',
            borderLeft: '4px solid #005ef5',
            borderRadius: 10,
          }}
        >
          <h3 style={{ fontSize: 18 }}>Stand out from the crowd</h3>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
            Candidates with work videos get significantly more employer attention. Show employers how you think and
            what you are capable of. A designer can walk through a project. A developer can screen record a problem
            they solved. A marketer can break down a campaign.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setShowAddVideo(true)} style={{ marginTop: 16 }}>
            Add your first work video
          </button>
        </div>
      )}

      {showAddVideo && (
        <AddWorkVideoModal
          candidateId={profile.id}
          userId={user.id}
          onClose={() => setShowAddVideo(false)}
          onAdded={() => setWorkVideoCount((prev) => (prev || 0) + 1)}
        />
      )}

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
          <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            Profile views
            {newProfileViews > 0 && <span className="notif-dot" aria-label="New profile views" />}
          </h3>
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

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            Shortlisted by employers
            {newShortlists > 0 && (
              <span className="notif-badge" aria-label={`${newShortlists} new shortlists`}>
                {newShortlists > 9 ? '9+' : newShortlists}
              </span>
            )}
          </h3>
          {shortlistCount === null ? (
            <p style={{ marginTop: 10, fontSize: 14, color: 'var(--color-text-muted)' }}>Not available yet.</p>
          ) : (
            <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10 }}>{shortlistCount}</p>
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
