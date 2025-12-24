import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGameState } from '../contexts/GameContext'
import RoomJoiner from './RoomJoinerPage/RoomJoiner'

export default function RoomJoinerPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setRoomCode, startGame } = useGameState()
  const roomCode = searchParams.get('room')

  if (!roomCode) {
    navigate('/')
    return null
  }

  const handleJoined = (code: string) => {
    // setRoomCode initialise maintenant le gameState si nécessaire
    setRoomCode(code)
    startGame()
    navigate('/game')
  }

  const handleBack = () => {
    navigate('/')
  }

  return (
    <RoomJoiner
      roomCode={roomCode}
      onJoined={handleJoined}
      onBack={handleBack}
    />
  )
}





