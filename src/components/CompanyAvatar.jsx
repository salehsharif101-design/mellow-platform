// Employer counterpart to CandidateAvatar.jsx — a rounded-square logo
// instead of a circular photo (matching how company logos render
// everywhere else, e.g. CompanyProfile.jsx, RolePublic.jsx), with an
// initial-letter fallback when no logo has been uploaded.
export default function CompanyAvatar({ logoUrl, companyName, size = 44, style }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: logoUrl ? 'var(--color-bg-soft)' : '#005ef5',
        backgroundImage: logoUrl ? `url(${logoUrl})` : 'none',
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
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
      {!logoUrl && ((companyName || '').trim()[0]?.toUpperCase() || '?')}
    </div>
  )
}
