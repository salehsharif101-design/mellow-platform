import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { deleteAccount } from '../../lib/deleteAccount.js'
import OnboardingWelcome from './OnboardingWelcome.jsx'
import OnboardingCelebration from './OnboardingCelebration.jsx'

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+']
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const MAX_LOGO_BYTES = 5 * 1024 * 1024
const MAX_HIGHLIGHT_LENGTH = 150

export default function EmployerOnboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [wasIncomplete, setWasIncomplete] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [companySize, setCompanySize] = useState(COMPANY_SIZES[0])
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [cultureDescription, setCultureDescription] = useState('')
  const [typicalRoles, setTypicalRoles] = useState('')
  const [companyHighlight, setCompanyHighlight] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null)
  const [logoError, setLogoError] = useState('')

  useEffect(() => {
    if (!user) return

    async function loadProfile() {
      const { data, error: fetchError } = await supabase
        .from('employer_profiles')
        .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
        .select()
        .maybeSingle()

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      const profile =
        data ??
        (
          await supabase.from('employer_profiles').select('*').eq('user_id', user.id).single()
        ).data

      if (profile) {
        setCompanyName(profile.company_name || '')
        setIndustry(profile.industry || '')
        setCompanySize(profile.company_size || COMPANY_SIZES[0])
        setWebsiteUrl(profile.website_url || '')
        setCultureDescription(profile.culture_description || '')
        setTypicalRoles(profile.typical_roles || '')
        setCompanyHighlight(profile.company_highlight || '')
        setLogoPreviewUrl(profile.logo_url || null)
        setWasIncomplete(!profile.company_name)
        setShowWelcome(!profile.company_name)
      }
      setLoading(false)
    }

    loadProfile()
  }, [user])

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError('')
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError('Please upload a PNG, JPG, WEBP, or SVG image.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('That image is over the 5MB limit.')
      return
    }
    setLogoFile(file)
    setLogoPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      let logoUrl = logoPreviewUrl && !logoFile ? logoPreviewUrl : undefined
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() || 'png'
        const path = `${user.id}/logo.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('company-logos').getPublicUrl(path)
        logoUrl = `${data.publicUrl}?t=${Date.now()}`
      }

      const { error: saveError } = await supabase
        .from('employer_profiles')
        .update({
          company_name: companyName.trim(),
          industry: industry.trim(),
          company_size: companySize,
          website_url: websiteUrl.trim() || null,
          culture_description: cultureDescription.trim(),
          typical_roles: typicalRoles.trim() || null,
          company_highlight: companyHighlight.trim() || null,
          ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
        })
        .eq('user_id', user.id)
      if (saveError) throw saveError

      if (wasIncomplete) {
        notify('employer-welcome', { userId: user.id })
        setJustCompleted(true)
      } else {
        navigate('/employer/roles/new')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await deleteAccount()
    navigate('/?accountDeleted=1')
  }

  if (loading) return null

  if (justCompleted) {
    return <OnboardingCelebration />
  }

  if (showWelcome) {
    return <OnboardingWelcome onContinue={() => setShowWelcome(false)} />
  }

  const isValid = companyName.trim() && industry.trim() && cultureDescription.trim()

  return (
    <div className="section">
      <div
        style={{
          display: 'flex',
          gap: 48,
          maxWidth: 1000,
          margin: '0 auto',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <h1 style={{ fontSize: 28 }}>Tell us about your company</h1>
          <p style={{ marginTop: 8, color: 'var(--color-text-muted)', fontSize: 15 }}>
            This shows up on your roles and helps candidates know who they'd be working with.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
            <div className="field">
              <label htmlFor="company_name">Company name</label>
              <input
                id="company_name"
                className="input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                required
              />
            </div>
            <div className="field">
              <label htmlFor="industry">Industry</label>
              <input
                id="industry"
                className="input"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Fintech"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="company_size">Company size</label>
              <select
                id="company_size"
                className="input"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
              >
                {COMPANY_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} employees
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="website_url">Website URL (optional)</label>
              <input
                id="website_url"
                className="input"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://acme.com"
              />
            </div>
            <div className="field">
              <label htmlFor="culture">Brief description of company culture</label>
              <textarea
                id="culture"
                className="input"
                rows={4}
                value={cultureDescription}
                onChange={(e) => setCultureDescription(e.target.value)}
                placeholder="What's it like to work here?"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="typical_roles">What kind of roles do you usually hire for? (optional)</label>
              <input
                id="typical_roles"
                className="input"
                value={typicalRoles}
                onChange={(e) => setTypicalRoles(e.target.value)}
                placeholder="e.g. designers, engineers, sales, operations"
              />
            </div>
            <div className="field">
              <label htmlFor="company_highlight">What makes your company a great place to work? (optional)</label>
              <input
                id="company_highlight"
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
            <div className="field">
              <label htmlFor="logo">Company logo (optional)</label>
              {logoPreviewUrl && (
                <img
                  src={logoPreviewUrl}
                  alt=""
                  style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)', marginBottom: 8 }}
                />
              )}
              <input id="logo" type="file" accept={LOGO_TYPES.join(',')} onChange={handleLogoChange} />
              {logoError && <p className="form-error">{logoError}</p>}
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={!isValid || saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </form>

          {!wasIncomplete && (
            <div style={{ marginTop: 48 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12, color: '#d92d20' }}>Danger zone</h3>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ borderColor: '#d92d20', color: '#d92d20' }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete my account
              </button>
            </div>
          )}
        </div>

        <div
          className="card decorative-aside"
          style={{
            flex: '0 0 280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: 32,
            background: 'var(--color-bg-soft)',
            border: 'none',
          }}
        >
          <img src="/Client_to_creative.png" alt="" style={{ width: '100%', maxWidth: 220 }} />
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>
            Next up: post your first role and start meeting candidates on video.
          </p>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete your account?"
          message="Are you sure? This will permanently delete your profile, videos, and all account data. This cannot be undone."
          confirmLabel="Delete my account"
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
