import { useState } from 'react'
import { SKILL_CATEGORIES } from '../../../../lib/skillCategories.js'
import SkillCategorySection from '../../../../components/SkillCategorySection.jsx'
import { supabase } from '../../../../lib/supabase.js'
import { useDraftAutosave } from '../../../../lib/useDraftAutosave.js'

const MAX_SKILLS = 10

export default function Step2Skills({ initial, onContinue, onBack, saving }) {
  const [skills, setSkills] = useState(initial.skills || [])
  const [input, setInput] = useState('')

  const atLimit = skills.length >= MAX_SKILLS

  function toggleSkill(skill) {
    setSkills((prev) => {
      const exists = prev.some((s) => s.toLowerCase() === skill.toLowerCase())
      if (exists) return prev.filter((s) => s.toLowerCase() !== skill.toLowerCase())
      if (prev.length >= MAX_SKILLS) return prev
      return [...prev, skill]
    })
  }

  function addCustomSkill() {
    const value = input.trim()
    if (!value || atLimit) return
    setSkills((prev) => {
      if (prev.length >= MAX_SKILLS) return prev
      if (prev.some((s) => s.toLowerCase() === value.toLowerCase())) return prev
      return [...prev, value]
    })
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomSkill()
    } else if (e.key === 'Backspace' && !input) {
      setSkills((prev) => prev.slice(0, -1))
    }
  }

  function removeSkill(skill) {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  // Saves the in-progress skill selection as a draft so it survives a
  // refresh, tab switch, or closed browser before "Continue" is clicked.
  useDraftAutosave(
    () => {
      if (!initial.id) return
      supabase.from('candidate_profiles').update({ skills }).eq('id', initial.id)
    },
    [skills],
  )

  function handleSubmit(e) {
    e.preventDefault()
    onContinue({ skills })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Skills ({skills.length}/{MAX_SKILLS})
        </label>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--color-text-muted)' }}>
          Tap to add. Tap again to remove.
        </p>
        <p style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>At least one skill required</p>
      </div>

      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {skills.map((skill) => (
            <span key={skill} className="tag">
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                aria-label={`Remove ${skill}`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {Object.entries(SKILL_CATEGORIES).map(([category, options]) => (
          <SkillCategorySection
            key={category}
            category={category}
            options={options}
            selected={skills}
            atLimit={atLimit}
            onToggle={toggleSkill}
          />
        ))}
      </div>

      <div className="field">
        <label htmlFor="skill-input">Don't see it? Type your skill and press Enter to add it</label>
        <input
          id="skill-input"
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={atLimit ? 'Limit reached' : 'Type a skill and hit enter'}
          disabled={atLimit}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn btn-primary" type="submit" disabled={saving || skills.length === 0}>
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
