import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/HomePage/HomeMenu.module.scss'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Link2, PenLine, Play } from 'lucide-react'
import { soundManager } from '@/utils/sounds'
import SectionHeader from '@/components/common/SectionHeader'
import IconPill from '@/components/common/IconPill'

interface HomeMenuProps {
  onCreateGame: () => void
  onOpenEditor: () => void
}

/** L'accueil : l'en-tête d'écran (titre, phrase, action principale) puis trois
 *  cartes, une par intention. Le formulaire « rejoindre » vit DANS sa carte,
 *  pas derrière un second écran. */
export default function HomeMenu({ onCreateGame, onOpenEditor }: HomeMenuProps) {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState<string>('')

  const createGame = () => {
    soundManager.playStart()
    onCreateGame()
  }

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      toast.error('Entre le code du salon pour le rejoindre.')
      return
    }
    soundManager.playClick()
    navigate(`/room/join?room=${roomCode.trim().toUpperCase()}`)
  }

  return (
    <div className={styles.home}>
      <SectionHeader
        level={1}
        title="Jouer"
        subtitle="Écoute et devine les chansons, séries TV, animes, films et jeux — entre amis, à distance."
        action={
          <button type="button" className={`${ds.btn} ${ds.btnPrimary}`} onClick={createGame}>
            <Play size={16} />
            Créer une partie
          </button>
        }
      />

      <div className={styles.cards}>
        <section className={`${ds.card} ${styles.card}`} aria-labelledby="home-create">
          <IconPill icon={Play} />
          <h2 id="home-create" className={styles.cardTitle}>
            Créer une partie
          </h2>
          <p className={styles.cardText}>
            Choisis les thèmes, partage le code du salon et lance la manche quand tout le monde est
            là.
          </p>
          <div className={styles.cardAction}>
            <button type="button" className={`${ds.btn} ${ds.btnPrimary}`} onClick={createGame}>
              Créer une partie
            </button>
          </div>
        </section>

        <section className={`${ds.card} ${styles.card}`} aria-labelledby="home-join">
          <IconPill icon={Link2} />
          <h2 id="home-join" className={styles.cardTitle}>
            Rejoindre un salon
          </h2>
          <p className={styles.cardText}>Entre le code à six caractères reçu de l'hôte.</p>
          <form
            className={styles.joinForm}
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
              className={`${ds.input} ${styles.joinInput}`}
              aria-label="Code du salon"
            />
            <button
              type="submit"
              className={`${ds.btn} ${ds.btnSecondary}`}
              disabled={!roomCode.trim()}
            >
              Rejoindre
            </button>
          </form>
        </section>

        <section className={`${ds.card} ${styles.card}`} aria-labelledby="home-editor">
          <IconPill icon={PenLine} />
          <h2 id="home-editor" className={styles.cardTitle}>
            Éditeur de questions
          </h2>
          <p className={styles.cardText}>
            Ajoute des extraits, corrige les réponses, organise les thèmes.
          </p>
          <div className={styles.cardAction}>
            <button
              type="button"
              className={`${ds.btn} ${ds.btnTertiary}`}
              onClick={() => {
                soundManager.playClick()
                onOpenEditor()
              }}
            >
              Ouvrir l'éditeur
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
