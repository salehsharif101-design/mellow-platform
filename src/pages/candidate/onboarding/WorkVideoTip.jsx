import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddWorkVideoModal from '../../../components/AddWorkVideoModal.jsx'

export default function WorkVideoTip({ candidateId, userId }) {
  const navigate = useNavigate()
  const [showAddVideo, setShowAddVideo] = useState(false)

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '48px 24px' }}>
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <img src="/Quality.PNG" alt="" style={{ width: '100%', maxWidth: 280, margin: '0 auto', display: 'block' }} />
        <h1 style={{ marginTop: 40, fontSize: 'clamp(32px, 4vw, 44px)', color: 'var(--color-primary)' }}>
          Make your profile unforgettable
        </h1>
        <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Talent with work videos gets significantly more employer attention. Add videos that show how you
          actually think and operate. A designer can walk through a rebrand. A developer can screen record a
          problem they solved. A marketer can break down a campaign from brief to result. The more you show, the
          more employers know.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowAddVideo(true)}
          style={{ marginTop: 36, padding: '14px 32px', fontSize: 15 }}
        >
          Add a work video
        </button>
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Skip for now, go to my dashboard
          </button>
        </div>
      </div>

      {showAddVideo && (
        <AddWorkVideoModal
          candidateId={candidateId}
          userId={userId}
          onClose={() => setShowAddVideo(false)}
          onAdded={() => navigate('/dashboard')}
        />
      )}
    </div>
  )
}
