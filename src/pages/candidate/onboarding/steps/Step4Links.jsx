import { useState } from 'react'

export default function Step4Links({ initial, onContinue, onBack, saving }) {
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedin_url || '')
  const [calendlyUrl, setCalendlyUrl] = useState(initial.calendly_url || '')

  function handleSubmit(e) {
    e.preventDefault()
    onContinue({ linkedin_url: linkedinUrl.trim() || null, calendly_url: calendlyUrl.trim() || null })
  }

  function handleSkip() {
    onContinue({ linkedin_url: null, calendly_url: null })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="field">
        <label htmlFor="linkedin">LinkedIn URL (optional)</label>
        <input
          id="linkedin"
          className="input"
          type="url"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://linkedin.com/in/yourname"
        />
      </div>

      <div className="field">
        <label htmlFor="calendly">Calendly link (optional)</label>
        <input
          id="calendly"
          className="input"
          type="url"
          value={calendlyUrl}
          onChange={(e) => setCalendlyUrl(e.target.value)}
          placeholder="https://calendly.com/yourname"
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Continue'}
        </button>
        <button type="button" onClick={handleSkip} disabled={saving} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Skip
        </button>
      </div>
    </form>
  )
}
