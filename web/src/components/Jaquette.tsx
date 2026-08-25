import { useState, type ReactNode } from 'react'

type Props = {
  /** L'URL de la jaquette. Absente ou vide : `repli` est rendu directement. */
  src: string | null | undefined
  /** Les classes de l'image elle-même. */
  className?: string
  /**
   * Ce qui s'affiche à la place. Chaque écran avait déjà le sien pour le cas
   * « pas de jaquette du tout » - un aplat, un numéro de tome, un titre en
   * petit. On le lui repasse tel quel : le rendu ne change pas d'un pixel,
   * seul le cas d'échec rejoint le cas d'absence.
   */
  repli: ReactNode
  loading?: 'lazy' | 'eager'
}

/**
 * Une jaquette qui a un plan B.
 *
 * <h2>Le défaut</h2>
 * Vingt et une balises `img` dans l'application, <b>une seule</b> gérait
 * `onError` (CoverTile). Partout ailleurs, une URL qui ne répond plus laissait
 * un trou : le cadre garde sa taille, rien ne s'y affiche. Mesuré sur la fiche
 * d'une œuvre, l'image la plus visible de l'application - 112 × 168 pixels de
 * vide, et le conteneur sans le moindre fond derrière.
 *
 * <p>Ce n'est pas un cas de laboratoire : ces URL pointent vers des hôtes
 * externes (Google Books, BGG). Elles cassent, changent, ou refusent d'être
 * affichées depuis un autre site - et l'application n'en sait rien tant que
 * l'image n'a pas essayé de se charger.
 *
 * <h2>Pourquoi un composant</h2>
 * Le remède tient en un `onError`, mais écrit vingt fois il serait oublié la
 * vingt et unième - c'est exactement ce qui s'est passé. Ici la règle vit à un
 * seul endroit.
 */
export function Jaquette({ src, className, repli, loading }: Props) {
  // On mémorise l'URL fautive, pas un simple booléen : sinon, corriger la
  // couverture d'une série (« Modifier la couverture ») laisserait le repli
  // affiché pour la NOUVELLE URL, qui n'a pourtant jamais échoué.
  const [urlEnEchec, setUrlEnEchec] = useState<string | null>(null)

  if (!src || src === urlEnEchec) return <>{repli}</>

  return (
    <img src={src} alt="" loading={loading} onError={() => setUrlEnEchec(src)} className={className} />
  )
}
