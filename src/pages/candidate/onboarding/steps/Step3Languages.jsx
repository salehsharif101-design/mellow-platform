import { useState } from 'react'
import { supabase } from '../../../../lib/supabase.js'
import { useDraftAutosave } from '../../../../lib/useDraftAutosave.js'

const PROFICIENCIES = ['basic', 'conversational', 'fluent', 'native']

export default function Step3Languages({ initial, onContinue, onBack, saving }) {
  const [languages, setLanguages] = useState(initial.languages || [])
  const [language, setLanguage] = useState('')
  const [proficiency, setProficiency] = useState('conversational')

  function addLanguage() {
    const value = language.trim()
    if (!value) return
    setLanguages((prev) => {
      if (prev.some((l) => l.language.toLowerCase() === value.toLowerCase())) return prev
      return [...prev, { language: value, proficiency }]
    })
    setLanguage('')
    setProficiency('conversational')
  }

  function removeLanguage(lang) {
    setLanguages((prev) => prev.filter((l) => l.language !== lang))
  }

  // Saves the in-progress language list as a draft so it survives a
  // refresh, tab switch, or closed browser before "Continue" is clicked.
  useDraftAutosave(
    () => {
      if (!initial.id) return
      supabase.from('candidate_profiles').update({ languages }).eq('id', initial.id)
    },
    [languages],
  )

  function handleSubmit(e) {
    e.preventDefault()
    onContinue({ languages })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="language">Language</label>
          <input
            id="language"
            className="input"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Spanish"
          />
        </div>
        <div className="field" style={{ minWidth: 170 }}>
          <label htmlFor="proficiency">Proficiency</label>
          <select
            id="proficiency"
            className="input"
            value={proficiency}
            onChange={(e) => setProficiency(e.target.value)}
          >
            {PROFICIENCIES.map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-ghost" onClick={addLanguage} disabled={!language.trim()}>
          Add
        </button>
      </div>

      {languages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {languages.map((l) => (
            <div
              key={l.language}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {l.language} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>· {l.proficiency}</span>
              </span>
              <button
                type="button"
                onClick={() => removeLanguage(l.language)}
                aria-label={`Remove ${l.language}`}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontWeight: 700 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn btn-primary" type="submit" disabled={saving || languages.length === 0}>
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
