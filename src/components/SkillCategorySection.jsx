import { useState } from 'react'

const PREVIEW_COUNT = 6

// One collapsible category block within a skill picker — shared by the
// candidate onboarding skills step and the employer role SkillsPicker so
// both collapse/expand identically. A skill the user already selected stays
// visible even while collapsed, regardless of its position in the list, so
// collapsing a category never hides your own picks.
export default function SkillCategorySection({ category, options, selected, atLimit, onToggle }) {
  const [expanded, setExpanded] = useState(false)

  const visibleOptions = expanded
    ? options
    : options.filter((option, i) => i < PREVIEW_COUNT || selected.some((s) => s.toLowerCase() === option.toLowerCase()))

  const hasHidden = !expanded && visibleOptions.length < options.length
  const canCollapse = expanded && options.length > PREVIEW_COUNT

  return (
    <div>
      <h4 style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>{category}</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {visibleOptions.map((option) => {
          const isSelected = selected.some((s) => s.toLowerCase() === option.toLowerCase())
          const disabled = !isSelected && atLimit
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              disabled={disabled}
              className="tag"
              style={{
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: isSelected ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                color: isSelected ? '#fff' : 'var(--color-primary)',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {option}
            </button>
          )
        })}
      </div>
      {(hasHidden || canCollapse) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: 13,
            fontWeight: 600,
            padding: 0,
            marginTop: 8,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
