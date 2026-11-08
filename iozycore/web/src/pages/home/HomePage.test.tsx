/**
 * <b>The home page "ta semaine" (lot 212), as it reads.</b>
 *
 * The server composes the week; the page writes it. What breaks in silence
 * here: a block that disappears when it is empty (a new account would face a
 * blank page), a shelf of a custom type left nameless, a missing element that
 * promises "je l'ai" while no generic add exists, a link to the collection
 * that leads back home.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HomeWeekDto } from '@/common/types/home'
import { typeDeCollection } from '@/test/fixtures'
import { HomePage } from './HomePage'

const apiHome = vi.hoisted(() => ({ fetchHomeWeek: vi.fn() }))
vi.mock('@/common/api/home', () => apiHome)
const apiTypes = vi.hoisted(() => ({ listEntityTypes: vi.fn() }))
vi.mock('@/common/api/entityTypes', () => apiTypes)

const FIGURINES = { ...typeDeCollection('FIGURINES', 'Figurines'), aspectKey: 'carre' }

const VIDE: HomeWeekDto = {
  weekStart: '2026-11-09',
  weekEnd: '2026-11-15',
  une: null,
  aussi: [],
  chiffre: null,
  presqueFini: [],
  rayons: [],
}

function oeuvre(id: string, title: string, champs: Record<string, unknown> = {}) {
  return {
    entityId: id,
    entityTypeId: 'type-manga',
    title,
    coverImageUrl: `https://covers.example/${id}.jpg`,
    collectorStatus: 'ONGOING' as const,
    ownedCount: 8,
    totalCount: 15,
    missingCount: 6,
    wishedCount: 0,
    lastMovedAt: '2026-11-08T06:00:00Z',
    ...champs,
  }
}

const SEMAINE: HomeWeekDto = {
  ...VIDE,
  une: {
    work: oeuvre('vinland', 'Vinland Saga'),
    reason: 'RELEASE',
    release: { date: '2026-11-13', precision: 'DAY', label: 'Tome 15', number: 15 },
    nextRelease: { date: '2026-11-13', precision: 'DAY', label: 'Tome 15', number: 15 },
    elements: [
      ...Array.from({ length: 8 }, (_, i) => ({
        key: `volume-${i + 1}`, label: `Tome ${i + 1}`, number: i + 1, state: 'OWNED' as const, countedAsMissing: false, variantId: null,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        key: `volume-${i + 9}`, label: `Tome ${i + 9}`, number: i + 9, state: 'MISSING' as const, countedAsMissing: true, variantId: null,
      })),
      { key: 'volume-15', label: 'Tome 15', number: 15, state: 'UPCOMING', countedAsMissing: false, variantId: null },
    ],
  },
  aussi: [
    {
      work: oeuvre('totoro', 'Totoro', { entityTypeId: FIGURINES.id, ownedCount: 0, wishedCount: 1, totalCount: 1, missingCount: 1, lastMovedAt: '2026-11-10T09:00:00Z' }),
      reason: 'MOVED',
      release: null,
    },
  ],
  chiffre: { totalObjects: 45, addedThisMonth: 3, releasesThisWeek: 1 },
  presqueFini: [
    {
      work: oeuvre('catan', 'Catan', { totalCount: 4, ownedCount: 2, missingCount: 2 }),
      missing: [
        { key: 'variant-m', label: 'Marins', number: null, state: 'MISSING', countedAsMissing: true, variantId: 'v-m' },
        { key: 'variant-v', label: 'Villes et Chevaliers', number: null, state: 'WANTED', countedAsMissing: true, variantId: 'v-v' },
      ],
    },
  ],
  rayons: [
    { entityTypeId: FIGURINES.id, workCount: 1, objectCount: 2, covers: [{ entityId: 'statue', title: 'Statue', coverImageUrl: 'https://covers.example/statue.jpg' }] },
    { entityTypeId: 'type-inconnu', workCount: 3, objectCount: 3, covers: [] },
  ],
}

function afficher() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  // Wednesday 11 November 2026: Friday 13 is "vendredi".
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 10, 0))
  apiTypes.listEntityTypes.mockResolvedValue([FIGURINES])
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('the home page of a new account', () => {
  it('keeps every block, each saying why it is empty and where to start', async () => {
    apiHome.fetchHomeWeek.mockResolvedValue(VIDE)
    afficher()

    expect(screen.getByRole('heading', { level: 1, name: 'Ta semaine' })).toBeInTheDocument()
    expect(await screen.findByText('Ta semaine commence ici.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ajouter une œuvre' })).toHaveAttribute('href', '/add')
    expect(screen.getByText("Rien d'autre cette semaine.")).toBeInTheDocument()
    expect(screen.getByText("Aucun objet pour l'instant.")).toBeInTheDocument()
    expect(screen.getByText("Rien de presque fini pour l'instant.")).toBeInTheDocument()
    expect(screen.getByText('Tes rayons sont vides.')).toBeInTheDocument()
  })
})

describe('a week with something in it', () => {
  it('leads with the release of the week, and says where the collector stands', async () => {
    apiHome.fetchHomeWeek.mockResolvedValue(SEMAINE)
    afficher()

    const une = await screen.findByRole('article', { name: 'Vinland Saga, Tome 15 : sortie vendredi.' })
    expect(within(une).getByText('À la une · vendredi 13 novembre')).toBeInTheDocument()
    expect(within(une).getByText("Tu en as 8 sur 15. Il t'en manque 6.")).toBeInTheDocument()
    expect(within(une).getByRole('img', { name: '8 possédés, 6 manquants, 1 à venir' })).toBeInTheDocument()
    expect(within(une).getByRole('link', { name: 'Ouvrir la fiche' })).toHaveAttribute('href', '/entity/vinland')
  })

  it('writes the other moves, the number and what is almost done, in that order', async () => {
    apiHome.fetchHomeWeek.mockResolvedValue(SEMAINE)
    afficher()

    const aussi = await screen.findByRole('region', { name: 'Aussi cette semaine' })
    expect(within(aussi).getByRole('link', { name: /Totoro/ })).toHaveAttribute('href', '/entity/totoro')
    expect(within(aussi).getByText('Ajouté à tes envies hier.')).toBeInTheDocument()

    const chiffre = screen.getByRole('region', { name: 'Le chiffre' })
    expect(within(chiffre).getByText('45')).toBeInTheDocument()
    expect(within(chiffre).getByText('+3 depuis le 1er novembre.')).toBeInTheDocument()
    expect(within(chiffre).getByText('1 sortie cette semaine.')).toBeInTheDocument()

    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titres).toEqual([
      'Vinland Saga, Tome 15 : sortie vendredi.',
      'Aussi cette semaine',
      'Le chiffre',
      'Presque fini',
      'Dans tes rayons',
    ])
  })

  it('lets a missing element lead to its entity page, without promising "je l\'ai"', async () => {
    apiHome.fetchHomeWeek.mockResolvedValue(SEMAINE)
    afficher()

    const presque = await screen.findByRole('region', { name: 'Presque fini' })
    expect(within(presque).getByText('Catan : plus que deux à trouver.')).toBeInTheDocument()
    expect(within(presque).getByRole('link', { name: "Marins : l'ajouter depuis la fiche" })).toHaveAttribute(
      'href',
      '/entity/catan',
    )
    expect(within(presque).getByRole('link', { name: "Villes et Chevaliers : l'ajouter depuis la fiche" })).toBeInTheDocument()
    expect(within(presque).queryByText(/je l'ai/)).not.toBeInTheDocument()
  })

  it('gives each category a shelf, custom ones included, and leads to the whole collection', async () => {
    apiHome.fetchHomeWeek.mockResolvedValue(SEMAINE)
    afficher()

    const rayons = await screen.findByRole('region', { name: 'Dans tes rayons' })
    expect(await within(rayons).findByRole('link', { name: /Figurines/ })).toHaveAttribute('href', '/collection/type-figurines')
    expect(within(rayons).getByText('1 œuvre · 2 objets')).toBeInTheDocument()
    // A type the list does not know yet keeps its shelf, with a neutral name.
    expect(within(rayons).getByRole('link', { name: /Catégorie/ })).toHaveAttribute('href', '/collection/type-inconnu')
    expect(within(rayons).getByRole('link', { name: 'Toute ma collection' })).toHaveAttribute('href', '/collection')
  })
})

describe('when the week cannot be read', () => {
  it('says so and offers to try again', async () => {
    apiHome.fetchHomeWeek.mockRejectedValue(new Error('Serveur injoignable'))
    afficher()

    expect(await screen.findByText("Ta semaine n'a pas pu être chargée : Serveur injoignable")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})
