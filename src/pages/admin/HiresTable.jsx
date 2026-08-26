import { Link } from 'react-router-dom'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'

function CompanyLogo({ logoUrl, companyName, size = 32 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: 'var(--color-bg-soft)',
        backgroundImage: logoUrl ? `url(${logoUrl})` : 'none',
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
      }}
    >
      {!logoUrl && (companyName?.[0]?.toUpperCase() || '?')}
    </div>
  )
}

export default function HiresTable({ data }) {
  const hires = data.hires || []

  return (
    <div>
      <div className="card" style={{ padding: 20, maxWidth: 220, marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Total confirmed hires</p>
        <p style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{data.total ?? 0}</p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--color-border)' }}>
              {['Candidate', 'Employer', 'Role', 'Confirmed', 'Time to hire'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hires.map((h) => (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 12px' }}>
                  {h.candidateUsername ? (
                    <Link
                      to={`/profile/${h.candidateUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none' }}
                    >
                      <CandidateAvatar avatarUrl={h.candidateAvatarUrl} fullName={h.candidateName} size={32} style={{ fontSize: 13 }} />
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{h.candidateName || '—'}</span>
                    </Link>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{h.candidateName || '—'}</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {h.companySlug ? (
                    <Link
                      to={`/company/${h.companySlug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none' }}
                    >
                      <CompanyLogo logoUrl={h.companyLogoUrl} companyName={h.companyName} />
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{h.companyName || '—'}</span>
                    </Link>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{h.companyName || '—'}</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{h.roleTitle || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{h.confirmedAt ? new Date(h.confirmedAt).toLocaleDateString() : '—'}</td>
                <td style={{ padding: '10px 12px' }}>{h.daysToHire != null ? `${h.daysToHire} day${h.daysToHire === 1 ? '' : 's'}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hires.length === 0 && <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>No confirmed hires yet.</p>}
      </div>
    </div>
  )
}
