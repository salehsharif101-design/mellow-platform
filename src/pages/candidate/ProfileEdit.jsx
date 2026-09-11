import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useHideChrome } from '../../components/Layout.jsx'
import { supabase } from '../../lib/supabase.js'
import { usePersistedState } from '../../lib/usePersistedState.js'
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

  const [profile, setProfile] = useState(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  // Persisted like justCompleted below it (and Step5Video's own showTips) —
  // a plain useState here meant a tab reload right after dismissing this
  // screen brought it back in front of Step 1, even though the candidate's
  // typed data (via draft autosave) was already intact.
  const [showWelcome, setShowWelcome] = usePersistedState('mellow_onboarding_candidate_show_welcome', true)
  // Persisted (not plain useState) so a same-tab reload right after
  // finishing — the browser discarding this tab under the memory pressure
  // of a link just opened in a new one is the common real-world trigger —
  // resumes the celebration/work-video-tip flow instead of falling through
  // to isComplete's own EditProfileForm branch below with no way left to
  // tell "mid celebration" apart from "a stale tab from before onboarding
  // even started."
  const [justCompleted, setJustCompleted] = usePersistedState('mellow_onboarding_candidate_just_completed', false)

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

  // A candidate who used "Save my profile and come back later" at the video
  // step (Step5Video.jsx's onSaveForLater) has onboarding_step stuck at
  // exactly LAST_STEP forever — never advancing past it, but never resetting
  // either, since steps 1-4 always fully collected real data before they got
  // here. Every dashboard-driven link, including the profile-strength
  // checklist's own intro-video item and the "not yet live" banner, should
  // land on the real Edit Profile form (and its #video-section, for the
  // intro video specifically) from here on, never back through the wizard.
  //
  // onboarding_step alone can't tell that candidate apart from one who
  // simply reached step 5 moments ago in the current wizard session — both
  // read onboarding_step === LAST_STEP, since saveStep's own update lands
  // the moment step 4 finishes, before Step5Video ever mounts. That
  // ambiguity isn't just a same-session render race either: navigating away
  // from step 5 (the guide link, a tab switch, a phone discarding a
  // background tab) and coming back re-mounts this component from scratch,
  // re-reading the same persisted onboarding_step === LAST_STEP with
  // nothing left to say "this was mid-wizard, not a deliberate pause."
  // video_reminder_started_at is that missing signal — onSaveForLater is the
  // ONLY place that ever stamps it (see its own comment below), so its
  // presence is exactly "this candidate deliberately left the wizard at the
  // video step," true only once they've actually clicked that button, in
  // this session or any prior one.
  const savedForLaterAtVideoStep = (profile?.onboarding_step || 1) === LAST_STEP && Boolean(profile?.video_reminder_started_at)

  // /onboarding (forceWizard, see Login.jsx and Signup.jsx) is the only
  // legitimate entry point into the wizard — every other route to this
  // component is plain /profile/edit, which should always mean Edit
  // Profile, full stop, regardless of onboarding progress or whether the
  // link carries a #section hash. Every dashboard-driven link (the
  // profile-strength checklist, the "not yet live" banner, the Edit
  // Profile button itself) points at /profile/edit#some-section for the
  // scroll-to-section behavior (HashScroll below reads the hash directly
  // off window.location, independent of this), not to resume the wizard —
  // a hash here is never a signal to show it.
  //
  // isComplete/savedForLaterAtVideoStep still apply on /onboarding itself,
  // so a stale onboarding link for an already-onboarded (or genuinely
  // saved-for-later) candidate falls through to the real form rather than
  // re-running the wizard.
  const showEditProfileForm = !forceWizard || isComplete || savedForLaterAtVideoStep

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
      // No email fired here on going live — Dashboard.jsx's candidate-welcome
      // notify() already covers it moments later, once the dashboard itself
      // mounts, and duplicated the same "your profile is live" message.
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
