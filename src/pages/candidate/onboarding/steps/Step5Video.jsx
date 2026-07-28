import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase.js'

const MAX_DURATION_SECONDS = 60
const MAX_FILE_BYTES = 50 * 1024 * 1024 // matches the candidate-videos bucket limit
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

const PROMPTS = [
  'Who are you and what do you do?',
  'What are you genuinely great at?',
  'What kind of role or company are you looking for?',
]

export default function Step5Video({ initial, userId, onFinish, onBack, saving }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(initial.intro_video_url || null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    return () => {
      if (file && previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setError('')

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError('Please upload an mp4, mov, or webm file.')
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError('That file is over the 50MB limit.')
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
      <div className="card" style={{ padding: 20, background: 'var(--color-bg-soft)', border: 'none' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          While you record, cover these three prompts:
        </p>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PROMPTS.map((prompt) => (
            <li key={prompt} style={{ fontSize: 15, fontWeight: 600 }}>
              {prompt}
            </li>
          ))}
        </ol>
      </div>

      {previewUrl && (
        <video
          src={previewUrl}
          controls
          style={{ width: '100%', maxWidth: 360, borderRadius: 12, background: '#000' }}
        />
      )}

      <div className="field">
        <label htmlFor="video">Upload your 60-second intro (mp4, mov, or webm — up to 50MB)</label>
        <input id="video" type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleFileChange} />
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
    </div>
  )
}
