import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { attachRecordedVideoDurationFix } from '../lib/fixVideoPlaybackDuration.js'

const MAX_SECONDS = 60

// Tried in order — the first the browser actually supports wins. An
// explicit avc1 (H.264) codec string is tried before bare 'video/mp4' —
// H.264 is what iOS hardware actually decodes natively, so being
// explicit about it rather than letting the browser pick whatever its
// 'video/mp4' default codec is removes one more variable when that
// default turns out not to be it. iOS Safari only supports mp4 at all;
// Chrome/Firefox only support webm, and prefer vp9 when available.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

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

// MediaSource.isTypeSupported() and MediaRecorder.isTypeSupported() don't
// agree on what a "supported" mimeType string looks like — confirmed by
// direct testing: MediaRecorder happily accepts and records the bare
// 'video/mp4;codecs=avc1' MIME_CANDIDATES lists above, but
// MediaSource.isTypeSupported() rejects that exact string and only accepts
// a fully profile/level-qualified one like 'video/mp4;codecs="avc1.42E01E"'
// (same story for webm: MediaSource wants an explicit vp8/vp9 pairing, not
// bare 'video/webm'). The underlying container bytes MediaRecorder writes
// don't change based on which string describes them, so trying a fixed set
// of common codec variants here — independent of whatever string was
// actually used to record — is what lets MediaSource engage at all for a
// recording made via MIME_CANDIDATES above.
function mediaSourceCandidates(recordingMimeType) {
  if (recordingMimeType?.startsWith('video/mp4')) {
    return ['video/mp4;codecs="avc1.42E01E"', 'video/mp4;codecs="avc1.4D401E"', 'video/mp4;codecs="avc1.64001E"']
  }
  if (recordingMimeType?.startsWith('video/webm')) {
    return ['video/webm;codecs="vp9,opus"', 'video/webm;codecs="vp8,opus"']
  }
  return []
}

// A data: URL was tried and made things worse — a 5.7MB data: URL
// triggered 'suspend' immediately, before playback even started, with
// almost nothing buffered (readyState 2). Rather than a large in-memory
// resource handed to the player all at once (which is what both a data:
// URL and a plain Blob-backed blob: URL amount to), MediaSource gives the
// browser a streaming append interface — the model iOS Safari's media
// pipeline is actually built around — for the exact same bytes. Same
// 'blob:' URL scheme either way (URL.createObjectURL produces one for a
// MediaSource just like it does for a Blob), so nothing downstream (the
// duration fix, the recovery listeners below) needs to know which one
// it's dealing with.
//
// Feature-detected and best-effort: resolves to null on any failure —
// unsupported MediaSource, an unsupported mimeType for it, an error at any
// step, or a hard SAFETY_TIMEOUT_MS ceiling — so the caller always falls
// back to a plain blob: URL. The timeout is not optional: a MediaRecorder
// blob is a single already-complete resource, not a genuine fragmented
// byte stream, and testing (even against a MediaSource-accepted codec
// string) showed appendBuffer can simply never fire 'updateend' or
// 'error' — it just sits there. Without a timeout that hangs this promise
// forever, meaning setRecordedUrl never gets called and the preview never
// appears at all — strictly worse than the original stall-after-10s bug
// this whole investigation started from.
const MEDIA_SOURCE_TIMEOUT_MS = 3000

