// Vercel serverless function. Public, unauthenticated endpoint used by the
// signup form to give a clear "this email is already registered as a
// candidate/employer" error before attempting Supabase auth signUp — which
// otherwise returns a fake "success" for duplicate emails (an anti-enumeration
// measure) with no indication of the existing account's type.
//
// Only ever returns whether an exact email is taken and its account type —
// nothing else about the account — so this doesn't enable broader user
// enumeration beyond what the signup form itself already requires.
//
// A removed team member should never actually hit this: api/team-remove.js
// deletes their auth account outright, and once that succeeds their users
// row is gone too, so this reports the email as free like any other. But
// that deletion can itself fail (some other error deleting the auth
// account) and leave a real, still-existing account behind with only a
// 'removed' employer_team_members row to show for it - correctly blocked
// from signing in (api/check-removed-member.js, Login.jsx) but wrongly
// blocked here too, with no way out either direction. Recognize that
// specific shape - a users row whose only employer association anywhere is
// 'removed', not an owner and not active/invited on any other team - and
// retry the same cleanup team-remove.js does, so the email becomes
// genuinely free rather than just reported as free.

import { deleteAuthAccount, getServiceClient } from './_lib/db.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }

  const email = (body.email || '').trim()
  if (!EMAIL_RE.test(email)) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'A valid email is required' }))
    return
  }

  try {
    const supabase = getServiceClient()
    const { data: user, error } = await supabase.from('users').select('id, user_type').ilike('email', email).maybeSingle()
    if (error) throw error

    if (!user) {
      res.statusCode = 200
      res.end(JSON.stringify({ exists: false, userType: null }))
      return
    }

    const [{ data: ownedEmployer, error: ownedError }, { data: memberships, error: memberError }] = await Promise.all([
      supabase.from('employer_profiles').select('id').eq('user_id', user.id).maybeSingle(),
      supabase.from('employer_team_members').select('status').eq('user_id', user.id),
    ])
    if (ownedError) throw ownedError
    if (memberError) throw memberError

    // Must actually have been a team member (at least one row) with every
    // one of those rows 'removed' — not just "no employer connections at
    // all", which would also be true of a completely unrelated candidate
    // account and wrongly free their email too.
    const isStuckRemovedMember = !ownedEmployer && memberships.length > 0 && memberships.every((m) => m.status === 'removed')
    if (isStuckRemovedMember) {
      const { error: deleteError } = await deleteAuthAccount(supabase, user.id)
      if (!deleteError) {
        res.statusCode = 200
        res.end(JSON.stringify({ exists: false, userType: null }))
        return
      }
      // Cleanup failed again — fall through and report it as taken, same
      // as any other real account, rather than claim it's free when it
      // demonstrably still isn't.
    }

    res.statusCode = 200
    res.end(JSON.stringify({ exists: true, userType: user.user_type }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
