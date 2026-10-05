/**
 * <b>The single source of the "Envies", and what it promises to each button.</b>
 *
 * Six surfaces go through this hook. Three promises hold its whole use
 * together, and each one has already been broken once:
 * <ul>
 *   <li><b>Two indexes, never confused</b>: a series is not "wanted"
 *       because one of its volumes is - it is only a group;</li>
 *   <li><b>"Annuler" is real</b>: canceling a removal puts back EXACTLY the
 *       same object, the volume and not its series;</li>
 *   <li><b>a refusal does not interrupt a grouped add</b>: a volume that is
 *       already owned is refused with a 409, and it is a normal case in a
 *       listing that overlaps with the collection - stopping there would
 *       abandon all the following ones silently.</li>
 * </ul>
 *
 * <p>The network is simulated, the rest is not: real `QueryClient`, real
 * message context. What is checked are the calls that really went out and the
 * message that was really displayed.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useWishlist } from './useWishlist'
import { ToastContext, type ToastAction } from '@/common/lib/toast'
import type { WishlistEntryResponse } from '@/common/types/api'

const api = vi.hoisted(() => ({
  listWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}))

vi.mock('@/common/api/wishlist', () => api)

function entree(id: string, entityId: string, variantId: string | null = null): WishlistEntryResponse {
  return { id, entityId, variantId, addedAt: '2026-08-01' }
}

/** The displayed messages, with their "Annuler" action when it exists. */
const messages: { texte: string; action?: ToastAction }[] = []

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContext.Provider value={(texte, action) => void messages.push({ texte, action })}>
        {children}
      </ToastContext.Provider>
    </QueryClientProvider>
  )
}

/** The hook, once its wish list is loaded. */
async function envies(existantes: WishlistEntryResponse[] = []) {
  api.listWishlist.mockResolvedValue(existantes)
  const rendu = renderHook(() => useWishlist(), { wrapper: enrobage })
  await waitFor(() => expect(rendu.result.current.isLoading).toBe(false))
  return rendu.result
}

beforeEach(() => {
  vi.clearAllMocks()
  messages.length = 0
  api.removeFromWishlist.mockResolvedValue(undefined)
})

describe('the two indexes', () => {
  it('does not call a series wanted because one of its volumes is', async () => {
    const hook = await envies([entree('e1', 'berserk', 'tome-7')])

    expect(hook.current.isInWishlist('berserk')).toBe(false)
    expect(hook.current.entryForVariant('tome-7')?.id).toBe('e1')
    expect([...hook.current.variantsVoulus]).toEqual(['tome-7'])
  })

  it('recognizes the wish applied to the whole work, for a type without volumes', async () => {
    const hook = await envies([entree('e2', 'hades')])

    expect(hook.current.isInWishlist('hades')).toBe(true)
    expect(hook.current.entryFor('hades')?.id).toBe('e2')
    expect(hook.current.variantsVoulus.size).toBe(0)
  })

  it('counts all the wishes for the badge, whatever their kind', async () => {
    const hook = await envies([entree('e1', 'berserk', 'tome-7'), entree('e2', 'hades')])

    expect(hook.current.count).toBe(2)
  })
})

describe('adding', () => {
  it('offers a cancel that really deletes the created entry', async () => {
    const hook = await envies()
    api.addToWishlist.mockResolvedValue(entree('nouvelle', 'berserk', 'tome-7'))

    await act(async () => hook.current.add({ entityId: 'berserk', volumeNumber: 7 }))
    await waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0].texte).toBe('Tome ajouté aux envies')

    await act(async () => messages[0].action?.onAction())

    await waitFor(() => expect(api.removeFromWishlist).toHaveBeenCalledWith('nouvelle'))
  })

  it('does not chain a second message on the cancel of an add', async () => {
    // Offering "Annuler" again would make the user loop between two messages.
    const hook = await envies()
    api.addToWishlist.mockResolvedValue(entree('nouvelle', 'berserk', 'tome-7'))

    await act(async () => hook.current.add({ entityId: 'berserk', volumeNumber: 7 }))
    await waitFor(() => expect(messages).toHaveLength(1))
    await act(async () => messages[0].action?.onAction())
    await waitFor(() => expect(api.removeFromWishlist).toHaveBeenCalled())

    expect(messages).toHaveLength(1)
  })
})

describe('removing', () => {
  it('puts back exactly the same object - the volume, not its series', async () => {
    // Adding back by `entityId` alone put the entire series back in the
    // wishes: canceling the removal of volume 7 suddenly wanted seventy-two.
    const hook = await envies([entree('e1', 'berserk', 'tome-7')])
    const cible = { entityId: 'berserk', variantId: 'tome-7' }

    await act(async () => hook.current.remove('e1', cible))
    await waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0].texte).toBe('Retiré des envies')

    api.addToWishlist.mockResolvedValue(entree('e1-bis', 'berserk', 'tome-7'))
    await act(async () => messages[0].action?.onAction())

    await waitFor(() => expect(api.addToWishlist).toHaveBeenCalledWith(cible))
  })
})

describe('adding a whole batch', () => {
  const lot = [
    { entityId: 'berserk', volumeNumber: 1 },
    { entityId: 'berserk', volumeNumber: 2 },
    { entityId: 'berserk', volumeNumber: 3 },
  ]

  it('continues after a refusal, and only counts what was added', async () => {
    const hook = await envies()
    api.addToWishlist
      .mockResolvedValueOnce(entree('n1', 'berserk', 'tome-1'))
      .mockRejectedValueOnce(new Error('409 déjà possédé'))
      .mockResolvedValueOnce(entree('n3', 'berserk', 'tome-3'))

    await act(async () => hook.current.addMany(lot))

    await waitFor(() => expect(messages).toHaveLength(1))
    expect(api.addToWishlist).toHaveBeenCalledTimes(3)
    expect(messages[0].texte).toBe('2 tomes ajoutés aux envies')
  })

  it('says so frankly when there was nothing to add', async () => {
    const hook = await envies()
    api.addToWishlist.mockRejectedValue(new Error('409'))

    await act(async () => hook.current.addMany(lot))

    await waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0].texte).toBe('Rien à ajouter - tu as déjà tout ça, ou tu le voulais déjà')
    expect(messages[0].action).toBeUndefined()
  })

  it('cancels the whole batch, entry by entry', async () => {
    const hook = await envies()
    api.addToWishlist
      .mockResolvedValueOnce(entree('n1', 'berserk', 'tome-1'))
      .mockResolvedValueOnce(entree('n2', 'berserk', 'tome-2'))
      .mockResolvedValueOnce(entree('n3', 'berserk', 'tome-3'))

    await act(async () => hook.current.addMany(lot))
    await waitFor(() => expect(messages).toHaveLength(1))
    await act(async () => await messages[0].action?.onAction())

    expect(api.removeFromWishlist.mock.calls.map(([id]) => id)).toEqual(['n1', 'n2', 'n3'])
  })

  it('does not use the plural for a single volume', async () => {
    const hook = await envies()
    api.addToWishlist.mockResolvedValue(entree('n1', 'berserk', 'tome-1'))

    await act(async () => hook.current.addMany([lot[0]]))

    await waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0].texte).toBe('Tome ajouté aux envies')
  })
})
