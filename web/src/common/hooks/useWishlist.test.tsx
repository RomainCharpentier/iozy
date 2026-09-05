/**
 * <b>La source unique des « Envies », et ce qu'elle promet à chaque bouton.</b>
 *
 * Six surfaces passent par ce hook. Trois promesses y tiennent l'usage entier,
 * et chacune a déjà été cassée une fois :
 * <ul>
 *   <li><b>Deux index, jamais confondus</b> : une série n'est pas « voulue »
 *       parce qu'un de ses tomes l'est - elle n'est qu'un groupe ;</li>
 *   <li><b>« Annuler » est réel</b> : annuler un retrait remet EXACTEMENT le
 *       même objet, le tome et pas sa série ;</li>
 *   <li><b>un refus n'interrompt pas un ajout groupé</b> : un tome déjà possédé
 *       est refusé en 409, et c'est un cas normal dans une annonce qui recoupe
 *       la collection - s'arrêter là abandonnerait tous les suivants en
 *       silence.</li>
 * </ul>
 *
 * <p>Le réseau est simulé, le reste ne l'est pas : vrai `QueryClient`, vrai
 * contexte de messages. Ce qui est vérifié, ce sont les appels réellement
 * partis et le message réellement affiché.
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

/** Les messages affichés, avec leur action « Annuler » quand elle existe. */
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

/** Le hook, une fois sa liste d'envies chargée. */
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

describe('les deux index', () => {
  it('ne dit pas une série voulue parce qu’un de ses tomes l’est', async () => {
    const hook = await envies([entree('e1', 'berserk', 'tome-7')])

    expect(hook.current.isInWishlist('berserk')).toBe(false)
    expect(hook.current.entryForVariant('tome-7')?.id).toBe('e1')
    expect([...hook.current.variantsVoulus]).toEqual(['tome-7'])
  })

  it('reconnaît l’envie portée sur l’œuvre entière, pour un type sans tome', async () => {
    const hook = await envies([entree('e2', 'hades')])

    expect(hook.current.isInWishlist('hades')).toBe(true)
    expect(hook.current.entryFor('hades')?.id).toBe('e2')
    expect(hook.current.variantsVoulus.size).toBe(0)
  })

  it('compte toutes les envies pour le badge, quelle que soit leur nature', async () => {
    const hook = await envies([entree('e1', 'berserk', 'tome-7'), entree('e2', 'hades')])

    expect(hook.current.count).toBe(2)
  })
})

describe('ajouter', () => {
  it('propose une annulation qui supprime vraiment l’entrée créée', async () => {
    const hook = await envies()
    api.addToWishlist.mockResolvedValue(entree('nouvelle', 'berserk', 'tome-7'))

    await act(async () => hook.current.add({ entityId: 'berserk', volumeNumber: 7 }))
    await waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0].texte).toBe('Tome ajouté aux envies')

    await act(async () => messages[0].action?.onAction())

    await waitFor(() => expect(api.removeFromWishlist).toHaveBeenCalledWith('nouvelle'))
  })

  it('n’enchaîne pas un second message sur l’annulation d’un ajout', async () => {
    // Reproposer « Annuler » ferait boucler l'utilisateur entre deux messages.
    const hook = await envies()
    api.addToWishlist.mockResolvedValue(entree('nouvelle', 'berserk', 'tome-7'))

    await act(async () => hook.current.add({ entityId: 'berserk', volumeNumber: 7 }))
    await waitFor(() => expect(messages).toHaveLength(1))
    await act(async () => messages[0].action?.onAction())
    await waitFor(() => expect(api.removeFromWishlist).toHaveBeenCalled())

    expect(messages).toHaveLength(1)
  })
})

describe('retirer', () => {
  it('remet exactement le même objet - le tome, pas sa série', async () => {
    // Réajouter par `entityId` seul remettait en envies la série entière :
    // annuler le retrait du tome 7 en voulait soudain soixante-douze.
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

describe('ajouter tout un lot', () => {
  const lot = [
    { entityId: 'berserk', volumeNumber: 1 },
    { entityId: 'berserk', volumeNumber: 2 },
    { entityId: 'berserk', volumeNumber: 3 },
  ]

  it('poursuit après un refus, et ne compte que ce qui a été ajouté', async () => {
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

  it('le dit franchement quand il n’y avait rien à ajouter', async () => {
    const hook = await envies()
    api.addToWishlist.mockRejectedValue(new Error('409'))

    await act(async () => hook.current.addMany(lot))

    await waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0].texte).toBe('Rien à ajouter - tu as déjà tout ça, ou tu le voulais déjà')
    expect(messages[0].action).toBeUndefined()
  })

  it('annule le lot entier, entrée par entrée', async () => {
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

  it('ne parle pas au pluriel pour un seul tome', async () => {
    const hook = await envies()
    api.addToWishlist.mockResolvedValue(entree('n1', 'berserk', 'tome-1'))

    await act(async () => hook.current.addMany([lot[0]]))

    await waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0].texte).toBe('Tome ajouté aux envies')
  })
})
