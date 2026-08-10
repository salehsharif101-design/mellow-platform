import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { deleteAccount } from '../../lib/deleteAccount.js'
import ConfirmModal from '../../components/ConfirmModal.jsx'

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+']
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const MAX_LOGO_BYTES = 5 * 1024 * 1024
const MAX_HIGHLIGHT_LENGTH = 150
const MAX_ABOUT_LENGTH = 300
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

function useSavedFlash() {
  const [saved, setSaved] = useState(false)
  function flash() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  return [saved, flash]
}

export default function EmployerEditProfile() {
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!user) return

    async function loadProfile() {
      const { data: { user: freshUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !freshUser) {
        setLoadError(userError?.message || 'Your session has expired — please log in again.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('employer_profiles')
        .upsert({ user_id: freshUser.id }, { onConflict: 'user_id', ignoreDuplicates: true })
        .select()
        .maybeSingle()

      if (error) {
        setLoadError(error.message)
        setLoading(false)
        return
      }

      const row =
        data ??
        (await supabase.from('employer_profiles').select('*').eq('user_id', freshUser.id).single()).data

      setProfile(row)
      setLoading(false)
    }

    loadProfile()
  }, [user])

  if (loading) return null

  if (loadError) {
    return (
      <div className="section">
        <p className="form-error">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="section">
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, marginBottom: 32 }}>Edit your profile</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <LogoSection profile={profile} onUpdated={setProfile} />
          <CompanyInfoSection profile={profile} onUpdated={setProfile} />
          <AboutSection profile={profile} onUpdated={setProfile} />
          <HighlightSection profile={profile} onUpdated={setProfile} />
          <TypicalRolesSection profile={profile} onUpdated={setProfile} />
          <LinksSection profile={profile} onUpdated={setProfile} />
          <IntroVideoSection profile={profile} onUpdated={setProfile} />
          <DangerZoneSection />
        </div>
      </div>
    </div>
  )
}

