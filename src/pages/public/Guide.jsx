import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useHideChrome } from '../../components/Layout.jsx'
import { supabase } from '../../lib/supabase.js'

// Matches ProfileEdit.jsx's LAST_STEP for candidates and Onboarding.jsx's
// wasIncomplete check (!company_name) for employers — the same onboarding
// completion checks used everywhere else in the app.
const CANDIDATE_LAST_STEP = 5

const SECTION_TITLE_STYLE = { fontSize: 22, marginBottom: 4 }

function SectionIcon({ emoji, color }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
      }}
    >
      {emoji}
    </span>
  )
}

function Section({ emoji, color, title, subtitle, children }) {
  return (
    <div className="card" style={{ padding: 28, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <SectionIcon emoji={emoji} color={color} />
      <div style={{ minWidth: 0 }}>
        <h2 style={SECTION_TITLE_STYLE}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16 }}>{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  )
}

function BulletList({ items }) {
  return (
    <ul style={{ marginTop: 12, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => (
        <li key={item} style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--color-text)' }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

export default function Guide() {
  const { user, userType, loading: authLoading } = useAuth()
  // Defaults to 'checking' (chrome hidden) so a mid-onboarding talent never
  // sees a flash of the nav bar while we work out who they are — it only
  // flips to 'show' once we've positively confirmed onboarding is complete
  // (or that there's no signed-in user at all).
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setStatus('show')
      return
    }
    if (!userType) return // user_type still loading — keep waiting

    let cancelled = false
    async function check() {
      let incomplete = false
      if (userType === 'candidate') {
        const { data } = await supabase
          .from('candidate_profiles')
          .select('onboarding_step')
          .eq('user_id', user.id)
          .maybeSingle()
        incomplete = (data?.onboarding_step || 1) <= CANDIDATE_LAST_STEP
      } else if (userType === 'employer') {
        const { data } = await supabase
          .from('employer_profiles')
          .select('company_name')
          .eq('user_id', user.id)
          .maybeSingle()
        incomplete = !data?.company_name
      }
      if (!cancelled) setStatus(incomplete ? 'hide' : 'show')
    }
    check()
    return () => {
      cancelled = true
    }
  }, [user, userType, authLoading])

  useHideChrome(status !== 'show')

  return (
    <div className="section">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/thinking2.png" alt="" style={{ width: '100%', maxWidth: 260, margin: '0 auto', display: 'block' }} />
          <h1 style={{ marginTop: 24, fontSize: 34 }}>How to record a video that gets you noticed</h1>
          <p style={{ marginTop: 12, fontSize: 16, color: 'var(--color-text-muted)', maxWidth: 560, margin: '12px auto 0' }}>
            You do not need fancy equipment or a script. You need to be clear, honest, and yourself. Here is
            everything that makes a Mellow video work.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 40 }}>
          <Section
            emoji="🎤"
            color="#e3f9e9"
            title="What to say in your intro video"
            subtitle="Aim for 45–60 seconds. A simple structure beats a perfect script."
          >
            <p style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>Suggested structure</p>
            <BulletList
              items={[
                'Who you are and what you do — one or two sentences, no more.',
                "What you're genuinely great at — a specific skill, not a job title restated.",
                "What you're looking for — the kind of role, team, or company that would be a good fit.",
                'A closing line that feels like you — something a stranger would remember an hour later.',
              ]}
            />
            <p style={{ fontSize: 15, fontWeight: 700, marginTop: 20 }}>What employers actually want to hear</p>
            <BulletList
              items={[
                'Specifics over claims — "I redesigned our onboarding flow and cut drop-off 40%" beats "I am a great problem solver."',
                'Genuine personality — employers are hiring a person, not a resume that talks.',
                'Clarity, not polish — a slightly awkward but honest take beats a stiff, over-rehearsed one.',
              ]}
            />
          </Section>

          <Section emoji="💡" color="#fff6e0" title="Technical tips" subtitle="None of this requires special equipment.">
            <BulletList
              items={[
                'Good lighting — face a window or lamp, never sit with a bright light behind you.',
                'A clean, uncluttered background — a plain wall works better than a busy room.',
                'Clear audio — record somewhere quiet, and keep your phone or laptop mic reasonably close.',
                'Look at the camera lens, not the screen — it reads as eye contact to whoever watches.',
                'Keep it under 60 seconds — loosely plan what you will say, but do not read it word for word.',
              ]}
            />
          </Section>

          <Section emoji="⚠️" color="#ffe8e8" title="Common mistakes to avoid">
            <BulletList
              items={[
                'Reading from a script — it almost always sounds robotic on camera.',
                'Rambling without a structure — employers skip videos that do not get to the point.',
                'Recording in a dark room or somewhere with background noise or an echo.',
                'A messy or distracting background that pulls focus from what you are saying.',
                'Running way past 60 seconds and getting cut off mid-thought.',
              ]}
            />
          </Section>

          <Section emoji="🎬" color="#eef4ff" title="What to include in work videos" subtitle="These are separate from your intro — one topic each.">
            <BulletList
              items={[
                'A screen recording or walkthrough of a real project you worked on.',
                'The problem you were solving, your approach, and the outcome — in that order.',
                'Your thinking, not just the polished result — how you got there matters as much as what you made.',
                'Keep each video focused on one piece of work rather than a highlight reel of everything.',
              ]}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}
