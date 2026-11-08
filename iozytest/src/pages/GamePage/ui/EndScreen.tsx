import gameStyles from '@/pages/GamePage/Game.module.scss'
import Score from '@/pages/GamePage/ui/Score'
import Podium from '@/pages/GamePage/ui/Podium'
import type { GameMode, Player } from '@/lib/game/types'
import { isOnline } from '@/lib/game/gameMode'
import { getPlayerId } from '@/utils/playerId'

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
 * Écran de fin. En ligne (le seul parcours atteignable) : le podium, sur toute
 * la largeur. Solo (encore dans le code) : le récapitulatif centré.
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
  if (isOnline(gameMode)) {
    return (
      <Podium
        players={players}
        totalQuestions={totalQuestions}
        selfId={getPlayerId()}
        isHost={isHost}
        shouldPlaySound={shouldPlaySound}
        onRestart={onRestart}
        onChangeThemes={onChangeThemes}
        onQuit={onQuit}
        onSoundPlayed={onSoundPlayed}
      />
    )
  }

  return (
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
  )
}
