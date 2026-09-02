// Small corner-of-avatar unread indicator — Mellow blue with a white ring
// so it stays legible against any avatar/logo image behind it. The parent
// wrapping the avatar needs position: relative for this to sit correctly.
export default function UnreadDot({ label = 'Unread' }) {
  return (
    <span
      aria-label={label}
      style={{
        position: 'absolute',
        top: -2,
        right: -2,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: 'var(--color-primary)',
        border: '2px solid #fff',
      }}
    />
  )
}
