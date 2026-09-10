// MediaRecorder streams data out incrementally rather than writing a
// proper duration/seek index once recording stops, so a blob: URL built
// from its output (or a File built from that blob, immediately after
// confirming a recording) is missing that metadata in its container. Most
// desktop browsers paper over this, but on mobile (iOS Safari and Chrome
// on Android) it makes the video decoder stall partway through playback —
// typically 10-20s in — since it can't tell how much more there is to
// buffer, while the audio track (not gated on the same metadata) keeps
// playing right through.
//
// Seeking to a huge timestamp forces the browser to scan the whole blob
// and fix its internal duration/seekable range; jumping back to 0
// immediately after avoids leaving the preview parked at the end. This is
// the standard, documented workaround for this well-known MediaRecorder-
// blob playback bug (the same technique Step5Video.jsx's own upload probe
// already used to compute a real duration — just never applied to the
// visible playback element itself). A trailing video.load() forces iOS
// Safari in particular to fully re-evaluate the resource now that the
// browser has scanned it once, rather than continuing to play from
// whatever partial understanding it had before the seek.
//
// Only worth doing for a blob: URL — a normal http(s) source (an
// already-submitted, properly-indexed video) doesn't have this problem,
// and seeking it to the end and back would just waste bandwidth.
export function attachRecordedVideoDurationFix(videoEl, src) {
  if (!videoEl || !src?.startsWith('blob:')) return undefined

  let fixed = false
  function fixDuration() {
    if (fixed) return
    fixed = true
    videoEl.currentTime = 1e101
    videoEl.ontimeupdate = () => {
      videoEl.ontimeupdate = null
      videoEl.currentTime = 0
      videoEl.load()
    }
  }

  // React effects run strictly after commit/paint — but loadedmetadata for
  // an in-memory blob: URL can fire essentially synchronously, sometimes
  // before this effect gets a chance to attach a listener for it. An event
  // that already fired never replays, so relying on the listener alone
  // silently does nothing in that case. readyState >= 1 (HAVE_METADATA)
  // means it's already happened; run the fix immediately instead.
  if (videoEl.readyState >= 1) {
    fixDuration()
  } else {
    videoEl.addEventListener('loadedmetadata', fixDuration, { once: true })
  }

  return () => {
    videoEl.removeEventListener('loadedmetadata', fixDuration)
  }
}
