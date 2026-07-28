export default function Logo({ size = 22, white = false }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        fontFamily: 'var(--font-heading)',
        fontWeight: 700,
        fontSize: size,
        color: white ? '#ffffff' : 'var(--color-text)',
      }}
    >
      <img
        src="/mellow_blue_logo_transparent.png"
        alt=""
        style={{
          height: size * 0.85,
          width: 'auto',
          display: 'block',
          filter: white ? 'brightness(0) invert(1)' : 'none',
        }}
      />
      mellow
    </span>
  )
}
