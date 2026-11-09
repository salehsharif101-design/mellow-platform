import { sendEmail } from './resend.js'
import { renderEmailHtml, SITE_URL } from './email-template.js'
import { escapeHtml } from './html.js'
import { firstNameOf } from './profileLinkEmails.js'

// The live "Welcome to Mellow" email, sent to a candidate whose profile is
// already live. The single copy of its content: the dashboard trigger in
// api/email.js, api/cron/live-profile-emails.js's hourly backstop and
// api/cron/welcome-email-nudge.js's daily fallback all send it through here,
// so a wording change happens in one place.
export async function sendLiveWelcomeEmail(to, fullName) {
  await sendEmail({
    to,
    subject: 'Welcome to Mellow',
    html: renderEmailHtml({
      heading: 'Your living first impression starts here',
      bodyText: `Hey ${escapeHtml(firstNameOf(fullName))},<br /><br />Your profile is live and visible to employers. Start exploring open roles and apply with your video profile, no CV needed.`,
      ctaLabel: 'Browse roles',
      ctaUrl: `${SITE_URL}/roles`,
      secondaryCtaLabel: 'Go to my dashboard',
      secondaryCtaUrl: `${SITE_URL}/dashboard`,
      illustration: 'Floating_girl_v2.PNG',
    }),
  })
}

// The employer "Welcome to Mellow" email, greeting the company by name.
// companyName is optional: callers without one get "Hey there,".
export function renderEmployerWelcomeEmail({ companyName } = {}) {
  const name = String(companyName || '').trim()
  const bullet = (label, text) => `&bull;&nbsp;<strong>${label}</strong> — ${text}`
  const bodyText = [
    `Hey ${name ? escapeHtml(name) : 'there'},`,
    'Your talent feed is live. Watch real people, in their own words, and find the right fit without reading a single CV.',
    'Everything you need is already here:',
    [
      bullet('Browse talent', 'watch video profiles and shortlist who stands out'),
      bullet('Post a role', 'reach candidates who match exactly what you’re looking for'),
      bullet('Ask a video question', 'send a follow-up question and get a video answer back'),
      bullet('Book a meeting', 'schedule directly with candidates you want to move forward'),
    ].join('<br />'),
  ].join('<br /><br />')

  return {
    subject: 'Welcome to Mellow',
    html: renderEmailHtml({
      heading: 'Start meeting people, not documents',
      bodyText,
      ctaLabel: 'Browse talent',
      ctaUrl: `${SITE_URL}/employer/talent`,
      secondaryCtaLabel: 'Post a role',
      secondaryCtaUrl: `${SITE_URL}/employer/roles/new`,
      illustration: 'Client_to_creative.png',
    }),
  }
}
