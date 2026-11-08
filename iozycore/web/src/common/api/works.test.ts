/**
 * <b>The works read model is reached at the routes the server serves.</b>
 *
 * A function pointed at the wrong route breaks no type: the screen would just
 * stay empty. These tests pin each route, its method and the body of the status.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCollectionSummary, fetchWork, listWorks, setCollectorStatus } from './works'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: '',
    json: async () => ({}),
    headers: new Headers(),
  } as unknown as Response)
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function lastCall(): { url: string; method: string; body: unknown } {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit | undefined]
  return {
    url,
    method: (init?.method ?? 'GET').toUpperCase(),
    body: init?.body ? JSON.parse(init.body as string) : undefined,
  }
}

describe('works api', () => {
  it('reads one work, the list and the summary with GET', async () => {
    await fetchWork('abc')
    expect(lastCall()).toMatchObject({ url: '/api/works/abc', method: 'GET' })
    await listWorks()
    expect(lastCall()).toMatchObject({ url: '/api/works', method: 'GET' })
    await fetchCollectionSummary()
    expect(lastCall()).toMatchObject({ url: '/api/works/summary', method: 'GET' })
  })

  it('sets the collector status with PUT and the status in the body', async () => {
    await setCollectorStatus('abc', 'PAUSED')
    expect(lastCall()).toEqual({
      url: '/api/works/abc/collector-status',
      method: 'PUT',
      body: { status: 'PAUSED' },
    })
  })
})
