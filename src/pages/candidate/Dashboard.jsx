import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { getCandidateStatusLabel, roleMatchesCandidate, daysUntil } from '../../lib/roleFormat.js'
import AddWorkVideoModal from '../../components/AddWorkVideoModal.jsx'

// Matches NotificationContext's poll interval so the pipeline cards' New
// counts stay current even if the candidate leaves this tab open.
const POLL_MS = 30000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function groupBySender(messages) {
  const map = new Map()
  for (const m of messages) {
    if (!map.has(m.sender_id)) map.set(m.sender_id, [])
    map.get(m.sender_id).push(m)
  }
  return map
}

const PROFILE_STRENGTH_CHECKS = [
  { key: 'intro_video', label: 'Intro video uploaded', anchor: '#video-section', tip: 'Add your intro video so employers can meet you.' },
  { key: 'work_video', label: 'At least one work video added', anchor: '#work-videos-section', tip: 'Add a work video to stand out more.' },
  { key: 'skills', label: 'Skills filled in', anchor: '#skills-section', tip: 'Add a few skills so the right roles find you.' },
  { key: 'bio', label: 'Bio complete', anchor: '#basics-section', tip: 'Write a short bio to help employers get to know you.' },
  { key: 'linkedin', label: 'LinkedIn added', anchor: '#linkedin-section', tip: 'Add your LinkedIn to build more trust with employers.' },
  { key: 'education', label: 'Education added', anchor: '#education-section', tip: 'Add your education to round out your profile.' },
  { key: 'photo', label: 'Profile photo uploaded', anchor: '#photo-section', tip: 'Add a profile photo — profiles with photos get more attention.' },
]

