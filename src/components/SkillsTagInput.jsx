import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { SKILL_CATEGORIES } from '../lib/skillCategories.js'

const MAX_SKILLS = 10
const MAX_SUGGESTIONS = 8

// The full suggestion pool: every predefined skill (Tech/Design/Marketing/
// Business/Creative) plus every custom skill already in use anywhere on the
// platform — a candidate's own skills or a role's required_skills — so a
// skill someone typed in by hand once shows up as a suggestion for
// everyone after that, the same way the fixed categories always did.
// Deduped case-insensitively; the first-seen casing wins, and the fixed
// list is seeded first so its canonical casing always takes priority over
// whatever casing a candidate or employer happened to type.
async function loadKnownSkills() {
  const byLower = new Map()
  Object.values(SKILL_CATEGORIES)
    .flat()
    .forEach((s) => byLower.set(s.toLowerCase(), s))

  const [{ data: candidateRows }, { data: roleRows }] = await Promise.all([
    supabase.from('candidate_profiles').select('skills').eq('is_live', true),
    supabase.from('roles').select('required_skills').eq('is_active', true),
  ])
  ;(candidateRows || []).forEach((r) =>
    (r.skills || []).forEach((s) => {
      if (s && !byLower.has(s.toLowerCase())) byLower.set(s.toLowerCase(), s)
    }),
  )
  ;(roleRows || []).forEach((r) =>
    (r.required_skills || []).forEach((s) => {
      if (s && !byLower.has(s.toLowerCase())) byLower.set(s.toLowerCase(), s)
    }),
  )

  return Array.from(byLower.values()).sort((a, b) => a.localeCompare(b))
}

// Searchable tag input: type to see matching suggestions from the full
// skills pool above, click one to add it, or press Enter to add whatever's
// typed as a custom skill even if it isn't in the list. Replaces the
// click-to-toggle category grid (SkillsPicker.jsx, still used as-is
// elsewhere) on pages where a faster, search-first flow fits better.
export default function SkillsTagInput({
  label = 'Skills',
  value,
  onChange,
  required = false,
  placeholder = 'Search and add skills',
  inputRef,
  inputStyle,
}) {
  const [query, setQuery] = useState('')
  const [knownSkills, setKnownSkills] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const blurTimeoutRef = useRef(null)

  const skills = value || []
  const atLimit = skills.length >= MAX_SKILLS

  useEffect(() => {
    let cancelled = false
    loadKnownSkills().then((loaded) => {
      if (!cancelled) setKnownSkills(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const selectedLower = new Set(skills.map((s) => s.toLowerCase()))
    return knownSkills.filter((s) => s.toLowerCase().includes(q) && !selectedLower.has(s.toLowerCase())).slice(0, MAX_SUGGESTIONS)
  }, [query, knownSkills, skills])

  function addSkill(skill) {
    const trimmed = skill.trim()
    if (!trimmed || atLimit) return
    setQuery('')
    setShowSuggestions(false)
    if (skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...skills, trimmed])
  }

  function removeSkill(skill) {
    onChange(skills.filter((s) => s !== skill))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill(query)
    } else if (e.key === 'Backspace' && !query) {
      onChange(skills.slice(0, -1))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
        {label} {required ? '' : '(optional)'} ({skills.length}/{MAX_SKILLS})
      </label>
      <p style={{ marginTop: 4, marginBottom: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
        {required ? 'At least one required.' : ''} Search to pick a suggestion, or type your own and press Enter.
      </p>

      <input
        ref={inputRef}
        className="input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setShowSuggestions(true)
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          // Delayed rather than immediate so a click on a suggestion
          // button registers before the list disappears out from under it.
          blurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 150)
        }}
        onKeyDown={handleKeyDown}
        placeholder={atLimit ? 'Limit reached' : placeholder}
        disabled={atLimit}
        autoComplete="off"
        style={inputStyle}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          className="card"
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            padding: 4,
            maxHeight: 220,
            overflowY: 'auto',
            boxShadow: '0 4px 14px rgba(10, 10, 10, 0.1)',
          }}
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="skill-suggestion-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addSkill(s)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--color-text)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
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
    </div>
  )
}
