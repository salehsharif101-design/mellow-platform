import { sendEmail } from './resend.js'
import { renderEmailHtml, SITE_URL } from './email-template.js'

// The live "Welcome to Mellow" email, sent to a candidate whose profile is
// already live. The single copy of its content: the dashboard trigger in
// api/email.js, api/cron/live-profile-emails.js's hourly backstop and
// api/cron/welcome-email-nudge.js's daily fallback all send it through here,
// so a wording change happens in one place.
export async function sendLiveWelcomeEmail(to) {
  await sendEmail({
    to,
    subject: 'Welcome to Mellow',
    html: renderEmailHtml({
      heading: 'Your living first impression starts here',
      bodyText:
        'Your profile is live and visible to employers. Start exploring open roles and apply with your video profile, no CV needed.',
      ctaLabel: 'Browse roles',
      ctaUrl: `${SITE_URL}/roles`,
      secondaryCtaLabel: 'Go to my dashboard',
      secondaryCtaUrl: `${SITE_URL}/dashboard`,
      illustration: 'Flexible.PNG',
    }),
  })
}
