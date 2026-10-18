import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { settingsService } from '@/services/settingsService'
import { IozyAccountProvider, adoptAccountName, fetchIozyAccount, loginUrl, useIozyAccount } from '@/lib/account/IozyAccount'

function reponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function Nom() {
  const account = useIozyAccount()
  return <p>{account ? `compte:${account.pseudo}` : 'personne'}</p>
}

beforeEach(() => {
  vi.stubEnv('BASE_URL', '/play/')
  settingsService.updateSetting('username', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('fetchIozyAccount', () => {
  it("rend le compte connecté d'IozyCore", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reponse(200, { pseudo: 'Romain', invite: false }))
    expect(await fetchIozyAccount()).toEqual({ pseudo: 'Romain' })
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
})

describe('adoptAccountName et loginUrl', () => {
  it('coupe un pseudo trop long à la taille d’un nom de joueur', () => {
    expect(adoptAccountName('  Un pseudo vraiment beaucoup trop long  ')).toBe('Un pseudo vraiment b')
    expect(settingsService.getSetting('username')).toBe('Un pseudo vraiment b')
  })

  it('ramène à la page de départ une fois connecté', () => {
    expect(loginUrl('/play/room/join?room=AB12')).toBe('/core/?next=%2Fplay%2Froom%2Fjoin%3Froom%3DAB12')
  })
})
