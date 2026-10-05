import { Book, Disc3, Film, Gamepad2, Grip, Layers, Library, Music, Popcorn, Shirt, Sparkles, Trophy, type LucideIcon } from 'lucide-react'
import type { EntityTypeDto } from '@/common/types/api'

export interface EntityTypeVisual {
  color: string
  tint: string
  icon: LucideIcon
  /** Cover ratio for this type - see IozyCore DS v1.1/v1.2 (UNIVERSE):
   * manga/books keep the classic pocket format, video games lean toward a
   * wider portrait (box covers), board games are square (boxes). */
  aspectClassName: string
}

const FALLBACK: EntityTypeVisual = {
  color: 'var(--color-accent)',
  tint: 'var(--color-accentTint)',
  icon: Library,
  aspectClassName: 'aspect-[2/3]',
}

/**
 * Palette offered as a choice for a type created by the user. Closed, and
 * not a free color picker: a universe color is also used as TEXT
 * ("Tout voir" of a row in Ma collection, title of the category page), so
 * each entry is calibrated to hold 4.5:1 on the three backgrounds of each
 * theme (see index.css). A shade chosen by eye would be unreadable in every
 * other theme - this is exactly what Batch 12 had to fix.
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

/** The first 4 keys reuse the tokens of the shipped universes: a custom
 * "Terracotta" type has exactly the color of Manga, rather than a second,
 * slightly different terracotta. */
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

/** Set of icons offered - closed too: an icon is an imported component,
 * not a string, so nothing can be rendered outside this list. */
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

/**
 * Cover formats offered. Closed like the rest: these are Tailwind classes
 * written in full, the only form the compiler knows how to extract - a class
 * built dynamically (`aspect-[${ratio}]`) would simply not exist in the
 * produced CSS.
 */
export const UNIVERSE_ASPECTS = [
  { key: 'portrait', label: 'Portrait', className: 'aspect-[2/3]', hint: 'Livres, mangas' },
  { key: 'boitier', label: 'Boîtier', className: 'aspect-[3/4]', hint: 'Jeux vidéo' },
  { key: 'carre', label: 'Carré', className: 'aspect-square', hint: 'Vinyles, jeux de société' },
  { key: 'paysage', label: 'Paysage', className: 'aspect-[16/9]', hint: 'Affiches, écrans' },
] as const

export type UniverseAspectKey = (typeof UNIVERSE_ASPECTS)[number]['key']

const ASPECTS: Record<string, string> = Object.fromEntries(UNIVERSE_ASPECTS.map((a) => [a.key, a.className]))

/** CSS variable of a palette shade - to draw the choice dots in the type
 * form, without going through a fake EntityType. */
export function colorVarFor(key: string): string {
  return COLOR_TOKENS[key]?.color ?? FALLBACK.color
}

const ICONS: Record<string, LucideIcon> = Object.fromEntries(UNIVERSE_ICONS.map((i) => [i.key, i.icon]))

/** Colors/icons of the shipped universes - shades of the V1.2 mockup (const
 * UNIVERSE), keyed on `EntityType.code` (see backend) rather than on an
 * arbitrary id. "Livre" included in advance (present in the mockup) even
 * if this type does not really exist yet in this instance.
 *
 * Values delegated to CSS tokens (see index.css) rather than written in
 * full: these colors are not only used for decorative dots, they are also
 * TEXT - the values of the mockup, calibrated for a light background,
 * dropped to 4.23:1 (manga) and 3.06:1 (video game) on the dark background.
 * The shade stays the one of the mockup in both themes, only the brightness
 * adapts. */
const BY_CODE: Record<string, EntityTypeVisual> = {
  MANGA: { ...COLOR_TOKENS.terracotta, icon: Library, aspectClassName: 'aspect-[2/3]' },
  VIDEO_GAME: { ...COLOR_TOKENS.indigo, icon: Layers, aspectClassName: 'aspect-[3/4]' },
  BOARD_GAME: { ...COLOR_TOKENS.foret, icon: Grip, aspectClassName: 'aspect-square' },
  BOOK: { ...COLOR_TOKENS.ambre, icon: Book, aspectClassName: 'aspect-[2/3]' },
}

/**
 * Visual of a type. The identity CHOSEN by the user (colorKey/iconKey,
 * see EntityType on the backend side) wins over everything else - including
 * for the shipped types, whose color it can therefore change; otherwise the
 * historical visual of the known code; otherwise the fallback.
 *
 * Accepts a simple code (callers that only have that at hand) or the whole
 * type, the only carrier of the chosen keys.
 */
export function getEntityTypeVisual(type: EntityTypeDto | string | undefined): EntityTypeVisual {
  const code = typeof type === 'string' ? type : type?.code
  const base = (code && BY_CODE[code]) || FALLBACK
  if (typeof type === 'string' || !type) {
    return base
  }
  const chosenColor = type.colorKey ? COLOR_TOKENS[type.colorKey] : undefined
  const chosenIcon = type.iconKey ? ICONS[type.iconKey] : undefined
  const chosenAspect = type.aspectKey ? ASPECTS[type.aspectKey] : undefined
  // An unknown key (palette extended elsewhere, data entered by hand) does
  // not break anything: we simply fall back on the base visual.
  return {
    ...base,
    ...(chosenColor ?? {}),
    ...(chosenIcon ? { icon: chosenIcon } : {}),
    ...(chosenAspect ? { aspectClassName: chosenAspect } : {}),
  }
}
