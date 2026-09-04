import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children, requireUserType }) {
  const { session, userType, loading, profileLoading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (requireUserType) {
    // userType hasn't resolved yet — wait rather than treating "don't know
    // yet" the same as "wrong type," which let a still-loading employer
    // briefly fall through into a candidate-only route (or vice versa).
    if (profileLoading) return null
    if (userType !== requireUserType) return <Navigate to="/" replace />
  }

  return children
}
