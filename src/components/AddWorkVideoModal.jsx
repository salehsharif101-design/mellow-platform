import { useState } from 'react'
import Modal from './Modal.jsx'
import { supabase } from '../lib/supabase.js'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const LABEL_OPTIONS = ['Recent project', 'Technical skill', 'Case study', 'Other']
const MAX_DESCRIPTION_LENGTH = 100

export default function AddWorkVideoModal({ candidateId, userId, onClose, onAdded }) {
  const [label, setLabel] = useState(LABEL_OPTIONS[0])
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)

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
    setFile(selected)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() || 'mp4'
      const path = `${userId}/work-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('candidate-videos')
        .upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('candidate-videos').getPublicUrl(path)

      const { data: row, error: insertError } = await supabase
        .from('candidate_videos')
        .insert({ candidate_id: candidateId, label, description: description.trim() || null, video_url: publicData.publicUrl })
        .select()
        .single()
      if (insertError) throw insertError

      onAdded(row)
      setUploaded(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (uploaded) {
    return (
      <Modal title="Add a work video" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary)' }}>Video uploaded successfully</p>
          <button type="button" className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>
            Close
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Add a work video" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label htmlFor="video-label">Label</label>
          <select id="video-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)}>
            {LABEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="video-description">Description (optional)</label>
          <input
            id="video-description"
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
            placeholder="What is this video about?"
            maxLength={MAX_DESCRIPTION_LENGTH}
          />
          <p style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </p>
        </div>
        <div className="field">
          <label htmlFor="work-video-file">Video file (mp4, mov, or webm — up to 50MB)</label>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 8 }}>
            Record vertically (portrait) for the best fit — that's how your video will be shown.
          </p>
          <input id="work-video-file" type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleFileChange} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={!file || uploading}>
            {uploading ? 'Uploading…' : 'Upload video'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
