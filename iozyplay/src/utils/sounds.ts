// Utilitaire pour gérer les effets sonores
// Utilise l'API Web Audio pour générer des sons simples

class SoundManager {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true
  private volume: number = 0.7 // 0-1 (70% par défaut)

  constructor() {
    // Initialiser l'audio context quand l'utilisateur interagit avec la page
    if (typeof window !== 'undefined') {
      // Créer l'audio context au premier clic
      document.addEventListener(
        'click',
        () => {
          if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          }
        },
        { once: true }
      )
    }
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioContext && typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return this.audioContext
  }

  // Générer un son de succès (fréquence montante)
  playSuccess() {
    if (!this.enabled) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.setValueAtTime(523.25, ctx.currentTime) // Do
    oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1) // Mi
    oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2) // Sol

    gainNode.gain.setValueAtTime(0.3 * this.volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.3)
  }

  // Générer un son d'erreur (fréquence descendante)
  playError() {
    if (!this.enabled) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.setValueAtTime(400, ctx.currentTime)
    oscillator.frequency.setValueAtTime(200, ctx.currentTime + 0.2)

    gainNode.gain.setValueAtTime(0.3 * this.volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.2)
  }

  // Générer un son de temps écoulé
  playTimeUp() {
    if (!this.enabled) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.setValueAtTime(200, ctx.currentTime)
    oscillator.frequency.setValueAtTime(150, ctx.currentTime + 0.1)
    oscillator.frequency.setValueAtTime(100, ctx.currentTime + 0.2)

    gainNode.gain.setValueAtTime(0.3 * this.volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.3)
  }

  // Générer un son de fin de compte à rebours (alarme)
  playCountdownEnd() {
    if (!this.enabled) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    // Son d'alarme plus marqué : trois bips rapides
    for (let i = 0; i < 3; i++) {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'square' // Son plus perçant
      oscillator.frequency.setValueAtTime(800, ctx.currentTime + i * 0.15)

      gainNode.gain.setValueAtTime(0.4 * this.volume, ctx.currentTime + i * 0.15)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.1)

      oscillator.start(ctx.currentTime + i * 0.15)
      oscillator.stop(ctx.currentTime + i * 0.15 + 0.1)
    }
  }

  // Générer un son de clic
  playClick() {
    if (!this.enabled) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(800, ctx.currentTime)
    oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.05)

    gainNode.gain.setValueAtTime(0.2 * this.volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.1)
  }

  // Générer un son de démarrage
  playStart() {
    if (!this.enabled) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    // Jouer une séquence de notes ascendantes
    const notes = [523.25, 659.25, 783.99, 1046.5] // Do, Mi, Sol, Do aigu

    notes.forEach((freq, index) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.setValueAtTime(freq, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.2 * this.volume, ctx.currentTime + index * 0.1)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.1 + 0.2)

      oscillator.start(ctx.currentTime + index * 0.1)
      oscillator.stop(ctx.currentTime + index * 0.1 + 0.2)
    })
  }

  // Générer un son de révélation (transition guess -> reveal)
  playReveal() {
    if (!this.enabled) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    // Son joyeux et montant pour la révélation
    const notes = [392.0, 493.88, 587.33, 783.99] // Sol, Si, Ré, Sol aigu

    notes.forEach((freq, index) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08)
      gainNode.gain.setValueAtTime(0.25 * this.volume, ctx.currentTime + index * 0.08)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.08 + 0.15)

      oscillator.start(ctx.currentTime + index * 0.08)
      oscillator.stop(ctx.currentTime + index * 0.08 + 0.15)
    })
  }

  // Activer/désactiver les sons
  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  // Définir le volume (0-100)
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume / 100))
  }

  // Obtenir le volume (0-100)
  getVolume(): number {
    return Math.round(this.volume * 100)
  }
}

// Instance singleton
export const soundManager = new SoundManager()
