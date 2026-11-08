import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import HomeMenu, { type BankSize } from '@/pages/HomePage/HomeMenu'
import UsernameGuard from '@/components/common/UsernameGuard'
import { useGameState } from '@/lib/game/GameContext'
import { settingsService } from '@/services/settingsService'
import { buildQuickGame, loadQuestionBank } from '@/services/quickGameService'
import { QuestionService } from '@/services/questionService'
import type { Question } from '@/types'

export default function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomParam = searchParams.get('room')
  const { setGameState } = useGameState()
  // La banque est lue dès l'arrivée : la phrase dit combien d'extraits il y a,
  // et le clic sur « Partie rapide » n'attend plus le réseau.
  const [bank, setBank] = useState<Question[] | null | undefined>(undefined)
  const [isPreparing, setIsPreparing] = useState(false)

  useEffect(() => {
    if (roomParam) {
      navigate(`/room/join?room=${roomParam}`, { replace: true })
    }
  }, [roomParam, navigate])

  useEffect(() => {
    if (roomParam) return
    let cancelled = false
    loadQuestionBank().then((questions) => {
      if (!cancelled) setBank(questions)
    })
    return () => {
      cancelled = true
    }
  }, [roomParam])

  if (roomParam) {
    return null
  }

  const startQuickGame = async () => {
    if (isPreparing) return
    setIsPreparing(true)
    try {
      // Banque injoignable à l'arrivée : on retente au clic.
      const questions = bank ?? (await loadQuestionBank())
      if (questions === null) {
        toast.error('La banque de questions ne répond pas. Réessaie dans un instant.')
        return
      }
      setBank(questions)
      const setup = buildQuickGame(questions)
      if (!setup) {
        toast.error('Aucune question dans la banque : ajoute des extraits dans l’éditeur.')
        return
      }
      const name = settingsService.getSettings().username?.trim() || 'Joueur'
      setGameState({
        categories: setup.categories,
        questions: setup.questions,
        gameMode: 'online',
        players: [],
        playerName: name,
        questionCount: setup.questionCount,
      })
      navigate('/room/create')
    } finally {
      setIsPreparing(false)
    }
  }

  const bankSize: BankSize =
    bank === undefined
      ? undefined
      : bank === null
        ? null
        : QuestionService.dedupeQuestions(bank).length

  return (
    <UsernameGuard>
      <HomeMenu
        bankSize={bankSize}
        isPreparing={isPreparing}
        onQuickGame={startQuickGame}
        onChooseThemes={() => navigate('/categories')}
      />
    </UsernameGuard>
  )
}
