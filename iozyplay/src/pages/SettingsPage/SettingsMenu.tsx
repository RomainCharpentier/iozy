import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from './SettingsMenu.module.scss'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { settingsService, UserSettings } from '@/services/settingsService'
import { soundManager } from '@/utils/sounds'
import ConfirmDialog from '@/components/common/ConfirmDialog'

export default function SettingsMenu() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<UserSettings>(settingsService.getSettings())
  const [activeSection, setActiveSection] = useState<'account' | 'sound' | 'interface'>('account')
  const [showResetDialog, setShowResetDialog] = useState(false)

  useEffect(() => {
    soundManager.setEnabled(settings.soundEnabled)
    soundManager.setVolume(settings.soundVolume)
  }, [])

  const handleSettingChange = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    settingsService.updateSetting(key, value)

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
    <div className={styles.settingsLayout}>
      <div className={styles.settingsContainer}>
        {/* Header */}
        <div className={styles.settingsHeader}>
          <button
            className={`${ds.btn} ${ds.btnSecondary} ${ds.btnIcon} ${styles.headerBack}`}
            onClick={() => {
              soundManager.playClick()
              navigate(-1)
            }}
            aria-label="Retour"
          >
            ← Retour
          </button>
          <h1 className={styles.settingsTitle}>
            <span className={styles.titleIcon}>⚙️</span> Réglages
          </h1>
          <div className={styles.headerSpacer} aria-hidden="true" />
        </div>

        <div className={styles.settingsContent}>
          {/* Sidebar Navigation */}
          <div className={styles.settingsSidebar}>
            <button
              className={`${styles.settingsNavItem} ${activeSection === 'account' ? styles.active : ''}`}
              onClick={() => {
                setActiveSection('account')
                soundManager.playClick()
              }}
            >
              <span className={styles.navIcon} style={{ fontSize: '18px' }}>
                👤
              </span>
              <span className={styles.navLabel}>Compte</span>
            </button>
            <button
              className={`${styles.settingsNavItem} ${activeSection === 'sound' ? styles.active : ''}`}
              onClick={() => {
                setActiveSection('sound')
                soundManager.playClick()
              }}
            >
              <span className={styles.navIcon} style={{ fontSize: '18px' }}>
                🔊
              </span>
              <span className={styles.navLabel}>Son</span>
            </button>
            <button
              className={`${styles.settingsNavItem} ${activeSection === 'interface' ? styles.active : ''}`}
              onClick={() => {
                setActiveSection('interface')
                soundManager.playClick()
              }}
            >
              <span className={styles.navIcon} style={{ fontSize: '18px' }}>
                🎨
              </span>
              <span className={styles.navLabel}>Interface</span>
            </button>
          </div>

          {/* Main Content */}
          <div className={styles.settingsMain}>
            {/* Section Compte */}
            {activeSection === 'account' && (
              <div className={styles.settingsSection}>
                <h2 className={styles.sectionTitle}>Profil</h2>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <span className={styles.labelText}>Nom d'utilisateur</span>
                    <span
                      className={styles.labelDescription}
                      style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}
                    >
                      Affiché dans les parties multijoueur
                    </span>
                  </label>
                  <input
                    type="text"
                    className={ds.input}
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
              <div className={styles.settingsSection}>
                <h2 className={styles.sectionTitle}>Réglages audio</h2>

                <div className={styles.settingGroup}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--spacing-md)',
                    }}
                  >
                    <label className={styles.settingLabel} style={{ marginBottom: 0 }}>
                      <span className={styles.labelText}>Activer les sons</span>
                    </label>
                    <div className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        id="soundEnabled"
                        checked={settings.soundEnabled}
                        onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                        aria-label="Activer les sons"
                      />
                      <label htmlFor="soundEnabled" className={styles.toggleLabel}>
                        <span className={styles.toggleSlider}></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--spacing-sm)',
                    }}
                  >
                    <label className={styles.settingLabel} style={{ marginBottom: 0 }}>
                      <span className={styles.labelText}>Volume</span>
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
                    className={styles.slider}
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

                <div className={styles.settingGroup} style={{ marginTop: 'var(--spacing-xl)' }}>
                  <button
                    className={`${ds.btn} ${ds.btnSecondary}`}
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
              <div className={styles.settingsSection}>
                <h2 className={styles.sectionTitle}>Apparence</h2>

                <div className={styles.settingGroup}>
                  <label className={styles.settingLabel}>
                    <span className={styles.labelText}>Thème</span>
                  </label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioOption}>
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
                    <label className={styles.radioOption}>
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
        <div className={styles.settingsFooter}>
          <button
            className={`${ds.btn} ${ds.btnDanger}`}
            onClick={handleReset}
            aria-label="Réinitialiser tous les réglages"
          >
            🔄 Réinitialiser
          </button>
          <button
            className={`${ds.btn} ${ds.btnPrimary}`}
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
