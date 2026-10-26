// "Year Established" on an employer profile: optional, but if given it must
// be a 4-digit year that isn't in the future. Shared by onboarding and Edit
// Profile so both apply the same rule.
const MIN_YEAR = 1000

export function currentYear() {
  return new Date().getFullYear()
}

// Returns { value, error }. value is an integer or null (blank is fine —
// the field is optional); error is a message to show, or ''.
export function parseYearEstablished(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return { value: null, error: '' }
  if (!/^\d{4}$/.test(text)) return { value: null, error: 'Year established must be a 4-digit year, like 2018.' }
  const year = Number(text)
  if (year < MIN_YEAR) return { value: null, error: 'Year established must be a 4-digit year, like 2018.' }
  if (year > currentYear()) return { value: null, error: "Year established can't be in the future." }
  return { value: year, error: '' }
}
