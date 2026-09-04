import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatRelativeTime, daysSince } from '../../lib/roleFormat.js'
import { getCachedDashboard, setCachedDashboard } from '../../lib/dashboardCache.js'
import { resolveEmployerId, getEmployerUserIds } from '../../lib/employerAccess.js'
import ShareButton from '../../components/ShareButton.jsx'
import DashboardSkeleton from '../../components/DashboardSkeleton.jsx'

// Matches NotificationContext's poll interval so the pipeline cards' New
// counts stay current even if the employer leaves this tab open while
// reviewing applicants in another one.
const POLL_MS = 30000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

const PROFILE_STRENGTH_CHECKS = [
  { key: 'logo', label: 'Company logo uploaded', anchor: '#logo-section', tip: 'Add a company logo to look more credible to candidates.' },
  { key: 'about', label: 'About your company filled in', anchor: '#about-section', tip: 'Add a short description of your company.' },
  { key: 'culture', label: 'Company culture filled in', anchor: '#culture-section', tip: 'Describe what it is like to work at your company.' },
  { key: 'highlight', label: 'Company highlight filled in', anchor: '#highlight-section', tip: 'Add a highlight that makes your company stand out.' },
  { key: 'video', label: 'Company intro video uploaded', anchor: '#intro-video-section', tip: 'Add a company video to attract more applicants.' },
  { key: 'linkedin', label: 'LinkedIn link added', anchor: '#linkedin-field', tip: 'Add your LinkedIn company page to build trust.' },
  { key: 'website', label: 'Website added', anchor: '#website-field', tip: 'Add your company website.' },
  { key: 'typicalRoles', label: 'Typical roles filled in', anchor: '#typical-roles-section', tip: 'Add the kinds of roles you typically hire for.' },
]

function groupByOtherParty(messages, myIds) {
  const map = new Map()
  for (const m of messages) {
    const otherId = myIds.has(m.sender_id) ? m.recipient_id : m.sender_id
    if (!map.has(otherId)) map.set(otherId, [])
    map.get(otherId).push(m)
  }
  return map
}

