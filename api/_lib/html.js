// Shared HTML-escaping helper for anywhere a database-sourced string (a
// candidate's name, a role title, a company name) is interpolated into an
// HTML string built server-side — an email body, an OG-tagged page. Never
// applied to trusted, hand-authored markup we build ourselves (a real
// <a href> we construct), only to untrusted values spliced into it.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
