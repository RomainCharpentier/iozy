import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from './HomeMenu.module.scss'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { soundManager } from '@/utils/sounds'
import Logo from '@/components/common/Logo'

interface HomeMenuProps {
  onCreateGame: () => void
  onJoinRoom: () => void
  onOpenEditor: () => void
}

export default function HomeMenu({ onCreateGame, onJoinRoom, onOpenEditor }: HomeMenuProps) {
  const navigate = useNavigate()
  const [showJoinRoom, setShowJoinRoom] = useState(false)
  const [roomCode, setRoomCode] = useState<string>('')

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      toast.error('Veuillez entrer un code de salon !', {
        icon: '🔗',
      })
      return
    }

    soundManager.playClick()
    navigate(`/room/join?room=${roomCode.trim().toUpperCase()}`)
  }

  if (showJoinRoom) {
    return (
      <div className={ds.homeLayout}>
        <div className={`${ds.card} ${styles.joinRoomCard}`}>
          <div className={ds.cardHeader}>
            <h2 className={ds.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🔗 Rejoindre un salon
            </h2>
          </div>

          <div className={styles.joinForm}>
            <div>
              <label className={styles.joinFormLabel}>Code du salon</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Ex: ABC123"
                maxLength={6}
                className={`${ds.input} ${styles.joinFormInput}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && roomCode.trim()) {
                    e.preventDefault()
                    handleJoinRoom()
                  }
                }}
                autoFocus
                aria-label="Code du salon"
              />
            </div>

            <div className={styles.joinFormActions}>
              <button
                className={`${ds.btn} ${ds.btnSecondary}`}
                onClick={() => {
                  soundManager.playClick()
                  setShowJoinRoom(false)
                  setRoomCode('')
                }}
              >
                ← Retour
              </button>
              <button
                className={`${ds.btn} ${ds.btnPrimary}`}
                onClick={handleJoinRoom}
                disabled={!roomCode.trim()}
              >
                Rejoindre →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={ds.homeLayout}>
      <div className={styles.headerSection}>
        <div className={styles.settingsBtnWrapper}>
          <button
            className={`${ds.btn} ${ds.btnSecondary} ${styles.settingsBtn}`}
            onClick={() => {
              soundManager.playClick()
              navigate('/settings')
            }}
            title="Réglages"
          >
            <span style={{ fontSize: '16px' }}>⚙️</span>
            <span style={{ fontSize: 'var(--font-size-sm)' }}>Réglages</span>
          </button>
        </div>
        <Logo size="medium" />
        <p className={`${ds.textSecondary} ${styles.subtitle}`}>
          Écoute et devine les chansons, séries TV, animes, films et jeux !
        </p>
      </div>

      <div className={`${ds.grid3} ${styles.cardsGrid}`}>
        {/* Card Solo */}
        <div
          className={`${ds.card} ${styles.menuCard}`}
          onClick={() => {
            soundManager.playStart()
            onCreateGame()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              soundManager.playStart()
              onCreateGame()
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Créer une partie solo ou multijoueur"
        >
          <div className={styles.cardIcon}>🎮</div>
          <h3 className={styles.cardTitle}>CRÉER</h3>
          <p className={`${ds.textSecondary} ${styles.cardDescription}`}>
            Créer une partie solo ou multijoueur
          </p>
          <button className={`${ds.btn} ${ds.btnPrimary} ${ds.btnLarge} ${styles.cardButton}`}>
            Créer une partie
          </button>
        </div>

        {/* Card Rejoindre */}
        <div
          className={`${ds.card} ${styles.menuCard}`}
          onClick={() => {
            soundManager.playClick()
            setShowJoinRoom(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              soundManager.playClick()
              setShowJoinRoom(true)
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Rejoindre un salon avec un code"
        >
          <div className={styles.cardIcon}>🔗</div>
          <h3 className={styles.cardTitle}>REJOINDRE</h3>
          <p className={`${ds.textSecondary} ${styles.cardDescription}`}>
            Rejoins un salon avec un code
          </p>
          <button className={`${ds.btn} ${ds.btnSecondary} ${ds.btnLarge} ${styles.cardButton}`}>
            Rejoindre une partie
          </button>
        </div>

        {/* Card Éditeur */}
        <div
          className={`${ds.card} ${styles.menuCard}`}
          onClick={() => {
            soundManager.playClick()
            onOpenEditor()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              soundManager.playClick()
              onOpenEditor()
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Ouvrir l'éditeur de questions"
        >
          <div className={styles.cardIcon}>✏️</div>
          <h3 className={styles.cardTitle}>ÉDITEUR</h3>
          <p className={`${ds.textSecondary} ${styles.cardDescription}`}>
            Ajoute et modifie les questions
          </p>
          <button className={`${ds.btn} ${ds.btnTertiary} ${ds.btnLarge} ${styles.cardButton}`}>
            Ouvrir l'éditeur
          </button>
        </div>
      </div>
    </div>
  )
}
