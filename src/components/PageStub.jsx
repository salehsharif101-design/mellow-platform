export default function PageStub({ title, description }) {
  return (
    <div className="section">
      <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <span className="tag">Coming next</span>
        <h1 style={{ fontSize: 32, marginTop: 16 }}>{title}</h1>
        {description && (
          <p style={{ marginTop: 12, color: 'var(--color-text-muted)', fontSize: 16 }}>{description}</p>
        )}
      </div>
    </div>
  )
}
