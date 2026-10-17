import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGameState } from '@/lib/game/GameContext'
import RoomJoiner from '@/pages/RoomJoinerPage/RoomJoiner'

export default function RoomJoinerPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setRoomCode, updateGameState, startGame } = useGameState()
  const roomCode = searchParams.get('room')

  useEffect(() => {
    if (!roomCode) {
      navigate('/', { replace: true })
    }
  }, [roomCode, navigate])

  if (!roomCode) {
    return null
  }

  const handleJoined = (code: string, playerName: string) => {
    // setRoomCode initialise maintenant le gameState si nécessaire
    setRoomCode(code)
    // Nom du lobby : repli de /game si le serveur ne connaît plus le joueur
    updateGameState({ playerName })
    startGame()
    navigate('/game')
  }

  const handleBack = () => {
    navigate('/')
  }

  return <RoomJoiner roomCode={roomCode} onJoined={handleJoined} onBack={handleBack} />
}
