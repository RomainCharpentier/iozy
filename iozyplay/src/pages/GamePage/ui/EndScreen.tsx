import gameStyles from '@/pages/GamePage/Game.module.scss'
import Score from '@/pages/GamePage/ui/Score'
import PlayersPanel from '@/pages/GamePage/ui/PlayersPanel'
import type { GameMode, Player } from '@/lib/game/types'
import { isOnline } from '@/lib/game/gameMode'

interface EndScreenProps {
  score: number
  totalQuestions: number
  gameMode: GameMode
  players: Player[]
  isHost: boolean
  shouldPlaySound: boolean
  onRestart: () => void
  onModifySettings: () => void
  onQuit: () => void
  onSoundPlayed: () => void
}

export default function EndScreen({
  score,
  totalQuestions,
  gameMode,
  players,
  isHost,
  shouldPlaySound,
  onRestart,
  onModifySettings,
  onQuit,
  onSoundPlayed,
}: EndScreenProps) {
  return (
    <>
      <div className={gameStyles.gameInterfaceGame}>
        <Score
          score={score}
          totalQuestions={totalQuestions}
          gameMode={gameMode}
          players={players}
          isHost={isHost}
          onRestart={onRestart}
          onModifySettings={onModifySettings}
          onQuit={onQuit}
          isPopup={false}
          shouldPlaySound={shouldPlaySound}
          onSoundPlayed={onSoundPlayed}
        />
      </div>
      {isOnline(gameMode) && (
        <div className={gameStyles.gamePlayersPanel}>
          <PlayersPanel
            players={players}
            questionAnsweredBy={null}
            correctPlayers={new Set()}
            answeredPlayers={new Set()}
            isRevealPhase={false}
            playerAnswers={{}}
            validatedAnswers={{}}
            skipVotes={new Set()}
            isGameEnded={true}
            totalQuestions={totalQuestions}
          />
        </div>
      )}
    </>
  )
}
