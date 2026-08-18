// Small icon-only action button (view/edit/delete, etc.) — a bordered
// square with a centered stroke icon. Native `title` gives a hover tooltip
// on desktop; `aria-label` covers screen readers and mobile. Matches
// ShareButton's sizing (see its `bordered` mode) so a row of these
// controls (e.g. on a role card) reads as one consistent button group.
export default function IconButton({ icon, label, onClick, href, variant = 'default', size = 17, disabled = false }) {
  const color = variant === 'danger' ? '#d92d20' : 'var(--color-primary)'
  const className = variant === 'danger' ? 'icon-btn icon-btn-danger' : 'icon-btn'
  const style = { opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }

  const svg = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icon}
    </svg>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={className} style={style}>
        {svg}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled} className={className} style={style}>
      {svg}
    </button>
  )
}
