import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { searchMetadata } from '@/common/api/metadata'
import { searchEntities } from '@/common/api/entities'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '@/common/lib/coverImage'
import { creatorFrom } from '@/pages/entity/creatorInfo'
import { isSeriesOngoing } from '@/pages/entity/seriesInfo'
import { useTeinteJaquette } from '@/pages/entity/useTeinteJaquette'
import { resolvePrimaryTitle, useTitleComposition } from '@/common/lib/titleLanguage'
import { gradientFor } from '@/common/theme/gradient'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { ColonneSource, InspecteurFiche, RangeeInspecteur } from '@/pages/entity/InspecteurFiche'
import type { MetadataCandidateDto } from '@/common/types/api'
import { FicheHero } from '@/pages/entity/FicheHero'
import { retourDepuis } from '@/common/lib/retour'
import { useCollecteParTome } from '@/common/lib/typeDeCollection'
import { usePropositionTomes } from '@/pages/entity/usePropositionTomes'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * The preview of a work one does not own: the same page as its detail page, but
 * read from the metadata provider, without writing anything to the database.
 *
 * <h2>Browsing does not write</h2>
 * A previous version created the Entity on opening, to have only one
 * route. It was convenient and wrong: browsing search results
 * filled the catalog with works that nobody ever intended to
 * collect. Here nothing is written until a volume is checked and then
 * added - it is `quickAdd` that creates the detail page at that moment, and the preview
 * then switches to it.
 *
 * <h2>Identified by the URL, not by a navigation state</h2>
 * `?type=…&titre=…`: the screen reloads, can be shared and goes back.
 * The old add screen only lived through `location.state` and showed
 * "Aucune sélection en cours" after a simple F5. The metadata search
 * is redone on load to find the work again - one
 * round trip, against a page that does not reload.
 *
 * <h2>What it does not show, and why</h2>
 * No ranking, no rating, no reading, no tag, no relationship: these things
 * attach to a detail page, and there is none yet. Inventing them as
 * read-only would suggest that they can be filled in here.
 *
 * <h2>For a visitor: a read-only preview</h2>
 * An ISBN found from the catalog leads here. A visitor sees the work as the
 * source describes it, and nothing more: no volumes to check (that search
 * asks providers for every edition, and its only purpose is to add), no
 * sentence about "ta collection", which they do not have.
 */
