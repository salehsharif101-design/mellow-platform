// Content for the /hire/:location/:role and /jobs/:location SEO landing
// pages. Kept as data rather than one component per page (per the "build a
// template page and generate these specific pages" brief) — HireLocationRole
// and JobsLocation render whatever combination is looked up here.

export const HIRE_LOCATIONS = {
  bahrain: { name: 'Bahrain', locationLabel: 'in Bahrain' },
  uae: { name: 'the UAE', locationLabel: 'in the UAE' },
  'saudi-arabia': { name: 'Saudi Arabia', locationLabel: 'in Saudi Arabia' },
}

export const HIRE_ROLES = {
  'video-editors': {
    plural: 'Video Editors',
    singular: 'a video editor',
    tagline: 'Watch real work samples and a 60-second intro before you ever schedule a call, no more guessing from a portfolio link.',
  },
  'software-engineers': {
    plural: 'Software Engineers',
    singular: 'a software engineer',
    tagline: 'Watch a short walkthrough of real projects before you ever schedule a technical interview, so you know how someone communicates as well as what they have built.',
  },
  'graphic-designers': {
    plural: 'Graphic Designers',
    singular: 'a graphic designer',
    tagline: "See a designer's range and personality in one short video before you review a single mockup.",
  },
  'marketing-managers': {
    plural: 'Marketing Managers',
    singular: 'a marketing manager',
    tagline: 'Meet marketing managers who can show you how they think, not just list past campaigns on a resume.',
  },
  'social-media-managers': {
    plural: 'Social Media Managers',
    singular: 'a social media manager',
    tagline: 'Find people who already understand your platforms, your audience, and how to grow both.',
  },
}

// Which role pages exist for which location — matches the specific URLs
// requested (not every role is offered in every location).
export const HIRE_LOCATION_ROLES = {
  bahrain: ['video-editors', 'graphic-designers', 'marketing-managers', 'software-engineers'],
  uae: ['video-editors', 'graphic-designers', 'social-media-managers', 'software-engineers'],
  'saudi-arabia': ['video-editors', 'marketing-managers'],
}

export const HIRE_BENEFITS = [
  'Watch a 60-second video before you ever schedule a call, so you know who you are talking to',
  'No CVs to screen, browse real people, not documents',
  'Post a role and start browsing candidates in minutes, not weeks',
  'Built for Bahrain, the UAE, and Saudi Arabia, with talent who already understand the market you are hiring in',
]

// Every entry HIRE_LOCATION_ROLES points at must resolve to a real page —
// this list exists so a template change can assert that stays true instead
// of quietly 404ing a combination someone typed by hand.
export function getHirePage(location, role) {
  const loc = HIRE_LOCATIONS[location]
  const roleInfo = HIRE_ROLES[role]
  const validForLocation = HIRE_LOCATION_ROLES[location]?.includes(role)
  if (!loc || !roleInfo || !validForLocation) return null
  return { location, role, loc, roleInfo }
}

export function getAllHirePages() {
  const pages = []
  Object.entries(HIRE_LOCATION_ROLES).forEach(([location, roles]) => {
    roles.forEach((role) => pages.push({ location, role }))
  })
  return pages
}

export const JOBS_LOCATIONS = {
  bahrain: { name: 'Bahrain', locationLabel: 'in Bahrain', matchTerms: ['bahrain'] },
  uae: { name: 'the UAE', locationLabel: 'in the UAE', matchTerms: ['uae', 'united arab emirates', 'dubai', 'abu dhabi'] },
  'saudi-arabia': { name: 'Saudi Arabia', locationLabel: 'in Saudi Arabia', matchTerms: ['saudi', 'ksa', 'riyadh', 'jeddah'] },
}
