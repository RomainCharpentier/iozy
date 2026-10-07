import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ImportPhotoPage } from './ImportPhotoPage'
import type { BoxDto, RecognizedItemDto } from '@/common/types/listingRecognition'
import type { FicheProposeeDto, ShelfAnalysisDto, ShelfItemDto, TomeAImporter } from '@/common/types/shelfImport'

const api = vi.hoisted(() => ({ analyserLEtagere: vi.fn(), importerDepuisLEtagere: vi.fn() }))
vi.mock('@/common/api/shelfImport', () => api)
const metadata = vi.hoisted(() => ({ searchVolumes: vi.fn() }))
vi.mock('@/common/api/metadata', () => metadata)
vi.mock('@/common/api/entityTypes', () => ({
  listEntityTypes: vi.fn().mockResolvedValue([{ id: 't-manga', code: 'MANGA' }]),
}))

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
    evidence: [`Chiffre ${tome ?? '?'} sur la tranche`],
    sourceImages: [0],
    boxes: [],
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

/** A frame on photo 1, between two fractions of its width - a spine, tall and narrow, unless said otherwise. */
function cadre(left: number, right: number, top = 0.1, bottom = 0.9): BoxDto {
  return { image: 0, top, left, bottom, right }
}

/** A new series, read with certainty, with its work page found by the title. */
function nouvelle(
  titre: string,
  tome: number | null,
  fiche: FicheProposeeDto | null = FICHE_BLEACH,
  boxes: BoxDto[] = [],
): ShelfItemDto {
  return {
    // The server never pre-checks a series that is outside the catalog (rule of the
    // listing batch): on a shelf, it is the screen that checks the certain reading.
    // An edition has a name: a new series is read with one unless a test says otherwise.
    item: lu(titre, tome, {
      catalogStatus: 'NOT_IN_CATALOG',
      entityId: null,
      preselected: false,
      editionHint: 'Glénat',
      boxes,
    }),
    alreadyOwned: false,
    proposal: fiche,
    proposalByTitle: fiche !== null,
  }
}

const LECTURE: ShelfAnalysisDto = {
  visionStatus: 'OK',
  unidentifiedCount: 1,
  notInCatalogCount: 2,
  analyzedImageCount: 1,
  requestedImageCount: 1,
  lookupsSkipped: 0,
  items: [
    {
      item: lu('Naruto', 4, { editionHint: 'Kana', boxes: [cadre(0, 0.1)] }),
      alreadyOwned: true,
      proposal: null,
      proposalByTitle: false,
    },
    {
      item: lu('Naruto', 5, { editionHint: 'Kana', boxes: [cadre(0.1, 0.2)] }),
      alreadyOwned: false,
      proposal: null,
      proposalByTitle: false,
    },
    nouvelle('Bleach', 1, FICHE_BLEACH, [cadre(0.2, 0.3)]),
    // A cover laid face on: wide, so the label is horizontal.
    nouvelle('Bleach', null, FICHE_BLEACH, [cadre(0.3, 0.6, 0.5, 0.9)]),
  ],
}

async function envoyerUnePhoto() {
  const user = userEvent.setup()
  render(<ImportPhotoPage />, { wrapper: enrobage })
  const photo = new File([new Uint8Array(64)], 'etagere.jpg', { type: 'image/jpeg' })
  await user.upload(screen.getByLabelText('Choisir des photos de l’étagère'), photo)
  // userEvent copies the files: we compare the name, not the instance.
  await waitFor(() => expect(api.analyserLEtagere).toHaveBeenCalledTimes(1))
  const envoyees = api.analyserLEtagere.mock.calls[0][0] as File[]
  expect(envoyees.map((f) => f.name)).toEqual([photo.name])
  return user
}

/**
 * After the reading, the screen enters the one-by-one validation as soon as there is
 * something to validate; the summary by series is one click further.
 */
async function auRecapitulatif(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', { name: /Valider un par un|Ce que la photo montre/ })
  const revue = screen.queryByRole('button', { name: 'Récapitulatif' })
  if (revue) await user.click(revue)
  await screen.findByText('Ce que la photo montre')
}

