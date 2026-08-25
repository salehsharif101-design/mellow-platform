import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase.js'
import { useHideChrome } from '../../../../components/Layout.jsx'
import VideoRecorderModal from '../../../../components/VideoRecorderModal.jsx'

const MAX_DURATION_SECONDS = 60
const MAX_FILE_BYTES = 100 * 1024 * 1024 // matches the candidate-videos bucket limit
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

const PROMPTS = [
  'Who are you and what do you do?',
  'What are you genuinely great at?',
  'What kind of role or company are you looking for?',
]

function TipsScreen({ onContinue }) {
  useHideChrome()
  return (
    <div style={{ background: '#fff', padding: '48px 24px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <img src="/Floating girl.PNG" alt="" style={{ width: '100%', maxWidth: 260, margin: '0 auto', display: 'block' }} />
      <h2 style={{ marginTop: 32, fontSize: 26 }}>Make it count</h2>
      <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
        Before you upload, here is what makes a great Mellow video. Good lighting, face a window if you can. Clear
        audio, find a quiet spot. 60 seconds max, keep it focused. And most importantly, just be yourself. Employers
        remember authentic, not polished.
      </p>
      <button className="btn btn-primary" type="button" onClick={onContinue} style={{ marginTop: 32, padding: '13px 28px' }}>
        Got it, upload my video
      </button>
    </div>
  )
}

function PromptCard({ number, prompt }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px' }}>
      <span
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {number}
      </span>
      <p style={{ fontSize: 15, fontWeight: 600 }}>{prompt}</p>
    </div>
  )
}

export default function Step5Video({ initial, userId, onFinish, onBack, onSaveForLater, saving }) {
  const [showTips, setShowTips] = useState(true)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(initial.intro_video_url || null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)

  useEffect(() => {
    return () => {
      if (file && previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (showTips) {
    return <TipsScreen onContinue={() => setShowTips(false)} />
  }

  function processFile(selected) {
    setError('')

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError('Please upload an mp4, mov, or webm file.')
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError('That file is over the 100MB limit.')
      return
    }

    const objectUrl = URL.createObjectURL(selected)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      if (probe.duration > MAX_DURATION_SECONDS + 0.5) {
        setError('Your video is longer than 60 seconds — please trim it and try again.')
        URL.revokeObjectURL(objectUrl)
        return
      }
      setFile(selected)
      setPreviewUrl(objectUrl)
    }
    probe.src = objectUrl
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    processFile(selected)
  }

  function handleRecorded(recordedFile) {
    setShowRecorder(false)
    processFile(recordedFile)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() || 'mp4'
      const path = `${userId}/intro.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('candidate-videos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('candidate-videos').getPublicUrl(path)
      await onFinish({ intro_video_url: data.publicUrl })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card" style={{ padding: '16px 20px', background: 'var(--color-bg-soft)', border: 'none' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
          While you record, cover these three prompts:
        </p>
        <div>
          {PROMPTS.map((prompt, i) => (
            <PromptCard key={prompt} number={i + 1} prompt={prompt} />
          ))}
        </div>
      </div>

      {previewUrl && (
        <video
          src={previewUrl}
          controls
          style={{
            width: '100%',
            maxWidth: 400,
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 12,
            background: '#000',
            margin: '0 auto',
            display: 'block',
          }}
        />
      )}

      <div className="field">
        <label htmlFor="video">Your 60-second intro (mp4, mov, or webm — up to 100MB)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => setShowRecorder(true)}>
            ● Record video
          </button>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            Upload video
            <input
              id="video"
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <a href="/guide" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, marginTop: 8, display: 'inline-block' }}>
          How to record a great video →
        </a>
        <br />
        <button
          type="button"
          onClick={onSaveForLater}
          disabled={uploading || saving}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            marginTop: 10,
            fontSize: 13,
            color: 'var(--color-text-muted)',
            textDecoration: 'underline',
            cursor: uploading || saving ? 'default' : 'pointer',
          }}
        >
          Save my profile and come back later
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={uploading || saving}>
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!file || uploading || saving}
        >
          {uploading || saving ? 'Uploading…' : 'Upload & finish'}
        </button>
      </div>

      {showRecorder && <VideoRecorderModal onClose={() => setShowRecorder(false)} onConfirm={handleRecorded} />}
    </div>
  )
}
