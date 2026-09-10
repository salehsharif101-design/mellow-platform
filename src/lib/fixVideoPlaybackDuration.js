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
// visible playback element itself).
//
// Deliberately does NOT call video.load() after the reset (an earlier
// version of this fix did). Real-device diagnostics confirmed duration
// was already computing correctly through this exact seek-based fix, and
// then showed 'suspend' firing immediately afterward with almost nothing
// buffered — i.e. right where an unconditional reload of the whole
// resource would land the player. Resetting the media pipeline right
// before the candidate presses play is a plausible way to *cause* that
// thin-buffer state rather than fix anything; VideoRecorderModal.jsx now
// handles under-buffered suspend explicitly and more conservatively
// instead (only reloading when the buffered range genuinely doesn't
// cover the file, with a cooldown).
//
// Only worth doing for a blob: or data: URL — a normal http(s) source (an
// already-submitted, properly-indexed video) doesn't have this problem,
// and seeking it to the end and back would just waste bandwidth. data:
// covers the same freshly-recorded content encoded as a data URL instead
// of a blob: URL, in case a caller ever needs that path again — same
// underlying container bytes either way, so the same fix applies
// regardless of which URL scheme wraps them.
//
// onFixed, if given, is called with the duration the browser reports once
// it's finished scanning the blob — read right after the seek, before
// currentTime is reset, since that goes on to reset duration back to NaN
// until enough data is buffered again at the new position. Purely a
// diagnostic hook for the current mobile playback-stall investigation.
export function attachRecordedVideoDurationFix(videoEl, src, onFixed) {
  if (!videoEl || !(src?.startsWith('blob:') || src?.startsWith('data:'))) return undefined

  let fixed = false
  function fixDuration() {
    if (fixed) return
    fixed = true
    videoEl.currentTime = 1e101
    videoEl.ontimeupdate = () => {
      videoEl.ontimeupdate = null
      const scannedDuration = videoEl.duration
      videoEl.currentTime = 0
      onFixed?.(scannedDuration)
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
