import { useState } from 'react'
import { supabase } from '../../../../lib/supabase.js'
import { useDraftAutosave } from '../../../../lib/useDraftAutosave.js'

export default function Step4Links({ initial, onContinue, onBack, saving }) {
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedin_url || '')
  const [calendlyUrl, setCalendlyUrl] = useState(initial.calendly_url || '')
  const [websiteUrl, setWebsiteUrl] = useState(initial.website_url || '')
  const [error, setError] = useState('')

  // Saves the in-progress links as a draft so they survive a refresh, tab
  // switch, or closed browser before "Continue"/"Skip" is clicked. Doesn't
  // validate the website URL format here — that check only blocks the real
  // submit, not the draft save.
  useDraftAutosave(
    () => {
      if (!initial.id) return
      supabase
        .from('candidate_profiles')
        .update({
          linkedin_url: linkedinUrl.trim() || null,
          calendly_url: calendlyUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
        })
        .eq('id', initial.id)
    },
    [linkedinUrl, calendlyUrl, websiteUrl],
  )

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const trimmedWebsite = websiteUrl.trim()
    if (trimmedWebsite && !/^https?:\/\//i.test(trimmedWebsite)) {
      setError('Portfolio or website must start with https:// or http://')
      return
    }
    onContinue({
      linkedin_url: linkedinUrl.trim() || null,
      calendly_url: calendlyUrl.trim() || null,
      website_url: trimmedWebsite || null,
    })
  }

  function handleSkip() {
    onContinue({ linkedin_url: null, calendly_url: null, website_url: null })
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

      <div className="field">
        <label htmlFor="website">Portfolio or website (optional)</label>
        <input
          id="website"
          className="input"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://yourportfolio.com"
        />
      </div>

      {error && <p className="form-error">{error}</p>}

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
