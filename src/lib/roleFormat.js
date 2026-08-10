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