export default function EmployerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { newApplications, clearApplicationsBadge } = useNotifications()
  const clearApplicationsBadgeRef = useRef(clearApplicationsBadge)
  clearApplicationsBadgeRef.current = clearApplicationsBadge

  const cacheKey = user ? `employer:${user.id}` : null
  const cached = cacheKey ? getCachedDashboard(cacheKey) : null

  const [employer, setEmployer] = useState(cached?.employer ?? null)
  const [roles, setRoles] = useState(cached?.roles ?? [])
  const [applications, setApplications] = useState(cached?.applications ?? [])
  const [shortlistCount, setShortlistCount] = useState(cached?.shortlistCount ?? 0)
  const [feedItems, setFeedItems] = useState(cached?.feedItems ?? [])
  const [hasUnansweredMessage, setHasUnansweredMessage] = useState(cached?.hasUnansweredMessage ?? false)
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)
  const [nudgeVersion, setNudgeVersion] = useState(0)
  // Captured once from the first load of this page visit, before our own
  // clearApplicationsBadge() call overwrites last_viewed_applications_at —
  // every subsequent 30s poll reuses this frozen cutoff instead of
  // re-reading the (by then already-updated) column, which would otherwise
  // collapse the feed's window to almost nothing after the first poll.
  const sinceMsRef = useRef(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      // Resolves to the owner's own company, or the company they're an
      // active team member of — either way, everyone on the team sees the
      // same dashboard.
      const { employerId } = await resolveEmployerId(user.id)
      if (!employerId) {
        setLoading(false)
        return
      }

      const [empResult, myIdList] = await Promise.all([
        supabase
          .from('employer_profiles')
          .select(
            'id, company_name, company_slug, logo_url, intro_video_url, about, culture_description, company_highlight, typical_roles, linkedin_url, website_url, last_viewed_applications_at',
          )
          .eq('id', employerId)
          .maybeSingle(),
        getEmployerUserIds(employerId),
      ])

      const emp = empResult.data
      if (!emp) {
        setLoading(false)
        return
      }

      // The message inbox is shared across the whole team — a candidate's
      // conversation with "the company" isn't tied to whichever teammate
      // happens to be logged in.
      const myIds = new Set(myIdList)
      const orFilter = myIdList.map((id) => `sender_id.eq.${id},recipient_id.eq.${id}`).join(',')
      const allMessagesResult = orFilter
        ? await supabase
            .from('messages')
            .select('id, sender_id, recipient_id, body, sent_at, read_at')
            .or(orFilter)
            .order('sent_at', { ascending: false })
        : { data: [] }

      const allMessages = allMessagesResult.data || []

      const messagesByOther = groupByOtherParty(allMessages, myIds)
      let unanswered = false
      messagesByOther.forEach((msgs) => {
        const latest = msgs[0]
        if (!myIds.has(latest.sender_id) && Date.now() - new Date(latest.sent_at).getTime() > THREE_DAYS_MS) {
          unanswered = true
        }
      })

      // "Since last visit," capped to the last 7 days regardless of how
      // long it's actually been. Frozen after the first load — see
      // sinceMsRef above. clearApplicationsBadge() (which overwrites
      // last_viewed_applications_at to now) fires right here, strictly
      // after that column's pre-update value has been read into sinceMs —
      // not from a separate effect keyed on `loading`/`employer`, which
      // raced against this fetch whenever a cached dashboard made `loading`
      // start out already false: the badge's UPDATE could land before this
      // SELECT, so sinceMs came back as "now" and the feed looked empty
      // even with real unseen activity.
      if (sinceMsRef.current === null) {
        const sevenDaysAgoMs = Date.now() - SEVEN_DAYS_MS
        const lastViewedMs = emp.last_viewed_applications_at ? new Date(emp.last_viewed_applications_at).getTime() : 0
        sinceMsRef.current = Math.max(sevenDaysAgoMs, lastViewedMs)
        // The nav badge itself is intentionally NOT cleared here — clearing
        // it as part of the very first load would zero it out before the
        // employer ever got a chance to see it, so it could only ever show
        // a count for an application that arrives while they're already on
        // this page. It's cleared instead once they've actually seen the
        // dashboard and move on — see the unmount effect below.
      }
      const sinceMs = sinceMsRef.current
      const sinceIso = new Date(sinceMs).toISOString()

      const unreadSince = allMessages.filter(
        (m) => myIds.has(m.recipient_id) && !m.read_at && new Date(m.sent_at).getTime() > sinceMs,
      )
      const unreadBySender = new Map()
      unreadSince.forEach((m) => {
        const entry = unreadBySender.get(m.sender_id) || { count: 0, latest: m.sent_at }
        entry.count += 1
        if (m.sent_at > entry.latest) entry.latest = m.sent_at
        unreadBySender.set(m.sender_id, entry)
      })
      const senderIds = Array.from(unreadBySender.keys())

      // Everything below only needs emp.id (or the sender ids just derived
      // above) — none of it depends on any of the others' results, so it
      // all goes out in one batch instead of one round trip at a time.
      // Applications are filtered by employer via the embedded roles join
      // rather than a separate "get my role ids first" query.
      const [rolesResult, applicationsResult, shortlistResult, companyViewsResult, senderProfilesResult] = await Promise.all([
        supabase.from('roles').select('id, title, is_active, created_at, view_count').eq('employer_id', emp.id).order('created_at', { ascending: false }),
        supabase
          .from('applications')
          .select('id, status, role_id, applied_at, viewed_at, candidate_profiles(id, username, full_name, avatar_url, job_title), roles!inner(employer_id)')
          .eq('roles.employer_id', emp.id),
        // Excludes rejected entries — Shortlist Review moves a candidate to
        // status 'rejected' rather than deleting the row (so the history
        // survives), and this count should reflect active shortlists only,
        // matching what the Shortlist page itself now shows.
        supabase.from('shortlists').select('id', { count: 'exact', head: true }).eq('employer_id', emp.id).neq('status', 'rejected'),
        supabase.from('company_views').select('viewed_at, viewer_id').eq('employer_id', emp.id).gt('viewed_at', sinceIso),
        senderIds.length > 0
          ? supabase.from('candidate_profiles').select('user_id, full_name').in('user_id', senderIds)
          : Promise.resolve({ data: [] }),
      ])

      const myRoles = rolesResult.data || []
      const apps = applicationsResult.data || []
      const shortlistTotal = shortlistResult.count || 0
      const views = companyViewsResult.data || []
      const namesBySenderId = Object.fromEntries((senderProfilesResult.data || []).map((p) => [p.user_id, p.full_name]))

      const newApps = apps.filter((a) => a.applied_at && new Date(a.applied_at).getTime() > sinceMs)
      const newAppsByRole = new Map()
      newApps.forEach((a) => {
        const entry = newAppsByRole.get(a.role_id) || { count: 0, latest: a.applied_at }
        entry.count += 1
        if (a.applied_at > entry.latest) entry.latest = a.applied_at
        newAppsByRole.set(a.role_id, entry)
      })

      const items = []
      newAppsByRole.forEach((entry, roleId) => {
        const role = myRoles.find((r) => r.id === roleId)
        if (!role) return
        items.push({
          id: `apps-${roleId}`,
          text: `${entry.count} new applicant${entry.count === 1 ? '' : 's'} to ${role.title}`,
          link: `/employer/roles/${roleId}/applicants`,
          timestamp: entry.latest,
        })
      })
      unreadBySender.forEach((entry, senderId) => {
        const name = namesBySenderId[senderId] || 'Talent'
        items.push({
          id: `msg-${senderId}`,
          text: entry.count === 1 ? `New message from ${name}` : `${entry.count} new messages from ${name}`,
          link: '/employer/messages',
          timestamp: entry.latest,
        })
      })
      // Deduped by viewer — company_views has no per-viewer uniqueness, so
      // one candidate refreshing the company page 3 times would otherwise
      // read as "3 talents viewed your company profile."
      const uniqueViewerIds = new Set(views.map((v) => v.viewer_id).filter(Boolean))
      if (uniqueViewerIds.size > 0) {
        const latestView = views.reduce((max, v) => (v.viewed_at > max ? v.viewed_at : max), views[0].viewed_at)
        items.push({
          id: 'company-views',
          text: `${uniqueViewerIds.size} talent${uniqueViewerIds.size === 1 ? '' : 's'} viewed your company profile`,
          link: emp.company_slug ? `/company/${emp.company_slug}` : '/employer/dashboard',
          timestamp: latestView,
        })
      }
      items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      setEmployer(emp)
      setRoles(myRoles)
      setApplications(apps)
      setShortlistCount(shortlistTotal)
      setHasUnansweredMessage(unanswered)
      setFeedItems(items)
      setLoading(false)

      if (cacheKey) {
        setCachedDashboard(cacheKey, {
          employer: emp,
          roles: myRoles,
          applications: apps,
          shortlistCount: shortlistTotal,
          hasUnansweredMessage: unanswered,
          feedItems: items,
        })
      }
    }

    load()
    const interval = setInterval(load, POLL_MS)
    return () => {
      clearInterval(interval)
      clearApplicationsBadgeRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const activeNudge = useMemo(() => {
    if (!employer) return null
    const candidates = []
    if (hasUnansweredMessage) {
      candidates.push({
        key: 'unanswered-messages',
        text: 'You have unanswered messages. Candidates are waiting for your response.',
        linkTo: '/employer/messages',
        linkLabel: 'View messages',
      })
    }
    if (!employer.intro_video_url) {
      candidates.push({
        key: 'no-video',
        text: 'Add a company video to get more applicants.',
        linkTo: '/employer/profile/edit',
        linkLabel: 'Edit Profile',
      })
    }
    if (!employer.about || !employer.linkedin_url || !employer.website_url) {
      candidates.push({
        key: 'incomplete-profile',
        text: 'Complete your profile to build trust with candidates.',
        linkTo: '/employer/profile/edit',
        linkLabel: 'Edit Profile',
      })
    }
    return candidates.find((c) => sessionStorage.getItem(`dismissed_nudge_${c.key}`) !== '1') || null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employer, hasUnansweredMessage, nudgeVersion])

  function dismissNudge(key) {
    sessionStorage.setItem(`dismissed_nudge_${key}`, '1')
    setNudgeVersion((v) => v + 1)
  }

  if (loading) return <DashboardSkeleton />

  if (!employer) {
    return (
      <div className="section">
        <p>
          Finish setting up your company profile. <Link to="/employer/onboarding">Continue →</Link>
        </p>
      </div>
    )
  }

  const strengthChecks = PROFILE_STRENGTH_CHECKS.map((check) => {
    let complete = false
    if (check.key === 'logo') complete = Boolean(employer.logo_url)
    else if (check.key === 'about') complete = Boolean(employer.about)
    else if (check.key === 'culture') complete = Boolean(employer.culture_description)
    else if (check.key === 'highlight') complete = Boolean(employer.company_highlight)
    else if (check.key === 'video') complete = Boolean(employer.intro_video_url)
    else if (check.key === 'linkedin') complete = Boolean(employer.linkedin_url)
    else if (check.key === 'website') complete = Boolean(employer.website_url)
    else if (check.key === 'typicalRoles') complete = Boolean(employer.typical_roles)
    return { ...check, complete }
  })
  const strengthCompletedCount = strengthChecks.filter((c) => c.complete).length
  const strengthPct = Math.round((strengthCompletedCount / strengthChecks.length) * 100)
  const firstIncompleteStrengthCheck = strengthChecks.find((c) => !c.complete)
  // Only ever read while strengthPct < 100 — the section that renders this
  // is hidden entirely once the profile is complete.
  const strengthMessage = `Your profile is ${strengthPct}% complete. ${firstIncompleteStrengthCheck?.tip}`

  const activeRoles = roles.filter((r) => r.is_active)

  const pipeline = activeRoles.map((role) => {
    const roleApps = applications.filter((a) => a.role_id === role.id)
    const total = roleApps.length
    const unviewed = roleApps.filter((a) => !a.viewed_at).length
    const shortlistedCount = roleApps.filter((a) => a.status === 'shortlisted').length
    const rejectedCount = roleApps.filter((a) => a.status === 'rejected').length
    const views = role.view_count || 0
    const conversion = views > 0 ? Math.round((total / views) * 100) : null
    const daysOpen = daysSince(role.created_at)
    // A role with few views has a distribution problem, not a description
    // problem — telling its owner to rewrite the description is the wrong
    // advice for a role nobody has actually seen yet. Only surface the
    // description tip once there's been a meaningful amount of traffic that
    // still isn't converting.
    const lowViews = daysOpen > 14 && views < 10
    const lowConversion = daysOpen > 14 && views >= 10 && total < 5
    return { role, total, unviewed, shortlistedCount, rejectedCount, views, conversion, daysOpen, lowViews, lowConversion }
  })

  const rejectedApplications = applications.filter((a) => a.status === 'rejected')

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>{employer.company_name} dashboard</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/employer/profile/edit" className="btn btn-primary">
            Edit profile
          </Link>
          {employer.company_slug && (
            <>
              <Link to={`/company/${employer.company_slug}`} className="btn btn-ghost">
                View Profile
              </Link>
              <ShareButton url={`${window.location.origin}/company/${employer.company_slug}`} label="Share profile" />
            </>
          )}
        </div>
      </div>

      {activeNudge && (
        <div
          className="card"
          style={{
            marginTop: 24,
            padding: '16px 20px',
            background: '#eef4ff',
            border: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600 }}>{activeNudge.text}</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <Link to={activeNudge.linkTo} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
              {activeNudge.linkLabel}
            </Link>
            <button
              type="button"
              onClick={() => dismissNudge(activeNudge.key)}
              aria-label="Dismiss"
              style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div id="whats-new-section" style={{ marginTop: 28, scrollMarginTop: 20 }}>
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
                style={{ padding: '14px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#005ef5' }}
              >
                {item.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 28 }}>
        <Link to="/employer/roles" className="card stat-card-link" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Active roles</h3>
          <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10, color: activeRoles.length > 0 ? '#005ef5' : undefined }}>
            {activeRoles.length}
          </p>
        </Link>
        <Link to="/employer/applicants" className="card stat-card-link" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            Applications received
            {newApplications > 0 && (
              <span className="notif-badge" aria-label={`${newApplications} new applications`}>
                {newApplications > 9 ? '9+' : newApplications}
              </span>
            )}
          </h3>
          <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10, color: applications.length > 0 ? '#005ef5' : undefined }}>
            {applications.length}
          </p>
        </Link>
        <Link to="/employer/shortlist" className="card stat-card-link" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Shortlisted talent</h3>
          <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10, color: shortlistCount > 0 ? '#005ef5' : undefined }}>
            {shortlistCount}
          </p>
        </Link>
        <Link to="/employer/rejected" className="card stat-card-link" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Rejected talent</h3>
          <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10, color: rejectedApplications.length > 0 ? '#005ef5' : undefined }}>
            {rejectedApplications.length}
          </p>
        </Link>
        <Link to="/employer/roles/new" className="card stat-card-link" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Post a new role</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 10 }}>
            Create a role and start receiving applications.
          </p>
        </Link>
        <Link to="/employer/team" className="card stat-card-link" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Team</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 10 }}>
            Invite teammates to help manage your account.
          </p>
        </Link>
      </div>

      <div style={{ marginTop: 36 }}>
        <h3 style={{ fontSize: 18, marginBottom: 14 }}>Hiring pipeline</h3>
        {pipeline.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
            No active roles yet. <Link to="/employer/roles/new">Post a role</Link> to start building your pipeline.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pipeline.map(({ role, total, unviewed, shortlistedCount, rejectedCount, views, conversion, daysOpen, lowViews, lowConversion }) => (
              <div
                key={role.id}
                className="card"
                onClick={() => navigate(`/employer/roles/${role.id}/applicants`)}
                style={{ padding: 20, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 16 }}>{role.title}</p>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      Posted {formatRelativeTime(role.created_at)} · Open {daysOpen} day{daysOpen === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {unviewed > 0 && (
                      <span className="tag" style={{ fontWeight: 700, background: 'var(--color-primary)', color: '#fff' }}>
                        New: {unviewed}
                      </span>
                    )}
                    <span className="tag">
                      {total} applicant{total === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>
                  {views} view{views === 1 ? '' : 's'} · {total} applied · {shortlistedCount} shortlisted · {rejectedCount} rejected
                  {conversion !== null && ` · ${conversion}% view-to-apply`}
                </p>
                {lowViews && (
                  <p style={{ fontSize: 12, color: '#8a6100', background: '#fff6e0', borderRadius: 6, padding: '6px 10px', marginTop: 10, display: 'inline-block' }}>
                    This role isn't getting much visibility — try sharing it directly with candidates
                  </p>
                )}
                {lowConversion && (
                  <p style={{ fontSize: 12, color: '#8a6100', background: '#fff6e0', borderRadius: 6, padding: '6px 10px', marginTop: 10, display: 'inline-block' }}>
                    Consider updating your role description to attract more applicants
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Link to="/employer/talent" className="dashboard-hero-cta" style={{ marginTop: 36 }}>
        <div>
          <h3>Browse Talent</h3>
          <p>Discover candidates ready to work with you — watch intro videos and shortlist in one tap.</p>
        </div>
      </Link>

      {strengthPct < 100 && (
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
                  <Link to={`/employer/profile/edit${check.anchor}`} style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
                    {check.label} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
