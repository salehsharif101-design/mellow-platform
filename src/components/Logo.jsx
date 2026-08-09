export default function Logo({ size = 22, white = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', lineHeight: 1 }}>
      <img
        src="/mellow_logofont_email.png"
        alt="Mellow"
        style={{
          height: size,
          width: 'auto',
          display: 'block',
          filter: white ? 'brightness(0) invert(1)' : 'none',
        }}
      />
    </span>
  )
}
