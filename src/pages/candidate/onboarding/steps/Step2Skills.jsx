import { useState } from 'react'

const MAX_SKILLS = 10

export default function Step2Skills({ initial, onContinue, onBack, saving }) {
  const [skills, setSkills] = useState(initial.skills || [])
  const [input, setInput] = useState('')

  function addSkill() {
    const value = input.trim()
    if (!value) return
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
      addSkill()
    } else if (e.key === 'Backspace' && !input) {
      setSkills((prev) => prev.slice(0, -1))
    }
  }

  function removeSkill(skill) {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onContinue({ skills })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="field">
        <label htmlFor="skill-input">Skills ({skills.length}/{MAX_SKILLS})</label>
        <input
          id="skill-input"
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={skills.length >= MAX_SKILLS ? 'Limit reached' : 'Type a skill and hit enter'}
          disabled={skills.length >= MAX_SKILLS}
        />
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
