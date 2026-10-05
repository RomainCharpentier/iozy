/**
 * "Author/creator" line of a detail page or of an add confirmation - a single
 * concept displayed differently depending on the type (see the "UX vision" provided by
 * the user: each type has its own essential metadata, never
 * the same fields forced everywhere). `mangaka` (Manga, Jikan/MyAnimeList) and
 * `studio` (Video game, IGDB - see IgdbMetadataProvider on the backend side) are
 * already real attributes today; no equivalent attribute exists
 * yet for Board game (BggMetadataProvider returns neither author nor
 * publisher) - not added here as long as no real data would feed it
 * (see "do not anticipate too far").
 */
export function creatorFrom(attributes: Record<string, unknown> | undefined): string | null {
  const mangaka = attributes?.mangaka
  if (typeof mangaka === 'string' && mangaka.length > 0) return mangaka
  const studio = attributes?.studio
  if (typeof studio === 'string' && studio.length > 0) return studio
  return null
}
