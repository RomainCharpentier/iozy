import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useEffect, useRef, type RefObject } from 'react'
import { queryKeys } from '@/common/lib/queryKeys'
import { naviguerAvecVol } from '@/common/lib/volJaquette'
import type { EntityResponse } from '@/common/types/api'
import { installerLesObjets } from './mouvement'

/** The screens already seen in this visit: coming back to one is not an arrival. */
const dejaVus = new Set<string>()

/**
 * The way between a shelf and a detail page, the same from a room and from a shelf
 * page: the cover flies there and back, and coming back finds the scroll again.
 */
export function useOuvrirOeuvre({
  entities,
  retour,
  zone,
  pret,
}: {
  entities: EntityResponse[]
  /** The screen the detail page goes back to, named. */
  retour: { to: string; libelle: string }
  zone: RefObject<HTMLElement | null>
  /** The works are on their shelves. */
  pret: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const typeDeNavigation = useNavigationType()
  // Set by the back link of a detail page.
  const positionDeRetour = (useLocation().state as { position?: unknown } | null)?.position

  // The objects settle on their shelves on arrival. The first load is a POP too,
  // hence the memory of this visit.
  const installe = useRef(false)
  useEffect(() => {
    if (!pret || installe.current) return
    installe.current = true
    if (typeof positionDeRetour === 'number') {
      // A shelf off screen only has an estimated height: the real ones first, or the
      // position would land elsewhere.
      const element = zone.current
      element?.classList.add('salles-en-mouvement')
      // The page still grows for a moment (its tools arrive): try until it is tall enough.
      const position = positionDeRetour
      let essais = 0
      const defiler = () => {
        window.scrollTo(0, position)
        if (Math.abs(window.scrollY - position) > 1 && ++essais < 20) window.setTimeout(defiler, 40)
      }
      defiler()
      window.setTimeout(() => element?.classList.remove('salles-en-mouvement'), 900)
    } else if (typeDeNavigation !== 'POP' || !dejaVus.has(retour.to)) installerLesObjets(zone.current)
    dejaVus.add(retour.to)
  }, [pret, positionDeRetour, typeDeNavigation, retour.to, zone])

  /** The page already holds the work: the detail page can draw its cover at once, so that the
   *  flight has somewhere to land. It still asks the server, and corrects itself if needed. */
  return (entityId: string, jaquette: HTMLElement | null) => {
    const entity = entities.find((e) => e.id === entityId)
    if (entity) {
      queryClient.setQueryData<EntityResponse>(queryKeys.entities.detail(entityId), (connue) => connue ?? entity)
    }
    naviguerAvecVol(jaquette, () =>
      navigate(`/entity/${entityId}`, {
        state: { retour: { ...retour, position: window.scrollY, depuisOeuvre: entityId } },
      }),
    )
  }
}
