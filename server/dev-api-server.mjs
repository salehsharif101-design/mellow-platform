// Local-dev-only stand-in for Vercel's serverless runtime. Loads the same
// handler from api/admin.js so behavior matches production; Vite proxies
// /api requests here during `npm run dev`. Not used in production —
// Vercel picks up api/*.js directly as serverless functions.

import { config } from 'dotenv'
import http from 'node:http'
import handler from '../api/admin.js'

// Vite treats .env.local specially; plain dotenv doesn't, so load it explicitly.
config({ path: new URL('../.env.local', import.meta.url).pathname })
config()

const PORT = process.env.ADMIN_API_PORT || 5174

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/api/admin')) {
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
  console.log(`[admin-api] dev server listening on http://localhost:${PORT}`)
})
