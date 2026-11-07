/**
 * Tests du client HTTP : un refus d'écriture (401) donne un message lisible
 */
import { vi, afterEach } from 'vitest'
import { apiRequest, ApiError, UNAUTHORIZED_MESSAGE } from '@/api/client'

const response = (status: number, body: unknown) =>
  new Response(body === undefined ? '' : JSON.stringify(body), { status })

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('garde le message du serveur sur un 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(401, { error: 'Refusé par le serveur' }))
    await expect(apiRequest('/api/questions', { method: 'PUT' })).rejects.toMatchObject({
      status: 401,
      message: 'Refusé par le serveur',
    })
  })

  it('donne un message en français sur un 401 sans corps', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(401, undefined))
    const error = await apiRequest('/api/questions', { method: 'PUT' }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe(UNAUTHORIZED_MESSAGE)
  })
})
