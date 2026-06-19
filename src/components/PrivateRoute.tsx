import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth()

  if (isLoading) return <div className="text-center py-8">Загрузка...</div>
  if (!token) return <Navigate to="/login" replace />

  return <>{children}</>
}
