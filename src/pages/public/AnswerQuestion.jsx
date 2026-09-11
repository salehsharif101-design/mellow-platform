import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useHideChrome } from '../../components/Layout.jsx'
import CompanyAvatar from '../../components/CompanyAvatar.jsx'
import Logo from '../../components/Logo.jsx'
import VideoRecorderModal from '../../components/VideoRecorderModal.jsx'

const MAX_FILE_BYTES = 100 * 1024 * 1024
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

// Public — the answer_token itself is the credential, same idea as
// /employer/team/accept. Works for a logged-out candidate too: every write
// (the signed upload URL, and recording the answer on the question row)
// goes through api/video-question.js's service-role client, never a
// client-side Supabase query that would need a real session to satisfy RLS.
export default function AnswerQuestion() {
  const { token } = useParams()
  useHideChrome()

  const [question, setQuestion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [fileError, setFileError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoadError('This link is missing a token.')
      setLoading(false)
      return
    }

    async function lookup() {
      try {
        const res = await fetch('/api/video-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lookup', token }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'This link is invalid.')
        setQuestion(data)
      } catch (err) {
        setLoadError(err.message)
      } finally {
        setLoading(false)
      }
    }

    lookup()
  }, [token])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const previewVideoRef = useRef(null)

  function processFile(selected) {
    setFileError('')
    const baseType = selected.type.split(';')[0].trim().toLowerCase()
    if (!ACCEPTED_TYPES.includes(baseType)) {
      setFileError('Please upload an mp4, mov, or webm file.')
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFileError('That file is over the 100MB limit.')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
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

  async function handleSubmit() {
    if (!file) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const createRes = await fetch('/api/video-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-upload-url', token, contentType: file.type }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        // A 409 here means the window closed (or it was answered from
        // another tab) sometime between this page loading and Submit being
        // clicked — re-render into the real terminal state (expired,
        // matching create-upload-url's own default when it can't tell)
        // rather than leaving the full question-answering form up with
        // just an inline error underneath it.
        if (createRes.status === 409) {
          setQuestion((prev) => ({ ...prev, status: createData.status || 'expired' }))
          return
        }
        throw new Error(createData.error || 'Could not start the upload.')
      }

      const { error: uploadError } = await supabase.storage
        .from('candidate-videos')
        .uploadToSignedUrl(createData.path, createData.uploadToken, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const submitRes = await fetch('/api/video-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit-answer', token, path: createData.path }),
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok) {
        if (submitRes.status === 409) {
          setQuestion((prev) => ({ ...prev, status: submitData.status || 'expired' }))
          return
        }
        throw new Error(submitData.error || 'Could not submit your answer.')
      }

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" role="status" aria-label="Loading" />
      </div>
    )
  }

  if (loadError || !question) {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <Logo />
        <img src="/Collaborate.PNG" alt="" style={{ width: '100%', maxWidth: 220, margin: '28px auto 0', display: 'block' }} />
        <h1 style={{ fontSize: 26, marginTop: 20 }}>This link isn't valid</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
          {loadError || 'Something went wrong loading this question.'}
        </p>
      </div>
    )
  }

  if (submitted || question.status === 'answered') {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <Logo />
        <img src="/Collaborate2.png" alt="" style={{ width: '100%', maxWidth: 220, margin: '28px auto 0', display: 'block' }} />
        <h1 style={{ fontSize: 26, marginTop: 20 }}>You have answered this question</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
          Thanks — {question.companyName} has been notified and can now watch your answer.
        </p>
      </div>
    )
  }

  if (question.status === 'expired') {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <Logo />
        <img src="/Collaborate.PNG" alt="" style={{ width: '100%', maxWidth: 220, margin: '28px auto 0', display: 'block' }} />
        <h1 style={{ fontSize: 26, marginTop: 20 }}>This question has expired</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
          The {question.answerWindowDays}-day window to answer this question from {question.companyName} has passed.
        </p>
      </div>
    )
  }

  return (
    <div className="section" style={{ maxWidth: 480, margin: '0 auto' }}>
      <Logo />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 28 }}>
        <CompanyAvatar logoUrl={question.companyLogoUrl} companyName={question.companyName} size={44} />
        <div>
          <p style={{ fontWeight: 700, fontSize: 16 }}>{question.companyName}</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{question.roleTitle}</p>
        </div>
      </div>

      <img src="/Easy_stuff.png" alt="" style={{ width: '100%', maxWidth: 220, margin: '32px auto', display: 'block' }} />

      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          {question.companyName} asked
        </p>
        <p style={{ fontSize: 17, lineHeight: 1.6, fontWeight: 600 }}>{question.questionText}</p>
      </div>

      <p style={{ marginTop: 14, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        {question.daysLeft === 0
          ? 'This question expires today.'
          : `You have ${question.daysLeft} day${question.daysLeft === 1 ? '' : 's'} left to respond.`}
      </p>

      {previewUrl && (
        <video
          ref={previewVideoRef}
          src={previewUrl}
          controls
          playsInline
          preload="auto"
          style={{ width: '100%', maxWidth: 400, borderRadius: 12, background: '#000', margin: '20px auto 0', display: 'block' }}
        />
      )}

      <div className="field" style={{ marginTop: 20 }}>
        <label>Your answer (mp4, mov, or webm — up to 100MB)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => setShowRecorder(true)}>
            ● Record video
          </button>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            Upload video
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {fileError && <p className="form-error">{fileError}</p>}
      {submitError && <p className="form-error">{submitError}</p>}

      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={!file || submitting}
        style={{ marginTop: 16, width: '100%' }}
      >
        {submitting ? 'Submitting…' : 'Submit answer'}
      </button>

      {showRecorder && <VideoRecorderModal onClose={() => setShowRecorder(false)} onConfirm={handleRecorded} />}
    </div>
  )
}
