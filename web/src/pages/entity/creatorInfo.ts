/**
 * "Author/creator" line of a detail page or of an add confirmation - a single
 * concept displayed differently depending on the type (see the "UX vision" provided by
 * the user: each type has its own essential metadata, never
 * the same fields forced everywhere). `mangaka` (Manga, Jikan/MyAnimeList) and
 * `studio` (Video game, IGDB - see IgdbMetadataProvider on the backend side) are
 * already real attributes today, and so is `designers` for Board game since
 * the BGG details are asked when a game is added (batch 160).
 */
export function creatorFrom(attributes: Record<string, unknown> | undefined): string | null {
  const mangaka = attributes?.mangaka
  if (typeof mangaka === 'string' && mangaka.length > 0) return mangaka
  const studio = attributes?.studio
  if (typeof studio === 'string' && studio.length > 0) return studio
  // A board game's designers, from BGG (batch 160).
  const designers = attributes?.designers
  if (typeof designers === 'string' && designers.length > 0) return designers
  return null
}
