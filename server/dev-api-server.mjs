// Local-dev-only stand-in for Vercel's serverless runtime. Loads the same
// handlers from api/*.js so behavior matches production; Vite proxies
// /api requests here during `npm run dev`. Not used in production —
// Vercel picks up api/*.js directly as serverless functions.

import { config } from 'dotenv'
import http from 'node:http'
import adminHandler from '../api/admin.js'
import emailHandler from '../api/email.js'

// Vite treats .env.local specially; plain dotenv doesn't, so load it explicitly.
config({ path: new URL('../.env.local', import.meta.url).pathname })
config()

const PORT = process.env.ADMIN_API_PORT || 5174

const ROUTES = {
  '/api/admin': adminHandler,
  '/api/email': emailHandler,
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
