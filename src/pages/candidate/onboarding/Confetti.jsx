const PIECE_COUNT = 60
const COLORS = ['#005ef5', '#ffffff']

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

const pieces = Array.from({ length: PIECE_COUNT }, (_, i) => ({
  id: i,
  left: randomBetween(0, 100),
  delay: randomBetween(0, 0.6),
  duration: randomBetween(2.4, 4),
  size: randomBetween(6, 12),
  rotate: randomBetween(0, 360),
  color: COLORS[i % COLORS.length],
  wide: Math.random() > 0.5,
}))

export default function Confetti() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1500 }}>
      <style>{`
        @keyframes mellow-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(600deg); opacity: 0.4; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.wide ? p.size * 1.6 : p.size,
            height: p.size * 0.6,
            background: p.color,
            border: p.color === '#ffffff' ? '1px solid rgba(0,94,245,0.25)' : 'none',
            borderRadius: 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `mellow-confetti-fall ${p.duration}s ease-in ${p.delay}s 1 forwards`,
          }}
        />
      ))}
    </div>
  )
}
