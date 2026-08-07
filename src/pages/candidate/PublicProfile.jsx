import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import Modal from '../../components/Modal.jsx'
import CalendlyModal from '../../components/CalendlyModal.jsx'
import MessageThread from '../../components/MessageThread.jsx'
import AddWorkVideoModal from '../../components/AddWorkVideoModal.jsx'
import { notify } from '../../lib/notify.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const [linkCopied, setLinkCopied] = useState(false)

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

  async function shareProfile() {
    const url = `https://beta.joinmellow.xyz/profile/${profile.username || profile.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable or blocked (older browser, denied permission,
      // non-trusted context) — fall back to the legacy selection-based copy.
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  useEffect(() => {
    if (!profile || !user || isOwner) return
    // Fire-and-forget view tracking — never block or break the page on failure.
    supabase.from('profile_views').insert({ candidate_id: profile.id, viewer_id: user.id }).then(() => {
      if (userType === 'employer') {
        notify('profile-view-notification', { candidateId: profile.id, viewerId: user.id })
      }
    })
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

  return (
    <div className="section">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--color-bg-soft)',
                backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
                fontWeight: 700,
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {!profile.avatar_url && (profile.full_name?.[0]?.toUpperCase() || '?')}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 30 }}>{profile.full_name}</h1>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '6px 14px', fontSize: 13, position: 'relative' }}
                  onClick={shareProfile}
                >
                  {linkCopied ? 'Link copied!' : 'Share profile'}
                </button>
              </div>
              <p style={{ marginTop: 6, fontSize: 16, color: 'var(--color-text-muted)' }}>
                {profile.current_company ? `${profile.job_title} at ${profile.current_company}` : profile.job_title} · {profile.location}
              </p>
              {profile.work_style?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {profile.work_style.map((w) => (
                    <span key={w} className="tag" style={{ fontSize: 12 }}>
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isOwner && (
              <Link to="/profile/edit" className="btn btn-primary">
                Edit profile
              </Link>
            )}
            {profile.calendly_url && (
              <button className="btn btn-primary" onClick={() => setShowCalendly(true)}>
                Book a meeting
              </button>
            )}
            {isEmployerViewer && (
              <button className="btn btn-ghost" onClick={() => setShowContact(true)}>
                Contact
              </button>
            )}
          </div>
        </div>

        {profile.intro_video_url ? (
          <VideoPlayCard url={profile.intro_video_url} style={{ marginTop: 28 }} />
        ) : (
          <div
            className="card"
            style={{
              marginTop: 28,
              maxWidth: 400,
              margin: '28px auto 0',
              aspectRatio: '9 / 16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 14,
            }}
          >
            No intro video yet
          </div>
        )}

        {profile.bio && <p style={{ marginTop: 24, fontSize: 16, lineHeight: 1.6 }}>{profile.bio}</p>}

        {profile.three_words && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 10 }}>Known for</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.three_words
                .split(',')
                .map((w) => w.trim())
                .filter(Boolean)
                .map((word) => (
                  <span key={word} className="tag">
                    {word}
                  </span>
                ))}
            </div>
          </div>
        )}

        {profile.proud_of && (
          <div
            className="card"
            style={{
              marginTop: 20,
              padding: '20px 24px',
              background: 'var(--color-bg-soft)',
              border: 'none',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 6,
                left: 16,
                fontSize: 40,
                fontFamily: 'Georgia, serif',
                color: 'var(--color-primary)',
                opacity: 0.35,
                lineHeight: 1,
              }}
            >
              "
            </span>
            <p style={{ fontSize: 15, lineHeight: 1.6, fontStyle: 'italic', padding: '0 20px' }}>{profile.proud_of}</p>
            <span
              style={{
                position: 'absolute',
                bottom: 6,
                right: 16,
                fontSize: 40,
                fontFamily: 'Georgia, serif',
                color: 'var(--color-primary)',
                opacity: 0.35,
                lineHeight: 1,
              }}
            >
              "
            </span>
          </div>
        )}

        {profile.skills?.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 10 }}>Skills</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.skills.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.languages?.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 10 }}>Languages</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.languages.map((l) => (
                <span key={l.language} className="tag">
                  {l.language} · {l.proficiency}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.linkedin_url && (
          <div style={{ marginTop: 24 }}>
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}
            >
              View LinkedIn profile →
            </a>
          </div>
        )}

        <div style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: 18 }}>How {profile.full_name?.split(' ')[0]} actually works</h4>
            {isOwner && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setShowAddVideo(true)}>
                + Add work video
              </button>
            )}
          </div>

          {videos.length > 0 ? (
            <p style={{ marginTop: 6, fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              These videos show how this candidate thinks, operates, and approaches real work, not just how they
              present themselves.
            </p>
          ) : isOwner ? (
            <p style={{ marginTop: 6, fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Add work videos to show employers how you think and operate. This is your biggest differentiator.
            </p>
          ) : null}

          {videos.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 16,
                marginTop: 14,
              }}
            >
              {videos.map((v) => (
                <div key={v.id}>
                  <VideoPlayCard url={v.video_url} format="horizontal" />
                  <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{v.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
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
