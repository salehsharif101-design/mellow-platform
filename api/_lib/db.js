// Shared Supabase service-role helpers for serverless functions under api/.
// Prefixed-underscore directory so Vercel does not turn this into a route.

import { createClient } from '@supabase/supabase-js'

export function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export async function getCandidateContact(supabase, candidateId) {
  const candidate = unwrap(
    await supabase.from('candidate_profiles').select('user_id, username').eq('id', candidateId).single(),
  )
  const candidateUser = unwrap(await supabase.from('users').select('email').eq('id', candidate.user_id).single())
  return { email: candidateUser.email, username: candidate.username }
}
