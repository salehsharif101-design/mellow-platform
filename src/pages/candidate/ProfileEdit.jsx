import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useHideChrome } from '../../components/Layout.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'
import OnboardingProgress from './onboarding/OnboardingProgress.jsx'
import OnboardingWelcome from './onboarding/OnboardingWelcome.jsx'
import OnboardingCelebration from './onboarding/OnboardingCelebration.jsx'
import Step1Basics from './onboarding/steps/Step1Basics.jsx'
import Step2Skills from './onboarding/steps/Step2Skills.jsx'
import Step3Languages from './onboarding/steps/Step3Languages.jsx'
import Step4Links from './onboarding/steps/Step4Links.jsx'
import Step5Video from './onboarding/steps/Step5Video.jsx'
import EditProfileForm from './EditProfileForm.jsx'

const LAST_STEP = 5

export default function ProfileEdit() {
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showWelcome, setShowWelcome] = useState(true)
  const [justCompleted, setJustCompleted] = useState(false)

  useEffect(() => {
    if (!user) return

    async function loadProfile() {
      // Upsert is atomic at the DB level, so this is safe against the
      // effect firing twice concurrently (e.g. React StrictMode in dev).
      const { data, error } = await supabase
        .from('candidate_profiles')
        .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
        .select()
        .maybeSingle()

      if (error) {
        setLoadError(error.message)
        setLoading(false)
        return
      }

      if (data) {
        setProfile(data)
        setStep(Math.min(data.onboarding_step || 1, LAST_STEP))
      } else {
        // ignoreDuplicates suppresses the row on conflict, so re-fetch it
        const { data: existing, error: fetchError } = await supabase
          .from('candidate_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        if (fetchError) {
          setLoadError(fetchError.message)
          setLoading(false)
          return
        }
        setProfile(existing)
        setStep(Math.min(existing.onboarding_step || 1, LAST_STEP))
      }
      setLoading(false)
    }

    loadProfile()
  }, [user])

  const isComplete = (profile?.onboarding_step || 1) > LAST_STEP
  useHideChrome(!loading && (!isComplete || justCompleted))

  async function saveStep(fields, nextStep) {
    setSaving(true)
    try {
      const advance = Math.max(profile.onboarding_step || 1, nextStep)
      const { data, error } = await supabase
        .from('candidate_profiles')
        .update({ ...fields, onboarding_step: advance })
        .eq('id', profile.id)
        .select()
        .single()
      if (error) throw error
      setProfile(data)
      if (fields.is_live) {
        notify('live-notification', { candidateId: data.id })
        notify('video-library-notification', { candidateId: data.id })
      }
      if (nextStep > LAST_STEP) {
        setJustCompleted(true)
      } else {
        setStep(nextStep)
      }
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  if (loadError) {
    return (
      <div className="section">
        <p className="form-error">{loadError}</p>
      </div>
    )
  }

  if (isComplete) {
    if (justCompleted) {
      return <OnboardingCelebration username={profile.username || profile.id} candidateId={profile.id} userId={profile.user_id} />
    }
    return (
      <div className="section">
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, marginBottom: 32 }}>Edit your profile</h1>
          <EditProfileForm profile={profile} userId={user.id} onUpdated={setProfile} />
        </div>
        <HashScroll />
      </div>
    )
  }

  if (step === 1 && showWelcome) {
    return <OnboardingWelcome onContinue={() => setShowWelcome(false)} />
  }

  return (
    <div className="section">
      <div
        className="form-with-aside"
        style={{
          display: 'flex',
          gap: 48,
          maxWidth: 1000,
          margin: '0 auto',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <OnboardingProgress step={step} />

          {step === 1 && (
            <Step1Basics initial={profile} saving={saving} onContinue={(fields) => saveStep(fields, 2)} />
          )}
          {step === 2 && (
            <Step2Skills
              initial={profile}
              saving={saving}
              onBack={() => setStep(1)}
              onContinue={(fields) => saveStep(fields, 3)}
            />
          )}
          {step === 3 && (
            <Step3Languages
              initial={profile}
              saving={saving}
              onBack={() => setStep(2)}
              onContinue={(fields) => saveStep(fields, 4)}
            />
          )}
          {step === 4 && (
            <Step4Links
              initial={profile}
              saving={saving}
              onBack={() => setStep(3)}
              onContinue={(fields) => saveStep(fields, 5)}
            />
          )}
          {step === 5 && (
            <Step5Video
              initial={profile}
              userId={user.id}
              saving={saving}
              onBack={() => setStep(4)}
              onFinish={(fields) => saveStep({ ...fields, is_live: true }, 6)}
            />
          )}
        </div>

        <div
          className="decorative-aside"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: 32,
          }}
        >
          <img src="/Easy_stuff.png" alt="" style={{ width: '100%', maxWidth: 220 }} />
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>
            Take your time — everything you enter is saved automatically as you go.
          </p>
        </div>
      </div>
    </div>
  )
}

// Jumps to the section named by the URL hash (e.g. #skills-section) — used
// by the profile strength checklist's "Add a work video →" style links so
// they land directly on the relevant field instead of the top of the page.
// React Router doesn't scroll to hash fragments on its own.
function HashScroll() {
  useEffect(() => {
    if (!window.location.hash) return
    const el = document.querySelector(window.location.hash)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  return null
}
