// Groups real role postings into "role family" slugs (e.g. "Senior Software
// Engineer II" and "Software Engineer" both become "software-engineers") so
// the dynamic /hire/:location/:role-type pages can tell whether 2+ active
// postings share a role type. Deliberately simple heuristics, not NLP —
// good enough for grouping job titles that are already fairly conventional.
// Shared between the client (src/pages/public/HireLocationRole.jsx) and the
// sitemap serverless function (api/sitemap.js), which is why this file has
// no React/Vite-only syntax.

const SENIORITY_WORDS = new Set([
  'senior',
  'sr',
  'junior',
  'jr',
  'lead',
  'staff',
  'principal',
  'associate',
  'entry',
  'intern',
  'internship',
  'graduate',
])

function pluralize(word) {
  if (/[sxz]$|[cs]h$/.test(word)) return `${word}es`
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  if (word.endsWith('s')) return word
  return `${word}s`
}

export function roleTitleToSlug(title) {
  if (!title) return ''
  const words = title
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/\b(i{1,3}|iv|v)\b/g, ' ') // trailing roman numerals (Engineer II, III...)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !SENIORITY_WORDS.has(w) && !/^\d+$/.test(w))

  if (words.length === 0) return ''

  words[words.length - 1] = pluralize(words[words.length - 1])
  return words.join('-')
}

export function slugToLabel(slug) {
  return (slug || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}
