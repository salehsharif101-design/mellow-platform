import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import Modal from '../../components/Modal.jsx'
import CalendlyModal from '../../components/CalendlyModal.jsx'
import MessageThread from '../../components/MessageThread.jsx'
import AddWorkVideoModal from '../../components/AddWorkVideoModal.jsx'
import CompanyLinkIcons from '../../components/CompanyLinkIcons.jsx'
import MessageIconButton from '../../components/MessageIconButton.jsx'
import BookMeetingButton from '../../components/BookMeetingButton.jsx'
import ShareButton from '../../components/ShareButton.jsx'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SECTION_TITLE_STYLE = { fontSize: 20, marginBottom: 16 }

export default function PublicProfile() {
  const { username } = useParams()
  const { user, userType } = useAuth()

  const [profile, setProfile] = useState(null)
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [showCalendly, setShowCalendly] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [showAddVideo, setShowAddVideo] = useState(false)

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

  useEffect(() => {
    // Only employer views count toward the "profile views" stat shown on the
    // candidate dashboard — a candidate browsing another candidate's profile
    // shouldn't inflate that number. Notifications are batched into a daily
    // digest (api/cron/profile-view-digest.js) rather than sent per view.
    if (!profile || !user || isOwner || userType !== 'employer') return
    // Fire-and-forget view tracking — never block or break the page on failure.
    supabase.from('profile_views').insert({ candidate_id: profile.id, viewer_id: user.id })
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

        <div className="profile-hero-body">
          <div className="profile-hero-info">
            <div className="profile-hero-avatar-row">
              <CandidateAvatar avatarUrl={profile.avatar_url} fullName={profile.full_name} size={96} style={{ fontSize: 32 }} />
              <div style={{ minWidth: 0 }}>
                <div className="profile-name-row">
                  <h1 style={{ fontSize: 28 }}>{profile.full_name}</h1>
                  <CompanyLinkIcons
                    linkedinUrl={profile.linkedin_url}
                    websiteUrl={profile.website_url}
                    label={profile.full_name}
                    size={19}
                  />
                  <MessageIconButton
                    onMessage={isEmployerViewer ? () => setShowContact(true) : null}
                    label={profile.full_name}
                    size={19}
                  />
                  <ShareButton url={`https://beta.joinmellow.xyz/profile/${profile.username || profile.id}`} label="Share profile" size={19} />
                  {canBookMeeting && (
                    <BookMeetingButton onClick={() => setShowCalendly(true)} style={{ marginLeft: 'auto' }} />
                  )}
                </div>
                <p style={{ marginTop: 6, fontSize: 16, color: 'var(--color-text-muted)' }}>
                  {profile.current_company ? `${profile.job_title} at ${profile.current_company}` : profile.job_title}
                  {profile.location && ` · ${profile.location}`}
                  {profile.years_of_experience && ` · ${profile.years_of_experience}`}
                </p>

                {profile.headline && (
                  <p style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.5 }}>
                    {profile.headline}
                  </p>
                )}

                {(profile.availability || profile.work_style?.length > 0) && (
                  <div className="profile-tag-row" style={{ marginTop: 12 }}>
                    {profile.availability && (
                      <span className="tag" style={{ fontSize: 12, fontWeight: 600, background: '#e3f9e9', color: '#0f7a3d' }}>
                        Available: {profile.availability}
                      </span>
                    )}
                    {profile.work_style?.map((w) => (
                      <span key={w} className="tag" style={{ fontSize: 12 }}>
                        {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
          {profile.intro_video_url ? (
            <VideoPlayCard url={profile.intro_video_url} format="auto" style={{ width: '100%' }} />
          ) : (
            <div
              style={{
                borderRadius: 10,
                background: 'var(--color-bg-soft)',
                aspectRatio: '9 / 16',
                width: '100%',
                maxWidth: 320,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                fontSize: 14,
                textAlign: 'center',
                padding: 16,
              }}
            >
              No intro video yet
            </div>
          )}
        </div>

        {(isOwner || videos.length > 0) && (
          <div style={{ marginTop: 48 }}>
            {!isOwner && videos.length > 0 && (
              <>
                <h2 style={SECTION_TITLE_STYLE}>Watch me work</h2>
                <p style={{ marginTop: -8, marginBottom: 16, fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  These videos show how this person thinks, operates, and approaches real work, not just how they
                  present themselves.
                </p>
              </>
            )}

            {isOwner && videos.length === 0 && (
              <div>
                <h2 style={SECTION_TITLE_STYLE}>Watch me work</h2>
                <p style={{ marginTop: -8, fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  Add videos to show employers how you think and operate. This is your biggest differentiator.
                </p>
                <button type="button" className="btn btn-primary" onClick={() => setShowAddVideo(true)} style={{ marginTop: 16 }}>
                  Add a work video
                </button>
              </div>
            )}

            {isOwner && videos.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  ...SECTION_TITLE_STYLE,
                }}
              >
                <h2 style={{ fontSize: 20 }}>Watch me work</h2>
                <button className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setShowAddVideo(true)}>
                  + Add work video
                </button>
              </div>
            )}

            {videos.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 16,
                  marginTop: 16,
                }}
              >
                {videos.map((v) => (
                  <div key={v.id}>
                    <VideoPlayCard url={v.video_url} format="horizontal" />
                    <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{v.label}</p>
                    {v.description && (
                      <p style={{ marginTop: 2, fontSize: 12, color: 'var(--color-text-muted)' }}>{v.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {profile.bio && (
          <div id="about-section" style={{ marginTop: 48 }}>
            <h2 style={SECTION_TITLE_STYLE}>About</h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-text)' }}>{profile.bio}</p>
          </div>
        )}

        {profile.skills?.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={SECTION_TITLE_STYLE}>Skills</h2>
            <div className="profile-tag-row">
              {profile.skills.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.languages?.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={SECTION_TITLE_STYLE}>Languages</h2>
            <div className="profile-tag-row">
              {profile.languages.map((l) => (
                <span key={l.language} className="tag">
                  {l.language} · {l.proficiency}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.proud_of && (
          <div style={{ marginTop: 48 }}>
            <h2 style={SECTION_TITLE_STYLE}>What I'm most proud of</h2>
            <blockquote
              style={{
                margin: 0,
                paddingLeft: 20,
                borderLeft: '3px solid var(--color-primary)',
                fontSize: 16,
                lineHeight: 1.7,
                fontStyle: 'italic',
                color: 'var(--color-text)',
              }}
            >
              “{profile.proud_of}”
            </blockquote>
          </div>
        )}

        {(profile.education_level || profile.field_of_study || profile.institution_name || profile.graduation_year) && (
          <div style={{ marginTop: 48 }}>
            <h2 style={SECTION_TITLE_STYLE}>Education</h2>
            {(profile.education_level || profile.field_of_study) && (
              <p style={{ fontSize: 16 }}>
                {[profile.education_level, profile.field_of_study].filter(Boolean).join(' in ')}
              </p>
            )}
            {(profile.institution_name || profile.graduation_year) && (
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {[profile.institution_name, profile.graduation_year].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}
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
