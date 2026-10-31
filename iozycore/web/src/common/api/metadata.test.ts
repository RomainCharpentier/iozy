/**
 * <b>"No French title" is an answer, not a failure.</b>
 *
 * The catalogue asks for the French title of every suggestion of a search.
 * The server answers 204 when it knows none (a 404 before batch 193); an
 * older server still answers 404. Both must read as "keep the title already
 * displayed", never as an error that would hide the suggestion - and never
 * as a crash on an empty body.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFrenchTitle } from './metadata'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function reponse(status: number, body?: unknown): Response {
  return {
    ok: status < 400,
    status,
    statusText: '',
    json: async () => {
      if (body === undefined) throw new Error('empty body')
      return body
    },
    headers: new Headers(),
  } as unknown as Response
}

describe('fetchFrenchTitle', () => {
  it('returns the title the server knows', async () => {
    fetchMock.mockResolvedValue(reponse(200, { frenchTitle: 'Les Chevaliers du Zodiaque' }))
    await expect(fetchFrenchTitle('type', 'Saint Seiya')).resolves.toBe('Les Chevaliers du Zodiaque')
  })

  it('returns null on a 204, without reading a body that does not exist', async () => {
    fetchMock.mockResolvedValue(reponse(204))
    await expect(fetchFrenchTitle('type', 'Inconnu')).resolves.toBeNull()
  })

  it('still returns null on the 404 of an older server', async () => {
    fetchMock.mockResolvedValue(reponse(404, { message: 'Aucun titre français trouvé' }))
    await expect(fetchFrenchTitle('type', 'Inconnu')).resolves.toBeNull()
  })
})
