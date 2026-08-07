const STEP_LABELS = ['Basics', 'Skills', 'Languages', 'Links', 'Video']

export default function OnboardingProgress({ step }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i + 1 <= step ? 'var(--color-primary)' : 'var(--color-border)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>
      <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
        Step {step} of {STEP_LABELS.length} — {STEP_LABELS[step - 1]}
      </p>
    </div>
  )
}
