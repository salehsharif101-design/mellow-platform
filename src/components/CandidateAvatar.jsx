function getInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CandidateAvatar({ avatarUrl, fullName, size = 44, style }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: avatarUrl ? 'var(--color-bg-soft)' : '#005ef5',
        backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
        border: '2px solid #fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        ...style,
      }}
    >
      {!avatarUrl && getInitials(fullName)}
    </div>
  )
}
