import { useEffect, useRef, useState } from 'react'
import { pauseOtherVideos, isTouchDevice } from '../lib/videoPlayback.js'

export default function VideoPlayCard({ url, style, format = 'vertical', objectFit = 'contain', width, height }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [naturalSize, setNaturalSize] = useState(null)
  const [touch] = useState(isTouchDevice)
  // Only cards near the viewport get a src, so scrolling a long feed never
  // makes the browser fetch every video at once.
  const [nearViewport, setNearViewport] = useState(false)

  // iOS Safari (and every browser on iOS) ignores preload, so a video with no
  // src fragment stays a black box until played. Starting the media fragment
  // at 0.001s makes iOS seek to, and show, the first frame. Only cards near
  // the viewport have a src at all (see nearViewport), so this loads
  // metadata for a handful of cards, never the whole feed.
  const videoSrc = nearViewport && url ? (url.includes('#') ? url : `${url}#t=0.001`) : undefined

  const auto = format === 'auto'
  const horizontal = format === 'horizontal'

  function handleLoadedMetadata() {
    if (!auto) return
    const v = videoRef.current
    if (v?.videoWidth && v?.videoHeight) {
      setNaturalSize({ width: v.videoWidth, height: v.videoHeight })
    }
  }

  // Observes the video's wrapper (not the video, which has no src while off
  // screen). Leaving the 200px margin pauses the video and drops its src to
  // free memory; coming back re-attaches it.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setNearViewport(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearViewport(true)
          return
        }
        const v = videoRef.current
        if (v) {
          v.pause()
          v.removeAttribute('src')
          v.load()
        }
        setPlaying(false)
        setNearViewport(false)
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function handlePlayClick(e) {
    // Keep the tap from also reaching the native <video> underneath.
    e.stopPropagation()
    const p = videoRef.current?.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }

  // "auto" reads the video's own dimensions once metadata loads and sizes
  // the container to match, rather than assuming an orientation — used for
  // intro videos, which candidates can record either way. Until metadata is
  // available it falls back to the portrait box the intro video used
  // before, so there's no layout jump on the common case.
  //
  // On touch devices metadata can arrive late (iOS ignores preload), so the
  // box would start as that portrait default then snap to the real shape.
  // The stored `width` / `height` props (saved at upload) size it correctly
  // up front instead; they're ignored on desktop, where metadata loads
  // before the user does anything.
  const storedSize = touch && width > 0 && height > 0 ? { width, height } : null
  const knownSize = naturalSize || storedSize
  const isPortrait = auto ? (knownSize ? knownSize.height > knownSize.width : true) : !horizontal
  const aspectRatio = auto && knownSize ? `${knownSize.width} / ${knownSize.height}` : isPortrait ? '9 / 16' : '16 / 9'

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#000',
        aspectRatio,
        width: '100%',
        maxWidth: isPortrait ? 400 : 640,
        margin: '0 auto',
        ...style,
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        preload="metadata"
        controls={playing}
        controlsList="nodownload"
        playsInline
        webkit-playsinline="true"
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={(e) => {
          setPlaying(true)
          pauseOtherVideos(e.currentTarget)
        }}
        onPause={() => setPlaying(false)}
        style={{ width: '100%', height: '100%', display: 'block', objectFit, background: '#000' }}
      />
      {!playing && (
        <button
          type="button"
          onClick={handlePlayClick}
          aria-label="Play video"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.15)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: 'var(--color-primary)',
            }}
          >
            ▶
          </span>
        </button>
      )}
    </div>
  )
}
