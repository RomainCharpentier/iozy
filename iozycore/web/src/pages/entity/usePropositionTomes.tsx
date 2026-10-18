import { useState, type ReactNode } from 'react'
import { Layers, Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quickAdd } from '@/common/api/entities'
import { volumeKey } from './volumeKey'
import { useTomesProposes } from './useTomesProposes'
import { useCollecteParTome } from '@/common/lib/typeDeCollection'
import { AjoutDirect } from './AjoutDirect'
import { GrilleVolumes, type FiltreVolumes, type VolumeAffiche } from './GrilleVolumes'
import { CartesEditions } from './CartesEditions'
import { BarreAjoutTomes } from './BarreAjoutTomes'
import { AddVolumeSection } from './AddVolumeSection'
import { BoutonActualiserTomes } from './BoutonActualiserTomes'
import { useAuth } from '@/common/hooks/useAuth'
import { invaliderApresPossession } from '@/common/lib/invalidations'

/**
 * "Quels tomes possèdes-tu ?" - the volumes that a provider knows, to
 * check, and the add that brings them into the collection.
 *
 * <h2>The only place in this flow that WRITES</h2>
 * Looking at a work creates nothing: no detail page, no volume, no ownership. It is
 * the add button - and only it - that touches the database, through `quickAdd`, which
 * creates the Entity if it does not exist yet. As long as nothing is checked, everything
 * displayed comes from the metadata API.
 *
 * <h2>A hook that returns two pieces, and why</h2>
 * The edition cards live in the hero, the grid and the add live in
 * the body of the page - but both share a state (the displayed edition,
 * the selection). A hook carries it and returns the two nodes; the caller
 * places them. The first version passed the cards to the caller through a callback
 * during render, which amounts to changing the state of one component during
 * the render of another - React rightly refuses this.
 *
 * <h2>Two callers, one behavior</h2>
 * The preview of a work one does not own (see ApercuOeuvrePage) and the
 * detail page of a work that exists but has no volume yet (added to the wishes,
 * for example). Both ask the same question, with the same cards and the
 * same grid.
 *
 * <h2>And works that have no volume</h2>
 * A video game, a board game: the work IS the collectible object (see
 * lib/typeDeCollection). "Quels tomes possèdes-tu ?" means nothing there - and
 * yet this screen asked it, only to end on "Aucun tome trouvé" and a
 * single "Ajouter un tome à la main" button. A game was therefore **impossible
 * to add from the search** (seen on 2026-08-27 on Carcassonne then
 * Hollow Knight). These types now get a direct add, with no grid
 * and no edition.
 */
