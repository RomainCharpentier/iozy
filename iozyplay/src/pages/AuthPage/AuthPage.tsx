import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../../services/authService'
import { settingsService } from '../../services/settingsService'
import { soundManager } from '../../utils/sounds'
import '../../styles/auth-page.css'

export default function AuthPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Si déjà connecté, rediriger vers l'accueil
    if (authService.isAuthenticated()) {
      navigate('/')
    }
  }, [navigate])

  const handleCreateAccount = async () => {
    if (!username.trim()) {
      setError('Veuillez entrer un nom d\'utilisateur')
      return
    }

    if (username.trim().length < 2) {
      setError('Le nom d\'utilisateur doit contenir au moins 2 caractères')
      return
    }

    if (username.trim().length > 20) {
      setError('Le nom d\'utilisateur ne doit pas dépasser 20 caractères')
      return
    }

    setError('')
    setIsCreating(true)

    try {
      const session = await authService.createAccount(username.trim())
      
      // Mettre à jour les settings locaux
      settingsService.updateSetting('username', session.username)

      soundManager.playSuccess()
      navigate('/')
    } catch (error) {
      console.error('Erreur lors de la création du compte:', error)
      setError('Erreur lors de la création du compte. Veuillez réessayer.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreateAccount()
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">🎵 Blindtest</h1>
          <p className="auth-subtitle">Créez votre compte pour commencer à jouer</p>
        </div>

        <div className="auth-content">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <div className="auth-form">
            <div className="form-group">
              <label htmlFor="username-input" className="form-label">
                Nom d'utilisateur
              </label>
              <input
                id="username-input"
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError('')
                }}
                onKeyPress={handleKeyPress}
                placeholder="Votre nom"
                maxLength={20}
                autoFocus
                disabled={isCreating}
              />
            </div>

            <button
              className="btn btn-primary auth-button"
              onClick={handleCreateAccount}
              disabled={isCreating || !username.trim()}
            >
              {isCreating ? 'Création...' : 'Créer mon compte'}
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <p className="auth-hint">
            Pas de mot de passe requis pour l'instant. Votre compte est sauvegardé sur le serveur.
          </p>
        </div>
      </div>
    </div>
  )
}

