import gameStyles from '@/pages/GamePage/Game.module.scss'
import QuestionCard from '@/pages/GamePage/question/QuestionCard'
import PlayersPanel from '@/pages/GamePage/ui/PlayersPanel'
import type { Question } from '@/types'
import type { GameMode, Player } from '@/lib/game/types'
import { isOnline } from '@/lib/game/gameMode'

interface RoundScreenProps {
  question: Question
  instanceKey: number
  currentQuestionIndex: number
  gameMode: GameMode
  players: Player[]
  questionAnsweredBy: string | null
  timeRemaining: number
  isRevealPhase: boolean
  skipVotes: Set<string>
  correctPlayers: Set<string>
  answeredPlayers: Set<string>
  playerAnswers: Record<string, string>
  validatedAnswers: Record<string, boolean>
  answerSuggestions: string[]
  revealedAnswer?: string
  waitingForGo: boolean
  gameStep: string
  showSettingsPopup: boolean
  isGameEnded: boolean
  isMediaReady: boolean
  revealStartTime: number | undefined
  onAnswer: (answer: string, timeRemaining: number, playerId?: string) => void
  onPhaseEnd: () => void
  onSkipVote: () => void
  onMediaReady?: () => void
  onMediaStart?: () => void
  onRevealVideoStart?: () => void
}

export default function RoundScreen({
  question,
  instanceKey,
  currentQuestionIndex,
  gameMode,
  players,
  questionAnsweredBy,
  timeRemaining,
  isRevealPhase,
  skipVotes,
  correctPlayers,
  answeredPlayers,
  playerAnswers,
  validatedAnswers,
  answerSuggestions,
  revealedAnswer,
  waitingForGo,
  gameStep,
  showSettingsPopup,
  isGameEnded,
  isMediaReady,
  revealStartTime,
  onAnswer,
  onPhaseEnd,
  onSkipVote,
  onMediaReady,
  onMediaStart,
  onRevealVideoStart,
}: RoundScreenProps) {
  return (
    <>
      <QuestionCard
        key={`game-${instanceKey}-q-${currentQuestionIndex}`}
        question={question}
        onAnswer={onAnswer}
        onPhaseEnd={onPhaseEnd}
        onSkipVote={onSkipVote}
        gameMode={gameMode}
        players={players}
        questionAnsweredBy={questionAnsweredBy}
        shouldPause={showSettingsPopup}
        onMediaReady={onMediaReady}
        onMediaStart={onMediaStart}
        onRevealVideoStart={onRevealVideoStart}
        waitingForGo={waitingForGo}
        gameStep={gameStep}
        externalTimeRemaining={timeRemaining}
        externalIsRevealPhase={isRevealPhase}
        skipVotes={skipVotes}
        correctPlayers={correctPlayers}
        startTime={revealStartTime}
        isGameEnded={isGameEnded}
        isMediaReady={isMediaReady}
        answerSuggestions={answerSuggestions}
        revealedAnswer={revealedAnswer}
        validatedAnswers={isOnline(gameMode) ? validatedAnswers : undefined}
      />

      {isOnline(gameMode) && (
        <div className={gameStyles.gamePlayersPanel}>
          <PlayersPanel
            players={players}
            questionAnsweredBy={questionAnsweredBy}
            correctPlayers={correctPlayers}
            answeredPlayers={answeredPlayers}
            isRevealPhase={isRevealPhase}
            playerAnswers={playerAnswers}
            validatedAnswers={validatedAnswers}
            skipVotes={skipVotes}
            isGameEnded={false}
          />
        </div>
      )}
    </>
  )
}
