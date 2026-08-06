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

const PORT = process.env.ADMIN_API_PORT || 5174

const ROUTES = {
  '/api/admin': adminHandler,
  '/api/email': emailHandler,
  '/api/delete-account': deleteAccountHandler,
  '/api/waitlist': waitlistHandler,
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
