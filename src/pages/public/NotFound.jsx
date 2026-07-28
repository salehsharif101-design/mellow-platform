import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="section" style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: 40 }}>Page not found</h1>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>
        Back to home
      </Link>
    </div>
  )
}
