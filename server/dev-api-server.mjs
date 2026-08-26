// Local-dev-only stand-in for Vercel's serverless runtime. Loads the same
// handlers from api/*.js so behavior matches production; Vite proxies
// /api requests here during `npm run dev`. Not used in production —
// Vercel picks up api/*.js directly as serverless functions.

import { config } from 'dotenv'
import http from 'node:http'

// Vite treats .env.local specially; plain dotenv doesn't, so load it explicitly.
config({ path: new URL('../.env.local', import.meta.url).pathname })
config()

// Dynamic imports, done AFTER config() runs: static top-level imports are
// hoisted and evaluated before this file's own code (including config()),
// so any handler module that reads process.env at its own top level (e.g.
// api/_lib/resend.js's RESEND_FROM) would otherwise see env vars that
// haven't been injected yet and silently lock in the wrong default.
const { default: adminHandler } = await import('../api/admin.js')
const { default: emailHandler } = await import('../api/email.js')
const { default: deleteAccountHandler } = await import('../api/delete-account.js')
const { default: waitlistHandler } = await import('../api/waitlist.js')
const { default: checkEmailHandler } = await import('../api/check-email.js')
const { default: checkRemovedMemberHandler } = await import('../api/check-removed-member.js')
const { default: teamInviteHandler } = await import('../api/team-invite.js')
const { default: teamRemoveHandler } = await import('../api/team-remove.js')
const { default: profileViewDigestHandler } = await import('../api/cron/profile-view-digest.js')
const { default: weeklyDigestHandler } = await import('../api/cron/weekly-digest.js')
const { default: workVideoNudgeHandler } = await import('../api/cron/work-video-nudge.js')
const { default: videoReminderHandler } = await import('../api/cron/video-reminder.js')
const { default: calendlyWebhookHandler } = await import('../api/calendly-webhook.js')
const { default: meetingOutcomeHandler } = await import('../api/meeting-outcome.js')
const { default: meetingFollowUpHandler } = await import('../api/cron/meeting-follow-up.js')
const { default: calendlyConnectHandler } = await import('../api/calendly-connect.js')
const { default: calendlyCallbackHandler } = await import('../api/calendly-callback.js')
const { default: calendlyDisconnectHandler } = await import('../api/calendly-disconnect.js')

const PORT = process.env.ADMIN_API_PORT || 5174

const ROUTES = {
  '/api/admin': adminHandler,
  '/api/email': emailHandler,
  '/api/delete-account': deleteAccountHandler,
  '/api/waitlist': waitlistHandler,
  '/api/check-email': checkEmailHandler,
  '/api/check-removed-member': checkRemovedMemberHandler,
  '/api/team-invite': teamInviteHandler,
  '/api/team-remove': teamRemoveHandler,
  '/api/cron/profile-view-digest': profileViewDigestHandler,
  '/api/cron/weekly-digest': weeklyDigestHandler,
  '/api/cron/work-video-nudge': workVideoNudgeHandler,
  '/api/cron/video-reminder': videoReminderHandler,
  '/api/calendly-webhook': calendlyWebhookHandler,
  '/api/meeting-outcome': meetingOutcomeHandler,
  '/api/cron/meeting-follow-up': meetingFollowUpHandler,
  '/api/calendly-connect': calendlyConnectHandler,
  '/api/calendly-callback': calendlyCallbackHandler,
  '/api/calendly-disconnect': calendlyDisconnectHandler,
}

const server = http.createServer(async (req, res) => {
  const handler = ROUTES[req.url.split('?')[0]]
  if (!handler) {
    res.statusCode = 404
    res.end('Not found')
    return
  }
  try {
    await handler(req, res)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log(`[dev-api] dev server listening on http://localhost:${PORT}`)
})
