import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { settingsService, UserSettings } from '@/services/settingsService'
import { soundManager } from '@/utils/sounds'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import '../../styles/design-system.css'
import '../../styles/settings-menu.css'

export default function SettingsMenu() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<UserSettings>(settingsService.getSettings())
  const [activeSection, setActiveSection] = useState<'account' | 'sound' | 'interface'>('account')
  const [showResetDialog, setShowResetDialog] = useState(false)

  useEffect(() => {
    // Appliquer les settings au chargement
    soundManager.setEnabled(settings.soundEnabled)
    soundManager.setVolume(settings.soundVolume)
  }, [])

  const handleSettingChange = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    settingsService.updateSetting(key, value)

    // Appliquer immédiatement pour le son
    if (key === 'soundEnabled') {
      soundManager.setEnabled(value as boolean)
      if (value) {
        soundManager.playClick()
      }
    } else if (key === 'soundVolume') {
      soundManager.setVolume(value as number)
      if (settings.soundEnabled) {
        soundManager.playClick()
      }
    }
    // Le thème est appliqué automatiquement par settingsService.updateSetting
  }

  const handleReset = () => {
    setShowResetDialog(true)
  }

  const confirmReset = () => {
    settingsService.resetSettings()
    const defaultSettings = settingsService.getSettings()
    setSettings(defaultSettings)
    soundManager.setEnabled(defaultSettings.soundEnabled)
    soundManager.playClick()
    setShowResetDialog(false)
  }

  return (
    <div className="settings-layout">
      <div className="settings-container">
        {/* Header */}
        <div className="settings-header">
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => {
              soundManager.playClick()
              navigate(-1)
            }}
            style={{ marginRight: 'auto' }}
            aria-label="Retour"
          >
            ← Retour
          </button>
          <h1
            className="settings-title"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span style={{ fontSize: '24px' }}>⚙️</span> Réglages
          </h1>
          <div style={{ width: '100px' }}></div>
        </div>

        <div className="settings-content">
          {/* Sidebar Navigation */}
          <div className="settings-sidebar">
            <button
              className={`settings-nav-item ${activeSection === 'account' ? 'active' : ''}`}
              onClick={() => {
                setActiveSection('account')
                soundManager.playClick()
              }}
            >
              <span className="nav-icon" style={{ fontSize: '18px' }}>
                👤
              </span>
              <span className="nav-label">Compte</span>
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'sound' ? 'active' : ''}`}
              onClick={() => {
                setActiveSection('sound')
                soundManager.playClick()
              }}
            >
              <span className="nav-icon" style={{ fontSize: '18px' }}>
                🔊
              </span>
              <span className="nav-label">Son</span>
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'interface' ? 'active' : ''}`}
              onClick={() => {
                setActiveSection('interface')
                soundManager.playClick()
              }}
            >
              <span className="nav-icon" style={{ fontSize: '18px' }}>
                🎨
              </span>
              <span className="nav-label">Interface</span>
            </button>
          </div>

          {/* Main Content */}
          <div className="settings-main">
            {/* Section Compte */}
            {activeSection === 'account' && (
              <div className="settings-section">
                <h2 className="section-title">Profil</h2>

                <div className="setting-group">
                  <label className="setting-label">
                    <span className="label-text">Nom d'utilisateur</span>
                    <span
                      className="label-description"
                      style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}
                    >
                      Affiché dans les parties multijoueur
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={settings.username}
                    onChange={(e) => handleSettingChange('username', e.target.value)}
                    placeholder="Votre nom"
                    maxLength={20}
                    style={{ marginTop: 'var(--spacing-md)' }}
                    aria-label="Nom d'utilisateur"
                  />
                </div>
              </div>
            )}

            {/* Section Son */}
            {activeSection === 'sound' && (
              <div className="settings-section">
                <h2 className="section-title">Réglages audio</h2>

                <div className="setting-group">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--spacing-md)',
                    }}
                  >
                    <label className="setting-label" style={{ marginBottom: 0 }}>
                      <span className="label-text">Activer les sons</span>
                    </label>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        id="soundEnabled"
                        checked={settings.soundEnabled}
                        onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                        aria-label="Activer les sons"
                      />
                      <label htmlFor="soundEnabled" className="toggle-label">
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="setting-group">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--spacing-sm)',
                    }}
                  >
                    <label className="setting-label" style={{ marginBottom: 0 }}>
                      <span className="label-text">Volume</span>
                    </label>
                    <span
                      style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                      }}
                    >
                      {settings.soundVolume}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.soundVolume}
                    onChange={(e) => handleSettingChange('soundVolume', parseInt(e.target.value))}
                    className="slider"
                    disabled={!settings.soundEnabled}
                    aria-label="Volume du son"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={settings.soundVolume}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 'var(--spacing-xs)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="setting-group" style={{ marginTop: 'var(--spacing-xl)' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (settings.soundEnabled) {
                        soundManager.playSuccess()
                      }
                    }}
                    disabled={!settings.soundEnabled}
                    style={{ width: '100%' }}
                  >
                    <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>🔊</span> Tester le
                    son
                  </button>
                </div>
              </div>
            )}

            {/* Section Interface */}
            {activeSection === 'interface' && (
              <div className="settings-section">
                <h2 className="section-title">Apparence</h2>

                <div className="setting-group">
                  <label className="setting-label">
                    <span className="label-text">Thème</span>
                  </label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="theme"
                        value="dark"
                        checked={settings.theme === 'dark'}
                        onChange={(e) => handleSettingChange('theme', e.target.value as 'dark')}
                      />
                      <span>
                        <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>🌙</span> Sombre
                      </span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="theme"
                        value="light"
                        checked={settings.theme === 'light'}
                        onChange={(e) => handleSettingChange('theme', e.target.value as 'light')}
                      />
                      <span>
                        <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>☀️</span> Clair
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="settings-footer">
          <button
            className="btn btn-danger"
            onClick={handleReset}
            aria-label="Réinitialiser tous les réglages"
          >
            🔄 Réinitialiser
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              soundManager.playSuccess()
              navigate(-1)
            }}
            aria-label="Enregistrer et fermer"
          >
            ✓ Enregistrer et fermer
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showResetDialog}
        title="Réinitialiser les réglages"
        message="Êtes-vous sûr de vouloir réinitialiser tous les réglages ? Cette action est irréversible."
        confirmText="Réinitialiser"
        cancelText="Annuler"
        variant="warning"
        onConfirm={confirmReset}
        onCancel={() => setShowResetDialog(false)}
      />
    </div>
  )
}
