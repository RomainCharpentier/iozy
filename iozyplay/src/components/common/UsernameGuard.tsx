import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { settingsService } from '../../services/settingsService'

interface UsernameGuardProps {
  children: React.ReactNode
}

export default function UsernameGuard({ children }: UsernameGuardProps) {
  const navigate = useNavigate()

  useEffect(() => {
    const settings = settingsService.getSettings()
    if (!settings.username || !settings.username.trim()) {
      navigate('/username', { replace: true })
    }
  }, [navigate])

  const settings = settingsService.getSettings()
  if (!settings.username || !settings.username.trim()) {
    return null
  }

  return <>{children}</>
}






