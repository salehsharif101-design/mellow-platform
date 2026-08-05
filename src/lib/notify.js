// Fire-and-forget call to /api/email. Never blocks or breaks the calling
// flow — a failed notification email should not stop a signup, message,
// application, or shortlist from succeeding.
export function notify(action, payload) {
  fetch('/api/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  }).catch(() => {})
}
