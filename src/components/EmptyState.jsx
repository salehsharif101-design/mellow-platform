export default function EmptyState({ heading, body, illustration = '/Collaborate.PNG' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '56px 24px',
        maxWidth: 420,
        margin: '0 auto',
      }}
    >
      <img src={illustration} alt="" style={{ width: '100%', maxWidth: 220 }} />
      <h3 style={{ marginTop: 24, fontSize: 20, color: 'var(--color-primary)' }}>{heading}</h3>
      <p style={{ marginTop: 10, fontSize: 15, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{body}</p>
    </div>
  )
}
