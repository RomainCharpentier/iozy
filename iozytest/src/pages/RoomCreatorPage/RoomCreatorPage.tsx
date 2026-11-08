import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameState } from '@/lib/game/GameContext'
import { isSolo } from '@/lib/game/gameMode'
import type { Question } from '@/types'
import RoomCreator from '@/pages/RoomCreatorPage/RoomCreator'

export default function RoomCreatorPage() {
  const navigate = useNavigate()
  const { gameState, setRoomCode, startGame, updateGameState } = useGameState()

  useEffect(() => {
    if (!gameState || !gameState.questions || gameState.questions.length === 0) {
      navigate('/categories')
    }
  }, [gameState, navigate])

  if (!gameState || !gameState.questions || gameState.questions.length === 0) {
    return null
  }

  const isSoloMode = isSolo(gameState.gameMode)

  const handleRoomCreated = (code: string, questions?: Question[]) => {
    if (!isSoloMode) {
      setRoomCode(code)
    } else if (questions && gameState) {
      // En mode solo, mettre à jour le gameState avec les questions configurées
      updateGameState({
        questions: questions,
      })
    }
    startGame()
    navigate('/game')
  }

  // Retour là d'où l'on vient : la partie rapide part de « On joue ? », pas du choix des thèmes.
  const handleBack = () => {
    navigate(gameState.origin === 'quick' ? '/' : '/categories')
  }

  return (
    <RoomCreator
      categories={gameState.categories}
      questions={gameState.questions}
      playerName={gameState.playerName}
      gameMode={gameState.gameMode}
      initialQuestionCount={gameState.questionCount}
      onRoomCreated={handleRoomCreated}
      onBack={handleBack}
    />
  )
}
