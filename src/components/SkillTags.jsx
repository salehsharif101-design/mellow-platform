// Card skill tags, capped at `max` with a muted "+N" pill for the rest. The
// pill reuses the real .tag class and the caller's exact size overrides, so
// height, radius and font size match the skill tags by construction; only
// the colours differ, to read as "not a skill". The full list always lives
// on the detail/profile page. Shared by the employer talent feed and the
// candidate roles feed so the two read identically.
export default function SkillTags({ skills, max, gap, tagStyle, style, className }) {
  const visible = skills.slice(0, max)
  const hidden = skills.slice(max)
  return (
    <div className={className} style={{ display: 'flex', flexWrap: 'wrap', gap, ...style }}>
      {visible.map((s) => (
        <span key={s} className="tag" style={tagStyle}>
          {s}
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          className="tag"
          title={hidden.join(', ')}
          aria-label={`${hidden.length} more skill${hidden.length === 1 ? '' : 's'}: ${hidden.join(', ')}`}
          style={{ ...tagStyle, background: '#eef0f3', color: 'var(--color-text-muted)' }}
        >
          +{hidden.length}
        </span>
      )}
    </div>
  )
}
