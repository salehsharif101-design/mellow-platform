import { Link } from 'react-router-dom'
import { callAdminApi } from './adminApi.js'

export default function CandidatesTable({ candidates, setCandidates }) {
  async function toggleLive(candidate) {
    const nextValue = !candidate.isLive
    setCandidates((prev) => prev.map((c) => (c.id === candidate.id ? { ...c, isLive: nextValue } : c)))
    try {
      await callAdminApi('toggle-live', { candidateId: candidate.id, isLive: nextValue })
    } catch (err) {
      // revert on failure
      setCandidates((prev) => prev.map((c) => (c.id === candidate.id ? { ...c, isLive: !nextValue } : c)))
      alert(`Failed to update: ${err.message}`)
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--color-border)' }}>
            {['Name', 'Email', 'Location', 'Joined', 'Live', 'Completeness', 'Applications', ''].map((h) => (
              <th key={h} style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.fullName || '—'}</td>
              <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{c.email || '—'}</td>
              <td style={{ padding: '10px 12px' }}>{c.location || '—'}</td>
              <td style={{ padding: '10px 12px' }}>{c.dateJoined ? new Date(c.dateJoined).toLocaleDateString() : '—'}</td>
              <td style={{ padding: '10px 12px' }}>
                <button
                  type="button"
                  onClick={() => toggleLive(c)}
                  className="tag"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    background: c.isLive ? '#e3f9e9' : '#f2f2f2',
                    color: c.isLive ? '#0f7a3d' : 'var(--color-text-muted)',
                  }}
                >
                  {c.isLive ? 'Live' : 'Not live'}
                </button>
              </td>
              <td style={{ padding: '10px 12px' }}>{c.completeness}%</td>
              <td style={{ padding: '10px 12px' }}>{c.applicationCount}</td>
              <td style={{ padding: '10px 12px' }}>
                <Link to={`/profile/${c.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {candidates.length === 0 && (
        <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>No candidates yet.</p>
      )}
    </div>
  )
}
