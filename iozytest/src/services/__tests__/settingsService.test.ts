/**
 * Les réglages son enregistrés s'appliquent dès le démarrage,
 * sans passer par la page /settings.
 */
const SETTINGS_KEY = 'blindtest-settings'

async function loadFresh() {
  vi.resetModules()
  const { soundManager } = await import('@/utils/sounds')
  const { settingsService } = await import('@/services/settingsService')
  return { soundManager, settingsService }
}

describe('settingsService et le son', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('coupe le son au démarrage si le joueur l’a coupé', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundEnabled: false, soundVolume: 30 }))

    const { soundManager } = await loadFresh()

    expect(soundManager.isEnabled()).toBe(false)
    expect(soundManager.getVolume()).toBe(30)
  })

  it('garde le son actif à 70 % sans réglage enregistré', async () => {
    const { soundManager } = await loadFresh()

    expect(soundManager.isEnabled()).toBe(true)
    expect(soundManager.getVolume()).toBe(70)
  })

  it('applique aussitôt un changement et la réinitialisation', async () => {
    const { soundManager, settingsService } = await loadFresh()

    settingsService.updateSetting('soundEnabled', false)
    settingsService.updateSetting('soundVolume', 15)
    expect(soundManager.isEnabled()).toBe(false)
    expect(soundManager.getVolume()).toBe(15)

    settingsService.resetSettings()
    expect(soundManager.isEnabled()).toBe(true)
    expect(soundManager.getVolume()).toBe(70)
  })
})
