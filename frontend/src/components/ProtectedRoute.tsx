import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { accessToken, isLoading } = useAuth()
  if (accessToken && isLoading) return <div className="page-loading">Loading your workspace...</div>
  if (!accessToken) return <Navigate to="/login" replace />
  return children
}
