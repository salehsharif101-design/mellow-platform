export default function OnboardingWelcome({ onContinue }) {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <img src="/Flexible.PNG" alt="" style={{ width: '100%', maxWidth: 280, margin: '0 auto', display: 'block' }} />
        <h1 style={{ marginTop: 40, fontSize: 'clamp(32px, 4vw, 44px)', color: 'var(--color-primary)' }}>
          Welcome to Mellow
        </h1>
        <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Before we start, know this. There is no CV here. No keyword matching. No algorithm deciding if you are
          worth a conversation. Just you. Let's build your profile.
        </p>
        <button className="btn btn-primary" type="button" onClick={onContinue} style={{ marginTop: 36, padding: '14px 32px', fontSize: 15 }}>
          Let's go
        </button>
      </div>
    </div>
  )
}
