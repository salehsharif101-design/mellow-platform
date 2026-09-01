import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useSeoMeta } from '../../lib/useSeoMeta.js'
import { JOBS_LOCATIONS } from '../../lib/seoContent.js'
import { formatDeadline, formatSalary } from '../../lib/roleFormat.js'

// `location` is one of JOBS_LOCATIONS' keys, passed directly by the route
// (see App.jsx) rather than read from a URL param, since only these three
// specific pages exist — no dynamic /jobs/:location catch-all, so a typo'd
// URL 404s normally instead of silently rendering an empty page.
export default function JobsLocation({ location }) {
  const loc = JOBS_LOCATIONS[location]
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  useSeoMeta({
    title: `Jobs in ${loc.name} | Mellow`,
    description: `Browse open roles in ${loc.name} on Mellow. Apply with a 60-second video instead of a CV, no cover letter, ever.`,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const orFilter = loc.matchTerms.map((term) => `location.ilike.%${term}%`).join(',')
      const { data } = await supabase
        .from('roles')
        .select('id, slug, title, location, role_type, deadline, salary_min, salary_max, salary_currency, employer_profiles(company_name, logo_url)')
        .eq('is_active', true)
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(12)
      if (!cancelled) {
        setRoles(data || [])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [location])

  return (
    <div className="section">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32 }}>Find jobs in {loc.name}</h1>
        <p style={{ marginTop: 12, fontSize: 16, color: 'var(--color-text-muted)', maxWidth: 600 }}>
          Every role on Mellow is a chance to skip the CV. Record a 60-second video, apply with one tap, and let
          employers in {loc.name} meet the real you before the first interview.
        </p>
        <a
          href="https://beta.joinmellow.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ marginTop: 20, display: 'inline-block' }}
        >
          Sign up and start applying
        </a>

        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 20 }}>Why job seekers use Mellow</h2>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Record your intro video once, then it applies to every role you go for',
              'No CV, no cover letter, ever again',
              'Get matched to roles that fit your skills and availability',
              `Made for job seekers in ${loc.name}, where employers are already hiring`,
            ].map((benefit) => (
              <div key={benefit} className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ color: '#0f7a3d', fontWeight: 700, flexShrink: 0 }}>
                  ✓
                </span>
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 20 }}>Open roles in {loc.name}</h2>
          {loading ? (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-text-muted)' }}>Loading open roles…</p>
          ) : roles.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-text-muted)' }}>
              No open roles in {loc.name} right now, check back soon, or{' '}
              <a href="https://beta.joinmellow.xyz" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                sign up
              </a>{' '}
              to be notified when new ones are posted.
            </p>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {roles.map((role) => (
                <Link key={role.id} to={`/jobs/${role.slug}`} className="card stat-card-link" style={{ padding: 16, display: 'block' }}>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{role.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {role.employer_profiles?.company_name} · {role.location}
                  </p>
                  <div className="profile-tag-row" style={{ marginTop: 8 }}>
                    {formatSalary(role) && (
                      <span className="tag" style={{ fontSize: 12 }}>
                        {formatSalary(role)}
                      </span>
                    )}
                    {formatDeadline(role.deadline) && (
                      <span className="tag" style={{ fontSize: 12 }}>
                        Apply by {formatDeadline(role.deadline)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <p style={{ marginTop: 32, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <Link to="/jobs" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            See jobs in other locations →
          </Link>
        </p>
      </div>
    </div>
  )
}
