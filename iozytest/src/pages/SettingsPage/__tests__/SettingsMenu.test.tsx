/**
 * Réglages : le choix de l'avatar est enregistré et repris par la partie suivante.
 */
import { vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
