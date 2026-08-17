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

// Loose word-overlap match used for both the Browse Roles "Recommended for
// you" section and the talent activity feed's "new roles that match your
// skills" item. Deliberately generous (substring-based) rather than exact —
// "React" should match a role titled "Senior React Engineer", and a skill
// like "Product Management" should match an employer's typical_roles entry
// "Product Manager" even though the words aren't identical.
export function roleMatchesCandidate(role, candidateSkills, candidateJobTitle) {
  const haystack = [role.title, role.employer_profiles?.typical_roles]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (!haystack) return false

  const needles = [...(candidateSkills || []), candidateJobTitle].filter(Boolean).map((s) => s.toLowerCase().trim())

  return needles.some((needle) => {
    if (needle.length < 3) return false
    if (haystack.includes(needle)) return true
    // Also check the reverse direction — a short role title word (e.g.
    // "Designer") appearing inside a longer candidate needle (e.g. "Senior
    // Product Designer") should still count as a match.
    return needle.split(/\s+/).some((word) => word.length >= 3 && haystack.includes(word))
  })
}

export function daysUntil(dateString) {
  if (!dateString) return null
  const [year, month, day] = dateString.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  return Math.ceil((target.getTime() - Date.now()) / 86400000)
}

const SENIOR_TITLE_KEYWORDS = ['senior', 'lead', 'head of', 'director']
const JUNIOR_TITLE_KEYWORDS = ['junior', 'entry level', 'entry-level', 'intern', 'graduate']
// candidate_profiles.years_of_experience is a free-choice string from a
// fixed set of options (see YEARS_OF_EXPERIENCE_OPTIONS in EditProfileForm)
// — "3-5 years" is deliberately excluded from both buckets since it doesn't
// clearly satisfy "5+" or "under 3".
const FIVE_PLUS_YEARS = new Set(['5-10 years', '10+ years'])
const UNDER_THREE_YEARS = new Set(['Less than 1 year', '1-3 years'])

// Ranks how well a role fits a candidate for the Browse Roles "Recommended
// for you" section, layering several signals on top of the original
// skills/title match:
//   - Seniority: a senior-titled role (Senior/Lead/Head of/Director) is
//     excluded for candidates with under 5 years of experience, and an
//     entry-level/junior-titled role is excluded for candidates with 3+
//     years — skipped entirely if the candidate hasn't set an experience
//     level, so an unfilled optional field never hides roles.
//   - Work style: a bonus if the role's work style matches one the
//     candidate selected, or if the role didn't specify one (treated as
//     open to everyone).
//   - Availability: candidates who can start immediately get a bump for
//     urgent or recently-posted roles; candidates on a 1-3 month timeline
//     get a penalty for roles closing sooner than that.
//   - Location: a bonus when the candidate's and role's location strings
//     overlap (same city/country mentioned in either).
// Returns null when the role shouldn't be recommended at all (no skills
// match, already applied, or a seniority mismatch) — otherwise a numeric
// score where higher means a better fit, for sorting/ranking.
export function scoreRoleForCandidate(role, candidate, appliedRoleIds) {
  if (appliedRoleIds?.has(role.id)) return null
  if (!roleMatchesCandidate(role, candidate.skills, candidate.jobTitle)) return null

  const title = (role.title || '').toLowerCase()
  const isSenior = SENIOR_TITLE_KEYWORDS.some((k) => title.includes(k))
  const isJunior = JUNIOR_TITLE_KEYWORDS.some((k) => title.includes(k))
  if (candidate.yearsOfExperience) {
    if (isSenior && !FIVE_PLUS_YEARS.has(candidate.yearsOfExperience)) return null
    if (isJunior && !UNDER_THREE_YEARS.has(candidate.yearsOfExperience)) return null
  }

  let score = 1 // baseline credit for the required skills/title match

  if (candidate.workStyle?.length > 0 && (!role.work_style || candidate.workStyle.includes(role.work_style))) {
    score += 2
  }

  if (candidate.availability === 'Immediately') {
    if (role.is_urgent) score += 2
    if (role.created_at && daysSince(role.created_at) <= 7) score += 1
  } else if (candidate.availability === '1 to 3 months') {
    const remaining = daysUntil(role.deadline)
    if (remaining !== null && remaining < 90) score -= 2
  }

  if (candidate.location && role.location) {
    const candidateLocation = candidate.location.toLowerCase()
    const roleLocation = role.location.toLowerCase()
    if (candidateLocation.includes(roleLocation) || roleLocation.includes(candidateLocation)) score += 2
  }

  return score
}
