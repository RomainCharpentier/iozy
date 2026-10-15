import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/SettingsPage/SettingsMenu.module.scss'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Moon, RotateCcw, Sun, Volume2 } from 'lucide-react'
import { settingsService, UserSettings } from '@/services/settingsService'
import { soundManager } from '@/utils/sounds'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import BackLink from '@/components/common/BackLink'
import SectionHeader from '@/components/common/SectionHeader'
import { destinationLabelFor } from '@/components/layout/navItems'

/** Les réglages, comme la page Profil d'IozyCore : une colonne étroite, une
 *  carte par sujet, chaque changement enregistré aussitôt (pas de bouton
 *  « Enregistrer »), et la zone de danger à part, teintée. */
export default function SettingsMenu() {
  // Le lien retour NOMME d'où l'on vient (l'en-tête passe son origine en state).
  const back = destinationLabelFor((useLocation().state as { from?: string } | null)?.from)
  const [settings, setSettings] = useState<UserSettings>(settingsService.getSettings())
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

  const confirmReset = () => {
    settingsService.resetSettings()
    const defaultSettings = settingsService.getSettings()
    setSettings(defaultSettings)
    soundManager.setEnabled(defaultSettings.soundEnabled)
    soundManager.playClick()
    setShowResetDialog(false)
  }

  return (
    <div className={styles.page}>
      <BackLink to={back.to} label={back.label} />
      <SectionHeader
        level={1}
        title="Réglages"
        subtitle="Ces réglages restent sur cet appareil et s'appliquent aussitôt."
      />

      <section className={`${ds.card} ${styles.card}`} aria-labelledby="settings-account">
        <SectionHeader
          title={<span id="settings-account">Compte</span>}
          subtitle="Le nom que les autres joueurs voient pendant les parties."
        />
        <label className={styles.field}>
          <span className={styles.label}>Nom d'utilisateur</span>
          <input
            type="text"
            className={ds.input}
            value={settings.username}
            onChange={(e) => handleSettingChange('username', e.target.value)}
            placeholder="Votre nom"
            maxLength={20}
          />
        </label>
      </section>

      <section className={`${ds.card} ${styles.card}`} aria-labelledby="settings-sound">
        <SectionHeader
          title={<span id="settings-sound">Son</span>}
          subtitle="Les sons de l'interface : clics, départ de manche, bonne réponse."
        />

        <div className={styles.row}>
          <label htmlFor="soundEnabled" className={styles.rowLabel}>
            Activer les sons
          </label>
          <span className={styles.toggleSwitch}>
            <input
              type="checkbox"
              id="soundEnabled"
              checked={settings.soundEnabled}
              onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
            />
            <label htmlFor="soundEnabled" className={styles.toggleLabel} aria-hidden="true">
              <span className={styles.toggleSlider}></span>
            </label>
          </span>
        </div>

        <div className={styles.field}>
          <div className={styles.row}>
            <label htmlFor="soundVolume" className={styles.label}>
              Volume
            </label>
            <output htmlFor="soundVolume" className={styles.value}>
              {settings.soundVolume} %
            </output>
          </div>
          <input
            id="soundVolume"
            type="range"
            min="0"
            max="100"
            value={settings.soundVolume}
            onChange={(e) => handleSettingChange('soundVolume', parseInt(e.target.value))}
            className={styles.slider}
            disabled={!settings.soundEnabled}
          />
        </div>

        <div>
          <button
            type="button"
            className={`${ds.btn} ${ds.btnSecondary}`}
            onClick={() => {
              if (settings.soundEnabled) {
                soundManager.playSuccess()
              }
            }}
            disabled={!settings.soundEnabled}
          >
            <Volume2 size={16} aria-hidden="true" />
            Tester le son
          </button>
        </div>
      </section>

      <section className={`${ds.card} ${styles.card}`} aria-labelledby="settings-appearance">
        <SectionHeader
          title={<span id="settings-appearance">Apparence</span>}
          subtitle="Le thème se change aussi depuis l'en-tête, en un clic."
        />
        <div role="radiogroup" aria-label="Thème" className={styles.segmented}>
          <button
            type="button"
            role="radio"
            aria-checked={settings.theme === 'dark'}
            className={`${ds.chip} ${settings.theme === 'dark' ? ds.chipActive : ''}`}
            onClick={() => handleSettingChange('theme', 'dark')}
          >
            <Moon size={14} aria-hidden="true" />
            Sombre
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.theme === 'light'}
            className={`${ds.chip} ${settings.theme === 'light' ? ds.chipActive : ''}`}
            onClick={() => handleSettingChange('theme', 'light')}
          >
            <Sun size={14} aria-hidden="true" />
            Clair
          </button>
        </div>
      </section>

      <section className={styles.dangerZone} aria-labelledby="settings-reset">
        <SectionHeader
          title={<span id="settings-reset">Réinitialiser</span>}
          subtitle="Remet le nom, le son et le thème à leurs valeurs d'origine."
          action={
            <button
              type="button"
              className={`${ds.btn} ${ds.btnDanger}`}
              onClick={() => setShowResetDialog(true)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Réinitialiser
            </button>
          }
        />
      </section>

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
