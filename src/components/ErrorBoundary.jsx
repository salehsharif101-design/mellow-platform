import { Component } from 'react'

// Catches an error thrown while rendering anywhere below it, so a crash shows
// a message and a way out instead of a blank white page. Layout mirrors the
// other illustration pages (NotFound, PublicProfile). Deliberately free of
// router, auth and layout dependencies — it has to render even when those
// are what broke. The error text is development-only; visitors in
// production just see the generic message.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="section" style={{ textAlign: 'center' }}>
        <img src="/Collaborate.PNG" alt="" style={{ width: '100%', maxWidth: 220, margin: '0 auto', display: 'block' }} />
        <h1 style={{ fontSize: 28, marginTop: 28 }}>Something went wrong</h1>
        <p style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>
          This page hit an unexpected problem. Reloading usually fixes it.
        </p>
        {import.meta.env.DEV && (
          <pre
            style={{
              marginTop: 16,
              fontSize: 13,
              color: 'var(--color-text-muted)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error.message || String(error)}
          </pre>
        )}
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()} style={{ marginTop: 20, display: 'inline-flex' }}>
          Reload page
        </button>
      </div>
    )
  }
}
