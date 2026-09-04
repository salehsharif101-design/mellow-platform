import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { useSeoMeta } from '../../lib/useSeoMeta.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import Modal from '../../components/Modal.jsx'
import CalendlyModal from '../../components/CalendlyModal.jsx'
import MessageThread from '../../components/MessageThread.jsx'
import AddWorkVideoModal from '../../components/AddWorkVideoModal.jsx'
import CompanyLinkIcons from '../../components/CompanyLinkIcons.jsx'
import MessageIconButton from '../../components/MessageIconButton.jsx'
import BookMeetingButton from '../../components/BookMeetingButton.jsx'
import ShareButton from '../../components/ShareButton.jsx'
import CandidateProfileContent from '../../components/CandidateProfileContent.jsx'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function PublicProfile() {
  const { username } = useParams()
  const location = useLocation()
  const { user, userType } = useAuth()
  // Set via router state (not a query param) by Shortlist.jsx's mobile card
  // links, so it's invisible in the URL and doesn't survive a reload/share —
  // it's purely "how did this specific navigation get here", not a
  // persistent property of the profile URL itself.
  const cameFromShortlist = location.state?.from === 'shortlist'

  const [profile, setProfile] = useState(null)
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [showCalendly, setShowCalendly] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [showAddVideo, setShowAddVideo] = useState(false)

  useSeoMeta({
    title: profile ? `${profile.full_name} | Mellow` : undefined,
    description: profile ? (profile.headline || profile.bio || `${profile.full_name} on Mellow.`).slice(0, 200) : undefined,
    // Always the username URL, even when this page was reached via an old
    // bookmarked UUID link (see the byId fallback lookup above).
    canonicalUrl: profile ? `${window.location.origin}/profile/${profile.username || profile.id}` : undefined,
  })

  useEffect(() => {
    setLoading(true)
    setNotFound(false)

    async function load() {
      let data = null

      const byUsername = await supabase.from('candidate_profiles').select('*').eq('username', username).maybeSingle()
      data = byUsername.data

      // Falls back to the old uuid-based URL so links shared before the
      // username migration (emails already sent, bookmarks) keep working.
      if (!data && UUID_RE.test(username)) {
        const byId = await supabase.from('candidate_profiles').select('*').eq('id', username).maybeSingle()
        data = byId.data
      }

      if (!data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setProfile(data)

      const { data: videoRows } = await supabase
        .from('candidate_videos')
        .select('*')
        .eq('candidate_id', data.id)
        .order('created_at', { ascending: false })
      setVideos(videoRows || [])

      setLoading(false)
    }

    load()
  }, [username])

  const isOwner = user && profile && user.id === profile.user_id

  // Recorded directly on click rather than waiting to learn whether a
  // meeting actually got booked in the Calendly iframe — there's no
  // webhook anymore to tell us that, so the click itself is the trigger
  // for the 7-days-later follow-up email (api/cron/meeting-follow-up.js).
  // Guarded against a rapid repeat click creating a second row (and so a
  // second follow-up email) for the same pair within the same day.
  async function handleBookMeeting() {
    setShowCalendly(true)
    if (!user || userType !== 'employer' || isOwner) return
    try {
      const { employerId } = await resolveEmployerId(user.id)
      if (!employerId) return

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: recent } = await supabase
        .from('meetings')
        .select('id')
        .eq('employer_id', employerId)
        .eq('candidate_id', profile.id)
        .gte('booking_created_at', since)
        .limit(1)
      if (recent && recent.length > 0) return

      await supabase.from('meetings').insert({
        employer_id: employerId,
        candidate_id: profile.id,
        scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        follow_up_sent: false,
      })
    } catch {
      // Fire-and-forget — never block opening the booking modal on this.
    }
  }

  useEffect(() => {
    // Only employer views count toward the "profile views" stat shown on the
    // candidate dashboard — a candidate browsing another candidate's profile
    // shouldn't inflate that number. Notifications are batched into a daily
    // digest (api/cron/profile-view-digest.js) rather than sent per view.
    if (!profile || !user || isOwner || userType !== 'employer') return

    async function recordView() {
      // Same 24h-repeat guard as handleBookMeeting above — one employer
      // refreshing the page repeatedly (or opening it from several tabs)
      // shouldn't produce a new row, and therefore a new "employer viewed
      // your profile" count, every single time.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: recent } = await supabase
        .from('profile_views')
        .select('id')
        .eq('candidate_id', profile.id)
        .eq('viewer_id', user.id)
        .gte('viewed_at', since)
        .limit(1)
      if (recent && recent.length > 0) return

      // Fire-and-forget — never block or break the page on failure, but do
      // surface a failed insert (e.g. an RLS rejection) to the console
      // instead of swallowing it silently, since this write has no other
      // visible effect on the page for anyone to notice it failed.
      const { error } = await supabase.from('profile_views').insert({ candidate_id: profile.id, viewer_id: user.id })
      if (error) console.error('Failed to record profile view:', error)
    }

    recordView()
  }, [profile, user, isOwner, userType])

  if (loading) return null

  if (notFound) {
    return (
      <div className="section" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28 }}>Profile not found</h1>
        <p style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>
          This profile doesn't exist or isn't public yet.
        </p>
      </div>
    )
  }

  const isEmployerViewer = userType === 'employer' && !isOwner
  const canBookMeeting = user && !isOwner && profile.calendly_url
  const showSignupCta = !user
  const hasActions = isOwner || showSignupCta

  return (
    <div className="section">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {cameFromShortlist && (
          <Link
            to="/employer/shortlist"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 16 }}
          >
            ← Back to shortlist
          </Link>
        )}
        {hasActions && (
          <div className="profile-hero-actions">
            {isOwner && (
              <Link to="/profile/edit" className="btn btn-primary">
                Edit profile
              </Link>
            )}
            {showSignupCta && (
              <Link to="/signup" className="btn btn-primary">
                Sign up to connect
              </Link>
            )}
          </div>
        )}

        <CandidateProfileContent
          profile={profile}
          videos={videos}
          isOwner={isOwner}
          onAddVideo={() => setShowAddVideo(true)}
          headerIcons={
            <>
              <CompanyLinkIcons linkedinUrl={profile.linkedin_url} websiteUrl={profile.website_url} label={profile.full_name} size={19} />
              <MessageIconButton
                onMessage={isEmployerViewer ? () => setShowContact(true) : null}
                label={profile.full_name}
                size={19}
              />
              <ShareButton url={`${window.location.origin}/profile/${profile.username || profile.id}`} label="Share profile" size={19} />
            </>
          }
          bookMeetingButton={canBookMeeting && <BookMeetingButton onClick={handleBookMeeting} />}
        />
      </div>

      {showCalendly && <CalendlyModal calendlyUrl={profile.calendly_url} onClose={() => setShowCalendly(false)} />}

      {showContact && (
        <Modal title={`Message ${profile.full_name}`} onClose={() => setShowContact(false)}>
          <MessageThread otherUserId={profile.user_id} otherUserLabel={profile.full_name} />
        </Modal>
      )}

      {showAddVideo && (
        <AddWorkVideoModal
          candidateId={profile.id}
          userId={profile.user_id}
          onClose={() => setShowAddVideo(false)}
          onAdded={(row) => {
            setVideos((prev) => [row, ...prev])
            setShowAddVideo(false)
          }}
        />
      )}
    </div>
  )
}
