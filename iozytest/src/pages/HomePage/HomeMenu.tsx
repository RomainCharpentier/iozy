import styles from '@/pages/HomePage/HomeMenu.module.scss'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LayoutGrid, Play } from 'lucide-react'
import { soundManager } from '@/utils/sounds'
import { QUICK_GAME_QUESTION_COUNT } from '@/services/quickGameService'

/** Taille de la banque de questions : `undefined` en chargement, `null` si le
 *  serveur ne répond pas. */
export type BankSize = number | null | undefined

interface HomeMenuProps {
  bankSize: BankSize
  isPreparing: boolean
  onQuickGame: () => void
  onChooseThemes: () => void
}

/** La phrase sous le titre : vraie et calculée, jamais un slogan. */
export function quickGameSubtitle(bankSize: BankSize): string {
  if (bankSize === undefined) return 'Chargement de la banque de questions…'
  if (bankSize === null) return 'La banque de questions ne répond pas pour l’instant.'
  if (bankSize === 0) return 'La banque est vide : ajoute des extraits dans l’éditeur.'
  const count = Math.min(QUICK_GAME_QUESTION_COUNT, bankSize)
  return `${count} extrait${count > 1 ? 's' : ''} tiré${count > 1 ? 's' : ''} parmi ${bankSize}, tous thèmes, rien à régler.`
}

/**
 * « On joue ? » : l'accueil d'IozyTest. Une seule grande action, la partie
 * rapide (le salon s'ouvre prêt à partager et à lancer) ; choisir ses thèmes
 * et rejoindre un salon restent à côté, en verre.
 */
export default function HomeMenu({
  bankSize,
  isPreparing,
  onQuickGame,
  onChooseThemes,
}: HomeMenuProps) {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState<string>('')

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      toast.error('Entre le code du salon pour le rejoindre.')
      return
    }
    soundManager.playClick()
    navigate(`/room/join?room=${roomCode.trim().toUpperCase()}`)
  }

  const bankEmpty = bankSize === 0

  return (
    <div className={styles.home}>
      {/* Le fond : un halo de la couleur vive, flouté, sans bord net. */}
      <div className={styles.backdrop} aria-hidden="true" />

      <section className={styles.hero} aria-labelledby="home-title">
        <span className={styles.kicker}>IozyTest · le blindtest</span>
        <h1 id="home-title" className={styles.title}>
          On joue ?
        </h1>
        <p className={styles.subtitle} role="status">
          {quickGameSubtitle(bankSize)}
          {bankEmpty && (
            <>
              {' '}
              <Link to="/editor">Ouvrir l’éditeur</Link>
            </>
          )}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.quick}
            onClick={() => {
              soundManager.playStart()
              onQuickGame()
            }}
            disabled={isPreparing || bankEmpty}
            aria-busy={isPreparing}
          >
            <Play size={22} aria-hidden="true" />
            {isPreparing ? 'Préparation…' : 'Partie rapide'}
          </button>
          <button
            type="button"
            className={`iozy-verre ${styles.secondary}`}
            onClick={() => {
              soundManager.playClick()
              onChooseThemes()
            }}
          >
            <LayoutGrid size={18} aria-hidden="true" />
            Choisir les thèmes
          </button>
        </div>

        <form
          className={`iozy-verre ${styles.join}`}
          aria-label="Rejoindre un salon"
          onSubmit={(e) => {
            e.preventDefault()
            handleJoinRoom()
          }}
        >
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            className={styles.joinInput}
            aria-label="Code du salon"
          />
          <button type="submit" className={styles.joinButton} disabled={!roomCode.trim()}>
            Rejoindre
          </button>
        </form>
      </section>
    </div>
  )
}
