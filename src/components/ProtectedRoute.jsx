import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children, requireUserType }) {
  const { session, userType, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (requireUserType && userType && userType !== requireUserType) {
    return <Navigate to="/" replace />
  }

  return children
}
