/**
 * Réglages : le choix de l'avatar est enregistré et repris par la partie suivante.
 */
import { vi, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Pas d'AudioContext dans jsdom
vi.mock('@/utils/sounds', () => ({
  soundManager: {
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
    playClick: vi.fn(),
    playSuccess: vi.fn(),
  },
}))

import SettingsMenu from '@/pages/SettingsPage/SettingsMenu'
import { settingsService } from '@/services/settingsService'
import { DEFAULT_AVATAR, getLocalPlayerAvatar } from '@/utils/playerAvatar'
import { IozyAccountProvider } from '@/lib/account/IozyAccount'

function renderMenu() {
  return render(
    <MemoryRouter>
      <SettingsMenu />
    </MemoryRouter>
  )
}

describe('SettingsMenu : avatar', () => {
  afterEach(() => settingsService.resetSettings())

  it("coche l'avatar par défaut tant que rien n'est choisi", () => {
    settingsService.resetSettings()
    renderMenu()
    const group = screen.getByRole('radiogroup', { name: 'Avatar' })
    const checked = group.querySelectorAll('[aria-checked="true"]')
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toBe(DEFAULT_AVATAR)
  })

  it("enregistre l'avatar choisi et l'envoie à la partie suivante", () => {
    renderMenu()
    fireEvent.click(screen.getByRole('radio', { name: 'Renard' }))
    expect(screen.getByRole('radio', { name: 'Renard' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Manette' }).getAttribute('aria-checked')).toBe(
      'false'
    )
    expect(settingsService.getSetting('avatar')).toBe('🦊')
    expect(getLocalPlayerAvatar()).toBe('🦊')
  })
})

describe('SettingsMenu : le son partagé avec le profil Iozy', () => {
  afterEach(() => {
    settingsService.resetSettings()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function reponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
  }

  async function renderAvecCompte(ecriture: Response | Error) {
    vi.stubEnv('BASE_URL', '/test/')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'PATCH') {
        if (ecriture instanceof Error) throw ecriture
        return ecriture
      }
      return reponse(200, { pseudo: 'Romain', invite: false, preferences: { blindtestSound: null } })
    })
    render(
      <MemoryRouter>
        <IozyAccountProvider>
          <SettingsMenu />
        </IozyAccountProvider>
      </MemoryRouter>
    )
    await screen.findByText(/Réglage partagé avec/)
    return fetchMock
  }

  it('dit que le son est partagé avec le profil et l’enregistre sur le compte une fois posé', async () => {
    const fetchMock = await renderAvecCompte(reponse(200, {}))
    vi.useFakeTimers()

    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '40' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    const ecritures = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(ecritures).toHaveLength(1)
    expect(JSON.parse(String(ecritures[0][1]?.body))).toEqual({
      preferences: { blindtestSound: { enabled: true, volume: 40 } },
    })
    expect(settingsService.getSetting('soundVolume')).toBe(40)
  })

  it('garde le son sur l’appareil, et le dit, quand le compte ne répond pas', async () => {
    await renderAvecCompte(new Error('réseau'))
    vi.useFakeTimers()

    fireEvent.click(screen.getByLabelText('Activer les sons'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(screen.getByText(/le son reste réglé sur cet appareil/)).toBeTruthy()
    expect(settingsService.getSetting('soundEnabled')).toBe(false)
  })
})
