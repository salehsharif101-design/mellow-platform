import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
import HashScroll from '../../components/HashScroll.jsx'

const LAST_STEP = 5

export default function ProfileEdit({ forceWizard = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [profile, setProfile] = useState(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showWelcome, setShowWelcome] = useState(true)
  const [justCompleted, setJustCompleted] = useState(false)
  // Snapshot of onboarding_step as it was the moment the profile first
  // loaded — see savedForLaterAtVideoStep below for why this has to be
  // frozen rather than read live off `profile`.
  const [initialOnboardingStep, setInitialOnboardingStep] = useState(null)

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
        setInitialOnboardingStep(data.onboarding_step || 1)
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
        setInitialOnboardingStep(existing.onboarding_step || 1)
        setStep(Math.min(existing.onboarding_step || 1, LAST_STEP))
      }
      setLoading(false)
    }

    loadProfile()
  }, [user])

  const isComplete = (profile?.onboarding_step || 1) > LAST_STEP

  // A candidate who used "Save my profile and come back later" at the video
  // step (Step5Video.jsx's onSaveForLater) has onboarding_step stuck at
  // exactly LAST_STEP forever — never advancing past it, but never resetting
  // either, since steps 1-4 always fully collected real data before they got
  // here. The wizard's own signup flow is the only place it should still
  // appear for such a candidate (resuming mid-step, handled by `step` below,
  // with no navigation involved) — every dashboard-driven link, including
  // the profile-strength checklist's own intro-video item and the "not yet
  // live" banner, should land on the real Edit Profile form (and its
  // #video-section, for the intro video specifically) from here on, never
  // back through the wizard.
  //
  // Read off initialOnboardingStep (frozen at load), not the live
  // profile.onboarding_step — a candidate progressing through the wizard in
  // THIS session also passes through onboarding_step === LAST_STEP for the
  // one render right after finishing step 4 (saveStep's own update lands
  // before Step5Video ever mounts), which would otherwise satisfy this same
  // check and bounce them to the real edit form before they ever see the
  // video step.
  const savedForLaterAtVideoStep = initialOnboardingStep === LAST_STEP
  const deepLinkHash = location.hash

  // The Edit Profile button (Dashboard.jsx, PublicProfile.jsx) always links
  // to plain /profile/edit with no hash — "Edit profile" should always mean
  // Edit Profile, regardless of onboarding progress, so a hash-less visit
  // always shows the real edit form instead of resuming the wizard. The
  // wizard is reserved for a candidate genuinely still partway through
  // steps 1-4 (savedForLaterAtVideoStep false, isComplete false, and a
  // hash present — nothing to deep-link into yet at that point anyway).
  //
  // forceWizard overrides that hash-less default — it's how /onboarding
  // (the confirm-your-email and just-signed-up redirect target, see
  // Login.jsx and Signup.jsx) reaches this same component and still gets
  // the wizard on a first, hash-less visit. isComplete/savedForLaterAtVideoStep
  // still win over it, so a stale onboarding link for an already-onboarded
  // candidate falls through to the real form rather than re-running the
  // wizard.
  const showEditProfileForm = isComplete || savedForLaterAtVideoStep || (!deepLinkHash && !forceWizard)

  // `isComplete` defaults to false while `profile` is still null (loading),
  // so this hides chrome by default and only reveals it once we've
  // confirmed the profile is actually complete (or is taking one of the
  // bypasses above) — no flash on refresh.
  useHideChrome(!showEditProfileForm || justCompleted)

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
        // Only one email here, not two — the video-library nudge used to
        // fire in the same breath as this, landing in the same minute as
        // candidate-welcome (fired moments later once the dashboard
        // mounts). It's dropped rather than just delayed since the
        // dashboard they're about to land on already shows an equivalent
        // "add your first work video" banner natively — the email would
        // have duplicated a message they're seconds away from seeing
        // in-app anyway.
        notify('live-notification', { candidateId: data.id })
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

  // Deliberately leaves onboarding_step untouched (stays at 5, same as it
  // already was on arrival at this step) rather than treating it like a
  // normal saveStep(fields, 5) — profile.onboarding_step > LAST_STEP is what
  // `isComplete` checks, and keeping it at exactly 5 is what keeps the
  // dashboard's "not yet live" banner showing until a real video gets
  // uploaded. Every link back to /profile/edit from here on — the banner,
  // the checklist's intro-video item, the Edit Profile button itself — goes
  // straight to EditProfileForm (and its #video-section) instead of this
  // Step5Video step; see showEditProfileForm above.
  // video_reminder_started_at is only ever stamped the first time — it's
  // the timestamp api/cron/video-reminder.js measures the 24h/72h/7d
  // reminder delays from, and repeat "save for later" clicks shouldn't
  // reset that clock.
  async function saveForLater() {
    setSaving(true)
    try {
      if (!profile.video_reminder_started_at) {
        const { error } = await supabase
          .from('candidate_profiles')
          .update({ video_reminder_started_at: new Date().toISOString() })
          .eq('id', profile.id)
        if (error) throw error
      }
      navigate('/dashboard')
    } catch (err) {
      setLoadError(err.message)
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

  if (showEditProfileForm) {
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
              onSaveForLater={saveForLater}
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
