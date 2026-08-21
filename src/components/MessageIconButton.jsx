// Message icon, styled and sized to sit inline with CompanyLinkIcons and
// ShareButton in a profile hero's icon row. The caller decides whether to
// show it (e.g. only an employer viewer can message a candidate) by only
// passing onMessage when applicable.
export default function MessageIconButton({ onMessage, label, size = 19 }) {
  if (!onMessage) return null
  return (
    <button
      type="button"
      onClick={onMessage}
      aria-label={`Message ${label}`}
      title="Message"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', lineHeight: 0 }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </button>
  )
}