function buildMediaSourceUrl(blob, recordingMimeType) {
  if (typeof MediaSource === 'undefined') return Promise.resolve(null)
  const mimeType = mediaSourceCandidates(recordingMimeType).find((type) => MediaSource.isTypeSupported?.(type))
  if (!mimeType) return Promise.resolve(null)

  return new Promise((resolve) => {
    const mediaSource = new MediaSource()
    const objectUrl = URL.createObjectURL(mediaSource)
    let settled = false

    const safetyTimeout = setTimeout(() => fail(new Error('timed out waiting for MediaSource to accept the recording')), MEDIA_SOURCE_TIMEOUT_MS)

    function fail(err) {
      if (settled) return
      settled = true
      clearTimeout(safetyTimeout)
      // eslint-disable-next-line no-console
      console.log('[VideoRecorderModal] MediaSource setup failed, falling back to blob: URL:', err?.message || err)
      URL.revokeObjectURL(objectUrl)
      resolve(null)
    }
    function succeed() {
      if (settled) return
      settled = true
      clearTimeout(safetyTimeout)
      if (mediaSource.readyState === 'open') mediaSource.endOfStream()
      resolve(objectUrl)
    }

    mediaSource.addEventListener(
      'sourceopen',
      async () => {
        try {
          const sourceBuffer = mediaSource.addSourceBuffer(mimeType)
          const arrayBuffer = await blob.arrayBuffer()
          sourceBuffer.addEventListener('updateend', succeed, { once: true })
          sourceBuffer.addEventListener('error', fail, { once: true })
          sourceBuffer.appendBuffer(arrayBuffer)
        } catch (err) {
          fail(err)
        }
      },
      { once: true },
    )
    mediaSource.addEventListener('error', fail, { once: true })
  })
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
  // duration/seek index in its container. The onFixed callback is a
  // temporary diagnostic for the mobile playback-stall investigation —
  // safe to strip once that's confirmed resolved on real devices.
  useEffect(
    () =>
      attachRecordedVideoDurationFix(recordedVideoRef.current, recordedUrl, (duration) => {
        // eslint-disable-next-line no-console
        console.log('[VideoRecorderModal] Video duration after fix:', duration)
      }),
    [recordedUrl],
  )

  // Explicit reload right after the src changes — redundant with what
  // changing the src attribute is already supposed to trigger per spec,
  // but cheap insurance given how much iOS-Safari-specific quirkiness
  // this whole investigation has already turned up.
  useEffect(() => {
    const videoEl = recordedVideoRef.current
    if (!videoEl || !recordedUrl) return
    videoEl.load()
  }, [recordedUrl])

  // Temporary diagnostics + a recovery attempt for the mobile
  // playback-stall investigation. Real-device testing has now shown: the
  // blob/duration/mimeType are all correct with no error event (ruling out
  // a decode failure), 'suspend' firing on a data: URL before playback
  // even started (ruled that approach out — see buildMediaSourceUrl
  // above), and — back on a blob: URL — the video pausing mid-playback
  // with the buffer already covering the *entire* file (buffered end past
  // duration), ruling out buffering/network entirely. That last one means
  // WebKit's own media-resource-management policy is pausing a
  // fully-ready video on its own. Three different recoveries are used
  // depending on what the browser is actually telling us:
  //  - 'stalled'/'waiting' during active playback: a small nudge forward
  //    plus retrying play() — a documented recovery for a decoder that's
  //    gotten stuck waiting on data it considers itself blocked on even
  //    though more of the file exists, without losing playback position
  //    the way a full reload would.
  //  - 'suspend' while the buffered range still falls well short of the
  //    full duration: force a fresh load() rather than accept the browser
  //    gave up this early. A suspend that already covers (close to) the
  //    whole file is the routine "nothing left to fetch" case and is left
  //    alone — reloading then would just restart a file that was already
  //    fully ready.
  //  - 'pause' that wasn't near a genuine user tap and isn't at the true
  //    end of the file: WebKit pausing on its own, not the candidate
  //    stopping playback. The 'pause' event itself carries no flag for
  //    which case this is, so a short window since the last observed
  //    touch/click on the element is used as the proxy — a real user
  //    pause fires in essentially the same tick as the gesture that
  //    caused it, anything outside that window didn't come from a tap
  //    here. Resumed directly first; if WebKit rejects that (an automatic
  //    pause may not carry the same playback permission a user gesture
  //    does), a one-time retry is armed on the *next* tap on the video —
  //    a genuine gesture — instead of fighting the player indefinitely.
  // All three share one cooldown so a decoder/player that's still
  // genuinely stuck can't turn this into a tight retry loop; the cooldown
  // only starts once an attempt is actually made, not on every event
  // received.
  useEffect(() => {
    const videoEl = recordedVideoRef.current
    if (!videoEl || !recordedUrl) return undefined

    const COOLDOWN_MS = 1500
    const GESTURE_WINDOW_MS = 500
    let lastRecoveryAttempt = 0
    let lastGestureAt = 0
    let clearArmedRetry = null

    function bufferedEnd() {
      const { buffered } = videoEl
      return buffered.length > 0 ? buffered.end(buffered.length - 1) : 0
    }
    function isUnderBuffered() {
      const duration = videoEl.duration
      return !duration || bufferedEnd() < duration - 0.5
    }
    function isNearEnd() {
      const duration = videoEl.duration
      return Boolean(duration) && videoEl.currentTime >= duration - 0.35
    }
    function logEvent(type) {
      // eslint-disable-next-line no-console
      console.log(
        '[VideoRecorderModal] video event:', type,
        'at currentTime:', videoEl.currentTime,
        'readyState:', videoEl.readyState,
        'buffered end:', bufferedEnd(),
        'duration:', videoEl.duration,
      )
    }
    function withCooldown(shouldAct, act) {
      return (e) => {
        logEvent(e.type)
        if (!shouldAct()) return
        const now = Date.now()
        if (now - lastRecoveryAttempt < COOLDOWN_MS) return
        lastRecoveryAttempt = now
        act()
      }
    }
    function markGesture() {
      lastGestureAt = Date.now()
    }

    const handleStallOrWaiting = withCooldown(
      () => true,
      () => {
        const target = videoEl.duration ? Math.min(videoEl.currentTime + 0.1, videoEl.duration - 0.05) : videoEl.currentTime + 0.1
        // eslint-disable-next-line no-console
        console.log('[VideoRecorderModal] nudging currentTime to', target, 'and retrying play()')
        videoEl.currentTime = target
        videoEl.playbackRate = 1.0
        videoEl.play().catch((err) => {
          // eslint-disable-next-line no-console
          console.log('[VideoRecorderModal] resume play() failed:', err?.message)
        })
      },
    )

    const handleSuspend = withCooldown(isUnderBuffered, () => {
      // eslint-disable-next-line no-console
      console.log('[VideoRecorderModal] under-buffered suspend — forcing reload()')
      videoEl.load()
      videoEl.playbackRate = 1.0
      videoEl.play().catch((err) => {
        // eslint-disable-next-line no-console
        console.log('[VideoRecorderModal] resume play() after reload failed:', err?.message)
      })
    })

    function handleError() {
      logEvent('error')
      // eslint-disable-next-line no-console
      console.log('[VideoRecorderModal] video error:', videoEl.error)
    }

    // A resume attempted directly from the 'pause' handler isn't running
    // inside a real user gesture — WebKit fired 'pause' on its own, this
    // handler runs from that, not from a tap. It may still work if this
    // element already has an active playback session, but iOS can also
    // reject it and require a fresh gesture. If rejected, arm a one-time
    // listener so the very next genuine tap on the video retries it.
    function armGestureRetry() {
      if (clearArmedRetry) clearArmedRetry()
      function retry() {
        clearArmedRetry = null
        videoEl.playbackRate = 1.0
        videoEl.play().catch(() => {})
      }
      videoEl.addEventListener('touchend', retry, { once: true })
      videoEl.addEventListener('click', retry, { once: true })
      clearArmedRetry = () => {
        videoEl.removeEventListener('touchend', retry)
        videoEl.removeEventListener('click', retry)
      }
    }

    function handlePause(e) {
      logEvent(e.type)
      if (videoEl.ended) {
        // eslint-disable-next-line no-console
        console.log('[VideoRecorderModal] pause classified as: end of playback')
        return
      }
      const nearEnd = isNearEnd()
      const userInitiated = Date.now() - lastGestureAt < GESTURE_WINDOW_MS
      // eslint-disable-next-line no-console
      console.log(
        '[VideoRecorderModal] pause classified as:',
        userInitiated ? 'user-initiated (recent gesture)' : nearEnd ? 'near end' : 'automatic',
        'at currentTime:', videoEl.currentTime,
      )
      if (userInitiated || nearEnd) return

      const now = Date.now()
      if (now - lastRecoveryAttempt < COOLDOWN_MS) return
      lastRecoveryAttempt = now
      videoEl.playbackRate = 1.0
      videoEl.play().catch((err) => {
        // eslint-disable-next-line no-console
        console.log('[VideoRecorderModal] auto-resume after pause failed, arming retry on next tap:', err?.message)
        armGestureRetry()
      })
    }

    videoEl.addEventListener('stalled', handleStallOrWaiting)
    videoEl.addEventListener('waiting', handleStallOrWaiting)
    videoEl.addEventListener('suspend', handleSuspend)
    videoEl.addEventListener('error', handleError)
    videoEl.addEventListener('pause', handlePause)
    videoEl.addEventListener('touchstart', markGesture)
    videoEl.addEventListener('touchend', markGesture)
    videoEl.addEventListener('click', markGesture)

    return () => {
      videoEl.removeEventListener('stalled', handleStallOrWaiting)
      videoEl.removeEventListener('waiting', handleStallOrWaiting)
      videoEl.removeEventListener('suspend', handleSuspend)
      videoEl.removeEventListener('error', handleError)
      videoEl.removeEventListener('pause', handlePause)
      videoEl.removeEventListener('touchstart', markGesture)
      videoEl.removeEventListener('touchend', markGesture)
      videoEl.removeEventListener('click', markGesture)
      if (clearArmedRetry) clearArmedRetry()
    }
  }, [recordedUrl])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
      // Releases either kind of blob: URL recordedUrl might be — a plain
      // Blob-backed one or a MediaSource-backed one, both produced by
      // URL.createObjectURL — the same call handles both.
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

    // Temporary diagnostics for the mobile playback-stall investigation —
    // safe to strip once that's confirmed resolved on real devices.
    // eslint-disable-next-line no-console
    console.log('[VideoRecorderModal] MIME type used:', mimeTypeRef.current)

    // Caps sustained encoder load alongside the resolution/frame-rate
    // constraints on the stream itself above — an unconstrained default
    // bitrate for a 720p capture can run well past what's needed for a
    // talking-head video, adding to the same mid-recording stall risk.
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 })
    // eslint-disable-next-line no-console
    console.log('[VideoRecorderModal] recorder.mimeType (what the browser actually selected):', recorder.mimeType)
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
      recordedBlobRef.current = blob
      setRecording(false)

      // eslint-disable-next-line no-console
      console.log('[VideoRecorderModal] Blob size:', blob.size, 'Blob type:', blob.type)

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

        // Back to a blob: URL, not a data: URL — real-device testing
        // showed the data: URL made things worse (see buildMediaSourceUrl
        // above), so this now tries a MediaSource-backed variant of the
        // same blob: URL scheme first, falling back to a plain
        // Blob-backed one if that isn't supported or fails.
        buildMediaSourceUrl(blob, mimeTypeRef.current).then((mediaSourceUrl) => {
          if (mediaSourceUrl) {
            // eslint-disable-next-line no-console
            console.log('[VideoRecorderModal] Using MediaSource-backed URL for preview')
            setRecordedUrl(mediaSourceUrl)
          } else {
            // eslint-disable-next-line no-console
            console.log('[VideoRecorderModal] Using plain blob: URL for preview')
            setRecordedUrl(URL.createObjectURL(blob))
          }
        })
      }, 200)
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