beforeEach(() => {
  vi.clearAllMocks()
  metadata.searchVolumes.mockResolvedValue({ volumes: [], quotaExceeded: false })
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

describe('the one-by-one validation', () => {
  it('starts right after the reading, with the photo and the single frame of the current book', async () => {
    const user = await envoyerUnePhoto()

    // Naruto T5 first: it is the leftmost frame of the not owned ones.
    expect(await screen.findByText('Extrait 1 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
    expect(screen.getByText('Naruto')).toBeInTheDocument()
    const cadreT5 = screen.getByRole('img', { name: 'T5 de Naruto sur la photo 1' })
    expect(cadreT5).toHaveAttribute('title', 'Chiffre 5 sur la tranche')
    // A spine is much taller than wide: its label is read from top to bottom.
    expect(screen.getByText('T5')).toHaveClass('[writing-mode:vertical-rl]')
    expect(screen.queryByRole('img', { name: /T1 de Bleach/ })).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Numéro du tome' })).toHaveValue(5)
    await user.click(screen.getByRole('button', { name: 'Écarter' }))

    expect(await screen.findByText('Extrait 2 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'T1 de Bleach sur la photo 1' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Numéro du tome' })).toHaveValue(1)
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    // The unread volume, laid face on: horizontal label, and nothing to
    // confirm until a number is typed.
    expect(await screen.findByText('Extrait 3 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
    expect(screen.getByText('?')).not.toHaveClass('[writing-mode:vertical-rl]')
    expect(screen.getByRole('button', { name: 'C’est bien ça' })).toBeDisabled()
    await user.type(screen.getByRole('spinbutton', { name: 'Numéro du tome' }), '2')
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    expect(await screen.findByText('Tout est passé en revue')).toBeInTheDocument()
    expect(screen.getByText(/2 ajoutés à ta collection, 1 écarté/)).toBeInTheDocument()
    // Each confirmation wrote its own volume, at once; the one set aside wrote nothing.
    expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(2)
    expect(api.importerDepuisLEtagere.mock.calls.map(([tomes]) => tomes.map((t: TomeAImporter) => t.volumeNumber))).toEqual([
      [1],
      [2],
    ])

    await user.click(screen.getByRole('button', { name: 'Voir le récapitulatif' }))

    // What was added is done: nothing left to send, and no second write of it.
    expect(await screen.findByRole('button', { name: 'Rien de coché à ajouter' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'T5 de Naruto' })).not.toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'T1 de Bleach' })).not.toBeInTheDocument()
    expect(screen.getByText(/2 ajoutés à l’instant/)).toBeInTheDocument()
  })

  it('writes the number the user typed, not the one that was read', async () => {
    const user = await envoyerUnePhoto()
    await screen.findByText('Extrait 1 sur 3 : le morceau de photo, et ce qui en a été lu.')
    const champ = screen.getByRole('spinbutton', { name: 'Numéro du tome' })
    await user.clear(champ)
    await user.type(champ, '6')
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([
      expect.objectContaining({ seriesTitle: 'Naruto', volumeNumber: 6, edition: 'Kana' }),
    ])
  })

  it('stays on the excerpt and writes nothing more when the add fails', async () => {
    api.importerDepuisLEtagere.mockRejectedValueOnce(new Error('boom'))
    const user = await envoyerUnePhoto()
    await screen.findByText('Extrait 1 sur 3 : le morceau de photo, et ce qui en a été lu.')
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('L’ajout a échoué : rien n’a été écrit')
    expect(screen.getByText('Extrait 1 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()

    // Trying again works, and the excerpt then moves on.
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))
    expect(await screen.findByText('Extrait 2 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
    expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(2)
  })

  /** A new series read without any edition: the list of choices comes from the sources. */
  function berserkSansEdition() {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [
        {
          item: lu('Berserk', 2, {
            catalogStatus: 'NOT_IN_CATALOG',
            entityId: null,
            preselected: false,
            editionHint: null,
            boxes: [cadre(0, 0.1)],
          }),
          alreadyOwned: false,
          proposal: null,
          proposalByTitle: false,
        },
      ],
    })
  }

  it('offers the editions the sources know in a drop-down, empty to start with, with no "unknown" choice', async () => {
    berserkSansEdition()
    metadata.searchVolumes.mockResolvedValue({
      quotaExceeded: false,
      volumes: [
        { edition: 'Glénat Deluxe', volumeNumber: 2, imageUrl: null, title: 'Berserk 2', alreadyOwned: false },
        { edition: 'Glénat Deluxe', volumeNumber: 3, imageUrl: null, title: 'Berserk 3', alreadyOwned: false },
        { edition: 'Glénat Manga', volumeNumber: 2, imageUrl: null, title: 'Berserk 2', alreadyOwned: false },
      ],
    })
    const user = await envoyerUnePhoto()

    await screen.findByText('Extrait 1 sur 1 : le morceau de photo, et ce qui en a été lu.')
    expect(await screen.findByRole('option', { name: 'Glénat Deluxe' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Glénat Manga' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Je ne sais pas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    // Several choices: nothing is picked for the user.
    expect(screen.getByRole('combobox', { name: 'Édition' })).toHaveValue('')
    // Asked once for the series, by its title, in the manga type.
    expect(metadata.searchVolumes).toHaveBeenCalledWith('t-manga', 'Berserk')
    expect(screen.getByRole('button', { name: 'C’est bien ça' })).toBeDisabled()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Édition' }), 'Glénat Deluxe')
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([
      expect.objectContaining({ seriesTitle: 'Berserk', volumeNumber: 2, edition: 'Glénat Deluxe' }),
    ])
  })

  it.each([
    ['knows none', () => metadata.searchVolumes.mockResolvedValue({ volumes: [], quotaExceeded: false })],
    ['stays silent', () => metadata.searchVolumes.mockRejectedValue(new Error('provider down'))],
  ])('preselects the single default edition when no source %s', async (_cas, preparer) => {
    berserkSansEdition()
    preparer()
    const user = await envoyerUnePhoto()

    await screen.findByText('Extrait 1 sur 1 : le morceau de photo, et ce qui en a été lu.')
    // One choice only: it is already picked, nothing to do but confirm.
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Édition' })).toHaveValue('Édition standard'))
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([
      expect.objectContaining({ seriesTitle: 'Berserk', volumeNumber: 2, edition: 'Édition standard' }),
    ])
  })

  it('shows one edition, not two, when the publisher read on the spine and a source spelling repeat the real one', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [
        {
          item: lu('One Piece', 3, {
            catalogStatus: 'EDITION_TO_CONFIRM',
            preselected: false,
            // The spine shows the publisher, which the reader returns as an edition.
            editionHint: 'Glénat',
            editionOptions: [{ editionId: 'e1', editionName: 'Édition originale', totalVolumes: 110 }],
            boxes: [cadre(0, 0.1)],
          }),
          alreadyOwned: false,
          proposal: null,
          proposalByTitle: false,
        },
      ],
    })
    // The source spells the same edition differently.
    metadata.searchVolumes.mockResolvedValue({
      quotaExceeded: false,
      volumes: [{ edition: 'Édition Originale', volumeNumber: 3, imageUrl: null, title: 'One Piece 3', alreadyOwned: false }],
    })
    await envoyerUnePhoto()

    await screen.findByText('Extrait 1 sur 1 : le morceau de photo, et ce qui en a été lu.')
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Édition' })).toHaveValue('Édition originale'))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Choisir une édition', 'Édition originale'])
  })

  it('says the edition is what blocks the summary when volumes are checked but no edition is chosen', async () => {
    berserkSansEdition()
    metadata.searchVolumes.mockResolvedValue({
      quotaExceeded: false,
      volumes: [
        { edition: 'Glénat Deluxe', volumeNumber: 2, imageUrl: null, title: 'Berserk 2', alreadyOwned: false },
        { edition: 'Glénat Manga', volumeNumber: 2, imageUrl: null, title: 'Berserk 2', alreadyOwned: false },
      ],
    })
    const user = await envoyerUnePhoto()
    await screen.findByRole('option', { name: 'Glénat Deluxe' })
    await user.click(screen.getByRole('button', { name: 'Récapitulatif' }))

    expect(await screen.findByRole('button', { name: 'Choisis une édition pour ajouter' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Rien de coché à ajouter' })).not.toBeInTheDocument()
  })

  it('keeps the way out of the excerpt closed while its add is on its way', async () => {
    api.importerDepuisLEtagere.mockReturnValueOnce(new Promise(() => {}))
    const user = await envoyerUnePhoto()
    await screen.findByText('Extrait 1 sur 3 : le morceau de photo, et ce qui en a été lu.')
    // From the second excerpt, so that "Précédent" would be available if nothing held it.
    await user.click(screen.getByRole('button', { name: 'Extrait suivant' }))
    await screen.findByText('Extrait 2 sur 3 : le morceau de photo, et ce qui en a été lu.')
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    expect(await screen.findByRole('button', { name: 'Ajout…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Extrait suivant' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Extrait précédent' })).toBeDisabled()
  })

  it('preselects the only edition of a series to confirm', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [
        {
          item: lu('One Piece', 3, {
            catalogStatus: 'EDITION_TO_CONFIRM',
            preselected: false,
            editionOptions: [{ editionId: 'e1', editionName: 'Glénat', totalVolumes: 110 }],
            boxes: [cadre(0, 0.1)],
          }),
          alreadyOwned: false,
          proposal: null,
          proposalByTitle: false,
        },
      ],
    })
    const user = await envoyerUnePhoto()

    await screen.findByText('Extrait 1 sur 1 : le morceau de photo, et ce qui en a été lu.')
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Édition' })).toHaveValue('Glénat'))
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([
      expect.objectContaining({ seriesTitle: 'One Piece', volumeNumber: 3, edition: 'Glénat' }),
    ])
  })

  it('reopens from the summary', async () => {
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)

    await user.click(screen.getByRole('button', { name: 'Valider un par un (3)' }))

    expect(await screen.findByText('Extrait 1 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
  })

  it('resumes at the first excerpt not decided yet, and says how many are left', async () => {
    const user = await envoyerUnePhoto()
    await screen.findByText('Extrait 1 sur 3 : le morceau de photo, et ce qui en a été lu.')
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))
    await screen.findByText('Extrait 2 sur 3 : le morceau de photo, et ce qui en a été lu.')
    // Set aside for later: this one stays open.
    await user.click(screen.getByRole('button', { name: 'Extrait suivant' }))
    await screen.findByText('Extrait 3 sur 3 : le morceau de photo, et ce qui en a été lu.')
    await user.click(screen.getByRole('button', { name: 'Récapitulatif' }))

    await user.click(await screen.findByRole('button', { name: 'Reprendre la validation (2 restants sur 3)' }))

    // Not at the first excerpt, which is already confirmed.
    expect(await screen.findByText('Extrait 2 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
    // Only the confirmed one was written, once.
    expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1)
  })
})

describe('the summary', () => {
  it('checks the read volumes, shows the owned ones as inert and offers the work page of a new series', async () => {
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)

    expect(
      screen.getByText('4 tomes lus sur 1 photo, dont 1 déjà dans ta collection ignoré. Vérifie, puis ajoute.'),
    ).toBeInTheDocument()
    // An owned volume has nothing to decide: it is only counted, never listed.
    expect(screen.queryByRole('checkbox', { name: /T4 de Naruto/ })).not.toBeInTheDocument()
    const t5 = screen.getByRole('checkbox', { name: 'T5 de Naruto' })
    expect(t5).toBeChecked()
    // What the reader saw, on hover: enough to check by hand.
    expect(t5).toHaveAttribute('title', 'Chiffre 5 sur la tranche')
    expect(screen.getByRole('checkbox', { name: 'T1 de Bleach' })).toBeChecked()
    expect(screen.getByText('Fiche proposée')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fiche gardée' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vérifier l’ajout de 2 tomes' })).toBeEnabled()
    expect(screen.getByText(/1 livre visible mais non identifié/)).toBeInTheDocument()
    // Once the reading is shown, the main action is the add: choosing
    // other photos is still possible, but moves to the background.
    const autres = screen.getByRole('button', { name: 'Analyser d’autres photos' })
    expect(autres).toBeEnabled()
    expect(autres.className).toContain('bg-surface')
  })

  it('only walks through what is not owned when most of a long shelf is already in the collection', async () => {
    const possedes: ShelfItemDto[] = Array.from({ length: 20 }, (_, i) => ({
      item: lu('Naruto', i + 1, { boxes: [cadre(i / 100, i / 100 + 0.01)] }),
      alreadyOwned: true,
      proposal: null,
      proposalByTitle: false,
    }))
    const aValider = Array.from({ length: 6 }, (_, i) => nouvelle('Bleach', i + 1, FICHE_BLEACH, [cadre(0.5 + i / 100, 0.51 + i / 100)]))
    api.analyserLEtagere.mockResolvedValue({ ...LECTURE, items: [...possedes, ...aValider] })
    const user = await envoyerUnePhoto()

    expect(await screen.findByText('Extrait 1 sur 6 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Récapitulatif' }))

    expect(
      await screen.findByText('26 tomes lus sur 1 photo, dont 20 déjà dans ta collection ignorés. Vérifie, puis ajoute.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Naruto/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vérifier l’ajout de 6 tomes' })).toBeEnabled()
  })

  it('says there is nothing to add when everything read is already owned', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [{ item: lu('Naruto', 4), alreadyOwned: true, proposal: null, proposalByTitle: false }],
    })
    await envoyerUnePhoto()

    expect(
      await screen.findByText('1 tome lu sur 1 photo, dont 1 déjà dans ta collection ignoré. Rien à ajouter.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Tout ce qui a été lu est déjà dans ta collection.')).toBeInTheDocument()
  })

  it('does not pre-check an uncertain reading of a new series', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [
        {
          ...nouvelle('Bleach', 3, null),
          item: lu('Bleach', 3, { catalogStatus: 'NOT_IN_CATALOG', entityId: null, preselected: false, confidence: 'MEDIUM' }),
        },
      ],
    })
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)

    expect(screen.getByRole('checkbox', { name: 'T3 de Bleach' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Rien de coché à ajouter' })).toBeDisabled()
  })

  it('keeps the mention read on the photo out of the list when the catalog already knows editions', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [
        {
          item: lu('Bleach', null, {
            catalogStatus: 'EDITION_TO_CONFIRM',
            editionHint: 'Masked',
            preselected: false,
            editionOptions: [{ editionId: 'e1', editionName: 'Standard', totalVolumes: 74 }],
          }),
          alreadyOwned: false,
          proposal: null,
          proposalByTitle: false,
        },
      ],
    })
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)

    // The read mention can be a publisher: it never sits beside the real editions.
    expect(screen.queryByRole('option', { name: /Masked/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Choisir une édition', 'Standard'])
    // A single choice: it is picked.
    expect(screen.getByRole('combobox', { name: 'Édition' })).toHaveValue('Standard')
  })

  it('says when the engine is not configured, without offering anything', async () => {
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
    expect(screen.queryByRole('button', { name: /Ajouter|Vérifier|Rien de coché|Valider un par un/ })).not.toBeInTheDocument()
  })

  it('says when the quota of the service is reached, without inviting to retry right away', async () => {
    api.analyserLEtagere.mockResolvedValue({ ...LECTURE, visionStatus: 'QUOTA_EXCEEDED', items: [], unidentifiedCount: 0 })

    await envoyerUnePhoto()

    expect(
      await screen.findByText(
        "Le service d'analyse d'images a atteint son quota du jour. Réessaie demain, ou ajoute les tomes depuis le Catalogue.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Vous pouvez réessayer/)).not.toBeInTheDocument()
  })
})

describe('before writing', () => {
  it('rereads in black and white what would be sent, and writes nothing until it is confirmed', async () => {
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)

    // The volume whose photo did not give the number: once typed, it counts.
    await user.type(screen.getByRole('spinbutton', { name: 'Numéro du tome non lu de Bleach' }), '2')
    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 3 tomes' }))

    expect(await screen.findByText('Ce qui sera ajouté')).toBeInTheDocument()
    expect(
      screen.getByText('3 tomes dans 2 séries, dont 1 série créée. Rien n’est écrit tant que tu n’as pas confirmé.'),
    ).toBeInTheDocument()
    expect(screen.getByText('1 tome : 5')).toBeInTheDocument()
    expect(screen.getByText('édition Kana · série déjà au catalogue')).toBeInTheDocument()
    expect(screen.getByText('2 tomes : 1, 2')).toBeInTheDocument()
    expect(screen.getByText('édition Glénat · série créée avec la fiche « Bleach »')).toBeInTheDocument()
    expect(api.importerDepuisLEtagere).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Ajouter 3 tomes à ma collection' }))

    // The mutation also receives a TanStack context: only the first argument counts.
    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([
      { seriesTitle: 'Naruto', volumeNumber: 5, edition: 'Kana' },
      {
        seriesTitle: 'Bleach',
        volumeNumber: 1,
        edition: 'Glénat',
        attributes: { mangaka: 'Tite Kubo' },
        coverImageUrl: 'https://img.invalid/bleach.jpg',
      },
      {
        seriesTitle: 'Bleach',
        volumeNumber: 2,
        edition: 'Glénat',
        attributes: { mangaka: 'Tite Kubo' },
        coverImageUrl: 'https://img.invalid/bleach.jpg',
      },
    ])
    expect(await screen.findByText('Import terminé')).toBeInTheDocument()
    expect(screen.getByText('3 tomes ajoutés · 1 série créée.')).toBeInTheDocument()
    expect(screen.getByText('ajouté, série créée')).toBeInTheDocument()
  })

  it('going back to the check loses nothing and writes nothing', async () => {
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)
    await user.click(screen.getByRole('checkbox', { name: 'T5 de Naruto' }))
    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 1 tome' }))
    await screen.findByText('Ce qui sera ajouté')

    await user.click(screen.getByRole('button', { name: 'Revenir à la vérification' }))

    expect(await screen.findByRole('checkbox', { name: 'T5 de Naruto' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'T1 de Bleach' })).toBeChecked()
    expect(api.importerDepuisLEtagere).not.toHaveBeenCalled()
  })

  it('summarizes the runs of numbers, and allows unchecking everything to check by hand', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [1, 2, 3, 4, 7].map((numero) => nouvelle('Bleach', numero)),
    })
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)

    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 5 tomes' }))
    expect(await screen.findByText('5 tomes : 1 à 4, 7')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revenir à la vérification' }))
    await user.click(await screen.findByRole('button', { name: 'tout décocher' }))
    expect(screen.getByRole('button', { name: 'Rien de coché à ajouter' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'tout cocher' }))
    expect(screen.getByRole('button', { name: 'Vérifier l’ajout de 5 tomes' })).toBeEnabled()
  })

  it('sends only what is checked, without the work page that was set aside', async () => {
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)
    await user.click(screen.getByRole('checkbox', { name: 'T5 de Naruto' }))
    await user.click(screen.getByRole('button', { name: 'Fiche gardée' }))
    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 1 tome' }))
    expect(await screen.findByText('édition Glénat · série créée avec ce seul titre')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ajouter 1 tome à ma collection' }))

    // Without the work page: the title that was read, with no attributes or cover.
    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([{ seriesTitle: 'Bleach', volumeNumber: 1, edition: 'Glénat' }])
  })

  it('shows a first search result as a lead, without keeping it by default', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [
        {
          ...nouvelle("L'Attaque des Titans", 3, { ...FICHE_BLEACH, title: 'Shingeki no Kyojin' }),
          proposalByTitle: false,
        },
      ],
    })
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)

    expect(screen.getByText('Fiche possible, à vérifier')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sans la fiche' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 1 tome' }))
    await user.click(await screen.findByRole('button', { name: 'Ajouter 1 tome à ma collection' }))

    // The title that was read, with no attributes or cover: the lead was not taken.
    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([{ seriesTitle: "L'Attaque des Titans", volumeNumber: 3, edition: 'Glénat' }])
  })

  it('keeps the lead when the user says so, with its title and work page', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [
        {
          ...nouvelle("L'Attaque des Titans", 3, { ...FICHE_BLEACH, title: 'Shingeki no Kyojin' }),
          proposalByTitle: false,
        },
      ],
    })
    const user = await envoyerUnePhoto()
    await auRecapitulatif(user)

    await user.click(screen.getByRole('button', { name: 'Sans la fiche' }))
    expect(screen.getByRole('button', { name: 'Fiche gardée' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 1 tome' }))
    expect(await screen.findByText('édition Glénat · série créée avec la fiche « Shingeki no Kyojin »')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ajouter 1 tome à ma collection' }))

    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([
      {
        seriesTitle: 'Shingeki no Kyojin',
        edition: 'Glénat',
        volumeNumber: 3,
        attributes: { mangaka: 'Tite Kubo' },
        coverImageUrl: 'https://img.invalid/bleach.jpg',
      },
    ])
  })
})
