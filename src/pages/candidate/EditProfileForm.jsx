import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import AddWorkVideoModal from '../../components/AddWorkVideoModal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { deleteAccount } from '../../lib/deleteAccount.js'

const MAX_SKILLS = 10
const PROFICIENCIES = ['basic', 'conversational', 'fluent', 'native']
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_SECONDS = 60

function SaveButton({ saving, saved }) {
  return (
    <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
      {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
    </button>
  )
}

export default function EditProfileForm({ profile, userId, onUpdated }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      <OpenToOpportunitiesSection profile={profile} onUpdated={onUpdated} />
      <AvatarSection profile={profile} userId={userId} onUpdated={onUpdated} />
      <BasicsSection profile={profile} onUpdated={onUpdated} />
      <SkillsSection profile={profile} onUpdated={onUpdated} />
      <LanguagesSection profile={profile} onUpdated={onUpdated} />
      <LinkedInSection profile={profile} onUpdated={onUpdated} />
      <VideoSection profile={profile} userId={userId} onUpdated={onUpdated} />
      <WorkVideosSection profile={profile} userId={userId} />
      <DangerZoneSection />
    </div>
  )
}

function useSavedFlash() {
  const [saved, setSaved] = useState(false)
  function flash() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  return [saved, flash]
}

function AvatarSection({ profile, userId, onUpdated }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    if (!AVATAR_TYPES.includes(file.type)) {
      setError('Please upload a PNG, JPG, or WEBP image.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('That image is over the 5MB limit.')
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${userId}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { data: row, error: saveError } = await supabase
        .from('candidate_profiles')
        .update({ avatar_url: `${data.publicUrl}?t=${Date.now()}` })
        .eq('id', profile.id)
        .select()
        .single()
      if (saveError) throw saveError
      onUpdated(row)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Profile picture</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            width: 72,
            height: 72,
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
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : 'Change photo'}
            <input
              type="file"
              accept={AVATAR_TYPES.join(',')}
              onChange={handleFileChange}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
          {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
        </div>
      </div>
    </section>
  )
}

function OpenToOpportunitiesSection({ profile, onUpdated }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isOpen = profile.is_open_to_opportunities !== false

  async function toggle() {
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('candidate_profiles')
      .update({ is_open_to_opportunities: !isOpen })
      .eq('id', profile.id)
      .select()
      .single()
    if (saveError) setError(saveError.message)
    else onUpdated(data)
    setSaving(false)
  }

  return (
    <section>
      <div className="card" style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 16 }}>Open to opportunities</h3>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--color-text-muted)' }}>
            {isOpen ? 'Your profile is visible to employers' : 'Your profile is hidden from employers'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-pressed={isOpen}
          aria-label="Toggle open to opportunities"
          style={{
            flexShrink: 0,
            width: 46,
            height: 26,
            borderRadius: 999,
            border: 'none',
            padding: 3,
            cursor: saving ? 'default' : 'pointer',
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
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  )
}

function BasicsSection({ profile, onUpdated }) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [jobTitle, setJobTitle] = useState(profile.job_title || '')
  const [currentCompany, setCurrentCompany] = useState(profile.current_company || '')
  const [location, setLocation] = useState(profile.location || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, flash] = useSavedFlash()

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('candidate_profiles')
      .update({
        full_name: fullName.trim(),
        job_title: jobTitle.trim(),
        current_company: currentCompany.trim() || null,
        location: location.trim(),
        bio: bio.trim(),
      })
      .eq('id', profile.id)
      .select()
      .single()
    if (saveError) setError(saveError.message)
    else {
      onUpdated(data)
      flash()
    }
    setSaving(false)
  }

  return (
    <section>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Basics</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Current role or title</label>
          <input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Current company (optional)</label>
          <input
            className="input"
            value={currentCompany}
            onChange={(e) => setCurrentCompany(e.target.value)}
            placeholder="e.g. Google, Freelance, Between roles"
          />
        </div>
        <div className="field">
          <label>Location (city)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} required />
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea className="input" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} required />
        </div>
        {error && <p className="form-error">{error}</p>}
        <SaveButton saving={saving} saved={saved} />
      </form>
    </section>
  )
}

