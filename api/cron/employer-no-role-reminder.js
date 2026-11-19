// Vercel Cron target — see the "crons" entry in vercel.json (runs daily).
// One-time "Post your first role on Mellow" email to an employer who
// finished onboarding (employer_profiles.onboarding_completed_at is set) at
// least 48 hours ago but has no rows in the roles table. no_role_reminder_sent
// (migration 0095) keeps it to one send per employer, ever.
//
// The query has no upper bound on how long ago onboarding finished, so a
// daily run still catches everyone eventually, just with up to a day's extra
// delay past the 48h mark. Same runtime shape as the other cron handlers
// (GET-only, no request body) since Vercel Cron issues a plain GET request.

import { sendEmail } from '../_lib/resend.js'
import { renderEmailHtml, SITE_URL } from '../_lib/email-template.js'
import { getServiceClient, unwrap } from '../_lib/db.js'
import { escapeHtml } from '../_lib/html.js'

const HOUR_MS = 60 * 60 * 1000
const MIN_AGE_MS = 48 * HOUR_MS

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // Fails closed — a missing CRON_SECRET is a misconfiguration, not a reason
  // to let this endpoint (which emails real employers) run open.
  if (!process.env.CRON_SECRET) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'CRON_SECRET is not configured on the server' }))
    return
  }
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = getServiceClient()
  const cutoff = new Date(Date.now() - MIN_AGE_MS).toISOString()

  try {
    const finished = unwrap(
      await supabase
        .from('employer_profiles')
        .select('id, user_id, company_name')
        .not('onboarding_completed_at', 'is', null)
        .lte('onboarding_completed_at', cutoff)
        .eq('no_role_reminder_sent', false),
    )

    // "No roles" is checked against the roles table directly, for just these
    // employers — any role at all (open, paused, closed) counts as posted.
    let employers = []
    if (finished.length > 0) {
      const withRoles = unwrap(
        await supabase
          .from('roles')
          .select('employer_id')
          .in(
            'employer_id',
            finished.map((e) => e.id),
          ),
      )
      const hasRole = new Set(withRoles.map((r) => r.employer_id))
      employers = finished.filter((e) => !hasRole.has(e.id))
    }

    let sent = 0
    let failed = 0
    for (const employer of employers) {
      // Claims the send atomically before sending, so two overlapping runs
      // can't both email the same employer. Released again below if the send
      // fails, so the next daily run retries.
      const { data: claimed } = await supabase
        .from('employer_profiles')
        .update({ no_role_reminder_sent: true })
        .eq('id', employer.id)
        .eq('no_role_reminder_sent', false)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

      try {
        // Re-checked after claiming: an employer who posts their first role
        // between the fetch above and now shouldn't be told to post one. The
        // claim is released so the flag stays false, though they'll simply
        // never match the "no roles" condition again.
        const { data: roleNow } = await supabase.from('roles').select('id').eq('employer_id', employer.id).limit(1)
        if (roleNow && roleNow.length > 0) {
          await supabase.from('employer_profiles').update({ no_role_reminder_sent: false }).eq('id', employer.id)
          continue
        }

        const employerUser = unwrap(await supabase.from('users').select('email').eq('id', employer.user_id).single())
        const name = String(employer.company_name || '').trim()

        await sendEmail({
          to: employerUser.email,
          subject: 'Post your first role on Mellow',
          html: renderEmailHtml({
            heading: 'Let’s find your next hire',
            bodyText: `Hey ${name ? escapeHtml(name) : 'there'},<br /><br />Your company profile is live on Mellow. All that’s missing is a role. Post your first role and you’ll be able to browse video profiles from candidates across Bahrain and the MENA region, send them questions and get video answers back, and shortlist the ones you like. You can also invite your team to collaborate on hiring.`,
            ctaLabel: 'Post a role',
            ctaUrl: `${SITE_URL}/employer/roles/new`,
            illustration: 'Your_Requested_Is_Posted.png',
          }),
        })
        sent += 1
      } catch {
        await supabase.from('employer_profiles').update({ no_role_reminder_sent: false }).eq('id', employer.id)
        failed += 1
      }
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, remindersSent: sent, failed }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
