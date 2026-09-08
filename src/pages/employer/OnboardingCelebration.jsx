import Confetti from '../../components/Confetti.jsx'
import WorkLibraryTip from './WorkLibraryTip.jsx'
import { usePersistedState } from '../../lib/usePersistedState.js'

export default function OnboardingCelebration() {
  // Persisted so a same-tab reload (see Onboarding.jsx's justCompleted
  // comment for why that happens) that already made it past the confetti
  // screen to the work-library tip resumes there, not back at the confetti.
  const [showTip, setShowTip] = usePersistedState('mellow_onboarding_employer_celebration_tip_shown', false)
  // Which button on the confetti screen sent the employer into the tip
  // screen — the tip screen's own primary button (and exit destination)
  // needs to match, so "Post a role" doesn't quietly turn into "browse
  // talent" once the tip is in the way. Persisted alongside showTip for
  // the same same-tab-reload reason.
  const [destination, setDestination] = usePersistedState('mellow_onboarding_employer_celebration_destination', 'talent')

  if (showTip) {
    return <WorkLibraryTip destination={destination} />
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '48px 24px' }}>
      <Confetti />
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <img
          src="/Client_to_creative.png"
          alt=""
          style={{ width: '100%', maxWidth: 280, margin: '0 auto', display: 'block' }}
        />
        <h1 style={{ marginTop: 40, fontSize: 'clamp(32px, 4vw, 44px)' }}>Your talent feed is ready.</h1>
        <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          You can now browse real talent, post your first role, and find the right person without reading a
          single CV. The best hire starts with a real conversation.
        </p>

        <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setDestination('talent')
              setShowTip(true)
            }}
            style={{ padding: '14px 28px', fontSize: 15 }}
          >
            Browse the talent feed
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setDestination('role')
              setShowTip(true)
            }}
            style={{ padding: '14px 28px', fontSize: 15 }}
          >
            Post a role
          </button>
        </div>
      </div>
    </div>
  )
}
