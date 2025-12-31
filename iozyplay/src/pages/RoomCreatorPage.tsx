import { useNavigate } from 'react-router-dom'
import { useGameState } from '../lib/game/GameContext'
import RoomCreator from './RoomCreatorPage/RoomCreator'

export default function RoomCreatorPage() {
  const navigate = useNavigate()
  const { gameState, setRoomCode, startGame } = useGameState()

  if (!gameState || !gameState.questions || gameState.questions.length === 0) {
    navigate('/categories?mode=online')
    return null
  }

  const handleRoomCreated = (code: string) => {
    setRoomCode(code)
    startGame()
    navigate('/game')
  }

  const handleBack = () => {
    navigate('/categories?mode=online')
  }

  return (
    <RoomCreator
      categories={gameState.categories}
      questions={gameState.questions}
      playerName={gameState.playerName}
      onRoomCreated={handleRoomCreated}
      onBack={handleBack}
    />
  )
}







