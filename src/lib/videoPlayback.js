// Mobile browsers handle only one playing video at a time, and several
// active ones freeze the page. Called from a video's `play` event: pauses
// every other playing <video> on the page. Live camera previews
// (srcObject) are left alone so the recorder is never frozen.
export function pauseOtherVideos(current) {
  document.querySelectorAll('video').forEach((v) => {
    if (v !== current && !v.paused && !v.srcObject) v.pause()
  })
}

// Phones and tablets (primary pointer is a finger).
export function isTouchDevice() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)
}
