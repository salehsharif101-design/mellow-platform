import { useRef, useState } from 'react'

export default function VideoPlayCard({ url, style, format = 'vertical' }) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [naturalSize, setNaturalSize] = useState(null)

  const auto = format === 'auto'
  const horizontal = format === 'horizontal'

  function handleLoadedMetadata() {
    if (!auto) return
    const v = videoRef.current
    if (v?.videoWidth && v?.videoHeight) {
      setNaturalSize({ width: v.videoWidth, height: v.videoHeight })
    }
  }

  // "auto" reads the video's own dimensions once metadata loads and sizes
  // the container to match, rather than assuming an orientation — used for
  // intro videos, which candidates can record either way. Until metadata is
  // available it falls back to the portrait box the intro video used
  // before, so there's no layout jump on the common case.
  const isPortrait = auto ? (naturalSize ? naturalSize.height > naturalSize.width : true) : !horizontal
  const aspectRatio = auto && naturalSize ? `${naturalSize.width} / ${naturalSize.height}` : isPortrait ? '9 / 16' : '16 / 9'

  return (
    <div
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
        src={url}
        controls={playing}
        playsInline
        webkit-playsinline="true"
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', background: '#000' }}
      />
      {!playing && (
        <button
          type="button"
          onClick={() => videoRef.current?.play()}
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
