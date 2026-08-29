import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { deleteAccount } from '../../lib/deleteAccount.js'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { COUNTRIES } from '../../lib/countries.js'

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+']
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const MAX_LOGO_BYTES = 5 * 1024 * 1024
const MAX_HIGHLIGHT_LENGTH = 150
const MAX_ABOUT_LENGTH = 300
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const MAX_VIDEO_SECONDS = 60

export default function EmployerEditProfile() {
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isTeamMember, setIsTeamMember] = useState(false)

  useEffect(() => {
    if (!user) return

    async function loadProfile() {
      const { data: { user: freshUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !freshUser) {
        setLoadError(userError?.message || 'Your session has expired — please log in again.')
        setLoading(false)
        return
      }

      // Only the account owner can edit the company profile — a team
      // member sees a notice instead. Checked before the upsert below,
      // since that upsert would otherwise create a second, blank
      // employer_profiles row for a team member (unique on their own
      // user_id, so it wouldn't conflict with the owner's row).
      const { employerId, isOwner } = await resolveEmployerId(freshUser.id)
      if (employerId && !isOwner) {
        setIsTeamMember(true)
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

  if (isTeamMember) {
    return (
      <div className="section" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 24 }}>Only the account owner can edit the company profile</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
          Ask the account owner to make changes, or head back to the{' '}
          <Link to="/employer/dashboard" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            dashboard
          </Link>
          .
        </p>
      </div>
    )
  }

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
        <EditProfileFormBody profile={profile} onUpdated={setProfile} />
      </div>
    </div>
  )
}

function EditProfileFormBody({ profile, onUpdated }) {
  const [companyName, setCompanyName] = useState(profile.company_name || '')
  const [industry, setIndustry] = useState(profile.industry || '')
  const [companySize, setCompanySize] = useState(profile.company_size || COMPANY_SIZES[0])
  const [country, setCountry] = useState(profile.country || '')
  const [headline, setHeadline] = useState(profile.headline || '')
  const [about, setAbout] = useState(profile.about || '')
  const [cultureDescription, setCultureDescription] = useState(profile.culture_description || '')
  const [companyHighlight, setCompanyHighlight] = useState(profile.company_highlight || '')
  const [typicalRoles, setTypicalRoles] = useState(profile.typical_roles || '')
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url || '')
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || '')
  const [introVideoUrl, setIntroVideoUrl] = useState(profile.intro_video_url || null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [errorField, setErrorField] = useState(null)
  const [success, setSuccess] = useState(false)

  const fieldRefs = {
    companyName: useRef(null),
    industry: useRef(null),
    about: useRef(null),
    linkedinUrl: useRef(null),
    websiteUrl: useRef(null),
  }

  function validate() {
    if (!companyName.trim()) return { field: 'companyName', message: 'Company name is required.' }
    if (!industry.trim()) return { field: 'industry', message: 'Industry is required.' }
    if (!about.trim()) return { field: 'about', message: 'About your company is required.' }
    const trimmedLinkedin = linkedinUrl.trim()
    if (trimmedLinkedin && !/^https?:\/\//i.test(trimmedLinkedin)) {
      return { field: 'linkedinUrl', message: 'LinkedIn URL must start with https:// or http://' }
    }
    const trimmedWebsite = websiteUrl.trim()
    if (trimmedWebsite && !/^https?:\/\//i.test(trimmedWebsite)) {
      return { field: 'websiteUrl', message: 'Company website must start with https:// or http://' }
    }
    return null
  }

  async function handleSaveAll(e) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setErrorField(problem.field)
      setSaveError(problem.message)
      setSuccess(false)
      const ref = fieldRefs[problem.field]?.current
      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
        ref.focus()
      }
      return
    }

    setErrorField(null)
    setSaveError('')
    setSaving(true)
    const { data, error } = await supabase
      .from('employer_profiles')
      .update({
        company_name: companyName.trim(),
        industry: industry.trim(),
        company_size: companySize,
        country: country || null,
        headline: headline.trim() || null,
        about: about.trim() || null,
        culture_description: cultureDescription.trim() || null,
        company_highlight: companyHighlight.trim() || null,
        typical_roles: typicalRoles.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        website_url: websiteUrl.trim() || null,
        intro_video_url: introVideoUrl || null,
      })
      .eq('user_id', profile.user_id)
      .select()
      .single()
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    onUpdated(data)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <form onSubmit={handleSaveAll} style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      <SaveControls floating saving={saving} success={success} error={saveError} />

      <LogoSection profile={profile} onUpdated={onUpdated} />

      <CompanyInfoSection
        companyName={companyName}
        setCompanyName={setCompanyName}
        industry={industry}
        setIndustry={setIndustry}
        companySize={companySize}
        setCompanySize={setCompanySize}
        country={country}
        setCountry={setCountry}
        headline={headline}
        setHeadline={setHeadline}
        errorField={errorField}
        fieldRefs={fieldRefs}
      />

      <AboutSection about={about} setAbout={setAbout} errorField={errorField} fieldRefs={fieldRefs} />

      <CultureSection cultureDescription={cultureDescription} setCultureDescription={setCultureDescription} />

      <HighlightSection companyHighlight={companyHighlight} setCompanyHighlight={setCompanyHighlight} />

      <TypicalRolesSection typicalRoles={typicalRoles} setTypicalRoles={setTypicalRoles} />

      <LinksSection
        linkedinUrl={linkedinUrl}
        setLinkedinUrl={setLinkedinUrl}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        errorField={errorField}
        fieldRefs={fieldRefs}
      />

      <IntroVideoSection introVideoUrl={introVideoUrl} setIntroVideoUrl={setIntroVideoUrl} />

      <SaveControls saving={saving} success={success} error={saveError} />

      <DangerZoneSection />
    </form>
  )
}

