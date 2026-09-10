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
// Only worth doing for a blob: URL — a normal http(s) source (an
// already-submitted, properly-indexed video) doesn't have this problem,
// and seeking it to the end and back would just waste bandwidth.
export function attachRecordedVideoDurationFix(videoEl, src) {
  if (!videoEl || !src?.startsWith('blob:')) return undefined

  function fixDuration() {
    videoEl.currentTime = 1e101
    videoEl.ontimeupdate = () => {
      videoEl.ontimeupdate = null
      videoEl.currentTime = 0
    }
  }

  videoEl.addEventListener('loadedmetadata', fixDuration)
  return () => videoEl.removeEventListener('loadedmetadata', fixDuration)
}
