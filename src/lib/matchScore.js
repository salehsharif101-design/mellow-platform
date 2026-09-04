// Weighted 0-100 match score for a single candidate against a single role,
// shown on the employer talent feed. Distinct from roleFormat.js's
// scoreRoleForCandidate, which ranks many roles for one candidate with an
// unbounded score — this produces a normalized percentage for one specific
// role, selected by the employer from a dropdown.

const SENIOR_TITLE_KEYWORDS = ['senior', 'lead', 'head of', 'director']
const JUNIOR_TITLE_KEYWORDS = ['junior', 'entry level', 'entry-level', 'intern', 'graduate']
const FIVE_PLUS_YEARS = new Set(['5-10 years', '10+ years'])
const UNDER_THREE_YEARS = new Set(['Less than 1 year', '1-3 years'])

const AVAILABILITY_SCORES = {
  Immediately: 1,
  'Within a month': 0.7,
  '1 to 3 months': 0.4,
  'Just exploring': 0.1,
}

const SKILLS_WEIGHT = 50
const WORK_STYLE_WEIGHT = 20
const AVAILABILITY_WEIGHT = 15
const EXPERIENCE_WEIGHT = 15

// Returns null when there isn't enough data to calculate a meaningful score
// (no role selected, or the role has no required_skills set) rather than a
// misleadingly precise number built on guesses.
export function calculateMatchScore(candidate, role) {
  if (!role || !role.required_skills || role.required_skills.length === 0) return null

  const requiredSkills = role.required_skills
  const requiredLower = requiredSkills.map((s) => s.toLowerCase())
  const candidateSkills = candidate.skills || []
  const matched = candidateSkills.filter((s) => requiredLower.includes(s.toLowerCase())).length
  const skillsScore = (matched / requiredSkills.length) * SKILLS_WEIGHT

  let workStyleScore = 0
  if (!role.work_style) {
    workStyleScore = WORK_STYLE_WEIGHT * 0.6 // role didn't specify — partial credit, not a mismatch
  } else if (candidate.work_style?.length > 0) {
    const roleStyleNorm = role.work_style.toLowerCase().replace(/[\s-]/g, '')
    const isMatch = candidate.work_style.some((w) => w.toLowerCase().replace(/[\s-]/g, '') === roleStyleNorm)
    workStyleScore = isMatch ? WORK_STYLE_WEIGHT : 0
  }

  const availabilityScore = (AVAILABILITY_SCORES[candidate.availability] ?? 0.3) * AVAILABILITY_WEIGHT

  const title = (role.title || '').toLowerCase()
  const isSenior = SENIOR_TITLE_KEYWORDS.some((k) => title.includes(k))
  const isJunior = JUNIOR_TITLE_KEYWORDS.some((k) => title.includes(k))
  let experienceScore = EXPERIENCE_WEIGHT * 0.6 // neutral default — role isn't clearly senior/junior, or candidate hasn't set years
  if (candidate.years_of_experience) {
    if (isSenior) experienceScore = FIVE_PLUS_YEARS.has(candidate.years_of_experience) ? EXPERIENCE_WEIGHT : EXPERIENCE_WEIGHT * 0.2
    else if (isJunior) experienceScore = UNDER_THREE_YEARS.has(candidate.years_of_experience) ? EXPERIENCE_WEIGHT : EXPERIENCE_WEIGHT * 0.4
    else experienceScore = EXPERIENCE_WEIGHT * 0.8 // role has no clear seniority signal — most experience levels are fine
  }

  const total = skillsScore + workStyleScore + availabilityScore + experienceScore
  return Math.round(total)
}
