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
  onChangeThemes: () => void
  onQuit: () => void // Ouvre la confirmation de sortie
  onSoundPlayed: () => void
}

/**
 * Écran de fin : récapitulatif et actions à gauche, classement final dans la colonne
 * de droite (même emplacement que pendant la partie).
 */
export default function EndScreen({
  score,
  totalQuestions,
  gameMode,
  players,
  isHost,
  shouldPlaySound,
  onRestart,
  onChangeThemes,
  onQuit,
  onSoundPlayed,
}: EndScreenProps) {
  return (
    <>
      <section className={gameStyles.endScreenMain} aria-label="Fin de partie">
        <Score
          score={score}
          totalQuestions={totalQuestions}
          gameMode={gameMode}
          players={players}
          isHost={isHost}
          onRestart={onRestart}
          onChangeThemes={onChangeThemes}
          onQuit={onQuit}
          shouldPlaySound={shouldPlaySound}
          onSoundPlayed={onSoundPlayed}
        />
      </section>
      {isOnline(gameMode) && (
        <div className={gameStyles.gamePlayersPanel}>
          <PlayersPanel
            players={players}
            questionAnsweredBy={null}
            isGameEnded={true}
            totalQuestions={totalQuestions}
          />
        </div>
      )}
    </>
  )
}
