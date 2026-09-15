import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ImportPhotoPage } from './ImportPhotoPage'
import type { RecognizedItemDto } from '@/common/types/listingRecognition'
import type { FicheProposeeDto, ShelfAnalysisDto } from '@/common/types/shelfImport'

const api = vi.hoisted(() => ({ analyserLEtagere: vi.fn(), importerDepuisLEtagere: vi.fn() }))
vi.mock('@/common/api/shelfImport', () => api)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function lu(titre: string, tome: number | null, extra: Partial<RecognizedItemDto> = {}): RecognizedItemDto {
  return {
    seriesTitle: titre,
    seriesTitleAsRead: titre.toUpperCase(),
    volumeNumber: tome,
    editionHint: null,
    hasExactIdentifier: false,
    confidence: 'HIGH',
    sources: ['VISION'],
    sourceLabels: ['photos'],
    evidence: [],
    sourceImages: [0],
    catalogStatus: 'MATCHED',
    entityId: 'naruto-id',
    editionOptions: [],
    preselected: true,
    readyForAnalysis: tome !== null,
    ...extra,
  }
}

const FICHE_BLEACH: FicheProposeeDto = {
  source: 'ANILIST',
  externalId: '42',
  title: 'Bleach',
  imageUrl: 'https://img.invalid/bleach.jpg',
  attributes: { mangaka: 'Tite Kubo' },
}

const LECTURE: ShelfAnalysisDto = {
  visionStatus: 'OK',
  unidentifiedCount: 1,
  notInCatalogCount: 2,
  analyzedImageCount: 1,
  requestedImageCount: 1,
  lookupsSkipped: 0,
  items: [
    { item: lu('Naruto', 4, { editionHint: 'Kana' }), alreadyOwned: true, proposal: null },
    { item: lu('Naruto', 5, { editionHint: 'Kana' }), alreadyOwned: false, proposal: null },
    {
      // Le serveur ne pré-coche jamais une série hors catalogue (règle du lot
      // d'annonce) : sur une étagère, c'est l'écran qui coche la lecture sûre.
      item: lu('Bleach', 1, { catalogStatus: 'NOT_IN_CATALOG', entityId: null, preselected: false }),
      alreadyOwned: false,
      proposal: FICHE_BLEACH,
    },
    {
      item: lu('Bleach', null, { catalogStatus: 'NOT_IN_CATALOG', entityId: null, preselected: false }),
      alreadyOwned: false,
      proposal: FICHE_BLEACH,
    },
  ],
}

async function envoyerUnePhoto() {
  const user = userEvent.setup()
  render(<ImportPhotoPage />, { wrapper: enrobage })
  const photo = new File([new Uint8Array(64)], 'etagere.jpg', { type: 'image/jpeg' })
  await user.upload(screen.getByLabelText('Choisir des photos de l’étagère'), photo)
  // userEvent recopie les fichiers : on compare le nom, pas l'instance.
  await waitFor(() => expect(api.analyserLEtagere).toHaveBeenCalledTimes(1))
  const envoyees = api.analyserLEtagere.mock.calls[0][0] as File[]
  expect(envoyees.map((f) => f.name)).toEqual([photo.name])
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  api.analyserLEtagere.mockResolvedValue(LECTURE)
  api.importerDepuisLEtagere.mockResolvedValue({
    added: 3,
    alreadyOwned: 0,
    seriesCreated: 1,
    items: [
      { seriesTitle: 'Naruto', volumeNumber: 5, edition: 'Kana', outcome: 'ADDED', seriesCreated: false, entityId: 'naruto-id' },
      { seriesTitle: 'Bleach', volumeNumber: 1, edition: null, outcome: 'ADDED', seriesCreated: true, entityId: 'bleach-id' },
      { seriesTitle: 'Bleach', volumeNumber: 2, edition: null, outcome: 'ADDED', seriesCreated: false, entityId: 'bleach-id' },
    ],
  })
})

