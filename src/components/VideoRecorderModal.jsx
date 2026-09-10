import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { attachRecordedVideoDurationFix } from '../lib/fixVideoPlaybackDuration.js'

const MAX_SECONDS = 60

// Tried in order — the first the browser actually supports wins. iOS Safari
// only supports mp4; Chrome/Firefox only support webm, and prefer vp9 when
// available.
const MIME_CANDIDATES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

// iOS Safari (both the browser itself and any other browser on iOS, which
// is required by Apple to use the same WebKit engine under the hood) has
// no webm playback support at all — a webm recording there wouldn't just
// risk the mobile duration/stall bug, it flatly wouldn't play back. This
// is a belt-and-suspenders check on top of MIME_CANDIDATES already
// listing mp4 first and isTypeSupported already gating each candidate: if
// isTypeSupported ever misreports webm as usable on iOS (a real
// inconsistency in some WebKit versions), refuse it explicitly rather
// than silently record something that can never be played back.
function isIOS() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  // iPadOS 13+ reports as "Macintosh" with touch support — the classic
  // iPhone/iPod UA check alone misses it.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const picked = MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) || null
  if (picked?.startsWith('video/webm') && isIOS()) return null
  return picked
}

export default function VideoRecorderModal({ onClose, onConfirm }) {
  const [stream, setStream] = useState(null)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS)
  const [recordedUrl, setRecordedUrl] = useState(null)

  const liveVideoRef = useRef(null)
  const recordedVideoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const mimeTypeRef = useRef(null)
  const recordedBlobRef = useRef(null)
  const streamRef = useRef(null)
  const previewTimeoutRef = useRef(null)

  function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support in-browser recording. Please upload a video file instead.')
      return
    }
    setError('')
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({
        // Unconstrained video here means "whatever the camera defaults
        // to" — often 1080p+ at the device's max frame rate. Sustained
        // real-time encoding at that load, especially where the browser
        // falls back to a software encoder (common for webm/VP8 on
        // Android, less universal than H.264 hardware encoding), is a
        // real candidate for exactly a mid-recording stall on mobile: CPU
        // or thermal pressure building up over several seconds rather
        // than failing immediately. Capping to 720p and a modest frame
        // rate keeps this comfortably within what a phone's encoder can
        // sustain for the full 60 seconds, at a resolution that's already
        // more than enough for a talking-head video.
        video: {
          facingMode: 'user',
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: true,
      })
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

  // See fixVideoPlaybackDuration.js — without this, mobile Safari/Chrome
  // stall the recorded preview's video track partway through playback
  // while the audio keeps going, since a MediaRecorder blob has no
  // duration/seek index in its container.
  useEffect(() => attachRecordedVideoDurationFix(recordedVideoRef.current, recordedUrl), [recordedUrl])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
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

    // Caps sustained encoder load alongside the resolution/frame-rate
    // constraints on the stream itself above — an unconstrained default
    // bitrate for a 720p capture can run well past what's needed for a
    // talking-head video, adding to the same mid-recording stall risk.
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
      recordedBlobRef.current = blob
      setRecording(false)

      // The camera used to keep running (light stays on, still actively
      // capturing/encoding) for the entire review screen, only released on
      // retake/use/close — on mobile, that ongoing capture pipeline
      // competing with the recorded video's own decode+render pipeline is
      // exactly the kind of resource contention that can make playback
      // stall partway through while audio (much cheaper to decode) keeps
      // going. Nothing on the review screen still needs the live stream —
      // release it the moment there's a recording to show instead.
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setStream(null)

      // track.stop() returns immediately, but the underlying camera/
      // encoder hardware teardown on some mobile devices isn't
      // necessarily synchronous with that call returning — give it a
      // brief moment to actually release before the preview video element
      // tries to claim decoder resources of its own.
      previewTimeoutRef.current = setTimeout(() => {
        previewTimeoutRef.current = null
        setRecordedUrl(URL.createObjectURL(blob))
      }, 150)
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
            ref={recordedVideoRef}
            src={recordedUrl}
            controls
            playsInline
            preload="auto"
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
