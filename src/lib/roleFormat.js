// Parsed manually (not `new Date(deadline)`) to avoid UTC-midnight parsing
// shifting the displayed date back a day in negative-UTC-offset timezones.
export function formatDeadline(deadline) {
  if (!deadline) return null
  const [year, month, day] = deadline.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatSalary(role) {
  if (!role.salary_min && !role.salary_max) return null
  const cur = role.salary_currency
  if (role.salary_min && role.salary_max) return `${cur} ${role.salary_min.toLocaleString()} – ${role.salary_max.toLocaleString()}`
  if (role.salary_min) return `${cur} ${role.salary_min.toLocaleString()}+`
  return `Up to ${cur} ${role.salary_max.toLocaleString()}`
}

// Hidden entirely below MIN_RESPONSES so a brand-new employer (or one with
// one or two lucky/unlucky replies) never sees a misleadingly confident rate.
const MIN_RESPONSES = 3

export function formatResponseRate(avgHours, responseCount) {
  if (avgHours == null || responseCount == null || responseCount < MIN_RESPONSES) return null
  if (avgHours < 6) return 'Usually responds within a few hours'
  if (avgHours < 24) return 'Usually responds within a day'
  return 'Usually responds within a few days'
}

export function daysSince(dateString) {
  if (!dateString) return 0
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000)
}

export function formatRelativeTime(dateString) {
  if (!dateString) return ''
  const diffMs = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

// Candidates never see the internal "reviewing"/"rejected" statuses used by
// employers — a rejection is only visible to a candidate if the employer
// separately chooses to send a rejection email, never as a dashboard label.
export function getCandidateStatusLabel(status) {
  if (status === 'shortlisted') return 'Shortlisted'
  if (status === 'applied') return 'Applied'
  return 'Under review'
}
