import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { settingsService, UserSettings } from '../../services/settingsService'
import { soundManager } from '../../utils/sounds'
import '../../styles/design-system.css'
import './SettingsMenu.css'

const AVATARS = ['🎮', '🎵', '🎬', '📺', '🎨', '🚀', '⚡', '🔥', '💎', '🌟', '🎯', '🎪']

export default function SettingsMenu() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<UserSettings>(settingsService.getSettings())
  const [activeSection, setActiveSection] = useState<'account' | 'sound' | 'interface'>('account')

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
  }

  const handleReset = () => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les réglages ?')) {
      settingsService.resetSettings()
      const defaultSettings = settingsService.getSettings()
      setSettings(defaultSettings)
      soundManager.setEnabled(defaultSettings.soundEnabled)
      soundManager.playClick()
    }
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
          >
            ← Retour
          </button>
          <h1 className="settings-title">⚙️ Réglages</h1>
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
              <span className="nav-icon">👤</span>
              <span className="nav-label">Compte</span>
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'sound' ? 'active' : ''}`}
              onClick={() => {
                setActiveSection('sound')
                soundManager.playClick()
              }}
            >
              <span className="nav-icon">🔊</span>
              <span className="nav-label">Son</span>
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'interface' ? 'active' : ''}`}
              onClick={() => {
                setActiveSection('interface')
                soundManager.playClick()
              }}
            >
              <span className="nav-icon">🎨</span>
              <span className="nav-label">Interface</span>
            </button>
          </div>

          {/* Main Content */}
          <div className="settings-main">
            {/* Section Compte */}
            {activeSection === 'account' && (
              <div className="settings-section">
                <h2 className="section-title">Gestion du compte</h2>
                
                <div className="setting-group">
                  <label className="setting-label">
                    <span className="label-text">Nom d'utilisateur</span>
                    <span className="label-description" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
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
                  />
                </div>

                <div className="setting-group">
                  <label className="setting-label">
                    <span className="label-text">Avatar</span>
                  </label>
                  <div className="avatar-grid" style={{ marginTop: 'var(--spacing-md)' }}>
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar}
                        className={`avatar-option ${settings.avatar === avatar ? 'selected' : ''}`}
                        onClick={() => {
                          handleSettingChange('avatar', avatar)
                          soundManager.playClick()
                        }}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Section Son */}
            {activeSection === 'sound' && (
              <div className="settings-section">
                <h2 className="section-title">Réglages audio</h2>
                
                <div className="setting-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <label className="setting-label" style={{ marginBottom: 0 }}>
                      <span className="label-text">Activer les sons</span>
                    </label>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        id="soundEnabled"
                        checked={settings.soundEnabled}
                        onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                      />
                      <label htmlFor="soundEnabled" className="toggle-label">
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="setting-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                    <label className="setting-label" style={{ marginBottom: 0 }}>
                      <span className="label-text">Volume</span>
                    </label>
                    <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--accent-primary)' }}>
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
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
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
                    🔊 Tester le son
                  </button>
                </div>
              </div>
            )}

            {/* Section Interface */}
            {activeSection === 'interface' && (
              <div className="settings-section">
                <h2 className="section-title">Personnalisation de l'interface</h2>
                
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
                      <span>🌙 Sombre</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="theme"
                        value="light"
                        checked={settings.theme === 'light'}
                        onChange={(e) => handleSettingChange('theme', e.target.value as 'light')}
                      />
                      <span>☀️ Clair</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="theme"
                        value="auto"
                        checked={settings.theme === 'auto'}
                        onChange={(e) => handleSettingChange('theme', e.target.value as 'auto')}
                      />
                      <span>🔄 Auto</span>
                    </label>
                  </div>
                </div>

                <div className="setting-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="setting-label" style={{ marginBottom: 0 }}>
                      <span className="label-text">Animations</span>
                    </label>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        id="animationsEnabled"
                        checked={settings.animationsEnabled}
                        onChange={(e) => handleSettingChange('animationsEnabled', e.target.checked)}
                      />
                      <label htmlFor="animationsEnabled" className="toggle-label">
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="setting-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="setting-label" style={{ marginBottom: 0 }}>
                      <span className="label-text">Mode compact</span>
                    </label>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        id="compactMode"
                        checked={settings.compactMode}
                        onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                      />
                      <label htmlFor="compactMode" className="toggle-label">
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="setting-group">
                  <label className="setting-label">
                    <span className="label-text">Taille de police</span>
                  </label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="fontSize"
                        value="small"
                        checked={settings.fontSize === 'small'}
                        onChange={(e) => handleSettingChange('fontSize', e.target.value as 'small')}
                      />
                      <span>Petit</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="fontSize"
                        value="medium"
                        checked={settings.fontSize === 'medium'}
                        onChange={(e) => handleSettingChange('fontSize', e.target.value as 'medium')}
                      />
                      <span>Moyen</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="fontSize"
                        value="large"
                        checked={settings.fontSize === 'large'}
                        onChange={(e) => handleSettingChange('fontSize', e.target.value as 'large')}
                      />
                      <span>Grand</span>
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
          >
            🔄 Réinitialiser
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              soundManager.playSuccess()
              navigate(-1)
            }}
          >
            ✓ Enregistrer et fermer
          </button>
        </div>
      </div>
    </div>
  )
}

