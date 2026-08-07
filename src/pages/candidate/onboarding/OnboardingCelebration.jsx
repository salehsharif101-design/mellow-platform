import { useState } from 'react'
import Confetti from '../../../components/Confetti.jsx'
import WorkVideoTip from './WorkVideoTip.jsx'

export default function OnboardingCelebration({ username, candidateId, userId }) {
  const [copied, setCopied] = useState(false)
  const [showTip, setShowTip] = useState(false)

  const profileUrl = `beta.joinmellow.xyz/profile/${username}`

  async function shareProfile() {
    const url = `https://${profileUrl}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (showTip) {
    return <WorkVideoTip candidateId={candidateId} userId={userId} />
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '48px 24px' }}>
      <Confetti />
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <img
          src="/Client_to_creative.png"
          alt=""
          style={{ width: '100%', maxWidth: 280, margin: '0 auto', display: 'block' }}
        />
        <h1 style={{ marginTop: 40, fontSize: 'clamp(32px, 4vw, 44px)' }}>You are live.</h1>
        <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Your profile is now visible to employers on Mellow. Share it with the world and let the right opportunities
          find you.
        </p>

        <div
          className="card"
          style={{
            marginTop: 32,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'var(--color-bg-soft)',
            border: 'none',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profileUrl}
          </span>
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={shareProfile} style={{ padding: '14px 28px', fontSize: 15 }}>
            {copied ? 'Link copied!' : 'Share my profile'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowTip(true)}
            style={{ padding: '14px 28px', fontSize: 15 }}
          >
            Go to my dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
