// Public, unauthenticated endpoint hit by the four post-meeting landing
// pages (HireConfirmed, ThanksForLettingUsKnow, HireAccepted) when they
// mount. The email links themselves only carry ids in the query string —
// the actual state changes (and the emails that follow from them) happen
// here rather than as a direct client-side Supabase write, since an
// anonymous visitor arriving from an email link has no session and
// shouldn't have RLS permission to write into hires/candidate_profiles
// directly anyway.

import { sendEmail } from './_lib/resend.js'
import { renderEmailHtml, SITE_URL } from './_lib/email-template.js'
import { getServiceClient, unwrap, getCandidateContact, getEmployerContact } from './_lib/db.js'

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

async function findMeeting(supabase, employerId, candidateId) {
  // Most recent meeting between this pair — if there's more than one, the
  // latest is the one any of these follow-up links would be about.
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('employer_id', employerId)
    .eq('candidate_id', candidateId)
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const { action, employerId, candidateId } = await readJsonBody(req)
    if (!action || !employerId || !candidateId) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Missing action, employerId, or candidateId' }))
      return
    }

    const supabase = getServiceClient()
    const meeting = await findMeeting(supabase, employerId, candidateId)

    if (action === 'hire_confirmed') {
      // Employer says "yes, we made a hire" — not final yet, the candidate
      // still needs to confirm (see "hire_accepted" below, which is what
      // actually writes to the hires table). Guarded so revisiting this
      // link doesn't re-send the candidate's confirmation-request email.
      if (meeting && !meeting.hire_confirmed_by_employer_at) {
        unwrap(
          await supabase
            .from('meetings')
            .update({ hire_confirmed_by_employer_at: new Date().toISOString() })
            .eq('id', meeting.id),
        )
        const [{ companyName }, { email: candidateEmail }] = await Promise.all([
          getEmployerContact(supabase, employerId),
          getCandidateContact(supabase, candidateId),
        ])
        await sendEmail({
          to: candidateEmail,
          subject: 'Congratulations - it looks like you landed something',
          html: renderEmailHtml({
            heading: 'Congratulations',
            bodyText: `It looks like your meeting with ${companyName} went well. We hope Mellow played a part in your next chapter. Could you confirm, did you get the role?`,
            secondaryBodyText:
              'One more thing, keep adding videos to your work library. It is a great way to keep your video portfolio up to date and show your growth over time. Your next opportunity might come from someone discovering your work, even when you are not actively looking.',
            ctaLabel: 'Yes, I got the role',
            ctaUrl: `${SITE_URL}/hire-accepted?candidateId=${candidateId}&employer=${employerId}`,
            secondaryCtaLabel: 'Not yet',
            secondaryCtaUrl: `${SITE_URL}/hire-declined?candidateId=${candidateId}&employer=${employerId}`,
            extraCtaLabel: 'Add to my work library',
            extraCtaUrl: `${SITE_URL}/profile/edit`,
            illustration: 'Client_to_creative.png',
          }),
        })
      }
    } else if (action === 'still_deciding' || action === 'hire_declined') {
      // Both land on the same "thanks for letting us know" page and feed
      // the same 7-day talent-nudge cron — stamped once so a repeat visit
      // doesn't push the nudge's clock back out.
      if (meeting && !meeting.outcome_recorded_at) {
        unwrap(
          await supabase
            .from('meetings')
            .update({ outcome_recorded_at: new Date().toISOString() })
            .eq('id', meeting.id),
        )
      }
    } else if (action === 'hire_accepted') {
      // Idempotent — a repeat click/reload shouldn't insert a second hires
      // row or re-flip settings the candidate may have since changed back.
      const { data: existingHire, error: hireErr } = await supabase
        .from('hires')
        .select('id')
        .eq('employer_id', employerId)
        .eq('candidate_id', candidateId)
        .maybeSingle()
      if (hireErr) throw new Error(hireErr.message)
      if (!existingHire) {
        unwrap(await supabase.from('hires').insert({ employer_id: employerId, candidate_id: candidateId }))
        unwrap(
          await supabase
            .from('candidate_profiles')
            .update({ availability: 'Not available', is_live: false })
            .eq('id', candidateId),
        )
      }
    } else {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Unknown action' }))
      return
    }

    res.statusCode = 200
    res.end(JSON.stringify({ success: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
