const ICON_BUTTON_STYLE = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', lineHeight: 0 }

// Calendly + message icon pair, styled and sized to sit inline with
// CompanyLinkIcons and ShareButton in a profile hero's icon row. The caller
// decides visibility/permissions (e.g. don't show "book a meeting" to the
// profile owner) by only passing calendlyUrl/onMessage when applicable.
export default function ProfileContactIcons({ calendlyUrl, onBookMeeting, onMessage, label, size = 19 }) {
  if (!calendlyUrl && !onMessage) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {calendlyUrl && onBookMeeting && (
        <button
          type="button"
          onClick={onBookMeeting}
          aria-label={`Book a meeting with ${label}`}
          title="Book a meeting"
          style={ICON_BUTTON_STYLE}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      )}
      {onMessage && (
        <button
          type="button"
          onClick={onMessage}
          aria-label={`Message ${label}`}
          title="Message"
          style={ICON_BUTTON_STYLE}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      )}
    </span>
  )
}
