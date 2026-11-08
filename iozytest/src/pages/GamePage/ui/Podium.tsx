import styles from '@/pages/GamePage/ui/Podium.module.scss'
import { useEffect, useRef } from 'react'
import { LayoutGrid, LogOut, RotateCcw } from 'lucide-react'
import { soundManager } from '@/utils/sounds'
import type { Player } from '@/lib/game/types'
import { buildPodium, rankLabel, type PodiumStep } from '@/lib/game/podium'
import { getPlayerAvatarLabel } from '@/utils/playerAvatar'

interface PodiumProps {
  players: Player[]
  totalQuestions: number
  /** Le joueur de cet écran (marqué « toi »). */
  selfId: string
  isHost: boolean
  shouldPlaySound: boolean
  onRestart: () => void
  onChangeThemes?: () => void
  onQuit: () => void
  onSoundPlayed?: () => void
}

const points = (n: number) => `${n} point${n > 1 ? 's' : ''}`

/** Le titre : qui l'emporte, en une phrase. */
export function podiumTitle(leaders: Player[], selfId: string): string {
  if (leaders.length === 0) return 'Personne n’a marqué'
  if (leaders.length > 1) return 'Égalité en tête'
  return leaders[0].id === selfId ? 'Tu l’emportes' : `${leaders[0].name} l’emporte`
}

/**
 * Fin de partie (maquette GA-Podium) : le premier au centre, sur la plus haute
 * marche, le deuxième à gauche, le troisième à droite ; une égalité partage sa
 * marche. Les scores en très grand, le reste en liste, « Rejouer » en un clic
 * pour l'hôte (les invités attendent l'hôte, comme avant).
 */
export default function Podium({
  players,
  totalQuestions,
  selfId,
  isHost,
  shouldPlaySound,
  onRestart,
  onChangeThemes,
  onQuit,
  onSoundPlayed,
}: PodiumProps) {
  const soundPlayedRef = useRef(false)
  const { steps, rest, leaders } = buildPodium(players)

  // Le son de fin, une seule fois
  useEffect(() => {
    if (shouldPlaySound && !soundPlayedRef.current) {
      soundManager.playSuccess()
      soundPlayedRef.current = true
      onSoundPlayed?.()
    }
  }, [shouldPlaySound, onSoundPlayed])

  const nameOf = (player: Player) => (
    <>
      {player.name}
      {player.id === selfId && <span className={styles.self}> · toi</span>}
    </>
  )

  const renderStep = (step: PodiumStep) => (
    <li
      key={step.rank}
      className={styles.step}
      data-rank={Math.min(step.rank, 3)}
      aria-label={`${rankLabel(step.rank)} : ${step.players.map((p) => p.name).join(', ')}, ${points(step.score)}`}
    >
      <div className={styles.stepPlayers} aria-hidden="true">
        {step.players.map((player) => (
          <div key={player.id} className={styles.stepPlayer}>
            <span className={styles.avatar}>{getPlayerAvatarLabel(player)}</span>
            <span className={styles.stepName}>{nameOf(player)}</span>
          </div>
        ))}
      </div>
      <div className={`iozy-verre--fort ${styles.block}`} aria-hidden="true">
        <span className={styles.rank}>{rankLabel(step.rank)}</span>
        <span className={styles.score}>{step.score}</span>
        <span className={styles.unit}>point{step.score > 1 ? 's' : ''}</span>
      </div>
    </li>
  )

  return (
    <section className={styles.podium} aria-labelledby="podium-title" data-testid="end-summary">
      <div className={styles.backdrop} aria-hidden="true" />
      <span className={styles.kicker}>
        Partie terminée · {totalQuestions} extrait{totalQuestions > 1 ? 's' : ''}
      </span>
      <h2 id="podium-title" className={styles.title}>
        {podiumTitle(leaders, selfId)}
      </h2>

      {steps.length > 0 && (
        <ol className={styles.steps} aria-label="Podium">
          {steps.map(renderStep)}
        </ol>
      )}

      {rest.length > 0 && (
        <ol className={`iozy-verre ${styles.rest}`} aria-label="Suite du classement">
          {rest.map(({ player, rank }) => (
            <li key={player.id} className={styles.restRow}>
              <span className={styles.restRank}>{rankLabel(rank)}</span>
              <span className={styles.restAvatar} aria-hidden="true">
                {getPlayerAvatarLabel(player)}
              </span>
              <span className={styles.restName}>{nameOf(player)}</span>
              <span className={styles.restScore}>
                {player.score}
                {totalQuestions > 0 && (
                  <span className={styles.restTotal}> / {totalQuestions}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!isHost && (
        <p className={styles.waiting} role="status">
          <span className={styles.waitingDot} aria-hidden="true" />
          En attente de l'hôte pour une nouvelle partie…
        </p>
      )}

      <div className={styles.actions}>
        {isHost && (
          <button
            type="button"
            className={styles.replay}
            onClick={() => {
              soundManager.playStart()
              onRestart()
            }}
          >
            <RotateCcw size={18} aria-hidden="true" />
            Rejouer
          </button>
        )}
        {isHost && onChangeThemes && (
          <button
            type="button"
            className={`iozy-verre ${styles.secondary}`}
            onClick={() => {
              soundManager.playClick()
              onChangeThemes()
            }}
          >
            <LayoutGrid size={18} aria-hidden="true" />
            Changer les thèmes
          </button>
        )}
        <button
          type="button"
          className={`iozy-verre ${styles.secondary}`}
          onClick={() => {
            soundManager.playClick()
            onQuit()
          }}
        >
          <LogOut size={18} aria-hidden="true" />
          Quitter le salon
        </button>
      </div>
    </section>
  )
}
