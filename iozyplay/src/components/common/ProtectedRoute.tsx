import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from './ProtectedRoute.module.scss'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { authService } from '@/services/authService'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Vérifier l'authentification
    const checkAuth = async () => {
      const authenticated = authService.isAuthenticated()
      setIsAuthenticated(authenticated)
    }
    checkAuth()
  }, [])

  // En attente de vérification
  if (isAuthenticated === null) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingContent}>
          <div className={ds.spinner} style={{ margin: '0 auto 1rem' }}></div>
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}
