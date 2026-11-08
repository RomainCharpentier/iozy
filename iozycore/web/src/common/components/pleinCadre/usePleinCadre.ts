import { createContext, useContext, useEffect } from 'react'
import type { RaisonRepli } from '@/common/lib/teinte/useTeinteJaquette'

/** What the shell shares with the pages (see PleinCadre). */
export interface EtatPleinCadre {
  url: string | null
  declarer: (url: string | null) => void
  repli: RaisonRepli | null
}

export const Contexte = createContext<EtatPleinCadre>({ url: null, declarer: () => {}, repli: null })

/**
 * Declares the cover of the moment, for as long as the calling page is on
 * screen. `null`: this page has no cover, the brand tones apply.
 */
export function usePleinCadre(url: string | null | undefined): void {
  const { declarer } = useContext(Contexte)
  const valeur = url ?? null
  useEffect(() => {
    declarer(valeur)
    return () => declarer(null)
  }, [declarer, valeur])
}

