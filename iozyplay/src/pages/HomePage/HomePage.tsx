import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import HomeMenu from './HomeMenu'
import UsernameGuard from '../../components/common/UsernameGuard'

export default function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomParam = searchParams.get('room')

  useEffect(() => {
    if (roomParam) {
      navigate(`/room/join?room=${roomParam}`, { replace: true })
    }
  }, [roomParam, navigate])

  if (roomParam) {
    return null
  }

  return (
    <UsernameGuard>
      <HomeMenu
        onCreateGame={() => navigate('/categories')}
        onJoinRoom={() => {}}
        onOpenEditor={() => navigate('/editor')}
      />
    </UsernameGuard>
  )
}

