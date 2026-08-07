import { useState } from 'react'
import Modal from './Modal.jsx'
import { supabase } from '../lib/supabase.js'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const LABEL_PRESETS = ['Recent project', 'Technical skill', 'Case study']

export default function AddWorkVideoModal({ candidateId, userId, onClose, onAdded }) {
  const [label, setLabel] = useState(LABEL_PRESETS[0])
  const [customLabel, setCustomLabel] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const finalLabel = label === 'Custom' ? customLabel.trim() : label

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
    if (!file || !finalLabel) return
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
        .insert({ candidate_id: candidateId, label: finalLabel, video_url: publicData.publicUrl })
        .select()
        .single()
      if (insertError) throw insertError

      onAdded(row)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal title="Add a work video" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label htmlFor="video-label">Label</label>
          <select id="video-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)}>
            {LABEL_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
            <option value="Custom">Custom…</option>
          </select>
        </div>
        {label === 'Custom' && (
          <div className="field">
            <label htmlFor="custom-label">Custom label</label>
            <input
              id="custom-label"
              className="input"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Client testimonial"
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="work-video-file">Video file (mp4, mov, or webm — up to 50MB)</label>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 8 }}>
            Record vertically (portrait) for the best fit — that's how your video will be shown.
          </p>
          <input id="work-video-file" type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleFileChange} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={!file || !finalLabel || uploading}>
          {uploading ? 'Uploading…' : 'Add video'}
        </button>
      </form>
    </Modal>
  )
}
