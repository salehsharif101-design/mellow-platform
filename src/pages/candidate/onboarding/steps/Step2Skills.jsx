import { useState } from 'react'

const MAX_SKILLS = 10

const SKILL_CATEGORIES = {
  Tech: ['JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Java', 'Swift', 'Figma', 'AWS', 'Git', 'TypeScript', 'Flutter', 'PHP', 'Ruby', 'C++'],
  Design: ['UI/UX Design', 'Graphic Design', 'Brand Identity', 'Motion Graphics', 'Illustration', 'Photography', 'Video Editing', '3D Modelling', 'Web Design', 'Product Design'],
  Marketing: ['Social Media', 'Content Writing', 'SEO', 'Email Marketing', 'Paid Ads', 'Copywriting', 'Brand Strategy', 'Market Research', 'PR', 'Growth Hacking'],
  Business: ['Project Management', 'Sales', 'Business Development', 'Account Management', 'Operations', 'Customer Success', 'Consulting', 'Strategy', 'Finance', 'HR'],
  Creative: ['Photography', 'Videography', 'Writing', 'Podcasting', 'Art Direction', 'Creative Direction', 'Storytelling'],
}

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
          <div key={category}>
            <h4 style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>{category}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {options.map((option) => {
                const selected = skills.some((s) => s.toLowerCase() === option.toLowerCase())
                const disabled = !selected && atLimit
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleSkill(option)}
                    disabled={disabled}
                    className="tag"
                    style={{
                      border: 'none',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      background: selected ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                      color: selected ? '#fff' : 'var(--color-primary)',
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="field">
        <label htmlFor="skill-input">Don't see it? Add your own</label>
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
