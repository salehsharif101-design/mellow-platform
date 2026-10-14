import { useState } from 'react'
import { supabase } from '../../../../lib/supabase.js'
import { useDraftAutosave } from '../../../../lib/useDraftAutosave.js'
import { isValidMeetingLink, MEETING_LINK_ERROR } from '../../../../lib/meetingLink.js'

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
    // Any https:// meeting or scheduling link is accepted — see
    // src/lib/meetingLink.js for why that's safe for non-Calendly hosts.
    const trimmedCalendly = calendlyUrl.trim()
    if (trimmedCalendly && !isValidMeetingLink(trimmedCalendly)) {
      setError(MEETING_LINK_ERROR)
      return
    }
    const trimmedWebsite = websiteUrl.trim()
    if (trimmedWebsite && !/^https?:\/\//i.test(trimmedWebsite)) {
      setError('Portfolio or website must start with https:// or http://')
      return
    }
    onContinue({
      linkedin_url: linkedinUrl.trim() || null,
      calendly_url: trimmedCalendly || null,
      website_url: trimmedWebsite || null,
    })
  }

  function handleSkip() {
    // Advances without touching any of the three fields — the draft
    // autosave above already persisted whatever was typed so far, so
    // unconditionally nulling all three here (the previous behavior) threw
    // away a link someone had already entered just because they chose not
    // to fill in the rest before continuing.
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
        <h3 style={{ fontSize: 16 }}>Add your meeting link</h3>
        <p style={{ marginTop: 4, marginBottom: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>
          Share a link where employers can book time with you — Calendly, Zoom, Google Meet, or any scheduling tool
          works.
        </p>
        <label htmlFor="meeting-link">Meeting Link (optional)</label>
        <input
          id="meeting-link"
          className="input"
          type="url"
          value={calendlyUrl}
          onChange={(e) => setCalendlyUrl(e.target.value)}
          placeholder="https://calendly.com/your-name"
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
