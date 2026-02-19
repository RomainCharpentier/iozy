// Service pour gérer les préférences utilisateur (localStorage)

export interface UserSettings {
  // Compte
  username: string

  // Son
  soundEnabled: boolean
  soundVolume: number // 0-100

  // Interface
  theme: 'dark' | 'light'
}

const DEFAULT_SETTINGS: UserSettings = {
  username: '',
  soundEnabled: true,
  soundVolume: 70,
  theme: 'dark',
}

const SETTINGS_KEY = 'blindtest-settings'

class SettingsService {
  private settings: UserSettings = { ...DEFAULT_SETTINGS }

  constructor() {
    this.loadSettings()
  }

  // Charger les settings depuis localStorage
  loadSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des settings:', error)
      this.settings = { ...DEFAULT_SETTINGS }
    }
    return this.settings
  }

  // Sauvegarder les settings dans localStorage
  saveSettings(settings: Partial<UserSettings>): void {
    try {
      this.settings = { ...this.settings, ...settings }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))

      // Appliquer les changements immédiatement
      this.applySettings()
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des settings:', error)
    }
  }

  // Obtenir les settings actuels
  getSettings(): UserSettings {
    return { ...this.settings }
  }

  // Obtenir une valeur spécifique
  getSetting<K extends keyof UserSettings>(key: K): UserSettings[K] {
    return this.settings[key]
  }

  // Mettre à jour une valeur spécifique
  updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
    this.saveSettings({ [key]: value })
  }

  // Réinitialiser les settings
  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS }
    localStorage.removeItem(SETTINGS_KEY)
    this.applySettings()
  }

  // Appliquer les settings à l'application
  private applySettings(): void {
    // Appliquer le thème
    if (this.settings.theme === 'dark') {
      document.documentElement.classList.remove('light-theme')
      document.documentElement.classList.add('dark-theme')
    } else {
      document.documentElement.classList.remove('dark-theme')
      document.documentElement.classList.add('light-theme')
    }
  }

  // Initialiser les settings au démarrage
  init(): void {
    this.loadSettings()
    this.applySettings()
  }
}

// Instance singleton
export const settingsService = new SettingsService()

// Initialiser au chargement
if (typeof window !== 'undefined') {
  settingsService.init()
}