export default function CandidateDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { clearDashboardBadges } = useNotifications()
  const [profile, setProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const [views, setViews] = useState(null) // null = unavailable, [] = none yet
  const [shortlistCount, setShortlistCount] = useState(null) // null = unavailable
  const [workVideoCount, setWorkVideoCount] = useState(null) // null = unknown yet
  const [messagesReceivedCount, setMessagesReceivedCount] = useState(0)
  const [feedItems, setFeedItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [togglingVisibility, setTogglingVisibility] = useState(false)
  const [showAddVideo, setShowAddVideo] = useState(false)
  // Frozen on first load — see the employer dashboard's identical pattern.
  // Without this, the 30s poll re-reads last_viewed_dashboard_at *after*
  // clearDashboardBadges() has already overwritten it, collapsing the
  // feed's "since" window to almost nothing on every subsequent poll.
  const sinceMsRef = useRef(null)
  const hasClearedBadgeRef = useRef(false)

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
        .select(
          'id, status, status_changed_at, applied_at, viewed_at, role_id, roles(id, title, employer_id, employer_profiles(company_name, user_id))',
        )
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

      const { count: msgReceivedTotal } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
      setMessagesReceivedCount(msgReceivedTotal || 0)

      // "Since last visit," capped to the last 7 days regardless of how
      // long it's actually been. Frozen after the first load — see
      // sinceMsRef above.
      if (sinceMsRef.current === null) {
        const sevenDaysAgoMs = Date.now() - SEVEN_DAYS_MS
        const lastViewedMs = candidate.last_viewed_dashboard_at ? new Date(candidate.last_viewed_dashboard_at).getTime() : 0
        sinceMsRef.current = Math.max(sevenDaysAgoMs, lastViewedMs)
      }
      const sinceMs = sinceMsRef.current
      const sinceIso = new Date(sinceMs).toISOString()

      const items = []

      // Application status updates (moved to Reviewing or Shortlisted).
      ;(apps || [])
        .filter((a) => a.status_changed_at && new Date(a.status_changed_at).getTime() > sinceMs && ['reviewing', 'shortlisted'].includes(a.status))
        .forEach((a) => {
          items.push({
            id: `status-${a.id}`,
            text: `Your application for ${a.roles?.title} at ${a.roles?.employer_profiles?.company_name} is now ${getCandidateStatusLabel(a.status)}`,
            link: '/applications',
            timestamp: a.status_changed_at,
          })
        })

      // Shortlist notifications (added to an employer's personal shortlist —
      // independent of any specific application).
      const { data: shortlistRows } = await supabase
        .from('shortlists')
        .select('id, employer_id, created_at, employer_profiles(company_name)')
        .eq('candidate_id', candidate.id)
        .gt('created_at', sinceIso)
      ;(shortlistRows || []).forEach((s) => {
        items.push({
          id: `shortlist-${s.id}`,
          text: `You were shortlisted by ${s.employer_profiles?.company_name || 'an employer'}`,
          link: '/applications',
          timestamp: s.created_at,
        })
      })

      // Employers who viewed the profile since last visit.
      const newViews = (viewRows || []).filter((v) => v.viewer_id && new Date(v.viewed_at).getTime() > sinceMs)
      const viewerIds = [...new Set(newViews.map((v) => v.viewer_id))]
      if (viewerIds.length > 0) {
        const { data: viewerEmployers } = await supabase
          .from('employer_profiles')
          .select('user_id, company_name')
          .in('user_id', viewerIds)
        const nameByUserId = Object.fromEntries((viewerEmployers || []).map((e) => [e.user_id, e.company_name]))
        const latestByViewer = new Map()
        newViews.forEach((v) => {
          const existing = latestByViewer.get(v.viewer_id)
          if (!existing || v.viewed_at > existing) latestByViewer.set(v.viewer_id, v.viewed_at)
        })
        latestByViewer.forEach((timestamp, viewerId) => {
          items.push({
            id: `view-${viewerId}`,
            text: `${nameByUserId[viewerId] || 'An employer'} viewed your profile`,
            link: `/profile/${candidate.username || candidate.id}`,
            timestamp,
          })
        })
      }

      // Messages received since last visit.
      const { data: allMessages } = await supabase
        .from('messages')
        .select('id, sender_id, sent_at')
        .eq('recipient_id', user.id)
        .gt('sent_at', sinceIso)
        .order('sent_at', { ascending: false })
      const bySender = groupBySender(allMessages || [])
      if (bySender.size > 0) {
        const senderIds = [...bySender.keys()]
        const { data: senderEmployers } = await supabase
          .from('employer_profiles')
          .select('user_id, company_name')
          .in('user_id', senderIds)
        const nameByUserId = Object.fromEntries((senderEmployers || []).map((e) => [e.user_id, e.company_name]))
        bySender.forEach((msgs, senderId) => {
          items.push({
            id: `msg-${senderId}`,
            text: msgs.length === 1
              ? `New message from ${nameByUserId[senderId] || 'an employer'}`
              : `${msgs.length} new messages from ${nameByUserId[senderId] || 'an employer'}`,
            link: '/messages',
            timestamp: msgs[0].sent_at,
          })
        })
      }

      // New roles posted in the last 7 days — either matching the
      // candidate's skills/title, or from an employer they previously
      // applied to (the "one-tap reapply" nudge). A role that qualifies for
      // both gets the reapply phrasing, since that's the stronger signal.
      const appliedEmployerIds = new Set((apps || []).map((a) => a.roles?.employer_id).filter(Boolean))
      const { data: recentRoles } = await supabase
        .from('roles')
        .select('id, slug, title, created_at, employer_id, employer_profiles(company_name, typical_roles)')
        .eq('is_active', true)
        .gt('created_at', sinceIso)
        .order('created_at', { ascending: false })
      ;(recentRoles || []).forEach((role) => {
        if (appliedEmployerIds.has(role.employer_id)) {
          items.push({
            id: `reapply-${role.id}`,
            text: `A company you applied to before has posted a new role — ${role.title} at ${role.employer_profiles?.company_name}`,
            link: `/jobs/${role.slug}`,
            timestamp: role.created_at,
          })
        } else if (roleMatchesCandidate(role, candidate.skills, candidate.job_title)) {
          items.push({
            id: `match-${role.id}`,
            text: `New role matching your skills — ${role.title} at ${role.employer_profiles?.company_name}`,
            link: `/jobs/${role.slug}`,
            timestamp: role.created_at,
          })
        }
      })

      // Saved roles with a deadline in the next 3 days — not gated by
      // "since last visit" since it's a forward-looking alert, not a log of
      // past activity.
      const { data: savedRows } = await supabase
        .from('saved_roles')
        .select('id, roles(id, slug, title, deadline, is_active)')
        .eq('candidate_id', candidate.id)
      ;(savedRows || []).forEach((s) => {
        const role = s.roles
        if (!role || !role.is_active || !role.deadline) return
        const days = daysUntil(role.deadline)
        if (days !== null && days >= 0 && days <= 3) {
          items.push({
            id: `deadline-${s.id}`,
            text: `Your saved role "${role.title}" closes in ${days} day${days === 1 ? '' : 's'}`,
            link: `/jobs/${role.slug}`,
            timestamp: new Date().toISOString(),
          })
        }
      })

      items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setFeedItems(items)

      setLoading(false)
    }

    load()
    const interval = setInterval(load, POLL_MS)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    // The dashboard is where the shortlist and profile-view stats live, so
    // viewing it is what clears both of those unread badges. Also doubles
    // as the "since you last checked" marker for the activity feed above —
    // guarded to fire once per mount only, for the same reason described on
    // sinceMsRef.
    if (!loading && profile && !hasClearedBadgeRef.current) {
      hasClearedBadgeRef.current = true
      clearDashboardBadges()
    }
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

  const strengthChecks = PROFILE_STRENGTH_CHECKS.map((check) => {
    let complete = false
    if (check.key === 'intro_video') complete = Boolean(profile.intro_video_url)
    else if (check.key === 'work_video') complete = (workVideoCount || 0) > 0
    else if (check.key === 'skills') complete = (profile.skills?.length || 0) > 0
    else if (check.key === 'bio') complete = Boolean(profile.bio)
    else if (check.key === 'linkedin') complete = Boolean(profile.linkedin_url)
    else if (check.key === 'education') complete = Boolean(profile.education_level || profile.institution_name)
    else if (check.key === 'photo') complete = Boolean(profile.avatar_url)
    return { ...check, complete }
  })
  const completedCount = strengthChecks.filter((c) => c.complete).length
  const strengthPct = Math.round((completedCount / strengthChecks.length) * 100)
  const firstIncomplete = strengthChecks.find((c) => !c.complete)
  const strengthMessage =
    strengthPct === 100
      ? "Your profile is complete! You're set up to make a great impression."
      : `Your profile is ${strengthPct}% complete. ${firstIncomplete.tip}`

  const weeklyViewCount = views ? views.filter((v) => Date.now() - new Date(v.viewed_at).getTime() < SEVEN_DAYS_MS).length : 0
  const motivatingLine =
    weeklyViewCount > 0
      ? `Your profile was viewed ${weeklyViewCount} time${weeklyViewCount === 1 ? '' : 's'} this week. Keep it updated to stay visible.`
      : (shortlistCount || 0) > 0
        ? `You've been shortlisted ${shortlistCount} time${shortlistCount === 1 ? '' : 's'}. Keep an eye on your messages.`
        : applications.length > 0
          ? `You've sent ${applications.length} application${applications.length === 1 ? '' : 's'}. Stay visible with an updated profile.`
          : 'Complete your profile and start applying to get noticed.'

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

      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: 18, marginBottom: 14 }}>What's new</h3>
        {feedItems.length === 0 ? (
          <p className="card" style={{ padding: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>
            You're all caught up — nothing new since your last visit.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feedItems.map((item) => (
              <div
                key={item.id}
                className="card"
                onClick={() => navigate(item.link)}
                style={{ padding: '14px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                {item.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 18, marginBottom: 4 }}>Job search progress</h3>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 14 }}>{motivatingLine}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Applications sent</p>
            <p style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{applications.length}</p>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Profile views this week</p>
            <p style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{weeklyViewCount}</p>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Times shortlisted</p>
            <p style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{shortlistCount ?? 0}</p>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Messages received</p>
            <p style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{messagesReceivedCount}</p>
          </div>
        </div>
      </div>

      <Link to="/roles" className="dashboard-hero-cta" style={{ marginTop: 32 }}>
        <div>
          <h3>Browse Roles</h3>
          <p>See open roles matched to your skills and apply with one tap.</p>
        </div>
        <span className="dashboard-hero-cta-arrow" aria-hidden="true">
          →
        </span>
      </Link>

      <div className="card" style={{ marginTop: 32, padding: 24 }}>
        <h3 style={{ fontSize: 18 }}>Profile strength</h3>
        <div style={{ marginTop: 14, height: 8, borderRadius: 4, background: 'var(--color-bg-soft)' }}>
          <div
            style={{
              width: `${strengthPct}%`,
              height: '100%',
              borderRadius: 4,
              background: 'var(--color-primary)',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
        <p style={{ marginTop: 10, fontSize: 14, color: 'var(--color-text-muted)' }}>{strengthMessage}</p>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {strengthChecks.map((check) => (
            <div key={check.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  background: check.complete ? '#e3f9e9' : 'var(--color-bg-soft)',
                  color: check.complete ? '#0f7a3d' : 'var(--color-text-muted)',
                }}
              >
                {check.complete ? '✓' : ''}
              </span>
              {check.complete ? (
                <span style={{ color: 'var(--color-text-muted)' }}>{check.label}</span>
              ) : (
                <Link to={`/profile/edit${check.anchor}`} style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
                  {check.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
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
            Talent with work videos gets significantly more employer attention. Show employers how you think and
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
                <span className="tag">{getCandidateStatusLabel(a.status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