export function ApercuOeuvrePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const titleComposition = useTitleComposition()
  const { estInvite } = useAuth()
  const entityTypeId = params.get('type') ?? ''
  const titre = params.get('titre') ?? ''

  const typesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const type = typesQuery.data?.find((t) => t.id === entityTypeId)

  /**
   * Does this work ALREADY have a detail page?
   *
   * The preview is a URL like any other: one can arrive by a bookmark,
   * by the Back button, or by a received link - including for a work
   * one has owned for a long time. Without this check, it claimed
   * "Cette œuvre n'est pas encore dans ta collection" in front of a series of
   * 3 owned volumes (reproduced on Naruto). The preview then gives way to
   * the real detail page, REPLACING the history entry: going back
   * must bring the user back to where they came from, not to a preview that would redirect at once.
   */
  const ficheExistanteQuery = useQuery({
    queryKey: queryKeys.entities.search({ q: titre }),
    queryFn: () => searchEntities({ q: titre }),
    enabled: entityTypeId !== '' && titre !== '',
  })
  const ficheExistante = ficheExistanteQuery.data?.find(
    (e) => e.entityTypeId === entityTypeId && e.title.trim().toLowerCase() === titre.trim().toLowerCase(),
  )
  useEffect(() => {
    if (ficheExistante) navigate(`/entity/${ficheExistante.id}`, { replace: true })
  }, [ficheExistante, navigate])

  // We redo the search to find the metadata of the work (author,
  // cover, year, ids). Same cache key as the search screen:
  // going back there right after does not restart anything.
  // The candidate already in hand, when it was just clicked: a shortcut,
  // never a dependency - on reload it is absent and the search
  // below finds it again. This is what sets this screen apart from the old
  // draft, which only existed through its `location.state`.
  const etatRecu = useLocation().state
  const candidatRecu = (etatRecu as { candidat?: MetadataCandidateDto } | null)?.candidat ?? null
  // A visitor who arrives with the candidate in hand does not need the search:
  // it only goes out to a provider again to find what is already here.
  const rechercheQuery = useQuery({
    queryKey: queryKeys.metadata.search(entityTypeId, titre),
    queryFn: () => searchMetadata(entityTypeId, titre),
    enabled: entityTypeId !== '' && titre !== '' && !(estInvite && candidatRecu),
  })
  // The search the user comes from, with what was typed in it (see retourFiche).
  // Absent from a received link or an F5: the back link then aims at the bare search,
  // which remains a valid destination.
  const retour = retourDepuis(etatRecu) ?? { to: '/add', libelle: 'Catalogue' }
  // A game has no volume: the welcome sentence cannot ask to check
  // some (see lib/typeDeCollection).
  const parTome = useCollecteParTome(entityTypeId)

  // Otherwise, the one with a title that matches exactly the one in the URL.
  // Case-insensitive comparison, on the main title AS WELL AS on the
  // raw title: the first may come from a French resolution that this
  // page does not redo. No fallback to "the first result" - a homonym
  // would show the author and cover of another work.
  const memeTitre = (valeur: string) => valeur.trim().toLowerCase() === titre.trim().toLowerCase()
  const candidat =
    candidatRecu ??
    rechercheQuery.data?.find(
      (c) => memeTitre(resolvePrimaryTitle(c, titleComposition, undefined)) || memeTitre(c.title),
    ) ??
    null
  const attributs = candidat
    ? candidat.imageUrl
      ? { ...candidat.attributes, [COVER_IMAGE_ATTRIBUTE_KEY]: candidat.imageUrl }
      : candidat.attributes
    : {}

  const couvertureUrl = coverImageUrlFrom(attributs)
  const teinte = useTeinteJaquette(couvertureUrl)
  const ongoing = isSeriesOngoing(attributs)
  const startYear = typeof attributs.startYear === 'string' ? attributs.startYear : null
  const endYear = typeof attributs.endYear === 'string' ? attributs.endYear : null

  const proposition = usePropositionTomes({
    entityTypeId,
    titre,
    attributs,
    actif: entityTypeId !== '' && titre !== '' && !estInvite,
    // As long as the search has not answered, `attributs` is empty: adding
    // now would create a work without a cover or author.
    attributsEnCours: !candidatRecu && rechercheQuery.isLoading,
    // The first added volume creates the detail page: we leave the preview for it,
    // replacing the history entry - going back must bring the user
    // to the search, not to a preview of a work that is now owned.
    // The back link travels to the detail page: after an add, "Recherche" must
    // still reopen the search as it was left.
    onAjoute: (id) => navigate(`/entity/${id}`, { replace: true, state: { retour } }),
  })

  if (entityTypeId === '' || titre === '') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-textDim">Aucune œuvre à afficher.</p>
        <Link to={retour.to} className="w-fit text-sm font-semibold text-accentText">
          Retour au catalogue
        </Link>
      </div>
    )
  }

  return (
    <>
      <Link
        to={retour.to}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim hover:text-textPrimary"
      >
        <ArrowLeft size={15} />
        {retour.libelle}
      </Link>

      <FicheHero
        colleEnHaut={false}
        teinte={teinte}
        kicker={type?.label ?? null}
        titre={titre}
        auteur={creatorFrom(attributs)}
        statut={
          ongoing === null
            ? null
            : ongoing
              ? { libelle: 'En cours', couleur: 'var(--color-warning)' }
              : { libelle: 'Terminée', couleur: 'var(--color-ok)' }
        }
        annees={startYear ? (endYear ? `${startYear} → ${endYear}` : ongoing ? `Depuis ${startYear}` : startYear) : null}
        couvertureUrl={couvertureUrl}
        repliCouverture={
          <div className="absolute inset-0" style={{ background: gradientFor(titre) }} aria-hidden="true" />
        }
        editions={proposition.cartesEditions}
      />

      {rechercheQuery.isError && <ErrorBanner message={rechercheQuery.error.message} />}

      {/* Say that this work is not yet one's own, rather than letting the
          absence of progress suggest it. */}
      <p className="pt-4 text-sm text-textDim">
        {estInvite
          ? "Cette œuvre n'est pas encore dans le catalogue. Voici ce qu'en dit la source."
          : parTome
            ? "Cette œuvre n'est pas encore dans ta collection — coche les tomes que tu possèdes pour l'y ajouter."
            : "Cette œuvre n'est pas encore dans ta collection."}
      </p>

      {proposition.section}

      <div className="pt-6">
        <InspecteurFiche
          teinte={teinte}
          personnel={
            estInvite ? undefined : (
              <p className="text-[13.5px] text-faint">
                Classement, note, lectures et tags apparaîtront ici une fois l'œuvre dans ta collection.
              </p>
            )
          }
          oeuvre={
            <div className="flex flex-col">
              {creatorFrom(attributs) && (
                <RangeeInspecteur libelle={type?.code === 'MANGA' ? 'Mangaka' : 'Auteur'}>
                  {creatorFrom(attributs)}
                </RangeeInspecteur>
              )}
              {ongoing !== null && (
                <RangeeInspecteur libelle="Statut">{ongoing ? 'En cours' : 'Terminée'}</RangeeInspecteur>
              )}
              {startYear && <RangeeInspecteur libelle="Année de début">{startYear}</RangeeInspecteur>}
            </div>
          }
          source={<ColonneSource attributs={attributs} />}
        />
      </div>
    </>
  )
}
