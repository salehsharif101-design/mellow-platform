import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import Modal from '../../components/Modal.jsx'
import CalendlyModal from '../../components/CalendlyModal.jsx'
import MessageThread from '../../components/MessageThread.jsx'
import AddWorkVideoModal from '../../components/AddWorkVideoModal.jsx'

export default function PublicProfile() {
  const { id } = useParams()
  const { user, userType } = useAuth()

  const [profile, setProfile] = useState(null)
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [showCalendly, setShowCalendly] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [showAddVideo, setShowAddVideo] = useState(false)
  const [editingCalendly, setEditingCalendly] = useState(false)
  const [calendlyInput, setCalendlyInput] = useState('')
  const [savingCalendly, setSavingCalendly] = useState(false)
  const [calendlyError, setCalendlyError] = useState('')

  useEffect(() => {
    setLoading(true)
    setNotFound(false)

    async function load() {
      const { data, error } = await supabase.from('candidate_profiles').select('*').eq('id', id).maybeSingle()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setProfile(data)
      setCalendlyInput(data.calendly_url || '')

      const { data: videoRows } = await supabase
        .from('candidate_videos')
        .select('*')
        .eq('candidate_id', id)
        .order('created_at', { ascending: false })
      setVideos(videoRows || [])

      setLoading(false)
    }

    load()
  }, [id])

  const isOwner = user && profile && user.id === profile.user_id

  async function saveCalendly(e) {
    e.preventDefault()
    setSavingCalendly(true)
    setCalendlyError('')
    const { data, error } = await supabase
      .from('candidate_profiles')
      .update({ calendly_url: calendlyInput.trim() || null })
      .eq('id', profile.id)
      .select()
      .single()
    if (error) {
      setCalendlyError(error.message)
    } else {
      setProfile(data)
      setEditingCalendly(false)
    }
    setSavingCalendly(false)
  }

  useEffect(() => {
    if (!profile || !user || isOwner) return
    // Fire-and-forget view tracking — never block or break the page on failure.
    supabase.from('profile_views').insert({ candidate_id: profile.id, viewer_id: user.id }).then(() => {})
  }, [profile, user, isOwner])

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
              <h1 style={{ fontSize: 30 }}>{profile.full_name}</h1>
              <p style={{ marginTop: 6, fontSize: 16, color: 'var(--color-text-muted)' }}>
                {profile.job_title} · {profile.location}
              </p>
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
          <VideoPlayCard url={profile.intro_video_url} style={{ marginTop: 28, aspectRatio: '16 / 9', maxWidth: 480 }} />
        ) : (
          <div
            className="card"
            style={{
              marginTop: 28,
              maxWidth: 480,
              aspectRatio: '16 / 9',
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

        {isOwner && (
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 10 }}>Calendly link</h4>
            {editingCalendly ? (
              <div>
                <form onSubmit={saveCalendly} style={{ display: 'flex', gap: 10, maxWidth: 420 }}>
                  <input
                    className="input"
                    type="url"
                    placeholder="https://calendly.com/yourname"
                    value={calendlyInput}
                    onChange={(e) => setCalendlyInput(e.target.value)}
                  />
                  <button className="btn btn-primary" type="submit" disabled={savingCalendly}>
                    {savingCalendly ? 'Saving…' : 'Save'}
                  </button>
                </form>
                {calendlyError && <p className="form-error" style={{ marginTop: 8 }}>{calendlyError}</p>}
              </div>
            ) : (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setEditingCalendly(true)}>
                {profile.calendly_url ? 'Edit Calendly link' : '+ Add Calendly link'}
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Work videos</h4>
            {isOwner && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setShowAddVideo(true)}>
                + Add work video
              </button>
            )}
          </div>

          {videos.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-text-muted)' }}>No work videos yet.</p>
          ) : (
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
                  <VideoPlayCard url={v.video_url} style={{ aspectRatio: '4 / 3' }} />
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
