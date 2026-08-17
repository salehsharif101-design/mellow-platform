import { useState } from 'react'
import { SKILL_CATEGORIES } from '../lib/skillCategories.js'
import SkillCategorySection from './SkillCategorySection.jsx'

const MAX_SKILLS = 10

// Same click-to-toggle category grid + custom-skill input as the candidate
// onboarding skills step (Step2Skills.jsx), generalized into a controlled
// component so it can also be embedded in the employer role forms.
export default function SkillsPicker({ label = 'Skills', value, onChange, required = false }) {
  const [input, setInput] = useState('')

  const skills = value || []
  const atLimit = skills.length >= MAX_SKILLS

  function toggleSkill(skill) {
    const exists = skills.some((s) => s.toLowerCase() === skill.toLowerCase())
    if (exists) {
      onChange(skills.filter((s) => s.toLowerCase() !== skill.toLowerCase()))
      return
    }
    if (atLimit) return
    onChange([...skills, skill])
  }

  function addCustomSkill() {
    const value = input.trim()
    if (!value || atLimit) return
    if (skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setInput('')
      return
    }
    onChange([...skills, value])
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomSkill()
    } else if (e.key === 'Backspace' && !input) {
      onChange(skills.slice(0, -1))
    }
  }

  function removeSkill(skill) {
    onChange(skills.filter((s) => s !== skill))
  }

  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
        {label} {required ? '' : '(optional)'} ({skills.length}/{MAX_SKILLS})
      </label>
      <p style={{ marginTop: 4, marginBottom: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>
        Tap to add. Tap again to remove.
      </p>

      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {skills.map((skill) => (
            <span key={skill} className="tag">
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                aria-label={`Remove ${skill}`}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700, padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="skill-picker-input">Don't see it? Type your skill and press Enter to add it</label>
        <input
          id="skill-picker-input"
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={atLimit ? 'Limit reached' : 'Type a skill and hit enter'}
          disabled={atLimit}
        />
      </div>
    </div>
  )
}
