import { useCallback, useMemo } from 'react'
import { consolesDeLOeuvre, nomDeConsole } from '@/common/lib/consoles'
import type { FiltreCollection } from '@/common/lib/preferencesCollection'
import type { EntityResponse } from '@/common/types/api'
import type { ObjetSalle } from './SalleCollection'
import { dosDeLOeuvre, pisteDeLOeuvre, tomesManquants } from './salles'
import { buildShelfTile, editionRepresentative, etatDeLOeuvre } from './shelfTiles'
import type { useDonneesCollection } from './useDonneesCollection'

/** What the copies say; without any, a work that only exists on one console has no doubt left. */
function consolesPour(entity: EntityResponse, desExemplaires: Set<string> | undefined): string[] {
  if (desExemplaires && desExemplaires.size > 0) return [...desExemplaires]
  const connues = consolesDeLOeuvre(entity.attributes)
  return connues.length === 1 ? [nomDeConsole(connues[0])] : []
}

/**
 * How a work stands on a shelf, the same in a room of My collection and on the
 * shelf page of its category: both read this, so they cannot start to differ.
 */
export function useObjetsCollection(donnees: ReturnType<typeof useDonneesCollection>, filtre: FiltreCollection) {
  const { entities, ownerships, progression, owned, oeuvresVoulues, oeuvresSuivies, tomesVoulus } = donnees

  // The state of each work, computed once: the counters of the bar and the
  // displayed list all read it, instead of deriving it again each.
  const etats = useMemo(
    () => new Map(entities.map((e) => [e.id, etatDeLOeuvre(e, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies)])),
    [entities, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies],
  )

  /** The volumes each work lacks: "À compléter" keeps them and starts with the shortest list. */
  const manquants = useMemo(
    () => new Map(entities.map((e) => [e.id, tomesManquants(editionRepresentative(e, progression)).length])),
    [entities, progression],
  )

  /** The consoles said on the copies of each work. */
  const consolesDesExemplaires = useMemo(() => {
    const parOeuvre = new Map<string, Set<string>>()
    for (const o of ownerships) {
      if (o.status !== 'OWNED' || !o.platform) continue
      const consoles = parOeuvre.get(o.entityId) ?? new Set<string>()
      consoles.add(nomDeConsole(o.platform))
      parOeuvre.set(o.entityId, consoles)
    }
    return parOeuvre
  }, [ownerships])

  const objetDe = useCallback(
    (entity: EntityResponse): ObjetSalle => {
      const etat = etats.get(entity.id)
      const edition = editionRepresentative(entity, progression)
      const tomesVoulusIci =
        entity.variants.filter((v) => tomesVoulus.has(v.id)).length + (oeuvresVoulues.has(entity.id) ? 1 : 0)
      return {
        tuile: buildShelfTile(entity, progression, {
          possede: etat?.possede ?? false,
          suivi: etat?.suivi ?? false,
          tomesVoulus: tomesVoulusIci,
          prioritaire: filtre === 'envies',
        }),
        envie: !etat?.possede && Boolean(etat?.voulu),
        aDesTomes: entity.variants.length > 0,
        dosPour: (dosMax) => dosDeLOeuvre(entity, edition, tomesVoulus, dosMax),
        piste: pisteDeLOeuvre(edition),
        consoles: consolesPour(entity, consolesDesExemplaires.get(entity.id)),
        editeur:
          typeof entity.attributes.publisher === 'string' && entity.attributes.publisher.trim() !== ''
            ? entity.attributes.publisher.trim()
            : null,
      }
    },
    [etats, progression, tomesVoulus, oeuvresVoulues, filtre, consolesDesExemplaires],
  )

  return { etats, manquants, objetDe }
}
