import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ImportPhotoPage } from './ImportPhotoPage'
import type { BoxDto, RecognizedItemDto } from '@/common/types/listingRecognition'
import type { FicheProposeeDto, ShelfAnalysisDto, ShelfItemDto } from '@/common/types/shelfImport'

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

/** Une série nouvelle, lue sûrement, avec sa fiche retrouvée par le titre. */
/** Un cadre sur la photo 1, entre deux fractions de sa largeur - une tranche, haute et étroite, sauf dit autrement. */
function cadre(left: number, right: number, top = 0.1, bottom = 0.9): BoxDto {
  return { image: 0, top, left, bottom, right }
}

function nouvelle(
  titre: string,
  tome: number | null,
  fiche: FicheProposeeDto | null = FICHE_BLEACH,
  boxes: BoxDto[] = [],
): ShelfItemDto {
  return {
    // Le serveur ne pré-coche jamais une série hors catalogue (règle du lot
    // d'annonce) : sur une étagère, c'est l'écran qui coche la lecture sûre.
    item: lu(titre, tome, { catalogStatus: 'NOT_IN_CATALOG', entityId: null, preselected: false, boxes }),
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
    // Une couverture posée de face : large, donc étiquette à l'horizontale.
    nouvelle('Bleach', null, FICHE_BLEACH, [cadre(0.3, 0.6, 0.5, 0.9)]),
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
    const t5 = screen.getByRole('checkbox', { name: 'T5 de Naruto' })
    expect(t5).toBeChecked()
    // Ce que le lecteur a vu, au survol : de quoi vérifier à la main.
    expect(t5).toHaveAttribute('title', 'Chiffre 5 sur la tranche')
    expect(screen.getByRole('checkbox', { name: 'T1 de Bleach' })).toBeChecked()
    expect(screen.getByText('Fiche proposée')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fiche gardée' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vérifier l’ajout de 2 tomes' })).toBeEnabled()
    expect(screen.getByText(/1 livre visible mais non identifié/)).toBeInTheDocument()
    // Une fois la lecture affichée, le geste principal est l'ajout : le choix
    // d'autres photos reste possible, mais passe en second plan.
    const autres = screen.getByRole('button', { name: 'Analyser d’autres photos' })
    expect(autres).toBeEnabled()
    expect(autres.className).toContain('bg-surface')
  })

  it('ne pré-coche pas une lecture incertaine d’une série nouvelle', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [
        {
          ...nouvelle('Bleach', 3, null),
          item: lu('Bleach', 3, { catalogStatus: 'NOT_IN_CATALOG', entityId: null, preselected: false, confidence: 'MEDIUM' }),
        },
      ],
    })

    await envoyerUnePhoto()

    expect(await screen.findByRole('checkbox', { name: 'T3 de Bleach' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Rien de coché à ajouter' })).toBeDisabled()
  })

  it('propose l’édition lue sur la photo même quand la série est déjà au catalogue', async () => {
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

    await envoyerUnePhoto()

    expect(await screen.findByRole('button', { name: 'Masked (lu sur la photo)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Standard' })).toBeInTheDocument()
  })

  it('pose un cadre par tome sur la photo, dans l’état de sa pastille, et un clic le bascule', async () => {
    const user = await envoyerUnePhoto()

    const cadreT5 = await screen.findByRole('checkbox', { name: 'T5 de Naruto sur la photo 1' })
    expect(cadreT5).toBeChecked()
    expect(cadreT5).toHaveAttribute('title', 'Chiffre 5 sur la tranche')
    // Une tranche est bien plus haute que large : son étiquette se lit de haut
    // en bas ; une couverture posée de face garde la sienne à l'horizontale.
    expect(within(cadreT5).getByText('T5')).toHaveClass('[writing-mode:vertical-rl]')
    const cadreCouverture = screen.getByRole('checkbox', { name: '? de Bleach sur la photo 1' })
    expect(within(cadreCouverture).getByText('?')).not.toHaveClass('[writing-mode:vertical-rl]')
    const cadrePossede = screen.getByRole('checkbox', { name: 'T4 de Naruto sur la photo 1, déjà possédé' })
    expect(cadrePossede).toBeChecked()
    expect(cadrePossede).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: '? de Bleach sur la photo 1' })).not.toBeChecked()

    await user.click(cadreT5)

    expect(cadreT5).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'T5 de Naruto' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Vérifier l’ajout de 1 tome' })).toBeEnabled()
  })

  it('fait valider les extraits un par un : confirmer, écarter, saisir un numéro, puis revenir', async () => {
    const user = await envoyerUnePhoto()
    await user.click(await screen.findByRole('button', { name: 'Valider un par un (3)' }))

    // Naruto T5 d'abord : c'est le cadre le plus à gauche des non possédés.
    expect(await screen.findByText('Extrait 1 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
    expect(screen.getByText('Naruto')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Numéro du tome' })).toHaveValue(5)
    await user.click(screen.getByRole('button', { name: 'Écarter' }))

    expect(await screen.findByText('Extrait 2 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Numéro du tome' })).toHaveValue(1)
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    // Le tome non lu : rien à confirmer tant qu'un numéro n'est pas saisi.
    expect(await screen.findByText('Extrait 3 sur 3 : le morceau de photo, et ce qui en a été lu.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'C’est bien ça' })).toBeDisabled()
    await user.type(screen.getByRole('spinbutton', { name: 'Numéro du tome' }), '2')
    await user.click(screen.getByRole('button', { name: 'C’est bien ça' }))

    expect(await screen.findByText('Tout est passé en revue')).toBeInTheDocument()
    expect(screen.getByText(/2 confirmés, 1 écarté/)).toBeInTheDocument()
    expect(api.importerDepuisLEtagere).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Revenir à la vue d’ensemble' }))

    // Naruto écarté, Bleach 1 et 2 confirmés : deux tomes à ajouter.
    expect(await screen.findByRole('button', { name: 'Vérifier l’ajout de 2 tomes' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'T5 de Naruto' })).not.toBeChecked()
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
    expect(screen.queryByRole('button', { name: /Ajouter|Vérifier|Rien de coché/ })).not.toBeInTheDocument()
  })
})

describe('avant d’écrire', () => {
  it('relit noir sur blanc ce qui partirait, et n’écrit rien tant que ce n’est pas confirmé', async () => {
    const user = await envoyerUnePhoto()
    await screen.findByRole('checkbox', { name: 'T5 de Naruto' })

    // Le tome dont la photo ne donnait pas le numéro : saisi, il compte.
    await user.type(screen.getByRole('spinbutton', { name: 'Numéro du tome non lu de Bleach' }), '2')
    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 3 tomes' }))

    expect(await screen.findByText('Ce qui sera ajouté')).toBeInTheDocument()
    expect(
      screen.getByText('3 tomes dans 2 séries, dont 1 série créée. Rien n’est écrit tant que tu n’as pas confirmé.'),
    ).toBeInTheDocument()
    expect(screen.getByText('1 tome : 5')).toBeInTheDocument()
    expect(screen.getByText('édition Kana · série déjà au catalogue')).toBeInTheDocument()
    expect(screen.getByText('2 tomes : 1, 2')).toBeInTheDocument()
    expect(screen.getByText('édition non renseignée · série créée avec la fiche « Bleach »')).toBeInTheDocument()
    expect(api.importerDepuisLEtagere).not.toHaveBeenCalled()

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

  it('revenir à la vérification ne perd rien et n’écrit rien', async () => {
    const user = await envoyerUnePhoto()
    await user.click(await screen.findByRole('checkbox', { name: 'T5 de Naruto' }))
    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 1 tome' }))
    await screen.findByText('Ce qui sera ajouté')

    await user.click(screen.getByRole('button', { name: 'Revenir à la vérification' }))

    expect(await screen.findByRole('checkbox', { name: 'T5 de Naruto' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'T1 de Bleach' })).toBeChecked()
    expect(api.importerDepuisLEtagere).not.toHaveBeenCalled()
  })

  it('résume les suites de numéros, et permet de tout décocher pour cocher à la main', async () => {
    api.analyserLEtagere.mockResolvedValue({
      ...LECTURE,
      items: [1, 2, 3, 4, 7].map((numero) => nouvelle('Bleach', numero)),
    })
    const user = await envoyerUnePhoto()

    await user.click(await screen.findByRole('button', { name: 'Vérifier l’ajout de 5 tomes' }))
    expect(await screen.findByText('5 tomes : 1 à 4, 7')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revenir à la vérification' }))
    await user.click(await screen.findByRole('button', { name: 'tout décocher' }))
    expect(screen.getByRole('button', { name: 'Rien de coché à ajouter' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'tout cocher' }))
    expect(screen.getByRole('button', { name: 'Vérifier l’ajout de 5 tomes' })).toBeEnabled()
  })

  it('n’envoie que ce qui est coché, sans la fiche écartée', async () => {
    const user = await envoyerUnePhoto()
    await user.click(await screen.findByRole('checkbox', { name: 'T5 de Naruto' }))
    await user.click(screen.getByRole('button', { name: 'Fiche gardée' }))
    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 1 tome' }))
    expect(await screen.findByText('édition non renseignée · série créée avec ce seul titre')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ajouter 1 tome à ma collection' }))

    // Sans la fiche : le titre lu, sans attributs ni jaquette.
    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([{ seriesTitle: 'Bleach', volumeNumber: 1 }])
  })

  it('montre un premier résultat de recherche comme une piste, sans le garder d’office', async () => {
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

    expect(await screen.findByText('Fiche possible, à vérifier')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sans la fiche' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 1 tome' }))
    await user.click(await screen.findByRole('button', { name: 'Ajouter 1 tome à ma collection' }))

    // Le titre lu, sans attributs ni jaquette : la piste n'a pas été prise.
    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([{ seriesTitle: "L'Attaque des Titans", volumeNumber: 3 }])
  })

  it('garde la piste quand l’utilisateur le dit, avec son titre et sa fiche', async () => {
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

    await user.click(await screen.findByRole('button', { name: 'Sans la fiche' }))
    expect(screen.getByRole('button', { name: 'Fiche gardée' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Vérifier l’ajout de 1 tome' }))
    expect(await screen.findByText('édition non renseignée · série créée avec la fiche « Shingeki no Kyojin »')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ajouter 1 tome à ma collection' }))

    await waitFor(() => expect(api.importerDepuisLEtagere).toHaveBeenCalledTimes(1))
    expect(api.importerDepuisLEtagere.mock.calls[0][0]).toEqual([
      {
        seriesTitle: 'Shingeki no Kyojin',
        volumeNumber: 3,
        attributes: { mangaka: 'Tite Kubo' },
        coverImageUrl: 'https://img.invalid/bleach.jpg',
      },
    ])
  })
})
