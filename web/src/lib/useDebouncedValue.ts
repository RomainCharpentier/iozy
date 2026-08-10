import { useEffect, useState } from 'react'

/** Debounce une valeur (ex: texte de recherche). 300ms par défaut, adapté à
 * une recherche locale (RelationshipsSection, gratuite - simple requête SQL
 * sur la collection). QuickAddPage passe un délai plus long
 * (500ms) pour sa recherche de métadonnées externes (Jikan/MAL/BGG/IGDB),
 * plus coûteuse à limiter - voir le commentaire d'usage sur place. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
