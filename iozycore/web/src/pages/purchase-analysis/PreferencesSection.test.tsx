/**
 * <b>The verdict settings screen.</b>
 *
 * The PATCH REPLACES the whole profile: a body with only the edited fields
 * would erase the factor weights and the edition ranking. The test checks that
 * the fetched object goes back whole, with only the two edited fields changed.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { CollectorPreferencesDto } from '@/common/types/purchaseAnalysis'
import { PreferencesSection } from './PreferencesSection'

const api = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}))
vi.mock('@/common/api/purchaseAnalysis', () => api)

const saved: CollectorPreferencesDto = {
  editionTierRanking: ['PERFECT', 'STANDARD'],
  avoidOutdatedEditionWhenBetterExistsOrAnnounced: true,
  conditionImportance: 'HIGH',
  minimumDiscountVsRetailPercent: 20,
  factorWeights: { CONDITION: 15, RARITY: 2 },
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('PreferencesSection', () => {
  beforeEach(() => {
    api.getPreferences.mockReset().mockResolvedValue(saved)
    api.updatePreferences.mockReset().mockImplementation((body: CollectorPreferencesDto) => Promise.resolve(body))
  })

  it('sends the whole profile back with only the two edited fields changed', async () => {
    const user = userEvent.setup()
    render(<PreferencesSection />, { wrapper })

    await user.click(screen.getByText('Ce qui compte pour toi'))
    const discount = await screen.findByLabelText('Remise minimale sur le prix neuf (%)')
    await user.clear(discount)
    await user.type(discount, '35')
    await user.click(screen.getByLabelText(/Éviter une édition dépassée/))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.updatePreferences).toHaveBeenCalledTimes(1))
    expect(api.updatePreferences.mock.calls[0][0]).toEqual({
      ...saved,
      minimumDiscountVsRetailPercent: 35,
      avoidOutdatedEditionWhenBetterExistsOrAnnounced: false,
    })
    expect(await screen.findByText('Réglages enregistrés.')).toBeTruthy()
  })

  it('refuses a discount outside 0 to 100 before any call', async () => {
    const user = userEvent.setup()
    render(<PreferencesSection />, { wrapper })

    await user.click(screen.getByText('Ce qui compte pour toi'))
    const discount = await screen.findByLabelText('Remise minimale sur le prix neuf (%)')
    await user.clear(discount)
    await user.type(discount, '150')

    expect(screen.getByText('Indique un nombre entier entre 0 et 100.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true)
    expect(api.updatePreferences).not.toHaveBeenCalled()
  })

  it('says so when the save fails, and shows no success message', async () => {
    api.updatePreferences.mockReset().mockRejectedValue(new Error('down'))
    const user = userEvent.setup()
    render(<PreferencesSection />, { wrapper })

    await user.click(screen.getByText('Ce qui compte pour toi'))
    await user.click(await screen.findByLabelText(/Éviter une édition dépassée/))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText(/L'enregistrement a échoué/)).toBeTruthy()
    expect(screen.queryByText('Réglages enregistrés.')).toBeNull()
  })

  it('says the defaults are used when the settings cannot be read', async () => {
    api.getPreferences.mockReset().mockRejectedValue(new Error('down'))
    render(<PreferencesSection />, { wrapper })

    expect(await screen.findByText(/l'analyse utilise les réglages par défaut/)).toBeTruthy()
  })
})
