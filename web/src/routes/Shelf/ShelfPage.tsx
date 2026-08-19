import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Download, ImagePlus, MoreHorizontal, SlidersHorizontal, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { mergeVariantAttributes, searchEntities } from '../../api/entities'
import { searchVolumes } from '../../api/metadata'
import { listAllOwnerships } from '../../api/ownerships'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CategorySection } from './CategorySection'
import { CollectionFilters, type CompletionFilter } from './CollectionFilters'
import { findBestCoverMatch, variantsMissingCover } from './backfillCovers'
import { groupByEntityType, matchesCompletionFilter } from './shelfTiles'
import { isOwned, ownedVariantIds } from './ownership'
import { useModalA11y } from '../../lib/useModalA11y'
import type { EntityResponse, EntityTypeDto, OwnershipResponse } from '../../types/api'

// Référence stable pour le fallback "pas encore chargé" - un `[]` inline
// serait recréé à chaque render et invaliderait la mémoïsation.
const EMPTY_ENTITIES: EntityResponse[] = []
const EMPTY_ENTITY_TYPES: EntityTypeDto[] = []
const EMPTY_OWNERSHIPS: OwnershipResponse[] = []

/**
 * Structure V1.2 (voir docs/DESIGN_MIGRATION_V1.2.md, Lot 3) : une ligne par
 * catégorie possédée (voir CategorySection) plutôt qu'une grille unique
 * filtrée par chips Tout/Manga/Jeu vidéo/Jeu de société - la répartition
 * par type est maintenant structurelle, plus besoin de choisir un filtre
 * pour la voir. Le filtre "Par tome" (grille à plat, un tome = une tuile)
 * n'a pas d'équivalent dans cette structure en rails (chaque rail montre
 * des SÉRIES, jamais des tomes individuels) et n'apparaît nulle part dans
 * la maquette V1.2 - retiré de cet écran (différence documentée, voir
 * docs/DESIGN_MIGRATION_V1.2.md). Rien n'est perdu côté modèle/données : le
 * suivi tome par tome (Ownership individuelle) reste entier, seul CE mode
 * de navigation disparaît ; récupérable depuis l'historique git si un
 * besoin réel le justifie ailleurs.
 */
