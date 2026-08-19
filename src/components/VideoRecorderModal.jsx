import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'

const MAX_SECONDS = 60

// Tried in order — the first the browser actually supports wins. iOS Safari
// only supports mp4; Chrome/Firefox only support webm, and prefer vp9 when
// available.
const MIME_CANDIDATES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) || null
}

export default function VideoRecorderModal({ onClose, onConfirm }) {
  const [stream, setStream] = useState(null)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS)
  const [recordedUrl, setRecordedUrl] = useState(null)

  const liveVideoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const mimeTypeRef = useRef(null)
  const recordedBlobRef = useRef(null)
  const streamRef = useRef(null)

  function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support in-browser recording. Please upload a video file instead.')
      return
    }
    setError('')
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = s
        setStream(s)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not access your camera and microphone. Please allow access in your browser and try again.')
        }
      })
    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    const cancel = startCamera()
    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (stream && liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleStartRecording() {
    if (!stream) return
    const mimeType = pickMimeType()
    if (!mimeType) {
      setError('Video recording is not supported in this browser. Please upload a video file instead.')
      return
    }
    mimeTypeRef.current = mimeType
    chunksRef.current = []

    const recorder = new MediaRecorder(stream, { mimeType })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
      recordedBlobRef.current = blob
      setRecordedUrl(URL.createObjectURL(blob))
      setRecording(false)
    }
    mediaRecorderRef.current = recorder
    recorder.start()
    setRecording(true)
    setSecondsLeft(MAX_SECONDS)

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          recorder.stop()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function handleStopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  function handleRetake() {
    // Stop everything from the previous take before starting fresh — the
    // old approach left the previous getUserMedia stream running (camera
    // light stays on, tracks never released) while the live <video> lost
    // its srcObject on remount and never got it back, since the effect
    // that binds it only reruns when the `stream` reference itself
    // changes. Tearing down and re-acquiring a new stream fixes both: the
    // old hardware is actually released, and the new stream reference
    // triggers that effect again for the freshly-mounted preview element.
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)

    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    recordedBlobRef.current = null
    setRecordedUrl(null)
    setRecording(false)
    setSecondsLeft(MAX_SECONDS)

    startCamera()
  }

  function handleUse() {
    if (!recordedBlobRef.current) return
    const ext = mimeTypeRef.current?.includes('mp4') ? 'mp4' : 'webm'
    const file = new File([recordedBlobRef.current], `recording.${ext}`, { type: recordedBlobRef.current.type })
    streamRef.current?.getTracks().forEach((t) => t.stop())
    onConfirm(file)
  }

  function handleClose() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    onClose()
  }

  const mm = Math.floor(secondsLeft / 60)
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <Modal title="Record video" onClose={handleClose} width={480}>
      {error && <p className="form-error">{error}</p>}

      {!error && !recordedUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 240 }}>
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', maxHeight: '60vh', display: 'block' }}
            />
            {!stream && (
              <p
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 14,
                }}
              >
                Starting camera…
              </p>
            )}
            {recording && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b30' }} />
                {mm}:{ss}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {!recording ? (
              <button type="button" className="btn btn-primary" onClick={handleStartRecording} disabled={!stream}>
                ● Record
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStopRecording}
                style={{ background: '#d92d20' }}
              >
                ■ Stop
              </button>
            )}
          </div>
        </div>
      )}

      {recordedUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <video
            src={recordedUrl}
            controls
            style={{ width: '100%', maxHeight: '60vh', borderRadius: 12, background: '#000', display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button type="button" className="btn btn-ghost" onClick={handleRetake}>
              Retake
            </button>
            <button type="button" className="btn btn-primary" onClick={handleUse}>
              Use this video
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
