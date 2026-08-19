import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import AddWorkVideoModal from '../../components/AddWorkVideoModal.jsx'
import VideoRecorderModal from '../../components/VideoRecorderModal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { deleteAccount } from '../../lib/deleteAccount.js'

const MAX_SKILLS = 10
const PROFICIENCIES = ['basic', 'conversational', 'fluent', 'native']
const EDUCATION_LEVELS = ['High School', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Self-taught', 'Other']
const YEARS_OF_EXPERIENCE_OPTIONS = ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years']
const AVAILABILITY_OPTIONS = ['Immediately', 'Within a month', '1 to 3 months', 'Just exploring']
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_SECONDS = 60

export default function EditProfileForm({ profile, userId, onUpdated }) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [jobTitle, setJobTitle] = useState(profile.job_title || '')
  const [currentCompany, setCurrentCompany] = useState(profile.current_company || '')
  const [yearsOfExperience, setYearsOfExperience] = useState(profile.years_of_experience || '')
  const [availability, setAvailability] = useState(profile.availability || '')
  const [location, setLocation] = useState(profile.location || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [headline, setHeadline] = useState(profile.headline || '')
  const [proudOf, setProudOf] = useState(profile.proud_of || '')
  const [educationLevel, setEducationLevel] = useState(profile.education_level || '')
  const [fieldOfStudy, setFieldOfStudy] = useState(profile.field_of_study || '')
  const [institutionName, setInstitutionName] = useState(profile.institution_name || '')
  const [graduationYear, setGraduationYear] = useState(profile.graduation_year || '')
  const [skills, setSkills] = useState(profile.skills || [])
  const [languages, setLanguages] = useState(profile.languages || [])
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url || '')
  const [calendlyUrl, setCalendlyUrl] = useState(profile.calendly_url || '')
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || '')
  const [introVideoUrl, setIntroVideoUrl] = useState(profile.intro_video_url || null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [errorField, setErrorField] = useState(null)
  const [success, setSuccess] = useState(false)

  const fieldRefs = {
    fullName: useRef(null),
    jobTitle: useRef(null),
    location: useRef(null),
    bio: useRef(null),
    availability: useRef(null),
    skills: useRef(null),
    languages: useRef(null),
    linkedinUrl: useRef(null),
    calendlyUrl: useRef(null),
    websiteUrl: useRef(null),
  }

  function validate() {
    if (!fullName.trim()) return { field: 'fullName', message: 'Full name is required.' }
    if (!jobTitle.trim()) return { field: 'jobTitle', message: 'Current role or title is required.' }
    if (!location.trim()) return { field: 'location', message: 'Location is required.' }
    if (!bio.trim()) return { field: 'bio', message: 'Bio is required.' }
    if (!availability) return { field: 'availability', message: 'Please select when you can start.' }
    if (skills.length === 0) return { field: 'skills', message: 'Please add at least one skill.' }
    if (languages.length === 0) return { field: 'languages', message: 'Please add at least one language.' }
    const trimmedLinkedin = linkedinUrl.trim()
    if (trimmedLinkedin && !/^https?:\/\//i.test(trimmedLinkedin)) {
      return { field: 'linkedinUrl', message: 'LinkedIn URL must start with https:// or http://' }
    }
    const trimmedCalendly = calendlyUrl.trim()
    if (trimmedCalendly && !/^https?:\/\//i.test(trimmedCalendly)) {
      return { field: 'calendlyUrl', message: 'Calendly link must start with https:// or http://' }
    }
    const trimmedWebsite = websiteUrl.trim()
    if (trimmedWebsite && !/^https?:\/\//i.test(trimmedWebsite)) {
      return { field: 'websiteUrl', message: 'Portfolio or website must start with https:// or http://' }
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
      .from('candidate_profiles')
      .update({
        full_name: fullName.trim(),
        job_title: jobTitle.trim(),
        current_company: currentCompany.trim() || null,
        years_of_experience: yearsOfExperience || null,
        availability: availability || null,
        location: location.trim(),
        bio: bio.trim(),
        headline: headline.trim() || null,
        proud_of: proudOf.trim() || null,
        education_level: educationLevel || null,
        field_of_study: fieldOfStudy.trim() || null,
        institution_name: institutionName.trim() || null,
        graduation_year: graduationYear ? Number(graduationYear) : null,
        skills,
        languages,
        linkedin_url: linkedinUrl.trim() || null,
        calendly_url: calendlyUrl.trim() || null,
        website_url: websiteUrl.trim() || null,
        intro_video_url: introVideoUrl || null,
      })
      .eq('id', profile.id)
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

      <OpenToOpportunitiesSection profile={profile} onUpdated={onUpdated} />
      <AvatarSection profile={profile} userId={userId} onUpdated={onUpdated} />

      <BasicsSection
        fullName={fullName}
        setFullName={setFullName}
        jobTitle={jobTitle}
        setJobTitle={setJobTitle}
        currentCompany={currentCompany}
        setCurrentCompany={setCurrentCompany}
        yearsOfExperience={yearsOfExperience}
        setYearsOfExperience={setYearsOfExperience}
        availability={availability}
        setAvailability={setAvailability}
        location={location}
        setLocation={setLocation}
        bio={bio}
        setBio={setBio}
        headline={headline}
        setHeadline={setHeadline}
        proudOf={proudOf}
        setProudOf={setProudOf}
        errorField={errorField}
        fieldRefs={fieldRefs}
      />

      <EducationSection
        educationLevel={educationLevel}
        setEducationLevel={setEducationLevel}
        fieldOfStudy={fieldOfStudy}
        setFieldOfStudy={setFieldOfStudy}
        institutionName={institutionName}
        setInstitutionName={setInstitutionName}
        graduationYear={graduationYear}
        setGraduationYear={setGraduationYear}
      />

      <SkillsSection skills={skills} setSkills={setSkills} errorField={errorField} fieldRefs={fieldRefs} />

      <LanguagesSection languages={languages} setLanguages={setLanguages} errorField={errorField} fieldRefs={fieldRefs} />

      <LinkedInSection
        linkedinUrl={linkedinUrl}
        setLinkedinUrl={setLinkedinUrl}
        calendlyUrl={calendlyUrl}
        setCalendlyUrl={setCalendlyUrl}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        errorField={errorField}
        fieldRefs={fieldRefs}
      />

      <VideoSection userId={userId} introVideoUrl={introVideoUrl} setIntroVideoUrl={setIntroVideoUrl} />

      <WorkVideosSection profile={profile} userId={userId} />

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

function AvatarSection({ profile, userId, onUpdated }) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  async function handleRemove() {
    setRemoving(true)
    setError('')
    try {
      const { data: row, error: saveError } = await supabase
        .from('candidate_profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id)
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
    <section id="photo-section">
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="icon-btn" style={{ cursor: uploading ? 'default' : 'pointer' }} aria-label="Change photo" title="Change photo">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <input
                type="file"
                accept={AVATAR_TYPES.join(',')}
                onChange={handleFileChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
            {uploading && <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Uploading…</span>}
          </div>
          {profile.avatar_url && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#d92d20', cursor: 'pointer', width: 'fit-content' }}
            >
              {removing ? 'Removing…' : 'Remove photo'}
            </button>
          )}
          {error && <p className="form-error" style={{ marginTop: 4 }}>{error}</p>}
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

function fieldStyle(hasError) {
  return hasError ? { borderColor: '#d92d20' } : undefined
}

function BasicsSection({
  fullName,
  setFullName,
  jobTitle,
  setJobTitle,
  currentCompany,
  setCurrentCompany,
  yearsOfExperience,
  setYearsOfExperience,
  availability,
  setAvailability,
  location,
  setLocation,
  bio,
  setBio,
  headline,
  setHeadline,
  proudOf,
  setProudOf,
  errorField,
  fieldRefs,
}) {
  return (
    <section id="basics-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Basics</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Full name</label>
          <input
            ref={fieldRefs.fullName}
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={fieldStyle(errorField === 'fullName')}
          />
        </div>
        <div className="field">
          <label>Current role or title</label>
          <input
            ref={fieldRefs.jobTitle}
            className="input"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            style={fieldStyle(errorField === 'jobTitle')}
          />
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
          <label>Years of experience (optional)</label>
          <select className="input" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)}>
            <option value="">Select…</option>
            {YEARS_OF_EXPERIENCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>When can you start?</label>
          <select
            ref={fieldRefs.availability}
            className="input"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            style={fieldStyle(errorField === 'availability')}
          >
            <option value="">Select…</option>
            {AVAILABILITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Location (city)</label>
          <input
            ref={fieldRefs.location}
            className="input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={fieldStyle(errorField === 'location')}
          />
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea
            ref={fieldRefs.bio}
            className="input"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={fieldStyle(errorField === 'bio')}
          />
        </div>
        <div className="field">
          <label>Your headline (optional)</label>
          <input
            className="input"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. I turn messy briefs into campaigns people remember"
            maxLength={100}
          />
        </div>
        <div className="field">
          <label>What I'm most proud of (optional)</label>
          <textarea
            className="input"
            rows={3}
            value={proudOf}
            onChange={(e) => setProudOf(e.target.value)}
            placeholder="Could be work, could be personal — anything that matters to you"
          />
        </div>
      </div>
    </section>
  )
}

function EducationSection({
  educationLevel,
  setEducationLevel,
  fieldOfStudy,
  setFieldOfStudy,
  institutionName,
  setInstitutionName,
  graduationYear,
  setGraduationYear,
}) {
  return (
    <section id="education-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Education</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Highest level of education (optional)</label>
          <select className="input" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
            <option value="">Select…</option>
            {EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Field of study (optional)</label>
          <input
            className="input"
            value={fieldOfStudy}
            onChange={(e) => setFieldOfStudy(e.target.value)}
            placeholder="e.g. Computer Science"
          />
        </div>
        <div className="field">
          <label>University or institution (optional)</label>
          <input
            className="input"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            placeholder="e.g. University of Bahrain"
          />
        </div>
        <div className="field">
          <label>Graduation year (optional)</label>
          <input
            className="input"
            type="number"
            min="1950"
            max="2100"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
            placeholder="e.g. 2022"
          />
        </div>
      </div>
    </section>
  )
}

function SkillsSection({ skills, setSkills, errorField, fieldRefs }) {
  const [input, setInput] = useState('')

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

  return (
    <section id="skills-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Skills</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>Skills</label>
          <input
            ref={fieldRefs.skills}
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={skills.length >= MAX_SKILLS ? 'Limit reached' : 'Type a skill and hit enter'}
            disabled={skills.length >= MAX_SKILLS}
            style={fieldStyle(errorField === 'skills')}
          />
          <p style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {skills.length}/{MAX_SKILLS} — at least one required
          </p>
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
      </div>
    </section>
  )
}

function LanguagesSection({ languages, setLanguages, errorField, fieldRefs }) {
  const [language, setLanguage] = useState('')
  const [proficiency, setProficiency] = useState('conversational')

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

  return (
    <section>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Languages</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Language</label>
            <input
              ref={fieldRefs.languages}
              className="input"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="Spanish"
              style={fieldStyle(errorField === 'languages')}
            />
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
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={addLanguage}
            disabled={!language.trim()}
          >
            Add
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: -6 }}>At least one language required</p>
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
      </div>
    </section>
  )
}

function LinkedInSection({
  linkedinUrl,
  setLinkedinUrl,
  calendlyUrl,
  setCalendlyUrl,
  websiteUrl,
  setWebsiteUrl,
  errorField,
  fieldRefs,
}) {
  return (
    <section id="linkedin-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Links</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <div className="field">
          <label>LinkedIn URL (optional)</label>
          <input
            ref={fieldRefs.linkedinUrl}
            className="input"
            type="text"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/yourname"
            style={fieldStyle(errorField === 'linkedinUrl')}
          />
        </div>
        <div className="field">
          <label>Calendly link (optional)</label>
          <p style={{ marginTop: -2, marginBottom: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Add your Calendly link so employers can book a meeting with you directly from your profile.
          </p>
          <input
            ref={fieldRefs.calendlyUrl}
            className="input"
            type="text"
            value={calendlyUrl}
            onChange={(e) => setCalendlyUrl(e.target.value)}
            placeholder="https://calendly.com/yourname"
            style={fieldStyle(errorField === 'calendlyUrl')}
          />
        </div>
        <div className="field">
          <label>Portfolio or website (optional)</label>
          <input
            ref={fieldRefs.websiteUrl}
            className="input"
            type="text"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourportfolio.com"
            style={fieldStyle(errorField === 'websiteUrl')}
          />
        </div>
      </div>
    </section>
  )
}

function VideoSection({ userId, introVideoUrl, setIntroVideoUrl }) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [showRecorder, setShowRecorder] = useState(false)

  const previewUrl = localPreviewUrl || introVideoUrl

  function processFile(selected) {
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
      setLocalPreviewUrl(objectUrl)
      handleUpload(selected)
    }
    probe.src = objectUrl
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    processFile(selected)
  }

  function handleRecorded(recordedFile) {
    setShowRecorder(false)
    processFile(recordedFile)
  }

  async function handleUpload(file) {
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
    <section id="video-section">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Intro video</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 260 }}>
        {previewUrl && (
          <video
            src={previewUrl}
            controls
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 10,
              background: '#000',
              display: 'block',
            }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Record video"
            title="Record video"
            onClick={() => setShowRecorder(true)}
            disabled={uploading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
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

        <Link to="/guide" target="_blank" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, width: 'fit-content' }}>
          How to record a great video →
        </Link>

        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Click Save below to apply your video change.
        </p>
      </div>

      {showRecorder && <VideoRecorderModal onClose={() => setShowRecorder(false)} onConfirm={handleRecorded} />}
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
    <section id="work-videos-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ fontSize: 16 }}>Watch me work</h3>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setShowAddVideo(true)}>
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
                onClick={() => setDeletingVideo(v)}
                style={{ marginTop: 4, background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: '#d92d20', cursor: 'pointer' }}
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
          message="Are you sure? This will permanently delete your profile, videos, and all account data. This cannot be undone."
          confirmLabel="Delete my account"
          onClose={() => setShowConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </section>
  )
}
