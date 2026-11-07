/**
 * The client must reuse a fresh answer when a screen mounts again (no new
 * download of the whole collection), but a write must still refresh it at once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryObserver, type QueryClient } from '@tanstack/react-query'
import { createQueryClient, DEFAULT_STALE_TIME_MS } from './queryClient'

let client: QueryClient | undefined

afterEach(() => {
  client?.clear()
  client = undefined
})

/** Mounts a screen that reads `['collection']`, waits for its data, then unmounts it. */
async function mountScreen(queryClient: QueryClient, queryFn: () => Promise<string>) {
  const observer = new QueryObserver(queryClient, { queryKey: ['collection'], queryFn })
  const unsubscribe = observer.subscribe(() => {})
  await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'))
  return { observer, unsubscribe }
}

describe('the query client', () => {
  it('keeps an answer fresh for 30 seconds', () => {
    client = createQueryClient()
    expect(DEFAULT_STALE_TIME_MS).toBe(30_000)
    expect(client.getDefaultOptions().queries?.staleTime).toBe(DEFAULT_STALE_TIME_MS)
    expect(client.getDefaultOptions().queries?.networkMode).toBe('always')
  })

  it('does not download again when a screen mounts again', async () => {
    client = createQueryClient()
    const queryFn = vi.fn().mockResolvedValue('three works')

    const first = await mountScreen(client, queryFn)
    first.unsubscribe()
    const second = await mountScreen(client, queryFn)
    second.unsubscribe()

    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('downloads again at once after a write invalidates the key', async () => {
    client = createQueryClient()
    const queryFn = vi.fn().mockResolvedValueOnce('three works').mockResolvedValueOnce('four works')

    const screen = await mountScreen(client, queryFn)
    await client.invalidateQueries({ queryKey: ['collection'] })

    expect(queryFn).toHaveBeenCalledTimes(2)
    expect(screen.observer.getCurrentResult().data).toBe('four works')
    screen.unsubscribe()
  })
})
