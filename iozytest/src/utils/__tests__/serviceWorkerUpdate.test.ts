import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyPendingUpdate,
  hasPendingUpdate,
  onNewWorkerActive,
  resetUpdateStateForTests,
} from '@/utils/serviceWorker'

// Une nouvelle version du worker ne doit jamais recharger la page en pleine partie.
describe('mise à jour du service worker', () => {
  beforeEach(() => {
    sessionStorage.clear()
    resetUpdateStateForTests()
  })

  it('recharge tout de suite hors de la partie', () => {
    const reload = vi.fn()
    onNewWorkerActive('/test/categories', reload)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(hasPendingUpdate()).toBe(false)
  })

  it('attend la sortie de /game pour recharger', () => {
    const reload = vi.fn()
    onNewWorkerActive('/test/game', reload)
    expect(reload).not.toHaveBeenCalled()
    expect(hasPendingUpdate()).toBe(true)

    applyPendingUpdate('/game', reload)
    expect(reload).not.toHaveBeenCalled()

    applyPendingUpdate('/room/create', reload)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(hasPendingUpdate()).toBe(false)
  })

  it('ne recharge pas au changement de route sans mise à jour en attente', () => {
    const reload = vi.fn()
    applyPendingUpdate('/', reload)
    expect(reload).not.toHaveBeenCalled()
  })

  it('garde la limite d’un rechargement par minute', () => {
    const reload = vi.fn()
    onNewWorkerActive('/', reload)
    resetUpdateStateForTests()
    onNewWorkerActive('/', reload)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reconnaît /game à la racine comme sous un préfixe', () => {
    const reload = vi.fn()
    onNewWorkerActive('/game/', reload)
    onNewWorkerActive('/play/game', reload)
    expect(reload).not.toHaveBeenCalled()
  })
})
