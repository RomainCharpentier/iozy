/**
 * <b>Ma collection says why a part of it is missing.</b> Only the works and
 * the ownerships were reported: a failed type list gave a header with N titles,
 * no shelf, no empty state and no error. Every query the screen reads must
 * reach `erreurs`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useDonneesCollection } from './useDonneesCollection'
import { ToastContext } from '@/common/lib/toast'

const api = vi.hoisted(() => ({
  searchEntities: vi.fn(),
  listAllOwnerships: vi.fn(),
  listEntityTypes: vi.fn(),
  getCollectionProgress: vi.fn(),
  listWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
  listFollowedWorks: vi.fn(),
  followWork: vi.fn(),
  unfollowWork: vi.fn(),
}))

vi.mock('@/common/api/entities', () => ({ searchEntities: api.searchEntities }))
vi.mock('@/common/api/ownerships', () => ({ listAllOwnerships: api.listAllOwnerships }))
vi.mock('@/common/api/entityTypes', () => ({ listEntityTypes: api.listEntityTypes }))
vi.mock('@/common/api/insights', () => ({ getCollectionProgress: api.getCollectionProgress }))
vi.mock('@/common/api/wishlist', () => ({
  listWishlist: api.listWishlist,
  addToWishlist: api.addToWishlist,
  removeFromWishlist: api.removeFromWishlist,
}))
vi.mock('@/common/api/followedWork', () => ({
  listFollowedWorks: api.listFollowedWorks,
  followWork: api.followWork,
  unfollowWork: api.unfollowWork,
}))

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContext.Provider value={() => {}}>{children}</ToastContext.Provider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.searchEntities.mockResolvedValue([])
  api.listAllOwnerships.mockResolvedValue([])
  api.listEntityTypes.mockResolvedValue([])
  api.getCollectionProgress.mockResolvedValue([])
  api.listWishlist.mockResolvedValue([])
  api.listFollowedWorks.mockResolvedValue([])
})

async function erreurs() {
  const rendu = renderHook(() => useDonneesCollection(), { wrapper: enrobage })
  await waitFor(() => expect(rendu.result.current.chargement).toBe(false))
  // The followed works and the types are not part of `chargement`: wait for them too.
  await waitFor(() => expect(api.listFollowedWorks).toHaveBeenCalled())
  return rendu.result
}

describe('useDonneesCollection errors', () => {
  it('reports nothing when every query answered', async () => {
    const hook = await erreurs()
    expect(hook.current.erreurs).toEqual([])
  })

  it.each([
    ['the collection types', api.listEntityTypes],
    ['the progress', api.getCollectionProgress],
    ['the wishes', api.listWishlist],
    ['the followed works', api.listFollowedWorks],
  ])('reports a failure of %s', async (_nom, appel) => {
    appel.mockRejectedValue(new Error('Erreur du serveur.'))
    const hook = await erreurs()
    await waitFor(() => expect(hook.current.erreurs).toEqual(['Erreur du serveur.']))
  })

  it('shows the same message once when several queries fail the same way', async () => {
    api.listEntityTypes.mockRejectedValue(new Error('Erreur du serveur.'))
    api.listAllOwnerships.mockRejectedValue(new Error('Erreur du serveur.'))
    const hook = await erreurs()
    await waitFor(() => expect(hook.current.erreurs).toEqual(['Erreur du serveur.']))
  })
})
