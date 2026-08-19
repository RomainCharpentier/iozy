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

/** Couleurs/icônes par univers de contenu - valeurs exactes de la maquette
 * V1.2 (const UNIVERSE), clé sur `EntityType.code` (voir backend) plutôt que
 * sur un id arbitraire : ces 3 codes sont les seuls réellement utilisés
 * aujourd'hui (voir DiscoverySection.tsx qui fait la même vérification).
 * Fixe (pas de variante par thème, contrairement à `accent`) - une identité
 * de catégorie stable plutôt qu'un token d'interaction. "Livre" inclus par
 * anticipation (présent dans la maquette) même si ce type n'existe pas
 * encore réellement dans cette instance - voir getEntityTypeVisual, qui
 * retombe sur FALLBACK pour tout code non reconnu (jamais une erreur pour
 * un type créé plus tard via Administration > Types de collection). */
const BY_CODE: Record<string, EntityTypeVisual> = {
  MANGA: { color: '#c05a3c', tint: 'rgba(192,90,60,.12)', icon: Library, aspectClassName: 'aspect-[2/3]' },
  VIDEO_GAME: { color: '#4f5f9c', tint: 'rgba(79,95,156,.12)', icon: Layers, aspectClassName: 'aspect-[3/4]' },
  BOARD_GAME: { color: '#3f7a63', tint: 'rgba(63,122,99,.12)', icon: Grip, aspectClassName: 'aspect-square' },
  BOOK: { color: '#a3782f', tint: 'rgba(163,120,47,.12)', icon: Book, aspectClassName: 'aspect-[2/3]' },
}

export function getEntityTypeVisual(code: string | undefined): EntityTypeVisual {
  return (code && BY_CODE[code]) || FALLBACK
}