describe('ce que la photo montre', () => {
  it('coche les tomes lus, montre les possédés inertes et propose la fiche d’une série nouvelle', async () => {
    await envoyerUnePhoto()

    expect(await screen.findByText('4 tomes lus sur 1 photo, dont 1 déjà possédé. Vérifie, puis ajoute.')).toBeInTheDocument()

    const possede = screen.getByRole('checkbox', { name: 'T4 de Naruto, déjà possédé' })
    expect(possede).toBeChecked()
    expect(possede).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'T5 de Naruto' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'T1 de Bleach' })).toBeChecked()
    expect(screen.getByText('Fiche proposée')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fiche gardée' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ajouter 2 tomes à ma collection' })).toBeEnabled()
    expect(screen.getByText(/1 livre visible mais non identifié/)).toBeInTheDocument()
    // Une fois la lecture affichée, le geste principal est l'ajout : le choix
    // d'autres photos reste possible, mais passe en second plan.
    const autres = screen.getByRole('button', { name: 'Analyser d’autres photos' })
    expect(autres).toBeEnabled()
    expect(autres.className).toContain('bg-surface')
  })

  it('n’envoie que ce qui est coché, avec l’édition de la série et la fiche gardée', async () => {
    const user = await envoyerUnePhoto()
    await screen.findByRole('checkbox', { name: 'T5 de Naruto' })

    // Le tome dont la photo ne donnait pas le numéro : saisi, il compte.
    await user.type(screen.getByRole('spinbutton', { name: 'Numéro du tome non lu de Bleach' }), '2')
    await user.click(screen.getByRole('button', { name: 'Ajouter 3 tomes à ma collection' }))

    // La mutation reçoit aussi un contexte TanStack : seul le premier argument compte.
    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([
        { seriesTitle: 'Naruto', volumeNumber: 5, edition: 'Kana' },
        {
          seriesTitle: 'Bleach',
          volumeNumber: 1,
          attributes: { mangaka: 'Tite Kubo' },
          coverImageUrl: 'https://img.invalid/bleach.jpg',
        },
        {
          seriesTitle: 'Bleach',
          volumeNumber: 2,
          attributes: { mangaka: 'Tite Kubo' },
          coverImageUrl: 'https://img.invalid/bleach.jpg',
        },
      ])
    expect(await screen.findByText('Import terminé')).toBeInTheDocument()
    expect(screen.getByText('3 tomes ajoutés · 1 série créée.')).toBeInTheDocument()
    expect(screen.getByText('ajouté, série créée')).toBeInTheDocument()
  })

  it('décocher un tome ou écarter la fiche change ce qui part', async () => {
    const user = await envoyerUnePhoto()
    await user.click(await screen.findByRole('checkbox', { name: 'T5 de Naruto' }))
    await user.click(screen.getByRole('button', { name: 'Fiche gardée' }))

    await user.click(screen.getByRole('button', { name: 'Ajouter 1 tome à ma collection' }))

    // Sans la fiche : le titre lu, sans attributs ni jaquette.
    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([{ seriesTitle: 'Bleach', volumeNumber: 1 }])
  })

  it('ne pré-coche pas une lecture incertaine d’une série nouvelle', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [
        {
          item: lu('Bleach', 3, { catalogStatus: 'NOT_IN_CATALOG', entityId: null, preselected: false, confidence: 'MEDIUM' }),
          alreadyOwned: false,
          proposal: null,
        },
      ],
    })

    await envoyerUnePhoto()

    expect(await screen.findByRole('checkbox', { name: 'T3 de Bleach' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Ajouter 0 tome à ma collection' })).toBeDisabled()
  })

  it('dit quand le moteur n’est pas configuré, sans rien proposer', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      visionStatus: 'NO_ENGINE',
      items: [],
      unidentifiedCount: 0,
    })

    await envoyerUnePhoto()

    expect(
      await screen.findByText("L'analyse des photos n'est pas configurée sur cette instance."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ajouter/ })).not.toBeInTheDocument()
  })
})
