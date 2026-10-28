// Content and eligibility for the emails that follow a candidate going live:
//   hour 0   the live "Welcome to Mellow" (api/email.js, unchanged)
//   hour 24  "Your profile is more than an intro" — work videos
//   hour 48  the profile-link welcome below
// The hour-24 and hour-48 sends are driven off candidate_profiles.went_live_at
// by api/cron/live-profile-emails.js. The re-engagement email is the one-time
// send to candidates who went live before any of this existed
// (scripts/send-profile-link-emails.mjs).
// Both go through the shared renderEmailHtml template, with the
// Client_to_creative.png illustration at the default width, so layout, logo
// and illustration placement match the other candidate emails exactly.
// Prefixed-underscore directory so Vercel does not turn this into a route.

import { renderEmailHtml, SITE_URL } from './email-template.js'
import { escapeHtml } from './html.js'

// Candidates who go live on or after this moment get the hour-24 and hour-48
// emails. Everyone who was already live before it is the one-time
// re-engagement audience instead — without this lower bound the first cron
// run would send the new-signup emails to every existing live candidate.
export const LIVE_EMAILS_FROM = '2026-10-27T09:46:00.000Z'

export const WELCOME_SUBJECT = 'Take Mellow with you — your profile link inside'
export const REENGAGEMENT_SUBJECT = 'Something we should have told you sooner 👋'

// Both emails point at the candidate's public profile, which only exists
// publicly while is_live is true, so they only go to candidates who are live
// right now, are open to opportunities (profile not hidden), and haven't been
// hired (a confirmed hire sets availability to "Not available" and
// is_live to false). Re-checked at send time, not just when the trigger
// fires.
export function isEligibleForLiveEmails(candidate) {
  return (
    candidate.is_live === true &&
    candidate.is_open_to_opportunities !== false &&
    candidate.availability !== 'Not available'
  )
}

export function firstNameOf(fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0]
  return first || 'there'
}

// Same fallback RolePublic/CandidateProfile links use: a candidate without a
// username is still reachable by id.
export function profileUrlFor({ username, id }) {
  return `${SITE_URL}/profile/${username || id}`
}

function profileLinkLine(url) {
  const safe = escapeHtml(url)
  return `👉 <a href="${safe}" style="color:#005ef5;font-weight:700;text-decoration:none;">${safe}</a>`
}

function section(title, text) {
  return `<strong style="color:#0a0a0a;">${title}</strong><br />${text}`
}

export function renderProfileLinkWelcome({ fullName, profileUrl, previewNote }) {
  const body = [
    'You’ve been on Mellow for a couple of days now, and we wanted to check in.',
    'Most people think of Mellow as a place to apply for jobs. It’s that, but it’s also something you can carry with you everywhere.',
    'Your profile link is yours:',
    profileLinkLine(profileUrl),
    'Drop it in a LinkedIn message instead of attaching a CV. Add it to your email signature. Share it in a WhatsApp group. Send it directly to any company you want to work for.',
    'Here’s what makes Mellow different from every other hiring platform. You can show your actual work, not just describe it. Record a short video walking through a project you built, a campaign you ran, or a problem you solved. Employers see how you think, how you communicate, and what you’re actually capable of. That’s something no CV or job application has ever been able to do.',
    'One link. Everything an employer needs to actually understand what you bring.',
    '— The Mellow Team',
  ]
  return {
    subject: WELCOME_SUBJECT,
    html: renderEmailHtml({
      heading: `Hey ${escapeHtml(firstNameOf(fullName))},`,
      bodyText: (previewNote ? [previewNote, ...body] : body).join('<br /><br />'),
      illustration: 'Client_to_creative.png',
    }),
  }
}

export function renderProfileLinkReengagement({ fullName, profileUrl, previewNote }) {
  const body = [
    'You signed up for Mellow a little while back — and we wanted to reach out.',
    'We never told you this clearly: your Mellow profile isn’t just for applying to jobs here. It’s yours. Use it anywhere.',
    profileLinkLine(profileUrl),
    section(
      'Share it anywhere:',
      'Send it to a company you want to work for. Drop it in a LinkedIn message instead of a CV. Add it to your email signature. Share it in a group chat.',
    ),
    section(
      'Show your actual work:',
      'You can also add work videos to your profile — show a project you built, a campaign you ran, or anything that shows what you’re capable of. Not just a CV. A real portfolio.',
    ),
    'One link. Everything an employer needs to see.',
    'Thanks for being here early.',
    '— The Mellow Team',
  ]
  return {
    subject: REENGAGEMENT_SUBJECT,
    html: renderEmailHtml({
      heading: `Hey ${escapeHtml(firstNameOf(fullName))},`,
      bodyText: (previewNote ? [previewNote, ...body] : body).join('<br /><br />'),
      illustration: 'Client_to_creative.png',
    }),
  }
}

// "Your profile is more than an intro" — about work videos. Sent 24 hours
// after a candidate goes live; the body was written for the (previously
// never-triggered) video-library notification in api/email.js, which now
// uses this too.
export function renderVideoLibraryEmail() {
  return {
    subject: 'Your profile is more than an intro',
    html: renderEmailHtml({
      heading: 'Show employers how you actually work',
      bodyText:
        'Your Mellow profile starts with your 60-second intro video. But top talent goes further. The work video library lets you upload additional videos that show employers exactly how you think and what you are capable of, before the first interview.<br><br>' +
        'Here are a few ideas to get you started:<br><br>' +
        '🎨 Designer? Walk through a recent project, the brief, your thinking, the final result.<br><br>' +
        '💻 Developer? Screen record yourself solving a problem or building a feature and talk through your decisions.<br><br>' +
        '📊 Marketer? Break down a campaign you ran, the strategy, the execution, the results.<br><br>' +
        '🎙️ Presenter or communicator? Record yourself pitching an idea or explaining a complex topic simply.<br><br>' +
        'Each video can be 60 seconds or longer. Label it clearly so employers know what they are looking at. The more you show, the more they know.',
      ctaLabel: 'Add a work video',
      ctaUrl: `${SITE_URL}/profile/edit`,
      illustration: 'working.png',
    }),
  }
}
