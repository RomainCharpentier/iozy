import { coverImageUrlFrom } from '@/common/lib/coverImage'
import { GrilleVolumes, type FiltreVolumes, type VolumeAffiche } from './GrilleVolumes'
import type { TomeTile } from './tomeTiles'

export type { FiltreVolumes as FiltreTomes }

/**
 * "Mes tomes" on the detail page: the common grid in browse mode (see
 * components/GrilleVolumes), preceded by the name of the edition being looked at when there
 * are several.
 *
 * <h2>What this adapter does, and nothing more</h2>
 * It translates `TomeTile` - the catalog shape, with its three states
 * (owned, cataloged missing, purely deduced) - into the `VolumeAffiche`
 * that the grid understands. That is all: the layout, the filters, the
 * measures and the hover actions live in the common component, shared
 * with the add screen.
 *
 * <p>The distinction "cataloged missing" / "purely deduced" does not survive
 * the translation, and this is intended: it changes nothing about what one SEES
 * (both are holes in the collection). It keeps existing where
 * it matters, when acting on the volume - a cataloged volume is attached,
 * a deduced volume must first be created (see AddVolumeSection).
 */
export function GrilleTomes({
  titre,
  plusieursEditions,
  filtre,
  onFiltre,
  tuiles,
  onChoisirTome,
  onRetirerTome,
  onJeLAi,
  tomesVoulus,
  onBasculerEnvie,
  modeEdition,
  onAjouterTome,
  consultation = false,
}: {
  titre: string
  /** True when the work has more than one edition. This is the only case where one
   *  must say again which one this grid shows: with a single edition, its
   *  card just above has already said it, and repeating it only pushes away the
   *  first cover. */
  plusieursEditions: boolean
  filtre: FiltreVolumes
  onFiltre: (filtre: FiltreVolumes) => void
  tuiles: TomeTile[]
  onChoisirTome: (numero: number) => void
  /** Remove an owned volume - the grid only calls it on the second gesture
   *  (see GrilleVolumes), never on a simple tap. */
  onRetirerTome: (numero: number) => void
  /** "Je l'ai" - adds the volume in one click. */
  onJeLAi: (numero: number) => void
  /** The ids of the volumes of this work that are in the wishes. */
  tomesVoulus: Set<string>
  onBasculerEnvie: (numero: number) => void
  modeEdition: boolean
  onAjouterTome: () => void
  /** A visitor: the volumes of the edition, without any personal state or
   *  gesture (see GrilleVolumes, mode `consultation`). */
  consultation?: boolean
}) {
  // The key is the number: a detail page grid only shows ONE edition at a
  // time, so the number is already unique there (unlike the add screen,
  // which mixes editions - see lib/volumeKey).
  const volumes: VolumeAffiche[] = tuiles.map((tuile) => ({
    cle: String(tuile.volumeNumber),
    numero: tuile.volumeNumber,
    jaquetteUrl: tuile.variant ? coverImageUrlFrom(tuile.variant.attributes) : null,
    possede: tuile.status === 'owned',
    // A purely deduced volume has no identity, so nothing to attach
    // a wish to: it cannot be wanted until it is cataloged -
    // which is exactly what "Je le veux" triggers (see TomeResolver).
    voulu: !!tuile.variant && tomesVoulus.has(tuile.variant.id),
    // Nothing opens on click anymore: no volume is "active".
    actif: false,
  }))

  return (
    <section className="pt-5">
      <GrilleVolumes
        enTete={
          // The NAME alone, and only if there is a choice. Progress used to live
          // here too; it is already on the edition card, gauge included.
          plusieursEditions ? (
            <h2 className="min-w-0 truncate font-display text-[14px] font-medium tracking-[-0.01em] text-textPrimary">
              {titre}
            </h2>
          ) : undefined
        }
        volumes={volumes}
        mode={consultation ? 'consultation' : 'navigation'}
        filtre={filtre}
        onFiltre={onFiltre}
        onActiver={(cle) => onChoisirTome(Number(cle))}
        onRetirer={(cle) => onRetirerTome(Number(cle))}
        // Both gestures now act in place: since adding no longer
        // asks for a condition or price, "Je l'ai" has no more reason to open a
        // panel than "Je le veux".
        onJeLAi={(cle) => onJeLAi(Number(cle))}
        onJeLeVeux={(cle) => onBasculerEnvie(Number(cle))}
        action={modeEdition ? { libelle: 'Ajouter un tome', onClick: onAjouterTome } : undefined}
      />
    </section>
  )
}
