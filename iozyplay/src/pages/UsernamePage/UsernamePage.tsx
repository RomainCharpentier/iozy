import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { settingsService } from '../../services/settingsService'
import { soundManager } from '../../utils/sounds'
import Logo from '../../components/common/Logo'
import '../../styles/auth-page.css'

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
    
    // Sauvegarder le username dans les settings
    settingsService.updateSetting('username', username.trim())
    
    soundManager.playSuccess()
    navigate('/', { replace: true })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <Logo size="large" />
          <p className="auth-subtitle">Choisissez votre nom d'utilisateur pour commencer</p>
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
              />
            </div>

            <button
              className="btn btn-primary auth-button"
              onClick={handleSubmit}
              disabled={!username.trim()}
            >
              Commencer
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <p className="auth-hint">
            Votre nom est sauvegardé localement et sera utilisé dans les parties multijoueur.
          </p>
        </div>
      </div>
    </div>
  )
}


