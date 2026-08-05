// Thin wrapper around the Resend HTTP API — avoids adding the `resend`
// package as a dependency for a single POST call.

// RESEND_FROM must be either onboarding@resend.dev (works with no setup, but
// Resend restricts recipients until a domain is verified) or an address on a
// domain verified in the Resend dashboard, e.g. hello@joinmellow.xyz.
const FROM = process.env.RESEND_FROM || 'Mellow <onboarding@resend.dev>'

export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured on the server')
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend request failed (${res.status}): ${body}`)
  }

  return res.json()
}
