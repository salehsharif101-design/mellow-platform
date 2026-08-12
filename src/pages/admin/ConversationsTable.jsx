import { useEffect, useState } from 'react'
import { callAdminApi } from './adminApi.js'
import Modal from '../../components/Modal.jsx'

function ThreadModal({ conversation, onClose }) {
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    callAdminApi('conversation-thread', { userAId: conversation.userAId, userBId: conversation.userBId })
      .then(setMessages)
      .catch((err) => setError(err.message))
  }, [conversation])

  return (
    <Modal title={`${conversation.userALabel} ↔ ${conversation.userBLabel}`} onClose={onClose} width={520}>
      {error && <p className="form-error">{error}</p>}
      {!error && !messages && <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Loading…</p>}
      {messages && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
          {messages.map((m) => {
            const fromA = m.sender_id === conversation.userAId
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: fromA ? 'flex-start' : 'flex-end',
                  maxWidth: '80%',
                  background: fromA ? 'var(--color-bg-soft)' : 'var(--color-primary)',
                  color: fromA ? 'var(--color-text)' : '#fff',
                  borderRadius: 12,
                  padding: '8px 14px',
                }}
              >
                <p style={{ fontSize: 14 }}>{m.body}</p>
                <p style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>{new Date(m.sent_at).toLocaleString()}</p>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export default function ConversationsTable({ conversations }) {
  const [viewing, setViewing] = useState(null)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--color-border)' }}>
            {['Between', 'Last message', 'Messages', 'Last activity', ''].map((h, i) => (
              <th key={i} style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {conversations.map((c) => (
            <tr key={`${c.userAId}|${c.userBId}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                {c.userALabel} ↔ {c.userBLabel}
              </td>
              <td
                style={{
                  padding: '10px 12px',
                  color: 'var(--color-text-muted)',
                  maxWidth: 280,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.lastMessage}
              </td>
              <td style={{ padding: '10px 12px' }}>{c.messageCount}</td>
              <td style={{ padding: '10px 12px' }}>{c.lastSentAt ? new Date(c.lastSentAt).toLocaleString() : '—'}</td>
              <td style={{ padding: '10px 12px' }}>
                <button
                  type="button"
                  onClick={() => setViewing(c)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}
                >
                  View thread →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {conversations.length === 0 && (
        <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>No messages yet.</p>
      )}

      {viewing && <ThreadModal conversation={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