function SaveControls({ saving, success, error, floating }) {
  return (
    <div
      style={
        floating
          ? {
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 40,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
            }
          : { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }
      }
    >
      {error && (
        <p
          className="form-error"
          style={
            floating ? { background: '#fff', padding: '6px 12px', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.15)' } : undefined
          }
        >
          {error}
        </p>
      )}
      {success && !error && (
        <p
          style={{
            color: '#0f7a3d',
            fontWeight: 600,
            fontSize: 14,
            ...(floating ? { background: '#fff', padding: '6px 12px', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.15)' } : {}),
          }}
        >
          Profile updated
        </p>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving}
        style={floating ? { boxShadow: '0 4px 14px rgba(0,0,0,0.2)', padding: '12px 28px' } : { alignSelf: 'flex-start' }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function LogoSection({ profile, onUpdated }) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  async function handleRemove() {
    setRemoving(true)
    setError('')
    try {
      const { data: { user: freshUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !freshUser) throw new Error(userError?.message || 'Your session has expired — please log in again.')
      const { data: row, error: saveError } = await supabase
        .from('employer_profiles')
        .update({ logo_url: null })
        .eq('user_id', freshUser.id)
        .select()
        .single()
      if (saveError) throw saveError
      onUpdated(row)
    } catch (err) {
      setError(err.message)
    } finally {
      setRemoving(false)
    }
  }

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
    <section id="logo-section">
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="icon-btn" style={{ cursor: uploading ? 'default' : 'pointer' }} aria-label="Change logo" title="Change logo">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <input
                type="file"
                accept={LOGO_TYPES.join(',')}
                onChange={handleFileChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
            {uploading && <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Uploading…</span>}
          </div>
          {profile.logo_url && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#d92d20', cursor: 'pointer', width: 'fit-content' }}
            >
              {removing ? 'Removing…' : 'Remove logo'}
            </button>
          )}
          {error && <p className="form-error" style={{ marginTop: 4 }}>{error}</p>}
        </div>
      </div>
    </section>
  )
}

function fieldStyle(hasError) {
  return hasError ? { borderColor: '#d92d20' } : undefined
}

function CompanyInfoSection({
  companyName,
  setCompanyName,
  industry,
  setIndustry,
  companySize,
  setCompanySize,
  country,
  setCountry,
  headline,
  setHeadline,
  errorField,
  fieldRefs,
}) {
  return (
    <section>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Company info</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Company name</label>
          <input
            ref={fieldRefs.companyName}
            className="input"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            style={fieldStyle(errorField === 'companyName')}
          />
        </div>
        <div className="field">
          <label>Industry</label>
          <input
            ref={fieldRefs.industry}
            className="input"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            style={fieldStyle(errorField === 'industry')}
          />
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
        <div className="field">
          <label>Country (optional)</label>
          <input
            className="input"
            list="country-options"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Start typing a country..."
            autoComplete="off"
          />
          <datalist id="country-options">
            {COUNTRIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>Company headline (optional)</label>
          <input
            className="input"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. We're building the future of hiring"
            maxLength={100}
          />
        </div>
      </div>
    </section>
  )
}

function AboutSection({ about, setAbout, errorField, fieldRefs }) {
  return (
    <section id="about-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>About your company</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Short description</label>
          <textarea
            ref={fieldRefs.about}
            className="input"
            rows={4}
            value={about}
            onChange={(e) => setAbout(e.target.value.slice(0, MAX_ABOUT_LENGTH))}
            placeholder="A brief intro to your company — shown on your public role pages."
            maxLength={MAX_ABOUT_LENGTH}
            style={fieldStyle(errorField === 'about')}
          />
          <p style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {about.length}/{MAX_ABOUT_LENGTH}
          </p>
        </div>
      </div>
    </section>
  )
}

function CultureSection({ cultureDescription, setCultureDescription }) {
  return (
    <section id="culture-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Company culture</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>What's it like to work here?</label>
          <textarea
            className="input"
            rows={4}
            value={cultureDescription}
            onChange={(e) => setCultureDescription(e.target.value)}
            placeholder="What's it like to work here?"
          />
        </div>
      </div>
    </section>
  )
}

function HighlightSection({ companyHighlight, setCompanyHighlight }) {
  return (
    <section id="highlight-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>What makes your company a great place to work?</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
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
      </div>
    </section>
  )
}

function TypicalRolesSection({ typicalRoles, setTypicalRoles }) {
  return (
    <section id="typical-roles-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Typical roles</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>What kind of roles do you usually hire for? (optional)</label>
          <input
            className="input"
            value={typicalRoles}
            onChange={(e) => setTypicalRoles(e.target.value)}
            placeholder="e.g. designers, engineers, sales, operations"
          />
        </div>
      </div>
    </section>
  )
}

function LinksSection({ linkedinUrl, setLinkedinUrl, websiteUrl, setWebsiteUrl, errorField, fieldRefs }) {
  return (
    <section id="links-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Links</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field" id="linkedin-field">
          <label>LinkedIn company page (optional)</label>
          <input
            ref={fieldRefs.linkedinUrl}
            className="input"
            type="text"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/company/yourcompany"
            style={fieldStyle(errorField === 'linkedinUrl')}
          />
        </div>
        <div className="field" id="website-field">
          <label>Company website (optional)</label>
          <input
            ref={fieldRefs.websiteUrl}
            className="input"
            type="text"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourcompany.com"
            style={fieldStyle(errorField === 'websiteUrl')}
          />
        </div>
      </div>
    </section>
  )
}

function IntroVideoSection({ introVideoUrl, setIntroVideoUrl }) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const previewUrl = localPreviewUrl || introVideoUrl

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setError('')
    if (!VIDEO_TYPES.includes(selected.type)) {
      setError('Please upload an mp4, mov, or webm file.')
      return
    }
    if (selected.size > MAX_VIDEO_BYTES) {
      setError('That file is over the 100MB limit.')
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
      setLocalPreviewUrl(objectUrl)
      handleUpload(selected)
    }
    probe.src = objectUrl
  }

  async function handleUpload(file) {
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
      setIntroVideoUrl(`${data.publicUrl}?t=${Date.now()}`)
      setLocalPreviewUrl(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setIntroVideoUrl(null)
    setLocalPreviewUrl(null)
  }

  return (
    <section id="intro-video-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Company intro video</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 12 }}>
        Optional — a 60-second video showing who your company is and why someone should join you. Shown
        prominently on your public role pages.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
        {previewUrl && (
          <video
            src={previewUrl}
            controls
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              objectFit: 'contain',
              borderRadius: 10,
              background: '#000',
              display: 'block',
            }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label className="icon-btn" style={{ cursor: uploading ? 'default' : 'pointer' }} aria-label="Upload video" title="Upload video">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <input
              type="file"
              accept={VIDEO_TYPES.join(',')}
              onChange={handleFileChange}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
          {uploading && <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Uploading…</span>}
        </div>

        {error && <p className="form-error" style={{ fontSize: 13 }}>{error}</p>}

        {introVideoUrl && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#d92d20', cursor: 'pointer', width: 'fit-content' }}
          >
            Remove video
          </button>
        )}

        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Click Save below to apply your video change.
        </p>
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
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        style={{ background: 'none', border: 'none', padding: 0, fontSize: 14, fontWeight: 600, color: '#d92d20', cursor: 'pointer' }}
      >
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
