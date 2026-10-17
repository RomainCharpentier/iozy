import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/UsernamePage/UsernamePage.module.scss'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { settingsService } from '@/services/settingsService'
import { soundManager } from '@/utils/sounds'
import Logo from '@/components/common/Logo'

/** La porte d'entrée, hors coquille (voir AppShell), construite comme la page
 *  de connexion d'IozyCore : le nom en grand, une phrase, une carte-formulaire. */
export default function UsernamePage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // Si déjà un username, rediriger vers l'accueil
    const settings = settingsService.getSettings()
    if (settings.username && settings.username.trim()) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  const handleSubmit = () => {
    if (!username.trim()) {
      setError("Veuillez entrer un nom d'utilisateur")
      return
    }

    if (username.trim().length < 2) {
      setError("Le nom d'utilisateur doit contenir au moins 2 caractères")
      return
    }

    if (username.trim().length > 20) {
      setError("Le nom d'utilisateur ne doit pas dépasser 20 caractères")
      return
    }

    setError('')

    // Sauvegarder le username dans les settings
    settingsService.updateSetting('username', username.trim())

    soundManager.playSuccess()
    navigate('/', { replace: true })
  }

  return (
    <main className={styles.door}>
      <div className={styles.halo} aria-hidden="true" />

      <div className={styles.brand}>
        <Logo size="small" showText={false} />
        <h1 className={styles.wordmark}>
          Iozy<span className={styles.wordmarkAccent}>Play</span>
        </h1>
        <p className={styles.lead}>
          Le blindtest entre amis : écoute, devine, marque des points. Il ne manque que ton nom.
        </p>
      </div>

      <form
        className={`${ds.card} ${styles.card}`}
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <h2 className={styles.cardTitle}>Choisis ton nom de joueur</h2>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <label className={styles.field} htmlFor="username-input">
          <span className={styles.label}>Nom d'utilisateur</span>
          <input
            id="username-input"
            type="text"
            className={ds.input}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError('')
            }}
            placeholder="Votre nom"
            maxLength={20}
            autoFocus
          />
          <span className={styles.hint}>Entre 2 et 20 caractères.</span>
        </label>

        <button
          type="submit"
          className={`${ds.btn} ${ds.btnPrimary} ${styles.submit}`}
          disabled={!username.trim()}
        >
          Commencer
        </button>
      </form>

      <p className={styles.footnote}>
        Ton nom reste sur cet appareil ; il s'affiche aux autres joueurs pendant les parties.
      </p>
    </main>
  )
}
