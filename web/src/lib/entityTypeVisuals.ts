import { Book, Disc3, Film, Gamepad2, Grip, Layers, Library, Music, Popcorn, Shirt, Sparkles, Trophy, type LucideIcon } from 'lucide-react'
import type { EntityTypeDto } from '../types/api'

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

/**
 * Palette proposée au choix pour un type créé par l'utilisateur. Fermée, et
 * pas un sélecteur libre de teinte : une couleur d'univers sert aussi de TEXTE
 * ("Tout voir" d'une ligne de Ma collection, titre de la page catégorie), donc
 * chaque entrée est calibrée pour tenir 4.5:1 sur les trois fonds de chaque
 * thème (voir index.css). Une teinte choisie à l'œil serait illisible dans un
 * thème sur deux - c'est exactement ce que le Lot 12 a eu à corriger.
 */
export const UNIVERSE_PALETTE = [
  { key: 'terracotta', label: 'Terracotta' },
  { key: 'indigo', label: 'Indigo' },
  { key: 'foret', label: 'Forêt' },
  { key: 'ambre', label: 'Ambre' },
  { key: 'violet', label: 'Violet' },
  { key: 'rose', label: 'Rose' },
  { key: 'cyan', label: 'Cyan' },
  { key: 'ardoise', label: 'Ardoise' },
] as const

export type UniverseColorKey = (typeof UNIVERSE_PALETTE)[number]['key']

/** Les 4 premières clés réutilisent les tokens des univers livrés : un type
 * personnalisé "Terracotta" est exactement de la couleur de Manga, plutôt
 * qu'un second terracotta légèrement différent. */
const COLOR_TOKENS: Record<string, { color: string; tint: string }> = {
  terracotta: { color: 'var(--color-universeManga)', tint: 'var(--color-universeMangaTint)' },
  indigo: { color: 'var(--color-universeVideoGame)', tint: 'var(--color-universeVideoGameTint)' },
  foret: { color: 'var(--color-universeBoardGame)', tint: 'var(--color-universeBoardGameTint)' },
  ambre: { color: 'var(--color-universeBook)', tint: 'var(--color-universeBookTint)' },
  violet: { color: 'var(--color-universeViolet)', tint: 'var(--color-universeVioletTint)' },
  rose: { color: 'var(--color-universeRose)', tint: 'var(--color-universeRoseTint)' },
  cyan: { color: 'var(--color-universeCyan)', tint: 'var(--color-universeCyanTint)' },
  ardoise: { color: 'var(--color-universeArdoise)', tint: 'var(--color-universeArdoiseTint)' },
}

/** Jeu d'icônes proposé - fermé lui aussi : une icône est un composant importé,
 * pas une chaîne, donc rien ne peut être rendu hors de cette liste. */
export const UNIVERSE_ICONS = [
  { key: 'library', label: 'Bibliothèque', icon: Library },
  { key: 'book', label: 'Livre', icon: Book },
  { key: 'layers', label: 'Boîtier', icon: Layers },
  { key: 'grip', label: 'Plateau', icon: Grip },
  { key: 'gamepad', label: 'Manette', icon: Gamepad2 },
  { key: 'disc', label: 'Disque', icon: Disc3 },
  { key: 'music', label: 'Musique', icon: Music },
  { key: 'film', label: 'Film', icon: Film },
  { key: 'popcorn', label: 'Cinéma', icon: Popcorn },
  { key: 'shirt', label: 'Textile', icon: Shirt },
  { key: 'trophy', label: 'Trophée', icon: Trophy },
  { key: 'sparkles', label: 'Divers', icon: Sparkles },
] as const

export type UniverseIconKey = (typeof UNIVERSE_ICONS)[number]['key']

/** Variable CSS d'une teinte de la palette - pour dessiner les pastilles de
 * choix dans le formulaire de type, sans passer par un faux EntityType. */
export function colorVarFor(key: string): string {
  return COLOR_TOKENS[key]?.color ?? FALLBACK.color
}

const ICONS: Record<string, LucideIcon> = Object.fromEntries(UNIVERSE_ICONS.map((i) => [i.key, i.icon]))

/** Couleurs/icônes des univers livrés - teintes de la maquette V1.2 (const
 * UNIVERSE), clé sur `EntityType.code` (voir backend) plutôt que sur un id
 * arbitraire. "Livre" inclus par anticipation (présent dans la maquette) même
 * si ce type n'existe pas encore réellement dans cette instance.
 *
 * Valeurs déléguées à des tokens CSS (voir index.css) plutôt qu'écrites en
 * dur : ces couleurs ne servent pas qu'à des pastilles décoratives, elles sont
 * aussi du TEXTE - les valeurs de la maquette, calibrées pour un fond clair,
 * tombaient à 4.23:1 (manga) et 3.06:1 (jeu vidéo) sur le fond sombre. La
 * teinte reste celle de la maquette dans les deux thèmes, seule la luminosité
 * s'adapte. */
const BY_CODE: Record<string, EntityTypeVisual> = {
  MANGA: { ...COLOR_TOKENS.terracotta, icon: Library, aspectClassName: 'aspect-[2/3]' },
  VIDEO_GAME: { ...COLOR_TOKENS.indigo, icon: Layers, aspectClassName: 'aspect-[3/4]' },
  BOARD_GAME: { ...COLOR_TOKENS.foret, icon: Grip, aspectClassName: 'aspect-square' },
  BOOK: { ...COLOR_TOKENS.ambre, icon: Book, aspectClassName: 'aspect-[2/3]' },
}

/**
 * Visuel d'un type. L'identité CHOISIE par l'utilisateur (colorKey/iconKey,
 * voir EntityType côté backend) gagne sur tout le reste - y compris pour les
 * types livrés, dont elle peut donc changer la couleur ; sinon le visuel
 * historique du code connu ; sinon le repli.
 *
 * Accepte un simple code (appelants qui n'ont que ça sous la main) ou le type
 * entier, seul porteur des clés choisies.
 */
export function getEntityTypeVisual(type: EntityTypeDto | string | undefined): EntityTypeVisual {
  const code = typeof type === 'string' ? type : type?.code
  const base = (code && BY_CODE[code]) || FALLBACK
  if (typeof type === 'string' || !type) {
    return base
  }
  const chosenColor = type.colorKey ? COLOR_TOKENS[type.colorKey] : undefined
  const chosenIcon = type.iconKey ? ICONS[type.iconKey] : undefined
  // Une clé inconnue (palette élargie ailleurs, donnée saisie à la main) ne
  // casse rien : on retombe simplement sur le visuel de base.
  return {
    ...base,
    ...(chosenColor ?? {}),
    ...(chosenIcon ? { icon: chosenIcon } : {}),
  }
}
