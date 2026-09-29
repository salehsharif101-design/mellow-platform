import { useState } from 'react'
import { supabase } from '../../../../lib/supabase.js'
import { useDraftAutosave } from '../../../../lib/useDraftAutosave.js'
import CalendlyConnect from '../../../../components/CalendlyConnect.jsx'

export default function Step4Links({ initial, onContinue, onBack, saving }) {
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedin_url || '')
  const [websiteUrl, setWebsiteUrl] = useState(initial.website_url || '')
  const [error, setError] = useState('')

  // Saves the in-progress links as a draft so they survive a refresh, tab
  // switch, or closed browser before "Continue"/"Skip" is clicked. Doesn't
  // validate the website URL format here — that check only blocks the real
  // submit, not the draft save. Calendly isn't part of this draft at all —
  // connecting it goes through CalendlyConnect's own OAuth flow (a full
  // navigation away and back via returnTo="onboarding", landing back on
  // this same step), not a field value collected here.
  useDraftAutosave(
    () => {
      if (!initial.id) return
      supabase
        .from('candidate_profiles')
        .update({
          linkedin_url: linkedinUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
        })
        .eq('id', initial.id)
    },
    [linkedinUrl, websiteUrl],
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
      website_url: trimmedWebsite || null,
    })
  }

  function handleSkip() {
    // Advances without touching either field — the draft autosave above
    // already persisted whatever was typed so far, so unconditionally
    // nulling both here (the previous behavior) threw away a link someone
    // had already entered just because they chose not to fill in the rest
    // before continuing. Calendly connection state (if any) isn't touched
    // by Continue or Skip either way — it lives on candidate_profiles
    // independently of this step's own fields.
    onContinue({})
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
        <label>Calendly (optional)</label>
        <p style={{ marginTop: -2, marginBottom: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
          Connect your Calendly so employers can book a meeting with you directly. You can also do this later from
          Edit Profile.
        </p>
        <CalendlyConnect
          schedulingUrl={initial.calendly_scheduling_url}
          username={initial.calendly_username}
          returnTo="onboarding"
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
