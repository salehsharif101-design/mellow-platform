// Mobile browsers handle only one playing video at a time, and several
// active ones freeze the page. Called from a video's `play` event: pauses
// every other playing <video> on the page. Live camera previews
// (srcObject) are left alone so the recorder is never frozen.
export function pauseOtherVideos(current) {
  document.querySelectorAll('video').forEach((v) => {
    if (v !== current && !v.paused && !v.srcObject) v.pause()
  })
}

// Touch devices (phones, tablets) load nothing until the user plays, which
// keeps a long feed from fetching many large videos at once. Pointer-and-
// hover devices only fetch metadata, enough to show the first frame as a
// preview and to size the card to the video, without the full download.
export function videoPreloadMode() {
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  return touch ? 'none' : 'metadata'
}
