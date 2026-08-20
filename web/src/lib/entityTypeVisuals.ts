import { Book, Grip, Layers, Library, type LucideIcon } from 'lucide-react'

export interface EntityTypeVisual {
  color: string
  tint: string
  icon: LucideIcon
  /** Ratio de la jaquette pour ce type - voir IozyCore DS v1.1/v1.2 (UNIVERSE) :
   * les mangas/livres restent au format poche classique, les jeux vidéo
   * penchent portrait plus large (jaquettes de boîtier), les jeux de société
   * sont carrés (boîtes). */
  aspectClassName: string
}

const FALLBACK: EntityTypeVisual = {
  color: 'var(--color-accent)',
  tint: 'var(--color-accentTint)',
  icon: Library,
  aspectClassName: 'aspect-[2/3]',
}

/** Couleurs/icônes par univers de contenu - teintes de la maquette V1.2
 * (const UNIVERSE), clé sur `EntityType.code` (voir backend) plutôt que sur
 * un id arbitraire : ces 3 codes sont les seuls réellement utilisés
 * aujourd'hui (voir DiscoverySection.tsx qui fait la même vérification).
 * "Livre" inclus par anticipation (présent dans la maquette) même si ce type
 * n'existe pas encore réellement dans cette instance - voir
 * getEntityTypeVisual, qui retombe sur FALLBACK pour tout code non reconnu
 * (jamais une erreur pour un type créé plus tard via Administration > Types
 * de collection).
 *
 * Valeurs déléguées à des tokens CSS (voir index.css) plutôt qu'écrites en
 * dur ici : ces couleurs ne servent pas qu'à des pastilles décoratives, elles
 * sont aussi du TEXTE ("Tout voir" d'une ligne de Ma collection, titre de la
 * page catégorie, icône d'univers) - les valeurs de la maquette, calibrées
 * pour un fond clair, tombaient à 4.23:1 (manga) et 3.06:1 (jeu vidéo) sur le
 * fond sombre. La teinte reste celle de la maquette dans les deux thèmes,
 * seule la luminosité s'adapte : l'identité de catégorie est préservée, sa
 * lisibilité aussi. */
const BY_CODE: Record<string, EntityTypeVisual> = {
  MANGA: { color: 'var(--color-universeManga)', tint: 'var(--color-universeMangaTint)', icon: Library, aspectClassName: 'aspect-[2/3]' },
  VIDEO_GAME: { color: 'var(--color-universeVideoGame)', tint: 'var(--color-universeVideoGameTint)', icon: Layers, aspectClassName: 'aspect-[3/4]' },
  BOARD_GAME: { color: 'var(--color-universeBoardGame)', tint: 'var(--color-universeBoardGameTint)', icon: Grip, aspectClassName: 'aspect-square' },
  BOOK: { color: 'var(--color-universeBook)', tint: 'var(--color-universeBookTint)', icon: Book, aspectClassName: 'aspect-[2/3]' },
}

export function getEntityTypeVisual(code: string | undefined): EntityTypeVisual {
  return (code && BY_CODE[code]) || FALLBACK
}
