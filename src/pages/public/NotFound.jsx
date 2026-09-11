import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="section" style={{ textAlign: 'center' }}>
      <img src="/Collaborate.PNG" alt="" style={{ width: '100%', maxWidth: 220, margin: '0 auto', display: 'block' }} />
      <h1 style={{ fontSize: 40, marginTop: 28 }}>Page not found</h1>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>
        Back to home
      </Link>
    </div>
  )
}
