import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGameState } from '../lib/game/GameContext'
import CategorySelector from './CategorySelectorPage/CategorySelector'
import { GameMode, Player } from '../types'
import { Category } from '../services/types'
import { QuestionService } from '../services/questionService'

export default function CategorySelectorPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setGameState } = useGameState()
  const defaultMode = searchParams.get('mode') as 'solo' | 'online' | null

  const handleStartGame = async (categories: Category[], mode: GameMode, configuredPlayers: Player[], name: string) => {
    if (categories.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie !')
      return
    }

    const allQuestions = await QuestionService.getQuestionsForCategories(categories)

    if (allQuestions.length === 0) {
      alert('Aucune question disponible pour les catégories sélectionnées !')
      return
    }

    const shuffledQuestions = QuestionService.shuffleQuestions(allQuestions)

    setGameState({
      categories,
      questions: shuffledQuestions,
      gameMode: mode,
      players: configuredPlayers.map(p => ({ ...p, score: 0 })),
      playerName: name
    })

    if (mode === 'online') {
      navigate('/room/create')
    } else {
      navigate('/game')
    }
  }

  return (
    <>
      <header className="app-header">
        <button
          className="editor-toggle-button"
          onClick={() => navigate('/')}
        >
          ← Retour au menu
        </button>
      </header>
      <CategorySelector
        onStartGame={handleStartGame}
        defaultMode={defaultMode || undefined}
      />
    </>
  )
}







