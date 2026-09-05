import { useCallback, useRef, useState } from 'react'
import type { TierListEntryDto } from '@/common/types/tierList'

/**
 * Flux "Classer rapidement" (voir DS v1.1 §50) - enchaîne les œuvres NON
 * CLASSÉES une par une dans le même TierPicker que le board, au lieu de
 * laisser rouvrir le sélecteur à la main pour chacune. Partagé par le board
 * général et une Tier List personnalisée : seule la mutation diffère, la
 * mécanique de file est identique.
 * <p>
 * La file est un INSTANTANÉ pris au démarrage, jamais la liste vivante :
 * chaque classement invalide la requête du board, donc `unranked` rétrécit
 * sous nos pieds - s'y fier ferait sauter un élément sur deux. L'index
 * avance seul, la file ne bouge plus jusqu'à la sortie.
 */
export function useQuickRank() {
  const queueRef = useRef<TierListEntryDto[]>([])
  const [index, setIndex] = useState<number | null>(null)

  const start = useCallback((unranked: TierListEntryDto[]) => {
    if (unranked.length === 0) return
    queueRef.current = [...unranked]
    setIndex(0)
  }, [])

  const stop = useCallback(() => {
    queueRef.current = []
    setIndex(null)
  }, [])

  /** Passe à l'élément suivant, et sort de lui-même à la fin de la file -
   * "terminé" et "abandonné" se ressemblent volontairement du point de vue
   * de l'appelant : dans les deux cas il n'y a plus rien à afficher. */
  const next = useCallback(() => {
    setIndex((current) => {
      if (current === null) return null
      const following = current + 1
      if (following >= queueRef.current.length) {
        queueRef.current = []
        return null
      }
      return following
    })
  }, [])

  const isActive = index !== null
  const current = isActive ? (queueRef.current[index] ?? null) : null

  return {
    isActive,
    current,
    // 1-indexé : c'est un compteur montré à l'utilisateur ("3 / 12"), pas un index.
    progress: isActive ? { current: index + 1, total: queueRef.current.length } : null,
    start,
    stop,
    next,
  }
}