export function ShelfPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [status, setStatus] = useState<CompletionFilter>('ALL')
  const [hubMenuOpen, setHubMenuOpen] = useState(false)
  // Escape + piège de focus + focus rendu au déclencheur - voir
  // useModalA11y (Lot 9).
  const hubMenuRef = useModalA11y<HTMLDivElement>(hubMenuOpen, () => setHubMenuOpen(false))

  const entitiesQuery = useQuery({
    queryKey: queryKeys.entities.search({}),
    queryFn: () => searchEntities({}),
  })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const ownershipsQuery = useQuery({
    queryKey: queryKeys.allOwnerships,
    queryFn: listAllOwnerships,
  })

  const allEntities = entitiesQuery.data ?? EMPTY_ENTITIES
  const entityTypes = entityTypesQuery.data ?? EMPTY_ENTITY_TYPES
  const ownerships = ownershipsQuery.data ?? EMPTY_OWNERSHIPS
  const owned = useMemo(() => ownedVariantIds(ownerships), [ownerships])

  // "Ma collection" montre ce qui est réellement possédé - une série
  // entièrement cataloguée mais dont plus aucun exemplaire n'est possédé
  // (tout revendu) n'y a pas sa place, voir isOwned.
  const entities = useMemo(
    () =>
      allEntities.filter((e) => isOwned(e, ownerships, owned) && matchesCompletionFilter(e, owned, status)),
    [allEntities, ownerships, owned, status],
  )

  const sections = useMemo(() => groupByEntityType(entities, entityTypes, owned), [entities, entityTypes, owned])

  // "Retrouver les jaquettes manquantes" - déplacé dans le menu "Plus
  // d'outils" (voir hubMenuOpen ci-dessous), l'action elle-même est
  // inchangée (voir backfillCovers.ts et son commentaire d'origine).
  const mangaType = entityTypes.find((t) => t.code === 'MANGA')
  const entitiesMissingCovers = useMemo(
    () => (mangaType ? entities.filter((e) => e.entityTypeId === mangaType.id && variantsMissingCover(e).length > 0) : []),
    [entities, mangaType],
  )
  const [backfill, setBackfill] = useState<
    { running: boolean; processed: number; total: number; found: number; quotaExceeded: boolean } | null
  >(null)

  async function backfillMissingCovers() {
    if (!mangaType || entitiesMissingCovers.length === 0) return
    setHubMenuOpen(false)
    setBackfill({ running: true, processed: 0, total: entitiesMissingCovers.length, found: 0, quotaExceeded: false })
    let found = 0
    let quotaExceeded = false

    // Séquentiel, jamais Promise.all : chaque série coûte potentiellement un
    // vrai appel Google Books (cache manquant), un lot en parallèle risquerait
    // de vider le quota d'un coup plutôt que de s'arrêter proprement dessus.
    for (let i = 0; i < entitiesMissingCovers.length; i++) {
      const entity = entitiesMissingCovers[i]
      const author = typeof entity.attributes.mangaka === 'string' ? entity.attributes.mangaka : undefined
      try {
        let response = await searchVolumes(mangaType.id, entity.title, { author })
        if (response.quotaExceeded) {
          quotaExceeded = true
          break
        }
        const missingVariants = variantsMissingCover(entity)
        const stillUnmatched = missingVariants.some((v) => !findBestCoverMatch(response.volumes, v)?.imageUrl)
        if (stillUnmatched) {
          response = await searchVolumes(mangaType.id, entity.title, { author, forceRefresh: true })
          if (response.quotaExceeded) {
            quotaExceeded = true
            break
          }
        }
        for (const variant of missingVariants) {
          const match = findBestCoverMatch(response.volumes, variant)
          if (match?.imageUrl) {
            await mergeVariantAttributes(entity.id, variant.id, { coverImageUrl: match.imageUrl })
            found++
          }
        }
      } catch {
        // Best-effort par nature (voir VolumeSelectionGrid) - une série en échec
        // ne doit jamais bloquer les suivantes, elle reste juste sans jaquette.
      }
      setBackfill({ running: true, processed: i + 1, total: entitiesMissingCovers.length, found, quotaExceeded })
    }

    setBackfill({ running: false, processed: entitiesMissingCovers.length, total: entitiesMissingCovers.length, found, quotaExceeded })
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  }

  const addedThisMonthCount = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    return ownerships.filter((o) => o.status === 'OWNED' && o.acquiredAt.startsWith(currentMonth)).length
  }, [ownerships])

  const isLoading = entitiesQuery.isLoading || ownershipsQuery.isLoading
  const totalOwned = entities.length

  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Ma collection</h1>
      <p className="mt-1.5 text-sm text-textDim">
        {totalOwned} titre{totalOwned > 1 ? 's' : ''} possédé{totalOwned > 1 ? 's' : ''}
        {addedThisMonthCount > 0 && ` · ${addedThisMonthCount} ajout${addedThisMonthCount > 1 ? 's' : ''} ce mois`}
      </p>

      {/* Toolbar calme : une seule entrée Filtres (badge si actif), deux
          raccourcis visibles, le reste dans "Plus d'outils" (voir la
          maquette V1.2 - "la bibliothèque reste dominante, la toolbar reste
          calme"). */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-expanded={filtersOpen}
          className={`flex min-h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
            status !== 'ALL' ? 'border-transparent bg-accentTint text-accentText' : 'border-fieldBorder text-textDim hover:bg-rowHover'
          }`}
        >
          <SlidersHorizontal size={15} />
          Filtres
          {status !== 'ALL' && (
            <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accentText">
              1
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/stats')}
          className="flex min-h-10 items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
        >
          <BarChart3 size={15} />
          Valeur
        </button>
        <button
          type="button"
          onClick={() => navigate('/import-bgg')}
          className="flex min-h-10 items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
        >
          <Download size={15} />
          Import
        </button>
        <button
          type="button"
          onClick={() => setHubMenuOpen(true)}
          title="Plus d'outils"
          aria-expanded={hubMenuOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-fieldBorder text-textDim transition-colors hover:bg-rowHover"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {backfill && !backfill.running && (
        <p className="mt-2 text-xs text-textDim">
          {backfill.found > 0
            ? `${backfill.found} jaquette${backfill.found > 1 ? 's' : ''} retrouvée${backfill.found > 1 ? 's' : ''}.`
            : 'Aucune jaquette retrouvée cette fois.'}
          {backfill.quotaExceeded &&
            ` Quota Google Books dépassé - ${backfill.processed}/${backfill.total} séries traitées, réessaie plus tard pour les autres.`}
        </p>
      )}

      {entitiesQuery.isError && <ErrorBanner message={entitiesQuery.error.message} />}
      {ownershipsQuery.isError && <ErrorBanner message={ownershipsQuery.error.message} />}

      {isLoading && <p className="mt-6 text-textDim">Chargement...</p>}

      {!isLoading && entitiesQuery.isSuccess && sections.length === 0 && (
        <div className="mt-6 rounded-2xl border border-surface2 bg-surface p-6">
          <p className="font-display text-base font-semibold text-textPrimary">
            {status !== 'ALL' ? 'Aucune série ne correspond à ces filtres.' : 'Rien ici pour l\'instant.'}
          </p>
          <p className="mt-1 text-sm text-textDim">
            {status !== 'ALL'
              ? ''
              : 'Utilise l\'onglet "Rechercher" pour commencer ta collection.'}
          </p>
          {status !== 'ALL' && (
            <button type="button" onClick={() => setStatus('ALL')} className="mt-3 w-fit text-sm font-semibold text-accentText">
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {sections.map(({ entityType, tiles }) => (
          <CategorySection key={entityType.id} entityType={entityType} tiles={tiles} />
        ))}
      </div>

      <CollectionFilters open={filtersOpen} onClose={() => setFiltersOpen(false)} status={status} onStatusChange={setStatus} />

      {hubMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:bg-transparent" onClick={() => setHubMenuOpen(false)} />
          <div
            ref={hubMenuRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-menu-title"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-token-elevated md:inset-x-auto md:top-32 md:left-[max(12px,calc((100%-min(100%-48px,1600px))/2))] md:bottom-auto md:w-[280px] md:rounded-2xl md:border md:border-surface2 md:p-2"
          >
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <span id="hub-menu-title" className="font-display text-sm font-semibold text-textPrimary">
                Outils de ma collection
              </span>
              <button
                type="button"
                onClick={() => setHubMenuOpen(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full text-textDim hover:bg-rowHover"
              >
                <X size={16} />
              </button>
            </div>
            <button
              type="button"
              onClick={backfillMissingCovers}
              disabled={entitiesMissingCovers.length === 0 || backfill?.running}
              className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-textPrimary transition-colors hover:bg-rowHover disabled:opacity-40"
            >
              <ImagePlus size={17} />
              Retrouver les jaquettes manquantes
              {entitiesMissingCovers.length > 0 && (
                <span className="ml-auto text-xs font-normal text-textDim">{entitiesMissingCovers.length}</span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