export function usePropositionTomes({
  entityTypeId,
  titre,
  attributs,
  entityId,
  actif,
  attributsEnCours = false,
  modeEdition = false,
  onAjoute,
}: {
  entityTypeId: string
  titre: string
  /** What the provider already gave: used as search hints, and
   *  will be copied onto the Entity at the time of the add. */
  attributs: Record<string, unknown>
  /** The id of the detail page when it already exists. Absent in preview:
   *  `quickAdd` will create the Entity by (type, title) at that moment. */
  entityId?: string
  actif: boolean
  /** The attributes are not known yet (preview whose metadata search
   *  has not answered). The add is held back: it copies them onto the
   *  Entity it creates, and a detail page without a cover or author is very
   *  painful to fix afterwards. */
  attributsEnCours?: boolean
  /** The detail page is in edit mode: this is where, and only where,
   *  "Actualiser depuis la source" shows on a detail page (see below). */
  modeEdition?: boolean
  /** Called after a successful add, with the id of the detail page - this is where
   *  the preview switches to the real detail page. */
  onAjoute?: (entityId: string) => void
}): { cartesEditions: ReactNode; section: ReactNode } {
  const queryClient = useQueryClient()
  const [editionAffichee, setEditionAffichee] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<FiltreVolumes>('tous')
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [ajoutManuelOuvert, setAjoutManuelOuvert] = useState(false)

  // No need to look for volumes for a game: it has none, and
  // the call to the provider would be empty anyway.
  const parTome = useCollecteParTome(entityTypeId)
  // Not before knowing WHOSE the work is: a short, common title
  // ("Doubt") otherwise brings back the volumes of a namesake from another publisher -
  // the BnF only has the title to decide when no author is
  // given (seen on "Doubt", a ghost "Akiko" edition next to
  // the real one, Batch 123). The preview therefore waits for its metadata search;
  // on a detail page, the attributes are there from the start and nothing waits.
  // Reloading from the source is reserved for the administrator (request of
  // 2026-09-04): the server ignores forceRefresh for the other
  // accounts anyway, no point showing them a button that would do nothing.
  // And on a DETAIL PAGE, this gesture belongs to edit mode, like everything that
  // asks the source again (user request of 2026-09-04): the grid only
  // shows it once this mode is open. In preview there is neither a detail page nor an edit
  // mode, so the button stays within reach of the administrator.
  const { compte } = useAuth()
  const peutActualiser = compte?.admin === true && (!entityId || modeEdition)
  const proposes = useTomesProposes({
    entityTypeId,
    titre,
    attributs,
    actif: actif && parTome && !attributsEnCours,
  })

  const ajout = useMutation({
    mutationFn: async () => {
      let identifiant = entityId

      // A work without volumes is added with a single call, without volumeNumber:
      // the Ownership is then attached directly to the Entity (see
      // QuickAddService).
      if (!parTome) {
        const resultat = await quickAdd({
          entityTypeId,
          title: titre,
          // `NEW` stays the stored value - it was already the default of the old
          // form - and is fixed on the copy. `condition` is
          // required in the database and has no "not filled in" value.
          condition: 'NEW',
          attributes: attributs,
        })
        return resultat.entityId
      }
      // One call per volume: `quickAdd` is already the single entry point of
      // the add, Entity and Edition deduplication included. It returns
      // the id of the detail page - created at the first volume when it
      // did not exist yet.
      for (const candidat of proposes.candidats.filter((c) => selection.has(volumeKey(c)))) {
        const resultat = await quickAdd({
          entityTypeId,
          title: titre,
          condition: 'NEW',
          attributes: attributs,
          volumeNumber: candidat.volumeNumber,
          edition: candidat.edition || undefined,
          volumeImageUrl: candidat.imageUrl ?? undefined,
        })
        identifiant = resultat.entityId
      }
      return identifiant
    },
    onSuccess: (identifiant) => {
      setSelection(new Set())
      // No condition on `entityId`: the add may have just CREATED
      // the work, in which case the progress of the whole collection also changes.
      invaliderApresPossession(queryClient)
      if (identifiant) onAjoute?.(identifiant)
    },
  })

  if (!actif) return { cartesEditions: null, section: null }

  if (!parTome) {
    return {
      cartesEditions: null,
      section: (
        <section className="flex flex-col gap-4 pt-5">
          <AjoutDirect
            onAjouter={() => ajout.mutate()}
            enCours={ajout.isPending}
            attente={attributsEnCours}
            erreur={ajout.isError ? ajout.error.message : null}
          />
        </section>
      ),
    }
  }

  const editions: string[] = []
  const parEdition = new Map<string, typeof proposes.candidats>()
  for (const candidat of proposes.candidats) {
    if (!parEdition.has(candidat.edition)) {
      editions.push(candidat.edition)
      parEdition.set(candidat.edition, [])
    }
    parEdition.get(candidat.edition)!.push(candidat)
  }
  const editionActive = editionAffichee !== null && parEdition.has(editionAffichee) ? editionAffichee : editions[0]
  const affiches = parEdition.get(editionActive) ?? []

  if (editions.length === 0) {
    return {
      cartesEditions: null,
      section: (
        <section className="flex flex-col gap-3 pt-7">
          <p className="text-sm text-textDim">
            {proposes.enCours
              ? 'Recherche des tomes disponibles...'
              : proposes.fournisseurMuet
                ? "Nos fournisseurs n'ont pas répondu pour le moment — impossible de vérifier les éditions françaises. Tu peux ajouter un tome à la main, ou réessayer plus tard."
                : 'Aucun tome trouvé pour cette œuvre chez nos fournisseurs. Tu peux les ajouter à la main.'}
          </p>
          {/* Manual entry assumes NO detail page: `quickAdd` creates it
              at the first volume (see AddVolumeSection). It was nevertheless
              conditioned on `entityId`, so that a preview with no volume found
              promised "tu peux les ajouter à la main" without offering the
              slightest button - reported on "Demon's Plan". */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAjoutManuelOuvert(true)}
              aria-expanded={ajoutManuelOuvert}
              className="flex min-h-11 w-fit items-center gap-2 rounded-[13px] bg-surface px-4 text-sm font-medium text-textPrimary shadow-token-sm"
            >
              <Plus size={15} />
              Ajouter un tome à la main
            </button>
            {/* "Réessayer plus tard" without a button to retry: the
                sentence above promised it, nothing allowed it. */}
            {peutActualiser && <BoutonActualiserTomes enCours={proposes.actualisationEnCours} onClick={proposes.actualiser} />}
          </div>
          <AddVolumeSection
            entityId={entityId}
            entityTypeId={entityTypeId}
            title={titre}
            attributes={attributs}
            ouvert={ajoutManuelOuvert}
            onFermer={() => setAjoutManuelOuvert(false)}
            onAjoute={(id) => onAjoute?.(id)}
          />
        </section>
      ),
    }
  }

  return {
    cartesEditions: (
      <CartesEditions
        editions={editions.map((nom) => ({
          nom,
          editeur: null,
          total: parEdition.get(nom)!.length,
          possedes: parEdition.get(nom)!.filter((v) => selection.has(volumeKey(v))).length,
        }))}
        editionAffichee={editionActive}
        onAfficher={setEditionAffichee}
        sensProgression="selection"
      />
    ),
    section: (
      <section className="flex flex-col gap-4 pt-5">
        {/* Volumes WERE found, but a source stayed silent: the list
            may be incomplete, and until now nothing said so - only
            the "no volume at all" case was announced. Seen on
            "Doubt", whose double edition only exists at Google Books,
            with its quota used up that day (Batch 123). */}
        {proposes.fournisseurMuet && (
          <p className="text-xs text-textDim">
            Une de nos sources n’a pas répondu : il manque peut-être des tomes ou une édition. « Actualiser depuis la
            source » la redemande.
          </p>
        )}
        {/* The server has long known how to search rare editions (integral, collector,
            double edition) - `deepSearch`, five requests
            to the provider, on demand. The button that its own
            comment described ("Chercher plus d'éditions") had
            never been placed: the capability existed without an entry point, and a
            double edition therefore stayed unfindable (Batch 123). */}
        {/* Five requests to the provider: same rule as "Actualiser"
            - administrator, and on a detail page only in edit mode. */}
        {peutActualiser && (
          <button
            type="button"
            onClick={proposes.chercherPlusEditions}
            disabled={proposes.rechercheApprofondieEnCours}
            className="flex min-h-11 w-fit items-center gap-2 rounded-[13px] bg-surface px-4 text-sm font-medium text-textPrimary shadow-token-sm disabled:opacity-50"
          >
            <Layers size={15} />
            {proposes.rechercheApprofondieEnCours ? 'Recherche…' : 'Chercher d’autres éditions'}
          </button>
        )}
        <GrilleVolumes
          enTete={
            // Same one-line header as on the detail page (see GrilleTomes):
            // both screens show the same thing, they must announce it
            // the same way.
            <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-display text-[14px] font-medium tracking-[-0.01em] text-textPrimary">
                {editionActive || 'Édition non précisée'}
              </span>
              <span className="text-[12.5px] text-faint">Quels tomes possèdes-tu ?</span>
              {/* The list comes from a cache that does not expire (see
                  useTomesProposes.actualiser): when it has holes, this is
                  where it is asked again from the source. */}
              {peutActualiser && <BoutonActualiserTomes enCours={proposes.actualisationEnCours} onClick={proposes.actualiser} />}
            </h2>
          }
          volumes={affiches.map(
            (candidat): VolumeAffiche => ({
              cle: volumeKey(candidat),
              numero: candidat.volumeNumber,
              jaquetteUrl: candidat.imageUrl,
              possede: candidat.alreadyOwned,
              actif: selection.has(volumeKey(candidat)),
            }),
          )}
          mode="selection"
          filtre={filtre}
          onFiltre={setFiltre}
          onActiver={(cle) =>
            setSelection((prev) => {
              const suivant = new Set(prev)
              if (suivant.has(cle)) suivant.delete(cle)
              else suivant.add(cle)
              return suivant
            })
          }
          videMessage="Aucun tome ne correspond à ce filtre."
        />

        <BarreAjoutTomes
          nombre={selection.size}
          enCours={ajout.isPending}
          attente={attributsEnCours}
        erreur={ajout.isError ? ajout.error.message : null}
          onToutDeselectionner={() => setSelection(new Set())}
          onAjouter={() => ajout.mutate()}
        />
      </section>
    ),
  }
}
