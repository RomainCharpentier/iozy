/**
 * <b>The single source of "what I follow".</b> What breaks silently:
 * a follow that no longer says whether it is in place, an "Annuler" that does
 * not redo the opposite action, a toggle that calls the wrong route.
 *
 * <p>The network is simulated, the rest is not: real `QueryClient`, real
 * message context.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useOeuvresSuivies } from './useOeuvresSuivies'
import { ToastContext, type ToastAction } from '@/common/lib/toast'

const api = vi.hoisted(() => ({ listFollowedWorks: vi.fn(), followWork: vi.fn(), unfollowWork: vi.fn() }))
vi.mock('@/common/api/followedWork', () => api)

const messages: { texte: string; action?: ToastAction }[] = []

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContext.Provider value={(texte, action) => void messages.push({ texte, action })}>{children}</ToastContext.Provider>
    </QueryClientProvider>
  )
}

async function suivies(existantes: { entityId: string; followedAt: string }[] = []) {
  api.listFollowedWorks.mockResolvedValue(existantes)
  const rendu = renderHook(() => useOeuvresSuivies(), { wrapper: enrobage })
  await waitFor(() => expect(rendu.result.current.isLoading).toBe(false))
  return rendu.result
}

beforeEach(() => {
  vi.clearAllMocks()
  messages.length = 0
  api.followWork.mockImplementation(async (entityId: string) => ({ entityId, followedAt: '2026-09-11' }))
  api.unfollowWork.mockResolvedValue(undefined)
})

describe('useOeuvresSuivies', () => {
  it('knows what is followed, and toggles in the right direction', async () => {
    const hook = await suivies([{ entityId: 'one-piece', followedAt: '2026-09-01' }])
    expect(hook.current.estSuivie('one-piece')).toBe(true)
    expect(hook.current.estSuivie('naruto')).toBe(false)

    await act(async () => hook.current.basculer('naruto'))
    expect(api.followWork).toHaveBeenCalledWith('naruto')
    expect(messages.at(-1)?.texte).toBe('Œuvre suivie : ses sorties arrivent au calendrier')

    await act(async () => hook.current.basculer('one-piece'))
    expect(api.unfollowWork).toHaveBeenCalledWith('one-piece')
    expect(messages.at(-1)?.texte).toBe('Œuvre plus suivie')
  })

  it('"Annuler" redoes exactly the opposite action, without offering to cancel again', async () => {
    const hook = await suivies()

    await act(async () => hook.current.suivre('naruto'))
    const annuler = messages.at(-1)?.action
    expect(annuler?.label).toBe('Annuler')
    await act(async () => annuler?.onAction())
    expect(api.unfollowWork).toHaveBeenCalledWith('naruto')
    // The removal that cancels a follow does not offer to cancel the cancellation.
    expect(messages.filter((m) => m.texte === 'Œuvre plus suivie')).toHaveLength(0)
  })
})
