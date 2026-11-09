/**
 * <b>The bridge between the device and the account (lot 218).</b>
 *
 * <p>Two silent defects: the account's choice never reaches a new browser
 * (the theme of the phone stays the default), or a choice made here never
 * reaches the account. And two quieter ones: a choice the account never made
 * (null) must not wipe the device's own setting, and a visit, which has no
 * account, must not even try to save.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Compte } from '@/common/api/auth'
import { usePreferencesCompte } from './usePreferencesCompte'
import { applyStoredTheme, setTheme } from '@/common/lib/theme'
import { relireAccent, setAccent } from '@/common/lib/accent'
import { getTitleComposition } from '@/common/lib/titleLanguage'
import { declarerEnregistrement, useEtatEnregistrement } from '@/common/lib/preferencesCompte'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)
const api = vi.hoisted(() => ({ modifierCompte: vi.fn() }))
vi.mock('@/common/api/auth', () => api)

const COMPTE: Compte = {
  id: 'u1',
  email: 'moi@example.com',
  pseudo: 'moi',
  admin: false,
  invite: false,
  preferences: {
    accent: 'TERRACOTTA',
    appearance: 'LIGHT',
    titleComposition: [
      { language: 'ROMAJI', enabled: true },
      { language: 'FRENCH', enabled: false },
      { language: 'ENGLISH', enabled: true },
    ],
    blindtestSound: null,
  },
}

function monter(compte: Compte | null, estInvite = false) {
  auth.useAuth.mockReturnValue({ compte, estInvite })
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(
    () => {
      usePreferencesCompte()
      return useEtatEnregistrement()
    },
    { wrapper },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  applyStoredTheme()
  relireAccent()
  declarerEnregistrement('repos')
  api.modifierCompte.mockResolvedValue(COMPTE)
})

describe('the account’s choices', () => {
  it('are written on this device without being sent back', () => {
    monter(COMPTE)

    expect(localStorage.getItem('iozycore.theme')).toBe('light')
    expect(localStorage.getItem('iozycore.accent')).toBe('TERRACOTTA')
    expect(getTitleComposition()[0]).toEqual({ language: 'ROMAJI', enabled: true })
    expect(api.modifierCompte).not.toHaveBeenCalled()
  })

  it('leave the device’s own setting when the account never chose', () => {
    localStorage.setItem('iozycore.theme', 'light')
    applyStoredTheme()

    monter({ ...COMPTE, preferences: { accent: null, appearance: null, titleComposition: null, blindtestSound: null } })

    expect(localStorage.getItem('iozycore.theme')).toBe('light')
    expect(localStorage.getItem('iozycore.accent')).toBeNull()
  })
})

describe('a choice made here', () => {
  it('is saved on the account', async () => {
    const { result } = monter({ ...COMPTE, preferences: null })

    act(() => setTheme('light'))

    await waitFor(() => expect(result.current).toBe('compte'))
    expect(api.modifierCompte).toHaveBeenCalledWith({ preferences: { appearance: 'LIGHT' } })
  })

  it('stays on the device, and says so, when the account does not answer', async () => {
    api.modifierCompte.mockRejectedValue(new Error('502'))
    const { result } = monter({ ...COMPTE, preferences: null })

    act(() => setAccent('TERRACOTTA'))

    await waitFor(() => expect(result.current).toBe('appareil'))
    expect(localStorage.getItem('iozycore.accent')).toBe('TERRACOTTA')
  })

  it('is not sent for a visit, which has no account', () => {
    const { result } = monter({ ...COMPTE, id: null, invite: true, preferences: null }, true)

    act(() => setTheme('light'))

    expect(api.modifierCompte).not.toHaveBeenCalled()
    expect(result.current).toBe('appareil')
  })
})
