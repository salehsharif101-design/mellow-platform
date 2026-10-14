// Helpers for the candidate "meeting link" (stored in candidate_profiles.
// calendly_url — the column name is a historical leftover; the field now
// accepts any scheduling or meeting tool: Calendly, Zoom, Google Meet, ...).

function parse(value) {
  try {
    return new URL(String(value || '').trim())
  } catch {
    return null
  }
}

// What the Edit Profile / onboarding forms accept on save: a real https://
// URL with a dotted hostname. Credentials in the URL are rejected so
// https://calendly.com@evil.example can't pass for a Calendly link.
export function isValidMeetingLink(value) {
  const url = parse(value)
  return Boolean(url && url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password)
}

// What the *sinks* (opening a link, framing one) accept. There's no
// server-side validation on this column — a candidate can write any string
// to it through the API — so anything that opens a stored value must
// re-check it here, regardless of what the form allowed. http: stays
// allowed so links saved before this check existed keep working; javascript:,
// data: and every other scheme never open.
export function isSafeMeetingLink(value) {
  const url = parse(value)
  return Boolean(url && (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password)
}

// Only Calendly is known to allow being framed. Zoom, Google Meet, Teams
// and most others send X-Frame-Options / frame-ancestors headers and would
// render a blank modal, and framing an arbitrary third-party page inside
// Mellow's own UI is a phishing risk anyway — so everything else opens in
// a new tab instead.
export function canEmbedMeetingLink(value) {
  const url = parse(value)
  if (!url || url.protocol !== 'https:' || url.username || url.password) return false
  return url.hostname === 'calendly.com' || url.hostname.endsWith('.calendly.com')
}

export function openMeetingLinkInNewTab(value) {
  if (!isSafeMeetingLink(value)) return
  window.open(String(value).trim(), '_blank', 'noopener,noreferrer')
}

export const MEETING_LINK_ERROR =
  'Please enter a valid link starting with https:// (e.g. https://calendly.com/yourname or https://zoom.us/j/123456789)'