function LogoSection({ profile, onUpdated }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    if (!LOGO_TYPES.includes(file.type)) {
      setError('Please upload a PNG, JPG, WEBP, or SVG image.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('That image is over the 5MB limit.')
      return
    }
    setUploading(true)
    try {
      const { data: { user: freshUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !freshUser) throw new Error(userError?.message || 'Your session has expired — please log in again.')

      const ext = file.name.split('.').pop() || 'png'
      const path = `${freshUser.id}/logo.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('company-logos').getPublicUrl(path)
      const { data: row, error: saveError } = await supabase
        .from('employer_profiles')
        .update({ logo_url: `${data.publicUrl}?t=${Date.now()}` })
        .eq('user_id', freshUser.id)
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
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Company logo</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            background: 'var(--color-bg-soft)',
            backgroundImage: profile.logo_url ? `url(${profile.logo_url})` : 'none',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)',
            fontWeight: 700,
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {!profile.logo_url && (profile.company_name?.[0]?.toUpperCase() || '?')}
        </div>
        <div>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : 'Change logo'}
            <input
              type="file"
              accept={LOGO_TYPES.join(',')}
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

function CompanyInfoSection({ profile, onUpdated }) {
  const [companyName, setCompanyName] = useState(profile.company_name || '')
  const [industry, setIndustry] = useState(profile.industry || '')
  const [companySize, setCompanySize] = useState(profile.company_size || COMPANY_SIZES[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, flash] = useSavedFlash()

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('employer_profiles')
      .update({
        company_name: companyName.trim(),
        industry: industry.trim(),
        company_size: companySize,
      })
      .eq('user_id', profile.user_id)
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
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Company info</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Company name</label>
          <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Industry</label>
          <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} required />
        </div>
        <div className="field">
          <label>Company size</label>
          <select className="input" value={companySize} onChange={(e) => setCompanySize(e.target.value)}>
            {COMPANY_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} employees
              </option>
            ))}
          </select>
        </div>
        {error && <p className="form-error">{error}</p>}
        <SaveButton saving={saving} saved={saved} />
      </form>
    </section>
  )
}

function AboutSection({ profile, onUpdated }) {
  const [about, setAbout] = useState(profile.about || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, flash] = useSavedFlash()

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('employer_profiles')
      .update({ about: about.trim() || null })
      .eq('user_id', profile.user_id)
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
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>About your company</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Short description (optional)</label>
          <textarea
            className="input"
            rows={4}
            value={about}
            onChange={(e) => setAbout(e.target.value.slice(0, MAX_ABOUT_LENGTH))}
            placeholder="A brief intro to your company — shown on your public role pages."
            maxLength={MAX_ABOUT_LENGTH}
          />
          <p style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {about.length}/{MAX_ABOUT_LENGTH}
          </p>
        </div>
        {error && <p className="form-error">{error}</p>}
        <SaveButton saving={saving} saved={saved} />
      </form>
    </section>
  )
}

function HighlightSection({ profile, onUpdated }) {
  const [companyHighlight, setCompanyHighlight] = useState(profile.company_highlight || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, flash] = useSavedFlash()

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('employer_profiles')
      .update({ company_highlight: companyHighlight.trim() || null })
      .eq('user_id', profile.user_id)
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
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>What makes your company a great place to work?</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Company highlight (optional)</label>
          <input
            className="input"
            value={companyHighlight}
            onChange={(e) => setCompanyHighlight(e.target.value.slice(0, MAX_HIGHLIGHT_LENGTH))}
            placeholder="e.g. flat structure, fast growth, remote friendly"
            maxLength={MAX_HIGHLIGHT_LENGTH}
          />
          <p style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {companyHighlight.length}/{MAX_HIGHLIGHT_LENGTH}
          </p>
        </div>
        {error && <p className="form-error">{error}</p>}
        <SaveButton saving={saving} saved={saved} />
      </form>
    </section>
  )
}

function TypicalRolesSection({ profile, onUpdated }) {
  const [typicalRoles, setTypicalRoles] = useState(profile.typical_roles || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, flash] = useSavedFlash()

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('employer_profiles')
      .update({ typical_roles: typicalRoles.trim() || null })
      .eq('user_id', profile.user_id)
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
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Typical roles</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>What kind of roles do you usually hire for? (optional)</label>
          <input
            className="input"
            value={typicalRoles}
            onChange={(e) => setTypicalRoles(e.target.value)}
            placeholder="e.g. designers, engineers, sales, operations"
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <SaveButton saving={saving} saved={saved} />
      </form>
    </section>
  )
}

function LinksSection({ profile, onUpdated }) {
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, flash] = useSavedFlash()

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('employer_profiles')
      .update({ linkedin_url: linkedinUrl.trim() || null })
      .eq('user_id', profile.user_id)
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
          <label>LinkedIn company page (optional)</label>
          <input
            className="input"
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/company/yourcompany"
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <SaveButton saving={saving} saved={saved} />
      </form>
    </section>
  )
}

function IntroVideoSection({ profile, onUpdated }) {
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
      const { data: { user: freshUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !freshUser) throw new Error(userError?.message || 'Your session has expired — please log in again.')

      const ext = file.name.split('.').pop() || 'mp4'
      const path = `${freshUser.id}/intro.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('company-videos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('company-videos').getPublicUrl(path)
      const { data: row, error: saveError } = await supabase
        .from('employer_profiles')
        .update({ intro_video_url: `${data.publicUrl}?t=${Date.now()}` })
        .eq('user_id', freshUser.id)
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
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Company intro video</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 12 }}>
        Optional — a 60-second video showing who your company is and why someone should join you. Shown
        prominently on your public role pages.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        {previewUrl && (
          <video
            src={previewUrl}
            controls
            style={{
              width: '100%',
              maxWidth: 400,
              aspectRatio: '16 / 9',
              objectFit: 'contain',
              borderRadius: 12,
              background: '#000',
              display: 'block',
            }}
          />
        )}
        <div className="field">
          <label>{previewUrl ? 'Replace video' : 'Upload video'} (mp4, mov, or webm — up to 50MB, 60s max)</label>
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
          message="Are you sure? This will permanently delete your company profile, roles, and all account data. This cannot be undone."
          confirmLabel="Delete my account"
          onClose={() => setShowConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </section>
  )
}
