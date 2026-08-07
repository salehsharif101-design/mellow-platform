import { useRef, useState } from 'react'

export default function VideoPlayCard({ url, style, format = 'vertical' }) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  const horizontal = format === 'horizontal'

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#000',
        aspectRatio: horizontal ? '16 / 9' : '9 / 16',
        width: '100%',
        maxWidth: horizontal ? 640 : 400,
        margin: '0 auto',
        ...style,
      }}
    >
      <video
        ref={videoRef}
        src={url}
        controls={playing}
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