function SkillsSection({ profile, onUpdated }) {
  const [skills, setSkills] = useState(profile.skills || [])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, flash] = useSavedFlash()

  function addSkill() {
    const value = input.trim()
    if (!value) return
    setSkills((prev) => {
      if (prev.length >= MAX_SKILLS) return prev
      if (prev.some((s) => s.toLowerCase() === value.toLowerCase())) return prev
      return [...prev, value]
    })
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill()
    } else if (e.key === 'Backspace' && !input) {
      setSkills((prev) => prev.slice(0, -1))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('candidate_profiles')
      .update({ skills })
      .eq('id', profile.id)
      .select()
      .single()
    if (saveError) setError(saveError.message)
    else {
      onUpdated(data)
      flash()
    }
    setSaving(false)
  }

  return (
    <section>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Skills</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Skills ({skills.length}/{MAX_SKILLS})</label>
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={skills.length >= MAX_SKILLS ? 'Limit reached' : 'Type a skill and hit enter'}
            disabled={skills.length >= MAX_SKILLS}
          />
        </div>
        {skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {skills.map((skill) => (
              <span key={skill} className="tag">
                {skill}
                <button
                  type="button"
                  onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                  aria-label={`Remove ${skill}`}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <SaveButton saving={saving} saved={saved} />
      </form>
    </section>
  )
}

function LanguagesSection({ profile, onUpdated }) {
  const [languages, setLanguages] = useState(profile.languages || [])
  const [language, setLanguage] = useState('')
  const [proficiency, setProficiency] = useState('conversational')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, flash] = useSavedFlash()

  function addLanguage() {
    const value = language.trim()
    if (!value) return
    setLanguages((prev) => {
      if (prev.some((l) => l.language.toLowerCase() === value.toLowerCase())) return prev
      return [...prev, { language: value, proficiency }]
    })
    setLanguage('')
    setProficiency('conversational')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('candidate_profiles')
      .update({ languages })
      .eq('id', profile.id)
      .select()
      .single()
    if (saveError) setError(saveError.message)
    else {
      onUpdated(data)
      flash()
    }
    setSaving(false)
  }

  return (
    <section>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Languages</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Language</label>
            <input className="input" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Spanish" />
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Proficiency</label>
            <select className="input" value={proficiency} onChange={(e) => setProficiency(e.target.value)}>
              {PROFICIENCIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-ghost" onClick={addLanguage} disabled={!language.trim()}>
            Add
          </button>
        </div>
        {languages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {languages.map((l) => (
              <div key={l.language} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px' }}>
                <span style={{ fontSize: 14 }}>
                  {l.language} <span style={{ color: 'var(--color-text-muted)' }}>· {l.proficiency}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setLanguages((prev) => prev.filter((x) => x.language !== l.language))}
                  aria-label={`Remove ${l.language}`}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontWeight: 700 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <SaveButton saving={saving} saved={saved} />
      </form>
    </section>
  )
}

function LinkedInSection({ profile, onUpdated }) {
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url || '')
  const [calendlyUrl, setCalendlyUrl] = useState(profile.calendly_url || '')
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, flash] = useSavedFlash()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmedWebsite = websiteUrl.trim()
    if (trimmedWebsite && !/^https?:\/\//i.test(trimmedWebsite)) {
      setError('Portfolio or website must start with https:// or http://')
      return
    }

    setSaving(true)
    const { data, error: saveError } = await supabase
      .from('candidate_profiles')
      .update({
        linkedin_url: linkedinUrl.trim() || null,
        calendly_url: calendlyUrl.trim() || null,
        website_url: trimmedWebsite || null,
      })
      .eq('id', profile.id)
      .select()
      .single()
    if (saveError) setError(saveError.message)
    else {
      onUpdated(data)
      flash()
    }
    setSaving(false)
  }

  return (
    <section>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Links</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>LinkedIn URL</label>
          <input
            className="input"
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/yourname"
          />
        </div>
        <div className="field">
          <label>Calendly link (optional)</label>
          <input
            className="input"
            type="url"
            value={calendlyUrl}
            onChange={(e) => setCalendlyUrl(e.target.value)}
            placeholder="https://calendly.com/yourname"
          />
        </div>
        <div className="field">
          <label>Portfolio or website (optional)</label>
          <input
            className="input"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourportfolio.com"
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <SaveButton saving={saving} saved={saved} />
      </form>
    </section>
  )
}

function VideoSection({ profile, userId, onUpdated }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(profile.intro_video_url || null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setError('')
    if (!VIDEO_TYPES.includes(selected.type)) {
      setError('Please upload an mp4, mov, or webm file.')
      return
    }
    if (selected.size > MAX_VIDEO_BYTES) {
      setError('That file is over the 50MB limit.')
      return
    }
    const objectUrl = URL.createObjectURL(selected)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      if (probe.duration > MAX_VIDEO_SECONDS + 0.5) {
        setError('Your video is longer than 60 seconds — please trim it and try again.')
        URL.revokeObjectURL(objectUrl)
        return
      }
      setFile(selected)
      setPreviewUrl(objectUrl)
    }
    probe.src = objectUrl
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() || 'mp4'
      const path = `${userId}/intro.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('candidate-videos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('candidate-videos').getPublicUrl(path)
      const { data: row, error: saveError } = await supabase
        .from('candidate_profiles')
        .update({ intro_video_url: `${data.publicUrl}?t=${Date.now()}` })
        .eq('id', profile.id)
        .select()
        .single()
      if (saveError) throw saveError
      onUpdated(row)
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Intro video</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        {previewUrl && (
          <video
            src={previewUrl}
            controls
            style={{
              width: '100%',
              maxWidth: 400,
              aspectRatio: '9 / 16',
              objectFit: 'contain',
              borderRadius: 12,
              background: '#000',
              margin: '0 auto',
              display: 'block',
            }}
          />
        )}
        <div className="field">
          <label>Replace video (mp4, mov, or webm — up to 50MB)</label>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 8 }}>
            Record vertically (portrait) for the best fit — that's how your video will be shown.
          </p>
          <input type="file" accept={VIDEO_TYPES.join(',')} onChange={handleFileChange} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="button" onClick={handleUpload} disabled={!file || uploading} style={{ alignSelf: 'flex-start' }}>
          {uploading ? 'Uploading…' : 'Save video'}
        </button>
      </div>
    </section>
  )
}

function WorkVideosSection({ profile, userId }) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddVideo, setShowAddVideo] = useState(false)
  const [deletingVideo, setDeletingVideo] = useState(null)

  useEffect(() => {
    supabase
      .from('candidate_videos')
      .select('*')
      .eq('candidate_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setVideos(data || [])
        setLoading(false)
      })
  }, [profile.id])

  async function handleDelete(video) {
    const { error } = await supabase.from('candidate_videos').delete().eq('id', video.id)
    if (error) throw error
    setVideos((prev) => prev.filter((v) => v.id !== video.id))
    setDeletingVideo(null)

    // Best-effort storage cleanup — never blocks the UI or surfaces an
    // error, since the video is already gone from the candidate's profile
    // either way.
    const marker = '/candidate-videos/'
    const idx = video.video_url.indexOf(marker)
    if (idx !== -1) {
      const path = video.video_url.slice(idx + marker.length).split('?')[0]
      supabase.storage.from('candidate-videos').remove([path]).catch(() => {})
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ fontSize: 16 }}>Work videos</h3>
        <button className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setShowAddVideo(true)}>
          + Add work video
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        Add videos that show your work. Screen recordings, project walkthroughs, or anything that shows how you
        think and operate.
      </p>

      {!loading && videos.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>No work videos yet.</p>
      )}

      {videos.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16,
            maxWidth: 420,
          }}
        >
          {videos.map((v) => (
            <div key={v.id}>
              <VideoPlayCard url={v.video_url} format="horizontal" />
              <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{v.label}</p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 6, fontSize: 12, padding: '4px 10px', color: '#d92d20', borderColor: '#d92d20' }}
                onClick={() => setDeletingVideo(v)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddVideo && (
        <AddWorkVideoModal
          candidateId={profile.id}
          userId={userId}
          onClose={() => setShowAddVideo(false)}
          onAdded={(row) => {
            setVideos((prev) => [row, ...prev])
            setShowAddVideo(false)
          }}
        />
      )}

      {deletingVideo && (
        <ConfirmModal
          title="Delete this video?"
          message={`"${deletingVideo.label}" will be permanently removed from your profile. This can't be undone.`}
          onClose={() => setDeletingVideo(null)}
          onConfirm={() => handleDelete(deletingVideo)}
        />
      )}
    </section>
  )
}

function DangerZoneSection() {
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleDelete() {
    await deleteAccount()
    navigate('/?accountDeleted=1')
  }

  return (
    <section>
      <h3 style={{ fontSize: 16, marginBottom: 12, color: '#d92d20' }}>Danger zone</h3>
      <button type="button" className="btn btn-ghost" style={{ borderColor: '#d92d20', color: '#d92d20' }} onClick={() => setShowConfirm(true)}>
        Delete my account
      </button>

      {showConfirm && (
        <ConfirmModal
          title="Delete your account?"
          message="Are you sure? This will permanently delete your profile, videos, and all account data. This cannot be undone."
          confirmLabel="Delete my account"
          onClose={() => setShowConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </section>
  )
}
