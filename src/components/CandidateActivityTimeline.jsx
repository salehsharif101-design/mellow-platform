import { formatRelativeTime } from '../lib/roleFormat.js'

const EVENT_LABELS = {
  applied: () => 'Applied to this role',
  status_changed: (detail) => `Status changed to ${detail || 'a new stage'}`,
  shortlisted: () => 'Shortlisted',
  unshortlisted: () => 'Removed from shortlist',
  // detail is "<author email>: <note preview>" (see migration 0058's
  // log_note_activity trigger) — notes are posted, never edited, so there's
  // no separate "note edited" event any more.
  note_added: (detail) => `Note posted${detail ? ` — ${detail}` : ''}`,
  // Dead since migration 0058 collapsed note logging to insert-only — no
  // code writes this any more, but older rows from before that migration
  // still carry it, and fell through to rendering the raw event_type
  // string ("note_updated") with no label until now.
  note_updated: (detail) => `Note edited${detail ? ` — ${detail}` : ''}`,
  message_sent: (detail) => `Message sent${detail ? `: "${detail}"` : ''}`,
}

// Most-recent-first timeline of everything that's happened with a candidate
// on this role — events is pre-filtered/sorted by the caller (RoleApplicants
// bulk-loads candidate_activity_log once per role rather than per card).
export default function CandidateActivityTimeline({ events }) {
  if (!events || events.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No activity yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {events.map((e) => (
        <div key={e.id} style={{ display: 'flex', gap: 10 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-primary)',
              flexShrink: 0,
              marginTop: 6,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13 }}>{(EVENT_LABELS[e.event_type] || (() => e.event_type))(e.detail)}</p>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
              {formatRelativeTime(e.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
