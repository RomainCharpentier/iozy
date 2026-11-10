import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { settingsService } from '@/services/settingsService'
import {
  IozyAccountProvider,
  adoptAccountName,
  fetchIozyAccount,
  loginUrl,
  saveAccountSound,
  useIozyAccount,
} from '@/lib/account/IozyAccount'

function reponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function Nom() {
  const account = useIozyAccount()
  return <p>{account ? `compte:${account.pseudo}` : 'personne'}</p>
}

beforeEach(() => {
  vi.stubEnv('BASE_URL', '/test/')
  settingsService.saveSettings({ username: '', usernameFromAccount: false })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('fetchIozyAccount', () => {
  it("rend le compte connecté d'IozyCore", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reponse(200, { pseudo: 'Romain', invite: false }))
    expect(await fetchIozyAccount()).toEqual({ pseudo: 'Romain', sound: null })
  })

  it('lit le son du blindtest réglé sur le compte (profil commun)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reponse(200, {
        pseudo: 'Romain',
        invite: false,
        preferences: { blindtestSound: { enabled: false, volume: 35 } },
      })
    )
    expect(await fetchIozyAccount()).toEqual({ pseudo: 'Romain', sound: { enabled: false, volume: 35 } })
  })

  it('ne compte ni une visite, ni une absence de session, ni une panne', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(reponse(200, { pseudo: 'visiteur', invite: true }))
    expect(await fetchIozyAccount()).toBeNull()
    fetchMock.mockResolvedValueOnce(reponse(401, {}))
    expect(await fetchIozyAccount()).toBeNull()
    fetchMock.mockRejectedValueOnce(new Error('réseau'))
    expect(await fetchIozyAccount()).toBeNull()
  })

  it("ne demande rien quand l'app est seule à la racine", async () => {
    vi.stubEnv('BASE_URL', '/')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    expect(await fetchIozyAccount()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('IozyAccountProvider', () => {
  it('adopte le pseudo comme nom de joueur avant de monter l’app', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reponse(200, { pseudo: 'Romain', invite: false }))
    render(
      <IozyAccountProvider>
        <Nom />
      </IozyAccountProvider>
    )
    await screen.findByText('compte:Romain')
    expect(settingsService.getSetting('username')).toBe('Romain')
  })

  it('laisse le nom libre des invités quand personne n’est connecté', async () => {
    settingsService.updateSetting('username', 'Invité')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reponse(401, {}))
    render(
      <IozyAccountProvider>
        <Nom />
      </IozyAccountProvider>
    )
    await screen.findByText('personne')
    expect(settingsService.getSetting('username')).toBe('Invité')
  })

  it('retire à la déconnexion le nom qui venait du compte', async () => {
    adoptAccountName('Romain')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reponse(401, {}))
    render(
      <IozyAccountProvider>
        <Nom />
      </IozyAccountProvider>
    )
    await screen.findByText('personne')
    expect(settingsService.getSetting('username')).toBe('')
    expect(settingsService.getSetting('usernameFromAccount')).toBe(false)
  })
})

describe('le son du compte', () => {
  afterEach(() => settingsService.saveSettings({ soundEnabled: true, soundVolume: 70 }))

  it('devient celui de l’appareil quand le compte en a un', async () => {
    settingsService.saveSettings({ soundEnabled: true, soundVolume: 70 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reponse(200, {
        pseudo: 'Romain',
        invite: false,
        preferences: { blindtestSound: { enabled: false, volume: 20 } },
      })
    )
    render(
      <IozyAccountProvider>
        <Nom />
      </IozyAccountProvider>
    )
    await screen.findByText('compte:Romain')
    expect(settingsService.getSetting('soundEnabled')).toBe(false)
    expect(settingsService.getSetting('soundVolume')).toBe(20)
  })

  it('laisse le réglage de l’appareil quand le compte n’en a jamais eu', async () => {
    settingsService.saveSettings({ soundEnabled: false, soundVolume: 45 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reponse(200, { pseudo: 'Romain', invite: false, preferences: { blindtestSound: null } })
    )
    render(
      <IozyAccountProvider>
        <Nom />
      </IozyAccountProvider>
    )
    await screen.findByText('compte:Romain')
    expect(settingsService.getSetting('soundEnabled')).toBe(false)
    expect(settingsService.getSetting('soundVolume')).toBe(45)
  })

  it('s’enregistre sur le compte avec le jeton anti-CSRF du cookie', async () => {
    document.cookie = 'XSRF-TOKEN=jeton-du-test; path=/'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reponse(200, {}))
    expect(await saveAccountSound({ enabled: true, volume: 55 })).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/me')
    expect(init?.method).toBe('PATCH')
    expect((init?.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('jeton-du-test')
    expect(JSON.parse(String(init?.body))).toEqual({ preferences: { blindtestSound: { enabled: true, volume: 55 } } })
  })

  it('rend false quand le compte ne répond pas : le réglage reste sur l’appareil', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('réseau'))
    expect(await saveAccountSound({ enabled: true, volume: 55 })).toBe(false)
  })
})

describe('adoptAccountName et loginUrl', () => {
  it('coupe un pseudo trop long à la taille d’un nom de joueur', () => {
    expect(adoptAccountName('  Un pseudo vraiment beaucoup trop long  ')).toBe('Un pseudo vraiment b')
    expect(settingsService.getSetting('username')).toBe('Un pseudo vraiment b')
  })

  it('ramène à la page de départ une fois connecté', () => {
    expect(loginUrl('/test/room/join?room=AB12')).toBe('/core/?next=%2Ftest%2Froom%2Fjoin%3Froom%3DAB12')
  })
})
